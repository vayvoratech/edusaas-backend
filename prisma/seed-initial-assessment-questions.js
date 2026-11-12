const fs = require("fs");
const path = require("path");
require("../src/config/env");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const questionBankPath = path.join(
  __dirname,
  "data",
  "initial-assessment-questions.json"
);
const expectedQuestionCount = 730;
const expectedSkillCount = 73;
const difficultyLevels = [
  { difficulty_name: "Easy", difficulty_order: 1 },
  { difficulty_name: "Medium", difficulty_order: 2 },
  { difficulty_name: "Hard", difficulty_order: 3 },
];
const expectedDifficultyCounts = {
  Easy: 4,
  Medium: 3,
  Hard: 3,
};
// Final assessments use the same validated bank, but remain isolated by
// assessment type so the final flow can enforce its own adaptive rules.
const assessmentTypesToSeed = ["INITIAL", "FINAL", "PRACTICE"];

function loadQuestionBank() {
  const bank = JSON.parse(fs.readFileSync(questionBankPath, "utf8"));
  if (bank.version !== 1 || !Array.isArray(bank.questions)) {
    throw new Error("Question bank must have version 1 and a questions array.");
  }
  if (bank.questions.length !== expectedQuestionCount) {
    throw new Error(
      `Question bank has ${bank.questions.length} questions; expected ${expectedQuestionCount}.`
    );
  }

  const grouped = new Map();
  const questionTexts = new Set();
  for (const [index, question] of bank.questions.entries()) {
    const requiredFields = [
      "skill",
      "difficulty",
      "question_text",
      "option_a",
      "option_b",
      "option_c",
      "option_d",
      "correct_option",
      "assessment_type",
    ];
    for (const field of requiredFields) {
      if (typeof question[field] !== "string" || !question[field].trim()) {
        throw new Error(
          `Question ${index + 1} is missing a valid "${field}" value.`
        );
      }
    }
    const questionText = question.question_text.trim();
    if (/concept best fits this description:\s*$/i.test(questionText)) {
      throw new Error(
        `Question ${index + 1} has an unfinished placeholder stem.`
      );
    }
    if (questionTexts.has(questionText)) {
      throw new Error(`Question ${index + 1} duplicates another question.`);
    }
    questionTexts.add(questionText);

    if (
      !Object.prototype.hasOwnProperty.call(
        expectedDifficultyCounts,
        question.difficulty
      )
    ) {
      throw new Error(
        `Question ${index + 1} has unsupported difficulty "${question.difficulty}".`
      );
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
    if (new Set(options).size !== options.length) {
      throw new Error(`Question ${index + 1} must have four distinct options.`);
    }
    if (question.assessment_type !== "INITIAL") {
      throw new Error(`Question ${index + 1} must be INITIAL.`);
    }
    if (
      question.marks !== undefined &&
      (!Number.isInteger(question.marks) || question.marks <= 0)
    ) {
      throw new Error(
        `Question ${index + 1} marks must be a positive integer.`
      );
    }

    const counts = grouped.get(question.skill) || {
      total: 0,
      difficulties: new Map(),
      questionTexts: new Set(),
    };
    if (counts.questionTexts.has(question.question_text)) {
      throw new Error(
        `Skill "${question.skill}" contains duplicate question text.`
      );
    }
    counts.questionTexts.add(question.question_text);
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
      `Question bank has ${grouped.size} skills; expected ${expectedSkillCount}.`
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
        `Difficulty "${expected.difficulty_name}" already has order ${sameName.difficulty_order}; expected ${expected.difficulty_order}. No changes were made.`
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
        `Difficulty order ${expected.difficulty_order} is already assigned to "${sameOrder.difficulty_name}". No changes were made.`
      );
    }
  }
}

