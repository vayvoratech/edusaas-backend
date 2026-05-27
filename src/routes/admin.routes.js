const express = require("express");
const { db } = require("../data/dataStore");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Admin user management - list all users
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of users (no password_hash) }
 *       403: { description: Forbidden }
 */
router.get("/users", authRequired, roleRequired("admin"), (req, res) => {
  res.json(
    db.users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      created_at: u.created_at,
    }))
  );
});

/**
 * @openapi
 * /api/admin/insights:
 *   get:
 *     tags: [Admin]
 *     summary: AI insights hub - aggregate platform metrics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Insights object }
 *       403: { description: Forbidden }
 */
router.get("/insights", authRequired, roleRequired("admin"), (req, res) => {
  const totalAssessments = db.assessments.length;
  const avgScore =
    totalAssessments === 0
      ? 0
      : Math.round(db.assessments.reduce((s, a) => s + a.score, 0) / totalAssessments);

  res.json({
    totals: {
      users: db.users.length,
      courses: db.courses.length,
      enrollments: db.enrollments.length,
      jobs: db.jobs.length,
      applications: db.applications.length,
    },
    assessments: {
      count: totalAssessments,
      average_score: avgScore,
    },
    top_missing_skills: ["communication", "advanced-react", "system-design"],
  });
});

module.exports = router;
