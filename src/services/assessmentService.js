const repo = require("../data");
const { assessments } = require("../data/prismaRepo");
const flaskService = require("./flaskServices");
const skillGapService = require("./skillGapService");

const INITIAL_ASSESSMENT_DURATION_MINUTES = Number(process.env.INITIAL_ASSESSMENT_DURATION_MINUTES || 30)
const INITIAL_ASSESSMENT_DURATION_MS = INITIAL_ASSESSMENT_DURATION_MINUTES * 60 * 1000;

if (
  !Number.isFinite(INITIAL_ASSESSMENT_DURATION_MINUTES) ||
  INITIAL_ASSESSMENT_DURATION_MINUTES <= 0
) {
  throw new Error(
    "INITIAL_ASSESSMENT_DURATION_MINUTES must be a positive number."
  );
}

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

  if (!user.domain_role_id) {
    const error = new Error(
      "Student has not selected a domain role"
    );
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

  const totalQuestions = requiredSkills.length * 10;

  /*
   * ============================================================
   * FIND EXISTING ASSESSMENT
   * ============================================================
   *
   * This now finds both:
   *
   *   In Progress -> student was actively taking the test
   *   Paused      -> student previously stopped the test
   *
   * Completed / Timed Out sessions are NOT returned.
   */
  const existingSession =
    await repo.quizSessions.findLatestByUser(userId);

  // Terminal state - do not create new session
    if (existingSession) {
      if (existingSession.status === "Completed") {
        const error = new Error(
          "This assessment has already been completed."
        );

        error.status = 409;
        error.code = "ASSESSMENT_ALREADY_COMPLETED";

        throw error;
      }

      if (existingSession.status === "Terminated") {
        const error = new Error(
          "This assessment has been terminated and cannot be restarted."
        );

        error.status = 409;
        error.code = "ASSESSMENT_TERMINATED";

        throw error;
      }

      if (existingSession.status === "Timed Out") {
        const error = new Error(
          "This assessment has already expired."
        );

        error.status = 409;
        error.code = "ASSESSMENT_TIME_EXPIRED";

        throw error;
      }
    }

  /*
   * ============================================================
   * RESUME EXISTING ASSESSMENT (READ-ONLY W.R.T. THE TIMER)
   * ============================================================
   *
   * IMPORTANT — this function is called every time the page loads
   * (InitialAssessment.js calls it on mount, before the student has
   * clicked "Resume"/"Start", before the camera permission prompt,
   * before proctoring has connected). It must NEVER start or restart
   * the countdown itself, or the student loses real exam time just
   * sitting on the "Resume Assessment" screen or waiting on a camera
   * permission dialog.
   *
   * Flipping a "Paused" session back to "In Progress" (i.e. actually
   * starting the deadline) only happens in activateInitialAssessment(),
   * which the frontend calls at the exact moment the student clicks
   * the Resume/Start button.
   */
  if (existingSession) {
    const now = new Date();

    /*
     * ----------------------------------------------------------
     * CASE 1: PAUSED SESSION
     * ----------------------------------------------------------
     *
     * remaining_seconds is the authoritative remaining time, and it
     * is left completely untouched here. We only check whether it
     * had already hit zero at the moment it was paused (edge case),
     * we do NOT create a new deadline yet.
     */
    if (existingSession.status === "Paused") {
      const remainingSeconds =
        Number(existingSession.remaining_seconds);

      if (
        !Number.isInteger(remainingSeconds) ||
        remainingSeconds <= 0
      ) {
        await repo.quizSessions.update(
          existingSession.session_id,
          {
            status: "Timed Out",
            end_time: now,
            remaining_seconds: 0,
          }
        );

        const error = new Error(
          "The assessment time has expired."
        );

        error.status = 409;
        error.code = "ASSESSMENT_TIME_EXPIRED";

        throw error;
      }

      existingSession.remaining_seconds = remainingSeconds;
    }

    /*
     * ----------------------------------------------------------
     * CASE 2: ALREADY IN PROGRESS
     * ----------------------------------------------------------
     *
     * Do NOT reset the timer.
     *
     * The existing deadline remains authoritative. This is a
     * genuinely live session (e.g. the student refreshed the page
     * mid-exam) — the clock correctly keeps counting down.
     */
    let liveRemainingSeconds = null;

    if (existingSession.status === "In Progress") {
      if (!existingSession.deadline_at) {
        const error = new Error(
          "Assessment timer information is missing."
        );

        error.status = 500;
        throw error;
      }

      const deadlineTime =
        new Date(existingSession.deadline_at).getTime();

      liveRemainingSeconds = Math.max(
        0,
        Math.floor(
          (deadlineTime - now.getTime()) / 1000
        )
      );

      /*
       * Server-side timeout check.
       */
      if (liveRemainingSeconds <= 0) {
        await repo.quizSessions.update(
          existingSession.session_id,
          {
            status: "Timed Out",
            end_time: now,
            remaining_seconds: 0,
          }
        );

        const error = new Error(
          "The assessment time has expired."
        );

        error.status = 409;
        error.code = "ASSESSMENT_TIME_EXPIRED";

        throw error;
      }
    }

    /*
     * ----------------------------------------------------------
     * CURRENT QUESTION MUST EXIST
     * ----------------------------------------------------------
     */
    if (!existingSession.current_question_id) {
      const error = new Error(
        "Assessment cannot be resumed because the current question is missing."
      );

      error.status = 500;
      throw error;
    }

    const currentQuestion =
      await repo.questions.findById(
        existingSession.current_question_id
      );

    if (!currentQuestion) {
      const error = new Error(
        "The current assessment question could not be found."
      );

      error.status = 500;
      throw error;
    }

    /*
     * ----------------------------------------------------------
     * CURRENT REMAINING TIME (DISPLAY ONLY — NOT PERSISTED)
     * ----------------------------------------------------------
     *
     * Paused  -> use the stored remaining_seconds as-is.
     * In Progress -> use the live countdown computed above.
     */
    const remainingSeconds =
      existingSession.status === "Paused"
        ? Number(existingSession.remaining_seconds)
        : liveRemainingSeconds;

    /*
     * ----------------------------------------------------------
     * BUILD ASSESSMENT PROGRESS
     * ----------------------------------------------------------
     */
    const completedResults =
      await repo.studentSkillResults.findBySessionId(
        existingSession.session_id
      );

    const completedSkillIds = new Set(
      completedResults.map((r) => r.skill_id)
    );

    const currentSkill =
      requiredSkills.find(
        (rs) =>
          rs.skill_id ===
          existingSession.current_skill_id
      ) || requiredSkills[0];

    const currentSkillIndex = Math.max(
      0,
      requiredSkills.findIndex(
        (rs) =>
          rs.skill_id ===
          existingSession.current_skill_id
      )
    );

    const questionsAnswered =
      existingSession.questions_answered || 0;

    const assessmentMeta = {
      total_skills: requiredSkills.length,

      questions_per_skill: 10,

      total_questions: totalQuestions,

      current_skill_index: currentSkillIndex,

      overall_question:
        questionsAnswered + 1,

      remaining_questions:
        Math.max(
          0,
          totalQuestions - questionsAnswered
        ),

      skills: requiredSkills.map(
        (item, index) => ({
          skill_id: item.skill_id,

          skill_name:
            item.skill.skill_name,

          index,

          status:
            completedSkillIds.has(item.skill_id)
              ? "completed"
              : item.skill_id ===
                existingSession.current_skill_id
              ? "current"
              : "upcoming",
        })
      ),
    };

    /*
     * ----------------------------------------------------------
     * RETURN RESUMED ASSESSMENT
     * ----------------------------------------------------------
     */
    return {
      resumed: true,

      session_id:
        existingSession.session_id,

      timer: {
        duration_seconds:
          INITIAL_ASSESSMENT_DURATION_MINUTES * 60,

        deadline_at:
          existingSession.deadline_at,

        remaining_seconds:
          remainingSeconds,
      },

      domain: {
        domain_role_id:
          user.domain_role_id,

        domain_name:
          user.domain_role,
      },

      assessment: assessmentMeta,

      skill: {
        skill_id:
          currentSkill.skill_id,

        skill_name:
          currentSkill.skill.skill_name,
      },

      question:
        toClientQuestion(currentQuestion),
    };
  }

  /*
   * ============================================================
   * CREATE NEW ASSESSMENT
   * ============================================================
   */

  const firstSkill = requiredSkills[0];

  const questions =
    await repo.questions.findBySkill(
      firstSkill.skill_id
    );

  if (!questions.length) {
    const error = new Error(
      "No questions available for the first skill."
    );

    error.status = 404;
    throw error;
  }

  const startTime = new Date();

  const durationSeconds =
    INITIAL_ASSESSMENT_DURATION_MINUTES * 60;

  /*
   * ----------------------------------------------------------
   * CREATE SESSION — STARTS "Paused", NOT "In Progress"
   * ----------------------------------------------------------
   *
   * The clock does not start here. This call happens on page load,
   * before the student has granted camera permission or clicked
   * "Start Assessment". We create the session and the first question
   * up front (that work is independent of the timer), but leave the
   * deadline unset. activateInitialAssessment() sets the real
   * deadline the moment the student actually clicks Start — see the
   * note above CASE 1 for why.
   */
  const quizSession =
    await repo.quizSessions.create({
      user_id: userId,

      domain_role_id:
        user.domain_role_id,

      start_time: startTime,

      deadline_at: null,

      remaining_seconds:
        durationSeconds,

      paused_at: startTime,

      status: "Paused",

      total_questions:
        totalQuestions,

      questions_answered: 0,

      current_skill_id:
        firstSkill.skill_id,

      current_question_id: null,
    });

  /*
   * ----------------------------------------------------------
   * CREATE FLASK ADAPTIVE STATE
   * ----------------------------------------------------------
   */
  const stateResponse =
    await flaskService.createQuizState({
      session_id:
        quizSession.session_id,

      skill: {
        skill_id:
          firstSkill.skill_id,

        skill_name:
          firstSkill.skill.skill_name,
      },
    });

  const state =
    stateResponse.state;

  /*
   * ----------------------------------------------------------
   * SAVE QUIZ STATE
   * ----------------------------------------------------------
   */
  await repo.quizStates.create({
    session_id:
      quizSession.session_id,

    skill_id:
      firstSkill.skill_id,

    current_difficulty:
      state.current_difficulty,

    correct_streak:
      state.correct_streak,

    wrong_streak:
      state.wrong_streak,

    questions_answered:
      state.questions_answered,

    obtained_score:
      state.obtained_score,

    maximum_score:
      state.maximum_score,

    state,
  });

  /*
   * ----------------------------------------------------------
   * GET FIRST ADAPTIVE QUESTION
   * ----------------------------------------------------------
   */
  const questionResponse =
    await flaskService.getNextQuestion({
      state,

      questions,
    });

  if (!questionResponse.question) {
    const error = new Error(
      "No question available for this skill."
    );

    error.status = 404;
    throw error;
  }

  const firstQuestion =
    questionResponse.question;

  /*
   * ----------------------------------------------------------
   * IMPORTANT:
   *
   * Save the exact question being displayed.
   *
   * This is what allows us to resume on the
   * exact same question.
   * ----------------------------------------------------------
   */
  await repo.quizSessions.update(
    quizSession.session_id,
    {
      current_question_id:
        firstQuestion.question_id,
    }
  );

  /*
   * ----------------------------------------------------------
   * ASSESSMENT META
   * ----------------------------------------------------------
   */
  const assessmentMeta = {
    total_skills:
      requiredSkills.length,

    questions_per_skill: 10,

    total_questions:
      totalQuestions,

    current_skill_index: 0,

    overall_question: 1,

    remaining_questions:
      totalQuestions - 1,

    skills:
      requiredSkills.map(
        (item, index) => ({
          skill_id:
            item.skill_id,

          skill_name:
            item.skill.skill_name,

          index,

          status:
            index === 0
              ? "current"
              : "upcoming",
        })
      ),
  };

  /*
   * ----------------------------------------------------------
   * RETURN NEW ASSESSMENT
   * ----------------------------------------------------------
   */
  return {
    resumed: false,

    session_id:
      quizSession.session_id,

    timer: {
      duration_seconds:
        durationSeconds,

      deadline_at: null,

      remaining_seconds:
        durationSeconds,
    },

    domain: {
      domain_role_id:
        user.domain_role_id,

      domain_name:
        user.domain_role,
    },

    assessment:
      assessmentMeta,

    skill: {
      skill_id:
        firstSkill.skill_id,

      skill_name:
        firstSkill.skill.skill_name,
    },

    question:
      toClientQuestion(firstQuestion),
  };
}