async function main() {
  const applyChanges = process.argv.includes("--apply");
  const { questions, skills: bankSkills } = loadQuestionBank();

  const result = await prisma.$transaction(async (tx) => {
    const requiredSkills = await tx.domainRequiredSkill.findMany({
      select: {
        domainRole: {
          select: {
            domain_name: true,
          },
        },
        skill: {
          select: {
            skill_id: true,
            skill_name: true,
          },
        },
      },
    });
    const skillIdsByName = new Map();
    for (const mapping of requiredSkills) {
      skillIdsByName.set(mapping.skill.skill_name, mapping.skill.skill_id);
    }
    const roleSkills = new Map();
    for (const mapping of requiredSkills) {
      const skillNames = roleSkills.get(mapping.domainRole.domain_name) || new Set();
      skillNames.add(mapping.skill.skill_name);
      roleSkills.set(mapping.domainRole.domain_name, skillNames);
    }
    const roleCoverage = [...roleSkills]
      .map(([domain, skills]) => ({
        domain,
        skillCount: skills.size,
        questionCount: skills.size * 10,
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain));

    const requiredSkillNames = new Set(skillIdsByName.keys());
    const missingBankSkills = [...requiredSkillNames].filter(
      (skillName) => !bankSkills.has(skillName)
    );
    const unusedBankSkills = [...bankSkills.keys()].filter(
      (skillName) => !requiredSkillNames.has(skillName)
    );
    if (missingBankSkills.length || unusedBankSkills.length) {
      throw new Error(
        [
          missingBankSkills.length
            ? `No questions for required skills: ${missingBankSkills.join(", ")}.`
            : "",
          unusedBankSkills.length
            ? `Question bank contains skills not mapped to a role: ${unusedBankSkills.join(", ")}.`
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
          (level) => level.difficulty_name === expected.difficulty_name
        )
    );

    const existingQuestions = await tx.question.findMany({
      where: { assessment_type: { in: assessmentTypesToSeed } },
      select: {
        question_id: true,
        skill_id: true,
        question_text: true,
        is_active: true,
        assessment_type: true,
      },
    });
    const questionsToDeactivate = existingQuestions.filter(
      (question) =>
        question.is_active &&
        /concept best fits this description:\s*$/i.test(question.question_text)
    );
    const existingQuestionKeys = new Set(
      existingQuestions.map(
        (question) =>
          `${question.assessment_type}\u0000${question.skill_id}\u0000${question.question_text}`
      )
    );
    const inactiveQuestionIdsByKey = new Map(
      existingQuestions
        .filter((question) => !question.is_active)
        .map((question) => [
          `${question.assessment_type}\u0000${question.skill_id}\u0000${question.question_text}`,
          question.question_id,
        ])
    );
    const questionsToActivate = [];
    const questionsToCreate = [];
    for (const question of questions) {
      const skillId = skillIdsByName.get(question.skill);
      for (const assessmentType of assessmentTypesToSeed) {
        const key = `${assessmentType}\u0000${skillId}\u0000${question.question_text}`;
        if (existingQuestionKeys.has(key)) {
          const inactiveQuestionId = inactiveQuestionIdsByKey.get(key);
          if (inactiveQuestionId) questionsToActivate.push(inactiveQuestionId);
          continue;
        }
        existingQuestionKeys.add(key);
        questionsToCreate.push({
          skill_id: skillId,
          difficulty_name: question.difficulty,
          question_text: question.question_text,
          option_a: question.option_a,
          option_b: question.option_b,
          option_c: question.option_c,
          option_d: question.option_d,
          correct_option: question.correct_option,
          marks: question.marks ?? 1,
          is_active: true,
          assessment_type: assessmentType,
        });
      }
    }
    const expectedQuestionRows = questions.length * assessmentTypesToSeed.length;

    if (!applyChanges) {
      return {
        mode: "preview",
        requiredSkillCount: requiredSkillNames.size,
        mappedSkillCount: requiredSkills.length,
        roleCoverage,
        questionCountInBank: questions.length,
        assessmentTypes: assessmentTypesToSeed,
        difficultyLevelsToCreate: levelsToCreate,
        questionsToCreate: questionsToCreate.length,
        questionsAlreadyPresent: expectedQuestionRows - questionsToCreate.length,
        questionsToActivate: questionsToActivate.length,
        questionsToDeactivate: questionsToDeactivate.length,
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
    const unresolvedDifficultyNames = [
      ...new Set(
        questionsToCreate
          .map((question) => question.difficulty_name)
          .filter((difficultyName) => !levelsByName.has(difficultyName))
      ),
    ];
    if (unresolvedDifficultyNames.length) {
      throw new Error(
        `Cannot insert questions because difficulty levels are missing: ${unresolvedDifficultyNames.join(", ")}.`
      );
    }

    if (questionsToDeactivate.length) {
      await tx.question.updateMany({
        where: {
          question_id: {
            in: questionsToDeactivate.map((question) => question.question_id),
          },
        },
        data: { is_active: false },
      });
    }

    if (questionsToActivate.length) {
      await tx.question.updateMany({
        where: {
          question_id: { in: questionsToActivate },
        },
        data: { is_active: true },
      });
    }

    if (questionsToCreate.length) {
      await tx.question.createMany({
        data: questionsToCreate.map(({ difficulty_name, ...question }) => ({
          ...question,
          difficulty_id: levelsByName.get(difficulty_name).difficulty_id,
        })),
      });
    }

    return {
      mode: "applied",
      requiredSkillCount: requiredSkillNames.size,
      mappedSkillCount: requiredSkills.length,
      roleCoverage,
      questionCountInBank: questions.length,
      assessmentTypes: assessmentTypesToSeed,
      difficultyLevelsCreated: createdLevels.length,
      questionsCreated: questionsToCreate.length,
      questionsAlreadyPresent: expectedQuestionRows - questionsToCreate.length,
      questionsReactivated: questionsToActivate.length,
      questionsDeactivated: questionsToDeactivate.length,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.mode === "preview") {
    console.log("Preview only. Pass --apply to insert missing levels/questions.");
  }
}

main()
  .catch((error) => {
    console.error("Initial assessment question seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
