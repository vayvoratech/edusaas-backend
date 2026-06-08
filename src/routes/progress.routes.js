const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/progress:
 *   get:
 *     tags: [Progress]
 *     summary: List progress for the current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of progress entries }
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    res.json(await repo.progress.listByUser(req.user.sub));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/progress/{lessonId}:
 *   patch:
 *     tags: [Progress]
 *     summary: Update progress for a lesson
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               watched_duration: { type: integer }
 *               quiz_score: { type: integer }
 *               assignment_status:
 *                 type: string
 *                 enum: [pending, submitted, graded]
 *               completion_flag: { type: boolean }
 *     responses:
 *       200: { description: Updated progress }
 */
router.patch("/:lessonId", authRequired, async (req, res, next) => {
  try {
    const allowed = ["watched_duration", "quiz_score", "assignment_status", "completion_flag"];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const lesson = await repo.lessons.findById(req.params.lessonId);
    if (!lesson) return res.status(404).json({ error: "lesson not found" });
    const updated = await repo.progress.upsert(req.user.sub, req.params.lessonId, data);
    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
