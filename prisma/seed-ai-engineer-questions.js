require("../src/config/env");

const { PrismaClient } = require("@prisma/client");
const { roleRequirements } = require("./seed-domain-required-skills");

const prisma = new PrismaClient();
const roleName = "AI Engineer";
const assessmentType = "INITIAL";
const supportedDifficulties = ["Easy", "Medium", "Hard"];

const aiEngineerQuestions = [
  {
    skill: "Python",
    difficulty: "Easy",
    question_text: "What does list.pop() return when called without an index on a non-empty list?",
    option_a: "The first item without removing it",
    option_b: "The last item, which it also removes",
    option_c: "The number of items in the list",
    option_d: "A copy of the entire list",
    correct_option: "B",
    explanation: "With no index argument, pop removes and returns the final list item.",
  },
  {
    skill: "Python",
    difficulty: "Easy",
    question_text: "What does enumerate(values) yield during iteration over a Python list?",
    option_a: "Pairs containing each index and its corresponding value",
    option_b: "Only the values, in reverse order",
    option_c: "A sorted copy of the values",
    option_d: "Pairs containing each value and its memory address",
    correct_option: "A",
    explanation: "enumerate yields (index, value) pairs, starting at index 0 unless start is specified.",
  },
  {
    skill: "Python",
    difficulty: "Medium",
    question_text: "Given values = [10, 20, 30, 40], what does values[1:3] return?",
    option_a: "[10, 20, 30]",
    option_b: "[20, 30, 40]",
    option_c: "[20, 30]",
    option_d: "[30, 40]",
    correct_option: "C",
    explanation: "A slice includes its start index and excludes its stop index.",
  },
  {
    skill: "Python",
    difficulty: "Medium",
    question_text: 'What does {"mode": "fast"}.get("timeout", 30) return?',
    option_a: '"timeout"',
    option_b: "None",
    option_c: "30",
    option_d: '"fast"',
    correct_option: "C",
    explanation: "dict.get returns its default value when the requested key is absent.",
  },
  {
    skill: "Python",
    difficulty: "Hard",
    question_text: "After shallow = copy.copy(original), original is a list containing a nested list. What is true about shallow[0]?",
    option_a: "It is a deep copy of the nested list",
    option_b: "It refers to the same nested list as original[0]",
    option_c: "It is always converted to a tuple",
    option_d: "It is omitted from shallow",
    correct_option: "B",
    explanation: "A shallow copy creates a new outer container but keeps references to nested objects.",
  },
  {
    skill: "SQL",
    difficulty: "Easy",
    question_text: "Which predicate correctly finds rows where manager_id has no value?",
    option_a: "manager_id = NULL",
    option_b: "manager_id == NULL",
    option_c: "manager_id IS NULL",
    option_d: "manager_id EQUALS NULL",
    correct_option: "C",
    explanation: "SQL tests for NULL using IS NULL; equality comparisons with NULL evaluate as unknown.",
  },
  {
    skill: "SQL",
    difficulty: "Easy",
    question_text: "In a query over orders, what does COUNT(*) count?",
    option_a: "Only rows whose every column is non-NULL",
    option_b: "All rows in the selected group",
    option_c: "Only distinct rows",
    option_d: "The number of non-NULL customer_id values only",
    correct_option: "B",
    explanation: "COUNT(*) counts rows, including rows that contain NULL values.",
  },
  {
    skill: "SQL",
    difficulty: "Medium",
    question_text: "A LEFT JOIN has a left-table row with no matching right-table row. What happens to that result row?",
    option_a: "It is omitted from the result",
    option_b: "It remains, with NULL values for right-table columns",
    option_c: "It is repeated once for every right-table row",
    option_d: "The query fails",
    correct_option: "B",
    explanation: "A LEFT JOIN preserves every left row and supplies NULLs for unmatched right-side columns.",
  },
  {
    skill: "SQL",
    difficulty: "Medium",
    question_text: "Which clause assigns a sequential number to rows separately within each department, ordered by salary descending?",
    option_a: "ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC)",
    option_b: "COUNT(*) GROUP BY department_id ORDER BY salary DESC",
    option_c: "RANK() GROUP BY department_id PARTITION BY salary",
    option_d: "ROW_NUMBER() WHERE department_id ORDER BY salary DESC",
    correct_option: "A",
    explanation: "ROW_NUMBER is a window function; PARTITION BY restarts numbering for each department.",
  },
  {
    skill: "SQL",
    difficulty: "Hard",
    question_text: "A query needs to return one highest-paid employee per department and exactly one row even when top salaries tie. Which expression provides that behavior?",
    option_a: "RANK() OVER (PARTITION BY department_id ORDER BY salary DESC)",
    option_b: "ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY salary DESC, employee_id)",
    option_c: "COUNT(*) OVER (PARTITION BY department_id)",
    option_d: "DENSE_RANK() OVER (ORDER BY salary DESC)",
    correct_option: "B",
    explanation: "ROW_NUMBER gives each row a unique position; the employee_id tie-breaker makes the selection deterministic.",
  },
  {
    skill: "Machine Learning",
    difficulty: "Easy",
    question_text: "A binary classifier reports a positive prediction. In its confusion matrix, what is a false positive?",
    option_a: "A positive prediction for an actually negative example",
    option_b: "A negative prediction for an actually negative example",
    option_c: "A positive prediction for an actually positive example",
    option_d: "A negative prediction for an actually positive example",
    correct_option: "A",
    explanation: "A false positive is a predicted positive whose true class is negative.",
  },
  {
    skill: "Machine Learning",
    difficulty: "Easy",
    question_text: "For binary classification, what does logistic regression conventionally produce before a decision threshold is applied?",
    option_a: "A probability between 0 and 1 for the positive class",
    option_b: "A cluster identifier with no class probability",
    option_c: "A probability that can only be exactly 0 or 1",
    option_d: "A continuous target value with no probability interpretation",
    correct_option: "A",
    explanation: "The logistic function maps the model score to a value between 0 and 1, commonly interpreted as class probability.",
  },
  {
    skill: "Machine Learning",
    difficulty: "Medium",
    question_text: "When should a held-out test set normally be used during model development?",
    option_a: "Repeatedly, to choose every hyperparameter",
    option_b: "Only for fitting the model weights",
    option_c: "For a final evaluation after model choices are made using training and validation data",
    option_d: "To replace all training examples",
    correct_option: "C",
    explanation: "Keeping the test set out of model selection provides a less biased final performance estimate.",
  },
  {
    skill: "Machine Learning",
    difficulty: "Medium",
    question_text: "An ROC AUC of 0.5 most directly indicates what for a binary classifier?",
    option_a: "Perfect ranking of positive examples above negative examples",
    option_b: "Ranking performance no better than random ordering, under the usual interpretation",
    option_c: "Exactly half of all predictions are correct",
    option_d: "The model predicts only positive examples",
    correct_option: "B",
    explanation: "ROC AUC measures ranking discrimination; 0.5 corresponds to chance-level ranking.",
  },
  {
    skill: "Machine Learning",
    difficulty: "Hard",
    question_text: "Why should a preprocessing step such as standardization be fitted separately inside each cross-validation training fold?",
    option_a: "To let each fold use statistics calculated only from its training partition",
    option_b: "To make all features have identical predictive importance",
    option_c: "To increase the number of labels in the validation partition",
    option_d: "To guarantee that every fold has the same examples",
    correct_option: "A",
    explanation: "Fitting preprocessing on held-out fold data leaks information from validation examples into training.",
  },
  {
    skill: "Deep Learning",
    difficulty: "Easy",
    question_text: "What is the output of the ReLU activation for an input value of -2?",
    option_a: "-2",
    option_b: "2",
    option_c: "0",
    option_d: "1",
    correct_option: "C",
    explanation: "ReLU computes max(0, x), so a negative input maps to zero.",
  },
  {
    skill: "Deep Learning",
    difficulty: "Easy",
    question_text: "For finite logits in a multiclass classification model, what property do softmax outputs have?",
    option_a: "They are non-negative and sum to 1",
    option_b: "They are integers that sum to the class count",
    option_c: "They may be negative but always have mean 0",
    option_d: "They are always equal across classes",
    correct_option: "A",
    explanation: "Softmax converts logits into non-negative values normalized to sum to one.",
  },
  {
    skill: "Deep Learning",
    difficulty: "Medium",
    question_text: "In standard dropout, what happens to randomly selected activations during training?",
    option_a: "They are set to zero for that training pass",
    option_b: "They are permanently removed from the model",
    option_c: "They are all replaced with the batch mean",
    option_d: "They are set to one for every inference pass",
    correct_option: "A",
    explanation: "Dropout randomly masks activations while training; it is disabled for ordinary inference.",
  },
  {
    skill: "Deep Learning",
    difficulty: "Medium",
    question_text: "When batch normalization is used in inference mode, which statistics are normally used?",
    option_a: "Statistics computed from the current inference batch only",
    option_b: "Moving estimates accumulated during training",
    option_c: "The target labels from the training set",
    option_d: "The gradients from the previous optimizer step",
    correct_option: "B",
    explanation: "Inference uses the running mean and variance accumulated during training, rather than current-batch statistics.",
  },
  {
    skill: "Deep Learning",
    difficulty: "Hard",
    question_text: "For mutually exclusive classes, why is softmax commonly paired with categorical cross-entropy?",
    option_a: "It compares a normalized class-probability distribution with the target distribution",
    option_b: "It guarantees zero training error after one update",
    option_c: "It removes the need for labeled examples",
    option_d: "It converts the network into a regression model",
    correct_option: "A",
    explanation: "Softmax produces a class distribution, and categorical cross-entropy measures its disagreement with the target distribution.",
  },
  {
    skill: "Git",
    difficulty: "Easy",
    question_text: "A file is already tracked by Git and then added to .gitignore. What happens to the tracked file?",
    option_a: "Git automatically removes it from the repository",
    option_b: "Git continues tracking it; ignore rules do not untrack existing files",
    option_c: "Git renames it with a .ignored suffix",
    option_d: "Git moves it into the staging area",
    correct_option: "B",
    explanation: ".gitignore affects untracked files; an already tracked file remains tracked until explicitly removed from the index.",
  },
  {
    skill: "Git",
    difficulty: "Easy",
    question_text: "What does git fetch origin do to the current branch by itself?",
    option_a: "Downloads remote updates without merging them into the current branch",
    option_b: "Deletes every local commit not on origin",
    option_c: "Creates a merge commit automatically",
    option_d: "Pushes local commits to origin",
    correct_option: "A",
    explanation: "fetch updates remote-tracking references and downloads objects; it does not merge into the checked-out branch.",
  },
  {
    skill: "Git",
    difficulty: "Medium",
    question_text: "Which command shows recent local updates to references such as HEAD, including commits no longer reachable from the current branch?",
    option_a: "git reflog",
    option_b: "git clean",
    option_c: "git blame",
    option_d: "git archive",
    correct_option: "A",
    explanation: "The reflog records recent local reference movements and can help locate otherwise unreachable commits.",
  },
  {
    skill: "Git",
    difficulty: "Medium",
    question_text: "What does git bisect help identify?",
    option_a: "The first commit in a range that introduced a regression, using a binary search",
    option_b: "Which remote branch has the most tags",
    option_c: "All files ignored by .gitignore",
    option_d: "The author of every line in a file",
    correct_option: "A",
    explanation: "git bisect narrows down a bad commit by repeatedly testing commits between known good and bad revisions.",
  },
  {
    skill: "Git",
    difficulty: "Hard",
    question_text: "A developer runs git reset --mixed HEAD~1. What happens to the latest commit's changes?",
    option_a: "The branch moves back one commit and the changes remain in the working tree, unstaged",
    option_b: "The branch moves back one commit and the changes are discarded",
    option_c: "A new commit reversing the changes is created",
    option_d: "The changes are moved into a new branch automatically",
    correct_option: "A",
    explanation: "A mixed reset moves HEAD and resets the index, but leaves the working tree changes in place.",
  },
];

