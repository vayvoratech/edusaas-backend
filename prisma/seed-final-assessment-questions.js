const fs = require("fs");
const path = require("path");

const questionBankPath = path.join(
  __dirname,
  "data",
  "final-assessment-questions.json"
);
const expectedQuestionCount = 730;
const expectedSkillCount = 73;
const difficultyLevels = [
  { difficulty_name: "Medium", difficulty_order: 2 },
  { difficulty_name: "Hard", difficulty_order: 3 },
  { difficulty_name: "Very Hard", difficulty_order: 4 },
];
const expectedDifficultyCounts = {
  Medium: 4,
  Hard: 3,
  "Very Hard": 3,
};

function loadQuestionBank() {
  const bank = JSON.parse(fs.readFileSync(questionBankPath, "utf8"));
  if (bank.version !== 1 || !Array.isArray(bank.questions)) {
    throw new Error("Final question bank must have version 1 and a questions array.");
  }
  if (bank.questions.length !== expectedQuestionCount) {
    throw new Error(
      `Final question bank has ${bank.questions.length} questions; expected ${expectedQuestionCount}.`
    );
  }

  const grouped = new Map();
  const questionTexts = new Set();
  for (const [index, question] of bank.questions.entries()) {
    for (const field of [
      "skill",
      "difficulty",
      "question_text",
      "option_a",
      "option_b",
      "option_c",
      "option_d",
      "correct_option",
      "assessment_type",
    ]) {
      if (typeof question[field] !== "string" || !question[field].trim()) {
        throw new Error(
          `Question ${index + 1} is missing a valid "${field}" value.`
        );
      }
    }

    if (!Object.hasOwn(expectedDifficultyCounts, question.difficulty)) {
      throw new Error(
        `Question ${index + 1} has unsupported difficulty "${question.difficulty}".`
      );
    }
    if (question.assessment_type !== "FINAL") {
      throw new Error(`Question ${index + 1} must be FINAL.`);
    }
    if (!["A", "B", "C", "D"].includes(question.correct_option)) {
      throw new Error(
        `Question ${index + 1} must use correct_option A, B, C, or D.`
      );
    }
    const options = [
      question.option_a,
      question.option_b,
      question.option_c,
      question.option_d,
    ];
    if (new Set(options).size !== 4) {
      throw new Error(`Question ${index + 1} must have four distinct options.`);
    }
    if (
      question.marks !== undefined &&
      (!Number.isInteger(question.marks) || question.marks <= 0)
    ) {
      throw new Error(
        `Question ${index + 1} marks must be a positive integer.`
      );
    }

    const normalizedText = question.question_text.trim().toLowerCase();
    if (questionTexts.has(normalizedText)) {
      throw new Error(`Question ${index + 1} duplicates another question.`);
    }
    questionTexts.add(normalizedText);

    const counts = grouped.get(question.skill) || {
      total: 0,
      difficulties: new Map(),
    };
    counts.total += 1;
    counts.difficulties.set(
      question.difficulty,
      (counts.difficulties.get(question.difficulty) || 0) + 1
    );
    grouped.set(question.skill, counts);
  }

  for (const [skill, counts] of grouped) {
    if (counts.total !== 10) {
      throw new Error(
        `Skill "${skill}" has ${counts.total} questions; exactly 10 are required.`
      );
    }
    for (const [difficulty, expectedCount] of Object.entries(
      expectedDifficultyCounts
    )) {
      const actualCount = counts.difficulties.get(difficulty) || 0;
      if (actualCount !== expectedCount) {
        throw new Error(
          `Skill "${skill}" has ${actualCount} ${difficulty} questions; ${expectedCount} are required.`
        );
      }
    }
  }
  if (grouped.size !== expectedSkillCount) {
    throw new Error(
      `Final question bank has ${grouped.size} skills; expected ${expectedSkillCount}.`
    );
  }

  return { questions: bank.questions, skills: grouped };
}

function validateDifficultyLevels(existingLevels) {
  for (const expected of difficultyLevels) {
    const sameName = existingLevels.find(
      (level) => level.difficulty_name === expected.difficulty_name
    );
    if (
      sameName &&
      sameName.difficulty_order !== expected.difficulty_order
    ) {
      throw new Error(
        `Difficulty "${expected.difficulty_name}" has unexpected order ${sameName.difficulty_order}; expected ${expected.difficulty_order}.`
      );
    }
    const sameOrder = existingLevels.find(
      (level) => level.difficulty_order === expected.difficulty_order
    );
    if (
      sameOrder &&
      sameOrder.difficulty_name !== expected.difficulty_name
    ) {
      throw new Error(
        `Difficulty order ${expected.difficulty_order} is already assigned to "${sameOrder.difficulty_name}".`
      );
    }
  }
}

