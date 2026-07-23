const express = require("express");
const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/courses/{id}/lessons:
 *   get:
 *     tags: [Lessons]
 *     summary: List lessons in a course (ordered)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of lessons }
 *   post:
 *     tags: [Lessons]
 *     summary: Create a lesson (educator/admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               video_url: { type: string }
 *               duration: { type: integer, description: "minutes" }
 *               order_index: { type: integer }
 *     responses:
 *       201: { description: Lesson created }
 */
router.get("/:id/lessons", authRequired, async (req, res, next) => {
  try {
    const course = await repo.courses.findById(req.params.id);
    if (!course) {
      return res.status(404).json({
        error: "Course not found.",
      });
    }

    // Authorization check:
    // - Admins can view any course's lessons.
    // - Educators can view their own course's lessons.
    // - Students can view lessons for courses they are enrolled in.
    const isAdmin = req.user.role === "admin";
    const isOwner = course.educator_id === req.user.sub;
    let isEnrolled = false;
    if (req.user.role === "student") {
      const enrollment = await repo.enrollments.findOne(req.user.sub, course.id);
      isEnrolled = !!enrollment;
    }

    if (!isAdmin && !isOwner && !isEnrolled) {
      return res.status(403).json({ error: "You are not authorized to view these lessons." });
    }

    return res.json(await repo.lessons.listByCourse(req.params.id));
  } catch (err) { next(err); }
});

router.post("/:id/lessons", authRequired, permissionRequired("lessons:create"), async (req, res, next) => {
  try {
    const { title, video_url, duration, order_index } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({
        error: "title is required",
      });
    }

    if (duration != null && Number(duration) < 0) {
      return res.status(400).json({
        error: "Duration must be greater than or equal to 0.",
      });
    }

    if (order_index != null && Number(order_index) < 0) {
      return res.status(400).json({
        error: "Order index must be greater than or equal to 0.",
      });
    }
    const course = await repo.courses.findById(req.params.id);
    if (!course) return res.status(404).json({ error: "course not found" });
    const lesson = await repo.lessons.create({
      course_id: req.params.id, title, video_url, duration, order_index: order_index || 0,
    });
    res.status(201).json(lesson);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/lessons/{id}:
 *   get:
 *     tags: [Lessons]
 *     summary: Get a single lesson (with attached quiz + assignments)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lesson detail }
 *       404: { description: Not found }
 */
router.get("/lesson/:id", authRequired, async (req, res, next) => {
  try {
    const lesson = await repo.lessons.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: "lesson not found" });
    const [quiz, assignments] = await Promise.all([
      repo.quizzes.findByLessonId(lesson.id),
      repo.assignments.listByLesson(lesson.id),
    ]);
    return res.json({ ...lesson, quiz, assignments });
  } catch (err) { next(err); }
});

module.exports = router;
