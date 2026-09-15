

const repo = require("../data");
const flaskService = require("./flaskServices");

// ---------------------------------------------------------------------
// Generate (or regenerate) a student's skill gap report.
//
// Flow: Assessment Completed -> Load Student Skill Results ->
//       Load Required Skills -> Python Skill Gap Engine ->
//       Compare Required vs Student Skill Levels -> Calculate Skill Gap ->
//       Calculate Readiness Score -> Identify Missing Skills ->
//       Generate Skill Gap Report (persisted to gap_reports)
// ---------------------------------------------------------------------
async function generateGapReport(userId, { readinessScore } = {}) {
  // 1. Student + domain
  const user = await repo.users.findById(userId);
  

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (!user.domain_role_id) {
    const error = new Error("Student has not selected a domain role");
    error.status = 400;
    throw error;
  }

  // 2. Skills required for the domain (with required_level)
  const requiredSkills = await repo.domainRequiredSkills.findByDomainRoleId(
    user.domain_role_id
  );
  

  if (!requiredSkills.length) {
    const error = new Error("No skills configured for the selected domain");
    error.status = 404;
    throw error;
  }

  // 3. Student's most recent completed assessment
  const completedSession = await repo.quizSessions.findCompletedByUser(
    userId
  );
  
  if (!completedSession) {
    const error = new Error(
      "Student has not completed an initial assessment yet"
    );
    error.status = 404;
    throw error;
  }

  // 4. Per-skill results from that session
  const skillResults = await repo.studentSkillResults.findBySessionId(
    completedSession.session_id
  );

  // 5. Build the payload the Python engine expects
  const studentSkillsPayload = skillResults.map((r) => ({
    skill_id: r.skill_id,
    skill_name: r.skill.skill_name,
    skill_level: r.skill_level,
  }));

  const requiredSkillsPayload = requiredSkills.map((rs) => ({
    skill_id: rs.skill_id,
    skill_name: rs.skill.skill_name,
    required_level: rs.required_level,
  }));
  
  // 6. Pure Python computation — no DB awareness on that side
 let analysisResponse;

  try {

    analysisResponse =
      await flaskService.analyzeSkillGap({
        student_skills: studentSkillsPayload,
        required_skills: requiredSkillsPayload,
      });

  } catch (err) {
    throw err;
  }

  const analysis = analysisResponse.result;

  // 7. Build what we persist (see schema note above)
  const recommendations = {
    skill_gap: analysis.skill_gap,
    suggestions: analysis.missing_skills.map((skillName) => ({
      skill: skillName,
      suggestion: `Focus on improving ${skillName} to meet the required level.`,
    })),
  };

  const existingReport = await repo.gapReports.findByUserId(userId);

  // 8. One report per student — upsert overwrites the previous one
  const report = await repo.gapReports.upsert(userId, {
    readiness_score:
      readinessScore ??
      existingReport?.readiness_score ??
      analysis.readiness_score,
    missing_skills: analysis.missing_skills,
    recommendations,
  });
  

  return report;
}

async function getSkillGapAnalysis(userId) {
  const user = await repo.users.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  if (!user.domain_role_id) {
    const error = new Error("Student has not selected a domain role");
    error.status = 400;
    throw error;
  }

  const quizSession = await repo.quizSessions.findLatestByUserAndAssessmentType(
    userId,
    "INITIAL"
  );

  if (!quizSession || quizSession.status !== "Completed") {
    const error = new Error("Student has not completed the initial quiz yet");
    error.status = 409;
    throw error;
  }

  const codingSession = await repo.codingSessions.findBySessionAndUser(
    quizSession.session_id,
    userId
  );

  if (!codingSession || codingSession.status !== "Completed") {
    const error = new Error(
      "Student has not completed the initial coding assessment yet"
    );
    error.status = 409;
    throw error;
  }

  const [requiredSkills, skillResults] = await Promise.all([
    repo.domainRequiredSkills.findByDomainRoleId(user.domain_role_id),
    repo.studentSkillResults.findBySessionId(quizSession.session_id),
  ]);

  if (!requiredSkills.length) {
    const error = new Error("No skills configured for the selected domain");
    error.status = 404;
    throw error;
  }

  const resultBySkillId = new Map(
    skillResults.map((result) => [result.skill_id, result])
  );

  const skills = requiredSkills.map((requiredSkill) => {
    const result = resultBySkillId.get(requiredSkill.skill_id);
    const skillLevel = result ? Number(result.skill_level) : 0;
    const requiredLevel = Number(requiredSkill.required_level);
    const quizPercentage = result ? Number(result.percentage) : 0;
    const levelPercentage = requiredLevel > 0
      ? Math.min(100, (skillLevel / requiredLevel) * 100)
      : 0;

    return {
      skillId: requiredSkill.skill_id,
      skillName: requiredSkill.skill.skill_name,
      requiredLevel,
      skillLevel,
      quizPercentage: Number(quizPercentage.toFixed(2)),
      performancePercentage: Number(levelPercentage.toFixed(2)),
      gapPercentage: Number(Math.max(0, 100 - levelPercentage).toFixed(2)),
    };
  });

  const totalScore = Number(codingSession.total_score || 0);
  const maxScore = Number(codingSession.max_score || 0);
  const codingPercentage = maxScore > 0
    ? (totalScore / maxScore) * 100
    : 0;
  const quizPercentage = skills.length
    ? skills.reduce((sum, skill) => sum + skill.quizPercentage, 0) / skills.length
    : 0;

  return {
    userId,
    domainRole: quizSession.domainRole
      ? {
          id: quizSession.domainRole.domain_role_id,
          name: quizSession.domainRole.domain_name,
        }
      : { id: user.domain_role_id },
    quiz: {
      sessionId: quizSession.session_id,
      percentage: Number(quizPercentage.toFixed(2)),
    },
    codingAssessment: {
      sessionId: codingSession.session_id,
      totalScore,
      maxScore,
      percentage: Number(codingPercentage.toFixed(2)),
      completedAt: codingSession.completed_at,
    },
    skills,
  };
}

module.exports = {
  generateGapReport,
  getSkillGapAnalysis,
};