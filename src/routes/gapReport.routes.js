const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/gap-report/{userId}:
 *   get:
 *     tags: [GapReport]
 *     summary: Generate skill gap report
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Gap report }
 */
router.get("/:userId", authRequired, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const assessments = await repo.assessments.listByUser(userId);
    const avg =
      assessments.length === 0
        ? 0
        : Math.round(assessments.reduce((s, a) => s + a.score, 0) / assessments.length);
    const readiness_score = avg;
    const missing_skills = avg >= 80 ? [] : ["communication", "advanced-react", "system-design"];
    const recommendations = missing_skills.map((skill) => ({
      skill,
      suggestion: `Consider a course on ${skill}`,
    }));

    const report = await repo.gapReports.upsert(userId, {
      readiness_score,
      missing_skills,
      recommendations,
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
