const express = require("express");
const { db, newId } = require("../data/dataStore");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/enrollments:
 *   post:
 *     tags: [Enrollments]
 *     summary: Enroll in course
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [course_id]
 *             properties:
 *               course_id: { type: string }
 *     responses:
 *       201: { description: Enrollment created }
 *       404: { description: Course not found }
 *       409: { description: Already enrolled }
 */
router.post("/", authRequired, (req, res) => {
  const { course_id } = req.body || {};
  if (!course_id) return res.status(400).json({ error: "course_id is required" });
  const course = db.courses.find((c) => c.id === course_id);
  if (!course) return res.status(404).json({ error: "course not found" });
  const userId = req.user.sub;
  const existing = db.enrollments.find((e) => e.user_id === userId && e.course_id === course_id);
  if (existing) return res.status(409).json({ error: "already enrolled" });

  const enrollment = {
    id: newId(),
    user_id: userId,
    course_id,
    status: "active",
    completion_percentage: 0,
    enrolled_at: new Date().toISOString(),
  };
  db.enrollments.push(enrollment);
  res.status(201).json(enrollment);
});

/**
 * @openapi
 * /api/enrollments:
 *   get:
 *     tags: [Enrollments]
 *     summary: List current user's enrollments
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of enrollments }
 */
router.get("/", authRequired, (req, res) => {
  res.json(db.enrollments.filter((e) => e.user_id === req.user.sub));
});

module.exports = router;
