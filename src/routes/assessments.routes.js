const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

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