/*
 * ============================================================
 * ACTIVATE (START/RESUME) THE ASSESSMENT TIMER
 * ============================================================
 *
 * This is the ONLY place the countdown deadline is ever set. The
 * frontend calls this at the exact moment the student clicks the
 * "Start/Resume Assessment" button — after that, it immediately
 * connects proctoring, which itself requires status "In Progress"
 * (see proctoringGateway.js), so this must run before that call.
 *
 * Idempotent: calling it again while already "In Progress" just
 * returns the live remaining time without resetting the deadline
 * (no free extra time from double-clicks or reconnects).
 */
async function activateInitialAssessment(userId, sessionId) {
  const quizSession =
    await repo.quizSessions.findById(sessionId);

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

  if (quizSession.status === "Completed") {
    const error = new Error(
      "This assessment has already been completed."
    );
    error.status = 409;
    throw error;
  }

  if (quizSession.status === "Terminated") {
    const error = new Error(
      "This assessment has been terminated and cannot be restarted."
    );
    error.status = 409;
    throw error;
  }

  if (quizSession.status === "Timed Out") {
    const error = new Error(
      "This assessment has already expired."
    );
    error.status = 409;
    error.code = "ASSESSMENT_TIME_EXPIRED";
    throw error;
  }

  const now = new Date();

  // Already ticking (e.g. a reconnect/double-click) — don't touch
  // the deadline, just report the live remaining time.
  if (quizSession.status === "In Progress") {
    if (!quizSession.deadline_at) {
      const error = new Error(
        "Assessment timer information is missing."
      );
      error.status = 500;
      throw error;
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor(
        (new Date(quizSession.deadline_at).getTime() - now.getTime()) / 1000
      )
    );

    if (remainingSeconds <= 0) {
      await repo.quizSessions.update(sessionId, {
        status: "Timed Out",
        end_time: now,
        remaining_seconds: 0,
      });

      const error = new Error("The assessment time has expired.");
      error.status = 409;
      error.code = "ASSESSMENT_TIME_EXPIRED";
      throw error;
    }

    return {
      activated: true,
      session_id: sessionId,
      remaining_seconds: remainingSeconds,
      deadline_at: quizSession.deadline_at,
    };
  }

  if (quizSession.status !== "Paused") {
    const error = new Error(
      "This assessment cannot be started in its current state."
    );
    error.status = 409;
    throw error;
  }

  const remainingSeconds = Number(quizSession.remaining_seconds);

  if (!Number.isInteger(remainingSeconds) || remainingSeconds <= 0) {
    await repo.quizSessions.update(sessionId, {
      status: "Timed Out",
      end_time: now,
      remaining_seconds: 0,
    });

    const error = new Error("The assessment time has expired.");
    error.status = 409;
    error.code = "ASSESSMENT_TIME_EXPIRED";
    throw error;
  }

  // This is the moment the exam clock actually starts.
  const newDeadline = new Date(now.getTime() + remainingSeconds * 1000);

  await repo.quizSessions.update(sessionId, {
    status: "In Progress",
    deadline_at: newDeadline,
    paused_at: null,
  });

  return {
    activated: true,
    session_id: sessionId,
    remaining_seconds: remainingSeconds,
    deadline_at: newDeadline,
  };
}

