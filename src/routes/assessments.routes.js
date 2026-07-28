const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");
//const questionBank = require('../data/questionBank.json')

const router = express.Router();

router.get("/questions", authRequired, async (req, res, next) => {
  try {
    // Allow only students
    if (req.user.role !== "student") {
      return res.status(403).json({
        error: "Only students can access assessment questions.",
      });
    }

    // Get logged-in user
    const user = await repo.users.findById(req.user.sub);

    if (!user || !user.career_goal) {
      return res.status(404).json({
        error: "Career goal not found.",
      });
    }

    // Get career goal with required skills
    const domainRole = await repo.domainRoles.findByName(user.career_goal);

    if (!domainRole) {
      return res.status(404).json({
        error: "Career goal not found.",
      });
    }

    // Extract required skill IDs
    const skillIds = domainRole.requiredSkills.map(
      (requiredSkill) => requiredSkill.skill_id
    );

    // Fetch all questions
    const questions = await repo.questions.findBySkillIds(skillIds);

    // Group questions by skill
    const groupedQuestions = {};

    for (const question of questions) {
      const skillName = question.skill.skill_name;

      if (!groupedQuestions[skillName]) {
        groupedQuestions[skillName] = [];
      }

      groupedQuestions[skillName].push({
        id: question.id,
        text: question.question_text,
        options: [
          question.option_a,
          question.option_b,
          question.option_c,
          question.option_d,
        ],
      });
    }

    return res.json({
      careerGoal: user.career_goal,

      skills: domainRole.requiredSkills.map(
        (requiredSkill) => requiredSkill.skill.skill_name
      ),

      questions: groupedQuestions,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/initial", authRequired, async (req, res, next) => {
  try {
    // 1. Allow only students
    if (req.user.role !== "student") {
      return res.status(403).json({
        error: "Only students can submit the initial assessment.",
      });
    }

    // 2. Prevent retaking the assessment
    const existingAssessment =
      await repo.assessments.findInitialByUser(req.user.sub);

    if (existingAssessment) {
      return res.status(409).json({
        error: "Initial assessment has already been completed.",
      });
    }

    // 3. Get student's profile
    const profile = await repo.profiles.findByUserId(req.user.sub);
    if (!profile || !profile.career_goal) {
      return res.status(404).json({
        error: "Career goal not found.",
      });
    }

    // 4. Load question bank for the student's career goal
    const goalQuestions = questionBank.careerGoals[profile.career_goal];

    if (!goalQuestions) {
      return res.status(404).json({
        error: "No assessment found for this career goal.",
      });
    }

    // 5. Validate request body
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        error: "Assessment answers are required.",
      });
    }

    // =====================================================
    // 6. Create a lookup map of all questions
    // =====================================================

    const questionMap = new Map();

    for (const [skill, questions] of Object.entries(goalQuestions.questions)) {
      for (const question of questions) {
        questionMap.set(question.id, {
          ...question,
          skill,
        });
      }
    }

    // =====================================================
    // 7. Prepare counters
    // =====================================================

    let obtainedMarks = 0;

    const totalMarks = questionMap.size;

    const skillBreakdown = {};

    for (const skill of goalQuestions.skills) {
      skillBreakdown[skill] = {
        total: 0,
        correct: 0,
      };
    }

    // =====================================================
    // 8. Grade each answer
    // =====================================================

    for (const answer of answers) {

      const question = questionMap.get(answer.questionId);

      if (!question) {
        continue;
      }

      skillBreakdown[question.skill].total++;

      if (answer.selectedIndex === question.correctIndex) {
        obtainedMarks++;

        skillBreakdown[question.skill].correct++;
      }
    }
    // 9. Calculate overall score

    const score = Number(
      ((obtainedMarks / totalMarks) * 100).toFixed(2)
    )
    // 10. Calculate percentage for each skill

    Object.keys(skillBreakdown).forEach((skill) => {
      const data = skillBreakdown[skill];

      data.percentage =
        data.total === 0
          ? 0
          : Number(
              ((data.correct / data.total) * 100).toFixed(2)
            );
    });

    // 11. TEMPORARY RESPONSE
    // (We'll replace this with DB save next)
    const assessment = await repo.assessments.createInitial({
      user_id: req.user.sub,
      type: "INITIAL_SKILL_ASSESSMENT",
      career_goal: profile.career_goal,
      is_initial: true,
      score,
      obtained_marks: obtainedMarks,
      total_marks: totalMarks,
      answers: skillBreakdown,
      completed: true,
      started_at: new Date(),
      completed_at: new Date(),
      date_taken: new Date(),
    });
    return res.status(201).json({
      message: "Initial assessment submitted successfully.",
      readinessScore: assessment.score,
    });

  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/assessments:
 *   post:
 *     tags: [Assessments]
 *     summary: Submit skill test
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, score]
 *             properties:
 *               type: { type: string, example: javascript-basics }
 *               score: { type: number, example: 82 }
 *               answers:
 *                 type: array
 *                 items: { type: object }
 *     responses:
 *       201: { description: Assessment recorded }
 */
router.post("/", authRequired, async (req, res, next) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        error: "Only students can submit assessments.",
      });
    }

    const { type, score, answers } = req.body || {};
    if (!type || typeof score !== "number") {
      return res.status(400).json({ error: "type (string) and score (number) are required" });
    }
    if (score < 0 || score > 100) {
      return res.status(400).json({
        error: "Score must be between 0 and 100.",
      });
    }

    if (answers && !Array.isArray(answers)) {
      return res.status(400).json({
        error: "Answers must be an array.",
      });
    }

    const assessment = await repo.assessments.create({
      user_id: req.user.sub,
      type,
      score,
      answers: answers || [],
    });
    return res.status(201).json(assessment);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/assessments/{id}/results:
 *   get:
 *     tags: [Assessments]
 *     summary: Get assessment results
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Assessment with results }
 *       404: { description: Not found }
 */
router.get("/:id/results", authRequired, async (req, res, next) => {
  try {
    const a = await repo.assessments.findById(req.params.id);
    if (!a) {
      return res.status(404).json({
        error: "Assessment not found.",
      });
    }

    const isOwner = a.user_id === req.user.sub;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "You are not authorized to view this assessment.",
      });
    }
    return res.json(a);
  } catch (err) {
    next(err);
  }
});




module.exports = router;
