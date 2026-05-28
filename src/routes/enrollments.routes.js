const express = require("express");
const repo = require("../data");
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
 *   get:
 *     tags: [Enrollments]
 *     summary: List current user's enrollments
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of enrollments }
 */
router.post("/", authRequired, async (req, res, next) => {
  try {
    const { course_id } = req.body || {};
    if (!course_id) return res.status(400).json({ error: "course_id is required" });
    const course = await repo.courses.findById(course_id);
    if (!course) return res.status(404).json({ error: "course not found" });
    const userId = req.user.sub;
    const existing = await repo.enrollments.findOne(userId, course_id);
    if (existing) return res.status(409).json({ error: "already enrolled" });

    const enrollment = await repo.enrollments.create({
      user_id: userId,
      course_id,
      status: "active",
      completion_percentage: 0,
    });
    res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
});

router.get("/", authRequired, async (req, res, next) => {
  try {
    res.json(await repo.enrollments.listByUser(req.user.sub));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