async function seedFinalAssessmentQuestions(
  client,
  { applyChanges = false, bank = loadQuestionBank() } = {}
) {
  return client.$transaction(async (tx) => {
    const requiredSkills = await tx.skill.findMany({
      where: { requiredForDomains: { some: {} } },
      select: { skill_id: true, skill_name: true },
    });
    const skillIdsByName = new Map(
      requiredSkills.map((skill) => [skill.skill_name, skill.skill_id])
    );
    const requiredSkillNames = new Set(skillIdsByName.keys());
    const missingSkills = [...requiredSkillNames].filter(
      (skill) => !bank.skills.has(skill)
    );
    const unmappedBankSkills = [...bank.skills.keys()].filter(
      (skill) => !requiredSkillNames.has(skill)
    );
    if (missingSkills.length || unmappedBankSkills.length) {
      throw new Error(
        [
          missingSkills.length
            ? `No FINAL questions for required skills: ${missingSkills.join(", ")}.`
            : "",
          unmappedBankSkills.length
            ? `Question bank skills are not required by any role: ${unmappedBankSkills.join(", ")}.`
            : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
    }

    const existingLevels = await tx.difficultyLevel.findMany();
    validateDifficultyLevels(existingLevels);
    const levelsToCreate = difficultyLevels.filter(
      (expected) =>
        !existingLevels.some(
          (existing) =>
            existing.difficulty_name === expected.difficulty_name
        )
    );

    const existingQuestions = await tx.question.findMany({
      where: { assessment_type: "FINAL" },
      select: { skill_id: true, question_text: true },
    });
    const existingKeys = new Set(
      existingQuestions.map(
        (question) => `${question.skill_id}\u0000${question.question_text}`
      )
    );
    const questionsToCreate = bank.questions.filter((question) => {
      const key = `${skillIdsByName.get(question.skill)}\u0000${question.question_text}`;
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (!applyChanges) {
      return {
        mode: "preview",
        requiredSkillCount: requiredSkillNames.size,
        questionCountInBank: bank.questions.length,
        assessment_type: "FINAL",
        difficultyLevelsToCreate: levelsToCreate,
        questionsToCreate: questionsToCreate.length,
        questionsAlreadyPresent:
          bank.questions.length - questionsToCreate.length,
      };
    }

    const createdLevels = [];
    for (const level of levelsToCreate) {
      createdLevels.push(await tx.difficultyLevel.create({ data: level }));
    }
    const levelsByName = new Map(
      [...existingLevels, ...createdLevels].map((level) => [
        level.difficulty_name,
        level,
      ])
    );
    const missingDifficultyReferences = [
      ...new Set(
        questionsToCreate
          .map((question) => question.difficulty)
          .filter((name) => !levelsByName.has(name))
      ),
    ];
    if (missingDifficultyReferences.length) {
      throw new Error(
        `Cannot insert FINAL questions; missing difficulty levels: ${missingDifficultyReferences.join(", ")}.`
      );
    }

    if (questionsToCreate.length) {
      await tx.question.createMany({
        data: questionsToCreate.map((question) => ({
          skill_id: skillIdsByName.get(question.skill),
          difficulty_id: levelsByName.get(question.difficulty).difficulty_id,
          question_text: question.question_text,
          option_a: question.option_a,
          option_b: question.option_b,
          option_c: question.option_c,
          option_d: question.option_d,
          correct_option: question.correct_option,
          marks: question.marks ?? 1,
          is_active: true,
          assessment_type: "FINAL",
        })),
      });
    }

    return {
      mode: "applied",
      requiredSkillCount: requiredSkillNames.size,
      questionCountInBank: bank.questions.length,
      assessment_type: "FINAL",
      difficultyLevelsCreated: createdLevels.length,
      questionsCreated: questionsToCreate.length,
      questionsAlreadyPresent:
        bank.questions.length - questionsToCreate.length,
    };
  });
}

function loadTargetEnvironment(target) {
  if (!["dev", "stage"].includes(target)) {
    throw new Error("Pass --target=dev or --target=stage.");
  }

  const environmentPath = path.join(__dirname, "..", `.env.${target}`);
  if (!fs.existsSync(environmentPath)) {
    throw new Error(
      `Cannot target ${target}: ${path.basename(environmentPath)} is missing. Refusing to fall back to .env.`
    );
  }

  const dotenv = require("dotenv");
  const loaded = dotenv.config({ path: environmentPath, override: true });
  if (loaded.error || !loaded.parsed || !loaded.parsed.DATABASE_URL) {
    throw new Error(
      `${path.basename(environmentPath)} must define DATABASE_URL. No connection values were displayed.`
    );
  }
  process.env.APP_ENV = target;
  require("../src/config/env");
}

async function main() {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg?.slice("--target=".length);
  loadTargetEnvironment(target);

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const result = await seedFinalAssessmentQuestions(prisma, {
      applyChanges: process.argv.includes("--apply"),
    });
    console.log(JSON.stringify({ target, ...result }, null, 2));
    if (result.mode === "preview") {
      console.log(
        "Preview only. Add --apply to insert missing FINAL questions."
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[seed-final-assessment-questions] failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  expectedDifficultyCounts,
  seedFinalAssessmentQuestions,
  validateDifficultyLevels,
};