async function pauseInitialAssessment(userId, sessionId) {
  const quizSession =
    await repo.quizSessions.findById(sessionId);

  if (!quizSession) {
    const error = new Error(
      "Quiz session not found"
    );

    error.status = 404;
    throw error;
  }

  /*
   * ----------------------------------------------------------
   * VERIFY OWNERSHIP
   * ----------------------------------------------------------
   */
  if (quizSession.user_id !== userId) {
    const error = new Error(
      "You are not authorized to access this quiz session"
    );

    error.status = 403;
    throw error;
  }

  /*
   * ----------------------------------------------------------
   * ALREADY COMPLETED
   * ----------------------------------------------------------
   */
  if (quizSession.status === "Completed") {
    const error = new Error(
      "This assessment has already been completed."
    );

    error.status = 409;
    throw error;
  }

  /*
   * ----------------------------------------------------------
   * ALREADY TIMED OUT
   * ----------------------------------------------------------
   */
  if (quizSession.status === "Timed Out") {
    const error = new Error(
      "This assessment has already expired."
    );

    error.status = 409;
    throw error;
  }

  /*
   * ----------------------------------------------------------
   * ALREADY PAUSED
   *
   * Make the endpoint idempotent.
   *
   * If React accidentally calls pause twice, we don't
   * recalculate or destroy the saved remaining time.
   * ----------------------------------------------------------
   */
  if (quizSession.status === "Paused") {
    return {
      paused: true,

      session_id:
        quizSession.session_id,

      remaining_seconds:
        Number(quizSession.remaining_seconds || 0),

      paused_at:
        quizSession.paused_at,

      current_question_id:
        quizSession.current_question_id,
    };
  }

  /*
   * ----------------------------------------------------------
   * ONLY "In Progress" CAN BE PAUSED
   * ----------------------------------------------------------
   */
  if (quizSession.status !== "In Progress") {
    const error = new Error(
      "This assessment cannot be paused in its current state."
    );

    error.status = 409;
    throw error;
  }

  /*
   * ----------------------------------------------------------
   * TIMER MUST EXIST
   * ----------------------------------------------------------
   */
  if (!quizSession.deadline_at) {
    const error = new Error(
      "Assessment timer information is missing."
    );

    error.status = 500;
    throw error;
  }

  const now = new Date();

  const deadlineTime =
    new Date(
      quizSession.deadline_at
    ).getTime();

  /*
   * Calculate remaining time using SERVER TIME.
   *
   * The browser's timer is NOT trusted.
   */
  const remainingSeconds = Math.max(
    0,
    Math.floor(
      (deadlineTime - now.getTime()) / 1000
    )
  );

  /*
   * ----------------------------------------------------------
   * TIMER EXPIRED BEFORE PAUSE
   * ----------------------------------------------------------
   */
  if (remainingSeconds <= 0) {
    await repo.quizSessions.update(
      sessionId,
      {
        status: "Timed Out",
        end_time: now,
        remaining_seconds: 0,
        deadline_at: null,
      }
    );

    const error = new Error(
      "The assessment time has expired."
    );

    error.status = 409;
    error.code =
      "ASSESSMENT_TIME_EXPIRED";

    throw error;
  }

  /*
   * ----------------------------------------------------------
   * SAVE PAUSED STATE
   * ----------------------------------------------------------
   *
   * Example:
   *
   * deadline = 10:30
   * current time = 10:15
   *
   * remaining_seconds = 900
   *
   * We remove the old deadline because the assessment
   * is no longer actively counting down.
   */
  await repo.quizSessions.update(
    sessionId,
    {
      status: "Paused",

      remaining_seconds:
        remainingSeconds,

      paused_at: now,

      deadline_at: null,
    }
  );

  return {
    paused: true,

    session_id:
      quizSession.session_id,

    remaining_seconds:
      remainingSeconds,

    paused_at: now,

    current_question_id:
      quizSession.current_question_id,
  };
}

