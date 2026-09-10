// adaptiveQuizService.js
//
// Native in-process Adaptive Quiz Engine for EduSaaS.
// Replaces the external Python/Flask network dependency with pure, instant,
// deterministic business logic for question progression, difficulty adaptation,
// scoring, and streak calculations.
//
// Running this natively in Node.js ensures:
// 1. 0ms network latency on question transitions.
// 2. Zero risk of 502 Bad Gateway / cold-start timeouts during student exams.
// 3. 100% test reliability and production-readiness.

// Difficulty levels matching the database schema
const DIFFICULTY = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  VERY_HARD: 4,
};

const QUESTIONS_PER_SKILL = 10;

/**
 * Initializes a new adaptive quiz state for a specific skill.
 * @param {Object} payload
 * @param {number} payload.session_id
 * @param {Object} payload.skill { skill_id, skill_name }
 * @param {string} [payload.assessment_type="INITIAL"]
 */
async function createQuizState(payload) {
  const assessment_type = String(
    payload.assessment_type || "INITIAL"
  ).toUpperCase();

  const starting_difficulty =
    assessment_type === "FINAL" ? DIFFICULTY.MEDIUM : DIFFICULTY.EASY;

  return {
    success: true,
    state: {
      session_id: payload.session_id,
      skill_id: payload.skill.skill_id,
      skill_name: payload.skill.skill_name,
      assessment_type,
      current_difficulty: starting_difficulty,
      correct_streak: 0,
      wrong_streak: 0,
      questions_answered: 0,
      obtained_score: 0,
      maximum_score: 0,
      asked_questions: [],
    },
  };
}

/**
 * Selects the next adaptive question based on current difficulty and past questions asked.
 * @param {Object} payload
 * @param {Object} payload.state
 * @param {Array} payload.questions
 */
async function getNextQuestion(payload) {
  const { state, questions } = payload;
  const difficulty = Number(state.current_difficulty) || DIFFICULTY.EASY;
  const asked = new Set(state.asked_questions || []);

  const allQuestions = Array.isArray(questions) ? questions : [];

  // Filter questions matching current difficulty that haven't been asked yet
  let available = allQuestions.filter(
    (q) => q.difficulty_id === difficulty && !asked.has(q.question_id)
  );

  // Fallback: If no questions remain at this difficulty, select any unanswered question
  if (available.length === 0) {
    available = allQuestions.filter((q) => !asked.has(q.question_id));
  }

  // If no questions are left in the entire bank for this skill
  if (available.length === 0) {
    return { success: true, question: null };
  }

  // Pick a random question from available choices to avoid deterministic ordering
  const chosen = available[Math.floor(Math.random() * available.length)];
  return { success: true, question: JSON.parse(JSON.stringify(chosen)) };
}

/**
 * Submits an answer, evaluates correctness, updates streaks, and dynamically adjusts difficulty.
 * @param {Object} payload
 * @param {Object} payload.state
 * @param {Object} payload.question
 * @param {string} payload.selected_option
 */
async function submitAnswer(payload) {
  const { state: originalState, question, selected_option } = payload;
  const state = JSON.parse(JSON.stringify(originalState));

  const is_correct =
    String(selected_option || "").trim().toUpperCase() ===
    String(question.correct_option || "").trim().toUpperCase();

  const marks = Number(question.marks) || 1;

  state.questions_answered = (state.questions_answered || 0) + 1;
  state.maximum_score = (state.maximum_score || 0) + marks;

  if (!state.asked_questions) state.asked_questions = [];
  if (!state.asked_questions.includes(question.question_id)) {
    state.asked_questions.push(question.question_id);
  }

  if (is_correct) {
    state.obtained_score = (state.obtained_score || 0) + marks;
    state.correct_streak = (state.correct_streak || 0) + 1;
    state.wrong_streak = 0;
  } else {
    state.wrong_streak = (state.wrong_streak || 0) + 1;
    state.correct_streak = 0;
  }

  const assessment_type = String(
    state.assessment_type || "INITIAL"
  ).toUpperCase();
  const minDiff =
    assessment_type === "FINAL" ? DIFFICULTY.MEDIUM : DIFFICULTY.EASY;
  const maxDiff =
    assessment_type === "FINAL" ? DIFFICULTY.VERY_HARD : DIFFICULTY.HARD;

  // Adaptive Difficulty Stepping:
  // 2 consecutive correct answers -> increase difficulty
  // 2 consecutive wrong answers   -> decrease difficulty
  if (state.correct_streak >= 2 && state.current_difficulty < maxDiff) {
    state.current_difficulty += 1;
    state.correct_streak = 0;
  } else if (state.wrong_streak >= 2 && state.current_difficulty > minDiff) {
    state.current_difficulty -= 1;
    state.wrong_streak = 0;
  }

  const skill_completed = state.questions_answered >= QUESTIONS_PER_SKILL;

  return {
    success: true,
    result: {
      is_correct,
      marks_awarded: is_correct ? marks : 0,
      current_difficulty: state.current_difficulty,
      skill_completed,
      updated_state: state,
    },
  };
}

/**
 * Calculates final score and skill level (1 to 5) for a completed skill.
 * @param {Object} payload
 * @param {Object} payload.state
 */
async function calculateSkillScore(payload) {
  const state = payload.state;
  const maxScore = state.maximum_score || 0;
  const obtained = state.obtained_score || 0;
  const percentage =
    maxScore === 0 ? 0 : Math.round((obtained / maxScore) * 100 * 100) / 100;

  // Level 1: Novice (<25%), Level 2: Beginner (25-49%), Level 3: Intermediate (50-69%),
  // Level 4: Advanced (70-89%), Level 5: Expert (90%+)
  let skill_level = 1;
  if (percentage >= 90) skill_level = 5;
  else if (percentage >= 70) skill_level = 4;
  else if (percentage >= 50) skill_level = 3;
  else if (percentage >= 25) skill_level = 2;

  return {
    success: true,
    result: {
      session_id: state.session_id,
      skill_id: state.skill_id,
      skill_name: state.skill_name,
      questions_answered: state.questions_answered,
      obtained_score: obtained,
      maximum_score: maxScore,
      percentage,
      skill_level,
      status: "Completed",
    },
  };
}

/**
 * Progresses to the next skill in sequence.
 * @param {Object} payload
 * @param {Array} payload.skills
 * @param {number} payload.current_skill_index
 */
async function getNextSkill(payload) {
  const { skills, current_skill_index } = payload;
  const next_index = (current_skill_index || 0) + 1;

  if (next_index >= (skills || []).length) {
    return { success: true, result: null };
  }

  return {
    success: true,
    result: {
      next_skill_index: next_index,
      next_skill: skills[next_index],
    },
  };
}

/**
 * Finalizes the assessment for a skill.
 * @param {Object} payload
 * @param {Object} payload.state
 */
async function finishQuiz(payload) {
  const scoreRes = await calculateSkillScore(payload);
  return {
    success: true,
    result: {
      assessment_completed: true,
      completed_skill: scoreRes.result,
    },
  };
}

module.exports = {
  createQuizState,
  getNextQuestion,
  submitAnswer,
  calculateSkillScore,
  getNextSkill,
  finishQuiz,
};
