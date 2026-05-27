const express = require("express");
const { db, newId } = require("../data/dataStore");
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
router.get("/:userId", authRequired, (req, res) => {
  const { userId } = req.params;
  const assessments = db.assessments.filter((a) => a.user_id === userId);
  const avg =
    assessments.length === 0
      ? 0
      : Math.round(assessments.reduce((s, a) => s + a.score, 0) / assessments.length);
  const readiness_score = avg;
  // naive demo logic
  const missing_skills = avg >= 80 ? [] : ["communication", "advanced-react", "system-design"];
  const recommendations = missing_skills.map((skill) => ({
    skill,
    suggestion: `Consider a course on ${skill}`,
  }));

  let report = db.gapReports.find((r) => r.user_id === userId);
  if (report) {
    report.readiness_score = readiness_score;
    report.missing_skills = missing_skills;
    report.recommendations = recommendations;
    report.updated_at = new Date().toISOString();
  } else {
    report = {
      id: newId(),
      user_id: userId,
      readiness_score,
      missing_skills,
      recommendations,
      created_at: new Date().toISOString(),
    };
    db.gapReports.push(report);
  }
  res.json(report);
});

module.exports = router;
