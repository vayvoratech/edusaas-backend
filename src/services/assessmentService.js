const repo = require("../data");
const { assessments } = require("../data/prismaRepo");
const flaskService = require("./flaskServices");
const skillGapService = require("./skillGapService");

// Strip the answer key before anything goes back to the client.
function toClientQuestion(question) {
  if (!question) return null;
  const { correct_option, ...rest } = question;
  return rest;
} 

// ---------------------------------------------------------------------
// Start the initial adaptive assessment
// ---------------------------------------------------------------------
async function startInitialAssessment(userId) {
  const user = await repo.users.findById(userId);

  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  // Prevent starting a new assessment after completion
  const profile = await repo.profiles.findByUserId(userId);

  if (profile?.initial_assessment_completed === true) {
    const error = new Error("Initial assessment already completed");
    error.status = 409;
    throw error;
  }

  if (!user.domain_role_id) {
    const error = new Error("Student has not selected a domain role");
    error.status = 400;
    throw error;
  }
 

  const requiredSkills =
    await repo.domainRequiredSkills.findByDomainRoleId(
      user.domain_role_id
    );
    
    
    if (!requiredSkills.length) {
  const error = new Error(
    "No skills configured for the selected domain"
  );
  error.status = 404;
  throw error;
}
    const skillOrder = [
  "Python",
  "SQL",
  "Machine Learning",
  "Deep Learning",
  "Git",
];

requiredSkills.sort((a, b) => {
  const indexA = skillOrder.indexOf(a.skill.skill_name);
  const indexB = skillOrder.indexOf(b.skill.skill_name);

  return (
    (indexA === -1 ? 999 : indexA) -
    (indexB === -1 ? 999 : indexB)
  );
});

  
  let quizSession =
    await repo.quizSessions.findActiveByUser(userId);

  let currentSkillEntry;
   

  // --------------------------------------------------
  // Resume Existing Session
  // --------------------------------------------------
 if (quizSession) {
  currentSkillEntry =
    requiredSkills.find(
      (skill) => skill.skill_id === quizSession.current_skill_id
    ) || requiredSkills[0];

  const existingState = await repo.quizStates.findById(
    quizSession.session_id,
    currentSkillEntry.skill_id
  );

  if (!existingState) {
    const stateResponse = await flaskService.createQuizState({
      session_id: quizSession.session_id,
      skill: {
        skill_id: currentSkillEntry.skill_id,
        skill_name: currentSkillEntry.skill.skill_name,
      },
    });

    const state = stateResponse.state;

    await repo.quizStates.create({
      session_id: quizSession.session_id,
      skill_id: currentSkillEntry.skill_id,
      current_difficulty: state.current_difficulty,
      correct_streak: state.correct_streak,
      wrong_streak: state.wrong_streak,
      questions_answered: state.questions_answered,
      obtained_score: state.obtained_score,
      maximum_score: state.maximum_score,
      state,
    });
  }
}
  // --------------------------------------------------
  // Start New Session
  // --------------------------------------------------
  else {
    currentSkillEntry = requiredSkills[0];

    quizSession = await repo.quizSessions.create({
      user_id: userId,
      domain_role_id: user.domain_role_id,
      current_skill_id: currentSkillEntry.skill_id,
      status: "In Progress",
      questions_answered: 0,
    });

    const stateResponse = await flaskService.createQuizState({
      session_id: quizSession.session_id,
      skill: {
        skill_id: currentSkillEntry.skill_id,
        skill_name: currentSkillEntry.skill.skill_name,
      },
    });

    const state = stateResponse.state;

    await repo.quizStates.create({
      session_id: quizSession.session_id,
      skill_id: currentSkillEntry.skill_id,
      current_difficulty: state.current_difficulty,
      correct_streak: state.correct_streak,
      wrong_streak: state.wrong_streak,
      questions_answered: state.questions_answered,
      obtained_score: state.obtained_score,
      maximum_score: state.maximum_score,
      state,
    });
  }

  // --------------------------------------------------
  // Load Quiz State
  // --------------------------------------------------
  const stateRow = await repo.quizStates.findById(
    quizSession.session_id,
    currentSkillEntry.skill_id
  );

  if (!stateRow || !stateRow.state) {
    const error = new Error("Quiz state not found");
    error.status = 404;
    throw error;
  }

  const questions = await repo.questions.findBySkill(
    currentSkillEntry.skill_id
  );

  const questionResponse = await flaskService.getNextQuestion({
    state: stateRow.state,
    questions,
  });

  if (!questionResponse.question) {
    const error = new Error("No questions available for this skill");
    error.status = 404;
    throw error;
  }

  // --------------------------------------------------
  // Assessment Metadata
  // --------------------------------------------------
  
const currentSkillIndex = requiredSkills.findIndex(
  (skill) => skill.skill_id === currentSkillEntry.skill_id
);

const assessmentMeta = {
  total_skills: requiredSkills.length,

  questions_per_skill: 10,

  total_questions: requiredSkills.length * 10,

  current_skill_index: currentSkillIndex,

  overall_question:
    (quizSession.questions_answered || 0) + 1,

  remaining_questions:
    requiredSkills.length * 10 -
    ((quizSession.questions_answered || 0) + 1),

  skills: requiredSkills.map((skill, index) => ({
    skill_id: skill.skill_id,

    skill_name: skill.skill.skill_name,

    status:
      index < currentSkillIndex
        ? "completed"
        : index === currentSkillIndex
        ? "current"
        : "upcoming",
  })),
};

// --------------------------------------------------
// Response
// --------------------------------------------------

return {
  session_id: quizSession.session_id,

  domain: {
    domain_role_id: user.domain_role_id,
    domain_name: user.domain_role,
  },

  assessment: assessmentMeta,

  skill: {
    skill_id: currentSkillEntry.skill_id,
    skill_name: currentSkillEntry.skill.skill_name,
  },

  question: toClientQuestion(questionResponse.question),
};
}
// ---------------------------------------------------------------------
// Submit one answer, advance state, and (when a skill finishes) roll
// into the next skill or close out the assessment.
// ---------------------------------------------------------------------
async function submitInitialAssessmentAnswer(
  userId,
  sessionId,
  questionId,
  answer
) {
  const quizSession = await repo.quizSessions.findById(sessionId);

  if (!quizSession) {
    const error = new Error("Quiz session not found");
    error.status = 404;
    throw error;
  }

  if (quizSession.user_id !== userId) {
    const error = new Error(
      "You are not authorized to access this quiz session"
    );
    error.status = 403;
    throw error;
  }

  if (quizSession.status !== "In Progress") {
    const error = new Error("This quiz session is already completed");
    error.status = 409;
    throw error;
  }

  const skillId = quizSession.current_skill_id;
  if (!skillId) {
    const error = new Error(
      "Current skill is not available for this quiz session"
    );
    error.status = 400;
    throw error;
  }

  const question = await repo.questions.findById(questionId);

  if (!question) {
    const error = new Error("Question not found");
    error.status = 404;
    throw error;
  }

  if (question.skill_id !== skillId) {
    const error = new Error(
      "This question does not belong to the current skill"
    );
    error.status = 400;
    throw error;
  }

  const stateRow = await repo.quizStates.findById(sessionId, skillId);

  if (!stateRow || !stateRow.state) {
    const error = new Error("Quiz state not found");
    error.status = 404;
    throw error;
  }

  const state = stateRow.state;

  const aiQuestion = {
    question_id: question.question_id,
    difficulty_id: question.difficulty_id,
    correct_option: question.correct_option,
  };

  const submitResponse = await flaskService.submitAnswer({
    state,
    question: aiQuestion,
    selected_option: answer,
  });

  const result = submitResponse.result;
  const updatedState = result.updated_state;

  await repo.quizStates.update(sessionId, skillId, {
    current_difficulty: updatedState.current_difficulty,
    correct_streak: updatedState.correct_streak,
    wrong_streak: updatedState.wrong_streak,
    questions_answered: updatedState.questions_answered,
    obtained_score: updatedState.obtained_score,
    maximum_score: updatedState.maximum_score,
    state: updatedState,
  });

  await repo.studentAnswers.create({
    session_id: sessionId,
    skill_id: skillId,
    question_id: questionId,
    difficulty_id: question.difficulty_id,
    selected_option: answer,
    correct_option: question.correct_option,
    is_correct: result.is_correct,
    marks_awarded: result.marks_awarded,
  });

  await repo.quizSessions.update(sessionId, {
    questions_answered: (quizSession.questions_answered || 0) + 1,
  });

  const requiredSkills = await repo.domainRequiredSkills.findByDomainRoleId(
    quizSession.domain_role_id
  );

  const skillOrder = [
  "Python",
  "SQL",
  "Machine Learning",
  "Deep Learning",
  "Git",
];

requiredSkills.sort((a, b) => {
  const indexA = skillOrder.indexOf(a.skill.skill_name);
  const indexB = skillOrder.indexOf(b.skill.skill_name);

  return indexA - indexB;
});
  const completedResults = await repo.studentSkillResults.findBySessionId(
    sessionId
  );
  const completedSkillIds = new Set(completedResults.map((r) => r.skill_id));

  const assessmentMeta = {
  total_skills: requiredSkills.length,
  questions_per_skill: 10,
  total_questions: requiredSkills.length * 10,

  current_skill_index: requiredSkills.findIndex(
    (skill) => skill.skill_id === quizSession.current_skill_id
  ),

  overall_question: (quizSession.questions_answered || 0) + 1,

  remaining_questions:
    requiredSkills.length * 10 -
    ((quizSession.questions_answered || 0) + 1),

  skills: requiredSkills.map((item) => ({
    skill_id: item.skill_id,
    skill_name: item.skill.skill_name,

    status: completedSkillIds.has(item.skill_id)
      ? "completed"
      : item.skill_id === quizSession.current_skill_id
      ? "current"
      : "upcoming",
  })),
};

  // Skill not finished yet — just hand back the next question
  if (!result.skill_completed) {
    const questions = await repo.questions.findBySkill(skillId);

    const nextQuestionResponse = await flaskService.getNextQuestion({
      state: updatedState,
      questions,
    });

    return {
      assessment_completed: false,
      skill_completed: false,
      assessment: assessmentMeta,
      is_correct: result.is_correct,
      marks_awarded: result.marks_awarded,
      progress: {
        current: updatedState.questions_answered,
        total: assessmentMeta.questions_per_skill,
        percentage: Math.round(
          (updatedState.questions_answered /
            assessmentMeta.questions_per_skill) *
            100
        ),
      },
      question: toClientQuestion(nextQuestionResponse.question),
    };
  }

  // Skill finished — score it and store the result
  const scoreResponse = await flaskService.calculateSkillScore({
    state: updatedState,
  });
  const score = scoreResponse.result;

  await repo.studentSkillResults.create({
    session_id: sessionId,
    skill_id: skillId,
    obtained_score: score.obtained_score,
    maximum_score: score.maximum_score,
    percentage: score.percentage,
    skill_level: score.skill_level,
  });
  completedSkillIds.add(skillId);
  completedResults.push({
    skill_id: skillId
  })

  await repo.quizStates.remove(sessionId, skillId);

  const nextRequired = requiredSkills.find(
    (rs) => !completedSkillIds.has(rs.skill_id) && rs.skill_id !== skillId
  );

  // Nothing left — assessment complete. This is the trigger point for
  // Skill Gap Analysis (Assessment Completed -> Load Results -> Load
  // Required Skills -> Python Skill Gap Engine -> ... -> Report).
 if (!nextRequired) {
  await repo.quizSessions.update(sessionId, {
    status: "Completed",
    end_time: new Date(),
  });

  await repo.profiles.upsert(userId, {
    initial_assessment_completed: true,
  });

  const allResults = await repo.studentSkillResults.findBySessionId(
    sessionId
  );


    // Quiz's own readiness metric: average % correct across skills.
    // NOT the same number as the skill-gap engine's readiness_score
    // (student skill level vs required skill level) below — don't
    // conflate the two.
    const quizReadinessScore = Math.round(
      allResults.reduce((sum, skill) => sum + Number(skill.percentage), 0) /
        allResults.length
    );

    let gapReport = null;

    try {
      gapReport = await skillGapService.generateGapReport(userId);
    } catch (err) {
      console.error(err);
    }

    return {
      assessment_completed: true,
      skill_completed: true,
      assessment: assessmentMeta,
      readiness_score: quizReadinessScore,
      completed_skill: score,
      gap_report: gapReport,
    };
  }

  // Move on to the next skill
  await repo.quizSessions.update(sessionId, {
    current_skill_id: nextRequired.skill_id,
  });

  const nextQuestions = await repo.questions.findBySkill(
    nextRequired.skill_id
  );

  const newStateResponse = await flaskService.createQuizState({
    session_id: sessionId,
    skill: {
      skill_id: nextRequired.skill_id,
      skill_name: nextRequired.skill.skill_name,
    },
  });
  const newState = newStateResponse.state;

  await repo.quizStates.create({
    session_id: sessionId,
    skill_id: nextRequired.skill_id,
    current_difficulty: newState.current_difficulty,
    correct_streak: newState.correct_streak,
    wrong_streak: newState.wrong_streak,
    questions_answered: newState.questions_answered,
    obtained_score: newState.obtained_score,
    maximum_score: newState.maximum_score,
    state: newState,
  });

  const firstQuestionResponse = await flaskService.getNextQuestion({
    state: newState,
    questions: nextQuestions,
  });

  const nextAssessmentMeta = {
    total_skills: requiredSkills.length,

    questions_per_skill: 10,

    total_questions: requiredSkills.length * 10,

    current_skill_index: requiredSkills.findIndex(
      (skill) => skill.skill_id === nextRequired.skill_id
    ),

    overall_question: (quizSession.questions_answered || 0) + 1,

    remaining_questions:
      requiredSkills.length * 10 -
      ((quizSession.questions_answered || 0) + 1),

    skills: requiredSkills.map((item) => ({
  skill_id: item.skill_id,
  skill_name: item.skill.skill_name,

  status:
    completedSkillIds.has(item.skill_id)
      ? "completed"
      : item.skill_id === nextRequired.skill_id
      ? "current"
      : "upcoming",
})),
  };

  return {
    assessment_completed: false,
    skill_completed: true,
    assessment: nextAssessmentMeta,
    completed_skill: score,
    next_skill: {
      skill_id: nextRequired.skill_id,
      skill_name: nextRequired.skill.skill_name,
    },
    question: toClientQuestion(firstQuestionResponse.question),
  };
}

module.exports = {
  startInitialAssessment,
  submitInitialAssessmentAnswer,
}; 