async function heartbeatInitialAssessment(userId, sessionId) {
  const quizSession =
    await repo.quizSessions.findById(sessionId);

  if (!quizSession) {
    const error = new Error(
      "Quiz session not found"
    );

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
    return {
      active: false,
      status: quizSession.status,
      remaining_seconds: Number(
        quizSession.remaining_seconds || 0
      ),
    };
  }

  if (!quizSession.deadline_at) {
    const error = new Error(
      "Assessment timer information is missing."
    );

    error.status = 500;
    throw error;
  }

  const now = new Date();

  const remainingSeconds = Math.max(
    0,
    Math.floor(
      (
        new Date(
          quizSession.deadline_at
        ).getTime() -
        now.getTime()
      ) / 1000
    )
  );

  /*
   * Timer expired.
   */
  if (remainingSeconds <= 0) {
    await repo.quizSessions.update(
      sessionId,
      {
        status: "Timed Out",
        end_time: now,
        remaining_seconds: 0,
      }
    );

    const error = new Error(
      "The assessment time has expired."
    );

    error.status = 409;
    error.code =
      "ASSESSMENT_TIME_EXPIRED";

    throw error;
  }

  /*
   * Keep the persisted value synchronized with the
   * server-authoritative deadline.
   */
  await repo.quizSessions.update(
    sessionId,
    {
      remaining_seconds:
        remainingSeconds,
    }
  );

  return {
    active: true,

    session_id:
      sessionId,

    remaining_seconds:
      remainingSeconds,

    deadline_at:
      quizSession.deadline_at,

    current_question_id:
      quizSession.current_question_id,
  };
}

