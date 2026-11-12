const test = require("node:test");
const assert = require("node:assert/strict");
const questionBank = require("../prisma/data/initial-assessment-questions.json");

const { roleRequirements } = require("../prisma/seed-domain-required-skills");
const assessmentService = require("../src/services/assessmentService");
const {
  aiEngineerQuestions,
  seedAiEngineerQuestions,
  validateAiEngineerQuestions,
} = require("../prisma/seed-ai-engineer-questions");

function createPrismaStub() {
  const questions = [];
  const skillNames = roleRequirements
    .find(({ role }) => role === "AI Engineer")
    .skills.map(([skill_name], index) => ({ skill_id: index + 1, skill_name }));
  const difficultyLevels = ["Easy", "Medium", "Hard"].map(
    (difficulty_name, index) => ({
      difficulty_id: index + 1,
      difficulty_name,
    })
  );

  return {
    questions,
    client: {
      $transaction: async (callback) =>
        callback({
          skill: {
            findMany: async () => skillNames,
          },
          difficultyLevel: {
            findMany: async () => difficultyLevels,
          },
          question: {
            findMany: async ({ where }) =>
              questions.filter(
                (question) =>
                  where.skill_id.in.includes(question.skill_id) &&
                  where.assessment_type === question.assessment_type &&
                  where.question_text.in.includes(question.question_text)
              ),
            createMany: async ({ data }) => {
              questions.push(...data);
              return { count: data.length };
            },
          },
        }),
    },
  };
}

test("AI Engineer has five unique, valid questions for every required skill", () => {
  const aiEngineer = roleRequirements.find(
    ({ role }) => role === "AI Engineer"
  );
  assert.ok(aiEngineer);
  assert.doesNotThrow(() => validateAiEngineerQuestions(aiEngineerQuestions));

  for (const [skillName] of aiEngineer.skills) {
    const questions = aiEngineerQuestions.filter(
      (question) => question.skill === skillName
    );
    assert.equal(questions.length, 5, `${skillName} must have five questions`);
    assert.deepEqual(
      new Set(questions.map((question) => question.difficulty)),
      new Set(["Easy", "Medium", "Hard"]),
      `${skillName} must be covered at all three difficulty levels`
    );
  }

  const existingQuestionKeys = new Set(
    questionBank.questions.map(
      (question) =>
        `${question.skill}\u0000${question.question_text.trim().toLowerCase()}`
    )
  );
  for (const question of aiEngineerQuestions) {
    assert.equal(
      existingQuestionKeys.has(
        `${question.skill}\u0000${question.question_text.trim().toLowerCase()}`
      ),
      false,
      `Question duplicates the existing bank: ${question.question_text}`
    );
  }
});

test("AI Engineer seed is idempotent and uses existing question fields", async () => {
  const { client, questions } = createPrismaStub();

  const firstRun = await seedAiEngineerQuestions(client);
  const secondRun = await seedAiEngineerQuestions(client);

  assert.deepEqual(firstRun, {
    role: "AI Engineer",
    assessment_type: "INITIAL",
    inserted: 25,
    already_present: 0,
  });
  assert.deepEqual(secondRun, {
    role: "AI Engineer",
    assessment_type: "INITIAL",
    inserted: 0,
    already_present: 25,
  });
  assert.equal(questions.length, 25);
  assert.ok(
    questions.every(
      (question) =>
        Number.isInteger(question.skill_id) &&
        Number.isInteger(question.difficulty_id) &&
        question.assessment_type === "INITIAL" &&
        question.is_active === true &&
        question.explanation
    )
  );
});

test("question GET responses omit the answer key and explanation", async (t) => {
  const repo = require("../src/data");
  const originals = {
    findById: repo.skills.findById,
    findBySkill: repo.questions.findBySkill,
  };
  repo.skills.findById = async () => ({
    skill_id: 1,
    skill_name: "Python",
  });
  repo.questions.findBySkill = async () => [
    {
      question_id: 1,
      question_text: "A safe question?",
      correct_option: "A",
      explanation: "The answer is A.",
    },
  ];
  t.after(() => {
    repo.skills.findById = originals.findById;
    repo.questions.findBySkill = originals.findBySkill;
  });

  const result = await assessmentService.getQuizQuestions(1, "PRACTICE");
  assert.equal(Object.hasOwn(result.questions[0], "correct_option"), false);
  assert.equal(Object.hasOwn(result.questions[0], "explanation"), false);
});