function getAiEngineerSkillNames() {
  const requirement = roleRequirements.find(({ role }) => role === roleName);
  if (!requirement) {
    throw new Error(`Role "${roleName}" is missing from seed-domain-required-skills.js.`);
  }
  return requirement.skills.map(([skillName]) => skillName);
}

function validateAiEngineerQuestions(questions = aiEngineerQuestions) {
  const skillNames = getAiEngineerSkillNames();
  const expectedQuestionCount = skillNames.length * 5;
  if (!Array.isArray(questions) || questions.length !== expectedQuestionCount) {
    throw new Error(
      `${roleName} question bank must contain exactly ${expectedQuestionCount} questions.`
    );
  }

  const seenTexts = new Set();
  const countsBySkill = new Map(
    skillNames.map((skillName) => [
      skillName,
      { total: 0, difficulties: new Map() },
    ])
  );
  for (const [index, question] of questions.entries()) {
    const skillCounts = countsBySkill.get(question.skill);
    if (!skillCounts) {
      throw new Error(
        `Question ${index + 1} references a skill not required for ${roleName}: "${question.skill}".`
      );
    }

    const text = question.question_text?.trim();
    if (!text || seenTexts.has(text.toLowerCase())) {
      throw new Error(`Question ${index + 1} has missing or duplicate question text.`);
    }
    seenTexts.add(text.toLowerCase());

    const options = [
      question.option_a,
      question.option_b,
      question.option_c,
      question.option_d,
    ];
    if (
      options.some((option) => typeof option !== "string" || !option.trim()) ||
      new Set(options).size !== 4
    ) {
      throw new Error(
        `Question ${index + 1} must have four distinct, non-empty options.`
      );
    }
    if (!["A", "B", "C", "D"].includes(question.correct_option)) {
      throw new Error(
        `Question ${index + 1} must use correct_option A, B, C, or D.`
      );
    }
    if (!question.explanation?.trim()) {
      throw new Error(`Question ${index + 1} is missing its explanation.`);
    }
    if (!supportedDifficulties.includes(question.difficulty)) {
      throw new Error(`Question ${index + 1} has an unsupported difficulty.`);
    }

    skillCounts.total += 1;
    skillCounts.difficulties.set(
      question.difficulty,
      (skillCounts.difficulties.get(question.difficulty) || 0) + 1
    );
  }

  for (const [skillName, counts] of countsBySkill) {
    if (
      counts.total !== 5 ||
      supportedDifficulties.some(
        (difficulty) => !counts.difficulties.has(difficulty)
      )
    ) {
      throw new Error(
        `${roleName} must have five questions across all three levels for "${skillName}".`
      );
    }
  }
}