// Submit one answer, advance state, and (when a skill finishes) roll
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

  const now = new Date();

  if (
    quizSession.deadline_at &&
    now >= new Date(quizSession.deadline_at)
  ) {
    await repo.quizSessions.update(sessionId, {
      status: "Timed Out",
      end_time: now,
    });

    const error = new Error(
      "The assessment time has expired."
    );

    error.status = 409;
    error.code = "ASSESSMENT_TIME_EXPIRED";

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

  if(quizSession.current_question_id !== questionId){
    const error = new Error(
      "This is not the current question"
    );
    error.status = 400;
    throw error
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
  const completedResults = await repo.studentSkillResults.findBySessionId(
    sessionId
  );
  const completedSkillIds = new Set(completedResults.map((r) => r.skill_id));

  const assessmentMeta = {
    total_skills: requiredSkills.length,
    questions_per_skill: 10,
    total_questions: requiredSkills.length * 10,
    current_skill_index: completedResults.length,
    overall_question: (quizSession.questions_answered || 0) + 1,
    remaining_questions:
      requiredSkills.length * 10 - ((quizSession.questions_answered || 0) + 1),
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

    if(!nextQuestionResponse.question){
      const error = new Error(
        "No next question is available"
      );

      error.status = 500;
      throw error
    }

    await repo.quizSessions.update(sessionId, {
      current_question_id: nextQuestionResponse.question.question_id,
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
  completedSkillIds.add(skillId),
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

  if(!firstQuestionResponse.question){
    const error = new Error("No question available for the next skill")
    error.status = 500;
    throw error;
  }

  await repo.quizSessions.update(sessionId, {
    current_skill_id: nextRequired.skill_id,
    current_question_id: firstQuestionResponse.question.question_id,
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
        item.skill_id === skillId
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
  activateInitialAssessment,
  submitInitialAssessmentAnswer,
  pauseInitialAssessment,
  heartbeatInitialAssessment
};