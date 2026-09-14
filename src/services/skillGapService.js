

const repo = require("../data");
const {calculateEffectiveReadiness, calculateFinalReadiness} = require("./readinessScoreService")

// ---------------------------------------------------------------------
// Pure in-memory calculation of student's skill gap & readiness score.
// Replaces external Python call with native 1ms Node.js computation.
// ---------------------------------------------------------------------
function computeSkillGap(studentSkills, requiredSkills) {
  const report = [];
  const missingSkills = [];
  let totalStudent = 0;
  let totalRequired = 0;

  const studentMap = new Map();
  for (const skill of studentSkills) {
    studentMap.set(skill.skill_id, skill);
  }

  for (const required of requiredSkills) {
    const skillId = required.skill_id;
    const requiredLevel = required.required_level || 0;
    const skillName = required.skill_name || "";
    const studentData = studentMap.get(skillId) || {};
    const studentLevel = studentData.skill_level || 0;

    let gap = requiredLevel - studentLevel;
    if (gap < 0) gap = 0;

    let status;
    if (gap === 0) {
      status = "Ready";
    } else {
      status = "Needs Improvement";
      missingSkills.push(skillName);
    }

    report.push({
      skill_id: skillId,
      skill_name: skillName,
      required_level: requiredLevel,
      student_level: studentLevel,
      gap,
      status,
    });

    const effectiveStudentLevel = Math.min(studentLevel, requiredLevel);
    totalStudent += effectiveStudentLevel;
    totalRequired += requiredLevel;
  }

  const readinessScore =
    totalRequired === 0
      ? 0
      : Math.round((totalStudent / totalRequired) * 10000) / 100;

  return {
    skill_gap: report,
    readiness_score: readinessScore,
    missing_skills: missingSkills,
  };
}

// ---------------------------------------------------------------------
// Generate (or regenerate) a student's skill gap report.
//
// Flow: Assessment Completed -> Load Student Skill Results ->
//       Load Required Skills -> Native Skill Gap Engine ->
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
    const allRoles = (await repo.domainRoles.list()) || [];
    const aiRole = allRoles.find((r) => r.domain_name === "AI Engineer") || allRoles[0];
    if (aiRole) {
      await repo.users.update(userId, {
        domain_role_id: aiRole.domain_role_id || aiRole.id,
      });
      user.domain_role_id = aiRole.domain_role_id || aiRole.id;
    } else {
      const error = new Error("Student has not selected a domain role");
      error.status = 400;
      throw error;
    }
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
  const completedSession = await repo.quizSessions.findCompletedByUser( userId, "INITIAL");

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

  // 5. Build the payload
  const studentSkillsPayload = skillResults.map((r) => ({
    skill_id: r.skill_id,
    skill_name: r.skill?.skill_name || "",
    skill_level: r.skill_level,
  }));

  const requiredSkillsPayload = requiredSkills.map((rs) => ({
    skill_id: rs.skill_id,
    skill_name: rs.skill?.skill_name || "",
    required_level: rs.required_level,
  }));

  // 6. Native Node computation — runs in ~0.5ms with 100% reliability
  const analysis = computeSkillGap(
    studentSkillsPayload,
    requiredSkillsPayload
  );

  // 7. Build what we persist (see schema note above)
  const recommendations = {
    skill_gap: analysis.skill_gap,
    suggestions: analysis.missing_skills.map((skillName) => ({
      skill: skillName,
      suggestion: `Focus on improving ${skillName} to meet the required level.`,
    })),
  };

  const existingReport = await repo.gapReports.findByUserId(userId);

  // 8. Preserve assessment-derived readiness scores.
  // The native skill-gap calculation is used only for skill-gap analysis
  // and must not overwrite Initial/Final assessment readiness.
  const preservedInitialReadiness =
    readinessScore ??
    existingReport?.initial_readiness_score ??
    analysis.readiness_score;

  const preservedFinalReadiness =
    existingReport?.final_readiness_score ?? null;

  const effectiveReadiness =
    preservedFinalReadiness == null
      ? preservedInitialReadiness
      : Math.max(
          preservedInitialReadiness,
          preservedFinalReadiness
        );

  const report = await repo.gapReports.upsert(userId, {
    readiness_score: Number(effectiveReadiness.toFixed(2)),
    initial_readiness_score:
      Number(preservedInitialReadiness.toFixed(2)),
    final_readiness_score:
      preservedFinalReadiness == null
        ? null
        : Number(preservedFinalReadiness.toFixed(2)),
    missing_skills: analysis.missing_skills,
    recommendations,
  });

  return report;
}

async function updateFinalReadiness(
  userId,
  finalQuizScore = null,
  miniProjectScore = null
) {
  const existingReport =
    await repo.gapReports.findByUserId(userId);

  // Initial assessment must already exist.
  // We should not create a standalone readiness report here.
  if (!existingReport) {
    return null;
  }

  let resolvedFinalQuizScore = finalQuizScore;
  let resolvedMiniProjectScore = miniProjectScore;

  /*
   * ------------------------------------------------------------
   * Resolve Final Quiz score if caller did not provide it.
   * ------------------------------------------------------------
   */
  if (resolvedFinalQuizScore == null) {
    const finalSession =
      await repo.quizSessions.findLatestByUserAndAssessmentType(
        userId,
        "FINAL"
      );

    if (finalSession?.status !== "Completed") {
      return null;
    }

    resolvedFinalQuizScore =
      await repo.studentSkillResults.getQuizScoreBySessionId(
        finalSession.session_id
      );
  }

  /*
   * ------------------------------------------------------------
   * Resolve Mini Project score if caller did not provide it.
   * ------------------------------------------------------------
   */
  if (resolvedMiniProjectScore == null) {
    const finalSession =
      await repo.quizSessions.findLatestByUserAndAssessmentType(
        userId,
        "FINAL"
      );

    if (!finalSession?.domain_role_id) {
      return null;
    }

    const currentProject =
      await repo.miniProjects.getCurrentForStudent(
        userId,
        finalSession.domain_role_id
      );

    if (!currentProject?.submissions?.length) {
      return null;
    }

    const completedSubmission =
      currentProject.submissions.find(
        (submission) =>
          submission.analysis?.status === "COMPLETED" &&
          submission.analysis?.readiness_score != null
      );

    if (!completedSubmission) {
      return null;
    }

    resolvedMiniProjectScore =
      Number(
        completedSubmission.analysis.readiness_score
      );
  }

  /*
   * ------------------------------------------------------------
   * Final readiness is valid ONLY when both components exist.
   * ------------------------------------------------------------
   */
  if (
    resolvedFinalQuizScore == null ||
    resolvedMiniProjectScore == null
  ) {
    return null;
  }

  const finalReadiness =
    calculateFinalReadiness(
      resolvedFinalQuizScore,
      resolvedMiniProjectScore
    );

  const effectiveReadiness =
    calculateEffectiveReadiness(
      existingReport.initial_readiness_score,
      finalReadiness
    );

  return repo.gapReports.upsert(userId, {
    readiness_score: effectiveReadiness,

    initial_readiness_score:
      existingReport.initial_readiness_score,

    final_readiness_score:
      finalReadiness,

    missing_skills:
      existingReport.missing_skills,

    recommendations:
      existingReport.recommendations,
  });
}

module.exports = {
  generateGapReport,
  computeSkillGap,
  updateFinalReadiness,
};