async function seedAiEngineerQuestions(client = prisma) {
  validateAiEngineerQuestions();
  const skillNames = getAiEngineerSkillNames();

  return client.$transaction(async (tx) => {
    const skills = await tx.skill.findMany({
      where: { skill_name: { in: skillNames } },
      select: { skill_id: true, skill_name: true },
    });
    const skillsByName = new Map(
      skills.map((skill) => [skill.skill_name, skill])
    );
    const missingSkills = skillNames.filter(
      (skillName) => !skillsByName.has(skillName)
    );
    if (missingSkills.length) {
      throw new Error(
        `Missing AI Engineer skills; run the domain-required-skills seed first: ${missingSkills.join(", ")}.`
      );
    }

    const difficultyLevels = await tx.difficultyLevel.findMany({
      where: { difficulty_name: { in: supportedDifficulties } },
      select: { difficulty_id: true, difficulty_name: true },
    });
    const difficultyIds = new Map(
      difficultyLevels.map((level) => [
        level.difficulty_name,
        level.difficulty_id,
      ])
    );
    const missingDifficulties = supportedDifficulties.filter(
      (difficulty) => !difficultyIds.has(difficulty)
    );
    if (missingDifficulties.length) {
      throw new Error(
        `Missing difficulty levels; run the existing initial question-bank seed first: ${missingDifficulties.join(", ")}.`
      );
    }

    const existingQuestions = await tx.question.findMany({
      where: {
        skill_id: { in: skillNames.map((name) => skillsByName.get(name).skill_id) },
        assessment_type: assessmentType,
        question_text: {
          in: aiEngineerQuestions.map(({ question_text }) => question_text),
        },
      },
      select: { skill_id: true, question_text: true },
    });
    const existingKeys = new Set(
      existingQuestions.map(
        ({ skill_id, question_text }) => `${skill_id}\u0000${question_text}`
      )
    );
    const questionsToCreate = aiEngineerQuestions
      .filter((question) => {
        const skillId = skillsByName.get(question.skill).skill_id;
        return !existingKeys.has(`${skillId}\u0000${question.question_text}`);
      })
      .map(({ skill, difficulty, ...question }) => ({
        ...question,
        skill_id: skillsByName.get(skill).skill_id,
        difficulty_id: difficultyIds.get(difficulty),
        marks: 1,
        is_active: true,
        assessment_type: assessmentType,
      }));

    if (questionsToCreate.length) {
      await tx.question.createMany({ data: questionsToCreate });
    }

    return {
      role: roleName,
      assessment_type: assessmentType,
      inserted: questionsToCreate.length,
      already_present: aiEngineerQuestions.length - questionsToCreate.length,
    };
  });
}

if (require.main === module) {
  seedAiEngineerQuestions()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error("[seed-ai-engineer-questions] failed:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = {
  aiEngineerQuestions,
  seedAiEngineerQuestions,
  validateAiEngineerQuestions,
};
