const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const questionBank = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "prisma",
      "data",
      "final-assessment-questions.json"
    ),
    "utf8"
  )
);
const initialQuestionBank = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "prisma",
      "data",
      "initial-assessment-questions.json"
    ),
    "utf8"
  )
);
const {
  expectedDifficultyCounts,
  seedFinalAssessmentQuestions,
} = require("../prisma/seed-final-assessment-questions");

const skills = [...new Set(questionBank.questions.map((question) => question.skill))];
const bank = {
  questions: questionBank.questions,
  skills: new Map(skills.map((skill) => [skill, {}])),
};

function createClientStub() {
  const insertedQuestions = [];
  const insertedDifficulties = [];
  const events = [];
  const client = {
    $transaction: async (callback) =>
      callback({
        skill: {
          findMany: async () =>
            skills.map((skill_name, index) => ({
              skill_id: index + 1,
              skill_name,
            })),
        },
        difficultyLevel: {
          findMany: async () => [...insertedDifficulties],
          create: async ({ data }) => {
            events.push(`difficulty:${data.difficulty_name}`);
            const row = {
              difficulty_id: insertedDifficulties.length + 5,
              ...data,
            };
            insertedDifficulties.push(row);
            return row;
          },
        },
        question: {
          findMany: async ({ where }) => {
            assert.equal(where.assessment_type, "FINAL");
            return insertedQuestions.map(
              ({ skill_id, question_text }) => ({ skill_id, question_text })
            );
          },
          createMany: async ({ data }) => {
            events.push("questions");
            insertedQuestions.push(...data);
            return { count: data.length };
          },
        },
      }),
  };
  return { client, events, insertedDifficulties, insertedQuestions };
}

test("FINAL bank has ten unique questions per required skill with the expected difficulty split", () => {
  assert.equal(questionBank.questions.length, 730);
  assert.equal(skills.length, 73);
  assert.deepEqual(
    [...skills].sort(),
    [
      ...new Set(initialQuestionBank.questions.map((question) => question.skill)),
    ].sort(),
    "FINAL coverage must match the existing required-skill bank"
  );

  const initialQuestionTexts = new Set(
    initialQuestionBank.questions.map((question) =>
      question.question_text.trim().toLowerCase()
    )
  );
  const countsBySkill = new Map();
  for (const question of questionBank.questions) {
    assert.equal(question.assessment_type, "FINAL");
    assert.equal(
      initialQuestionTexts.has(question.question_text.trim().toLowerCase()),
      false,
      "FINAL questions must not duplicate INITIAL question stems"
    );
    assert.ok(["A", "B", "C", "D"].includes(question.correct_option));
    const options = [
      question.option_a,
      question.option_b,
      question.option_c,
      question.option_d,
    ];
    assert.ok(options.every((option) => option.trim()));
    assert.equal(new Set(options).size, 4);

    const counts = countsBySkill.get(question.skill) || {
      total: 0,
      Medium: 0,
      Hard: 0,
      "Very Hard": 0,
      questionTexts: new Set(),
    };
    counts.total += 1;
    counts[question.difficulty] += 1;
    assert.equal(counts.questionTexts.has(question.question_text), false);
    counts.questionTexts.add(question.question_text);
    countsBySkill.set(question.skill, counts);
  }

  for (const [skill, counts] of countsBySkill) {
    assert.equal(counts.total, 10, `${skill} must have 10 questions`);
    assert.deepEqual(
      {
        Medium: counts.Medium,
        Hard: counts.Hard,
        "Very Hard": counts["Very Hard"],
      },
      expectedDifficultyCounts,
      `${skill} has an incorrect difficulty split`
    );
  }
});

test("FINAL seed creates missing difficulties before inserting FINAL questions and is idempotent", async () => {
  const { client, events, insertedDifficulties, insertedQuestions } =
    createClientStub();

  const preview = await seedFinalAssessmentQuestions(client, {
    bank,
  });
  assert.equal(preview.mode, "preview");
  assert.equal(preview.questionsToCreate, 730);
  assert.equal(preview.assessment_type, "FINAL");
  assert.equal(insertedQuestions.length, 0);

  const firstApply = await seedFinalAssessmentQuestions(client, {
    applyChanges: true,
    bank,
  });
  assert.equal(firstApply.questionsCreated, 730);
  assert.equal(insertedDifficulties.length, 3);
  assert.deepEqual(events.slice(0, 3), [
    "difficulty:Medium",
    "difficulty:Hard",
    "difficulty:Very Hard",
  ]);
  assert.equal(events[3], "questions");
  assert.ok(
    insertedQuestions.every(
      (question) =>
        question.assessment_type === "FINAL" &&
        Number.isInteger(question.skill_id) &&
        Number.isInteger(question.difficulty_id)
    )
  );

  const secondApply = await seedFinalAssessmentQuestions(client, {
    applyChanges: true,
    bank,
  });
  assert.equal(secondApply.questionsCreated, 0);
  assert.equal(secondApply.questionsAlreadyPresent, 730);
  assert.equal(insertedQuestions.length, 730);
});
