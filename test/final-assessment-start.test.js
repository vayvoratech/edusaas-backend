const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = "final-assessment-start-test-secret";

const repo = require("../src/data");
const assessmentService = require("../src/services/assessmentService");

function stubRepo(t, stubs) {
  const originals = [];
  for (const [groupName, methods] of Object.entries(stubs)) {
    const group = repo[groupName];
    for (const [methodName, replacement] of Object.entries(methods)) {
      originals.push([group, methodName, group[methodName]]);
      group[methodName] = replacement;
    }
  }

  t.after(() => {
    for (const [group, methodName, original] of originals) {
      group[methodName] = original;
    }
  });
}

async function assertTerminalSessionRejected(t, status, expectedCode) {
  stubRepo(t, {
    users: {
      findById: async () => ({
        id: "student-1",
        domain_role_id: "role-1",
        domain_role: "AI Engineer",
      }),
    },
    domainRequiredSkills: {
      findByDomainRoleId: async () => [
        { skill_id: 5, skill: { skill_name: "Foundations" } },
      ],
    },
    quizSessions: {
      findLatestByUserAndAssessmentType: async () => ({
        session_id: 17,
        status,
        assessment_type: "FINAL",
        current_skill_id: 5,
        current_question_id: 81,
        questions_answered: 0,
        remaining_seconds: 0,
      }),
    },
    questions: {
      findById: async () => ({
        question_id: 81,
        question_text: "Final question",
        correct_option: "A",
        explanation: "Answer key",
      }),
    },
    studentSkillResults: {
      findBySessionId: async () => [],
    },
  });

  await assert.rejects(
    assessmentService.startFinalAssessment("student-1"),
    (error) => error.status === 409 && error.code === expectedCode
  );
}

test("approved terminated FINAL assessment creates a new session", async (t) => {
  const terminatedSession = {
    session_id: 17,
    status: "Terminated",
    assessment_type: "FINAL",
  };
  const finalQuestion = {
    question_id: 81,
    question_text: "Final question",
    correct_option: "A",
    explanation: "Answer key",
    difficulty_id: 2,
    difficulty: { difficulty_order: 2 },
  };
  let createdSession;

  stubRepo(t, {
    users: {
      findById: async () => ({
        id: "student-1",
        domain_role_id: "role-1",
        domain_role: "AI Engineer",
      }),
    },
    domainRequiredSkills: {
      findByDomainRoleId: async () => [
        { skill_id: 5, skill: { skill_name: "Foundations" } },
      ],
    },
    quizSessions: {
      findLatestByUserAndAssessmentType: async () => terminatedSession,
      create: async (data) => {
        createdSession = data;
        return { session_id: 23 };
      },
      update: async () => undefined,
    },
    assessmentReports: {
      findByStudentAndSession: async () => ({ status: "Approved" }),
    },
    questions: {
      findBySkill: async (_skillId, assessmentType) => {
        assert.equal(assessmentType, "FINAL");
        return [finalQuestion];
      },
    },
    quizStates: {
      create: async () => undefined,
    },
  });

  const result = await assessmentService.startFinalAssessment("student-1");

  assert.equal(terminatedSession.status, "Terminated");
  assert.equal(createdSession.assessment_type, "FINAL");
  assert.equal(createdSession.status, "Paused");
  assert.equal(result.session_id, 23);
  assert.equal(result.question.question_id, finalQuestion.question_id);
  assert.equal(Object.hasOwn(result.question, "correct_option"), false);
  assert.equal(Object.hasOwn(result.question, "explanation"), false);
});

test("timed-out FINAL assessment cannot be returned as resumable", async (t) => {
  await assertTerminalSessionRejected(
    t,
    "Timed Out",
    "ASSESSMENT_TIME_EXPIRED"
  );
});

test("completed FINAL assessment cannot be returned as resumable", async (t) => {
  await assertTerminalSessionRejected(
    t,
    "Completed",
    "ASSESSMENT_ALREADY_COMPLETED"
  );
});

test("assessment errors preserve lifecycle codes for the frontend", () => {
  const { errorHandler } = require("../src/middleware/errorHandler");

  for (const code of [
    "ASSESSMENT_TIME_EXPIRED",
    "ASSESSMENT_TERMINATED",
    "ASSESSMENT_ALREADY_COMPLETED",
  ]) {
    const response = {
      statusCode: null,
      body: null,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    errorHandler(
      Object.assign(new Error("Assessment state"), {
        status: 409,
        code,
      }),
      {},
      response,
      () => undefined
    );

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, code);
  }
});
