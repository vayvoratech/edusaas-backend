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

    const lessons = await repo.lessons.listByCourse(req.params.id);
    
    // Security: Do not expose the correct_option to students
    if (req.user.role === "student") {
      lessons.forEach(lesson => {
        if (lesson.quizzes && lesson.quizzes.length > 0) {
          lesson.quizzes.forEach(quiz => {
            if (quiz.questions && Array.isArray(quiz.questions)) {
              quiz.questions.forEach(q => {
                delete q.correct_option;
              });
            }
          });
        }
      });
    }

    return res.json(lessons);
  } catch (err) { next(err); }
});

router.post("/:id/lessons", authRequired, permissionRequired("lessons:create"), async (req, res, next) => {
  try {
    const { title, video_url, duration, order_index, quiz } = req.body || {};

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

    // Strict validation: Must have between 5 and 20 questions
    if (!quiz || !Array.isArray(quiz) || quiz.length < 5 || quiz.length > 20) {
      return res.status(400).json({
        error: "A lesson must have a mandatory quiz containing between 5 and 20 questions.",
      });
    }

    const course = await repo.courses.findById(req.params.id);
    if (!course) return res.status(404).json({ error: "course not found" });

    // Create lesson
    const lesson = await repo.lessons.create({
      course_id: req.params.id, title, video_url, duration, order_index: order_index || 0,
    });

    // Create associated mandatory quiz
    const createdQuiz = await repo.quizzes.create({
      lesson_id: lesson.id,
      questions: quiz,
      passing_score: 80
    });

    res.status(201).json({ ...lesson, quiz: createdQuiz });
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

    // Security: Do not expose the correct_option to students
    if (req.user.role === "student" && quiz && quiz.questions && Array.isArray(quiz.questions)) {
      quiz.questions.forEach(q => {
        delete q.correct_option;
      });
    }

    return res.json({ ...lesson, quiz, assignments });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/lessons/{id}:
 *   patch:
 *     tags: [Lessons]
 *     summary: Update a lesson
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
 *             properties:
 *               title: { type: string }
 *               video_url: { type: string }
 *               duration: { type: integer, description: "minutes" }
 *               order_index: { type: integer }
 *               quiz: { type: array }
 *     responses:
 *       200: { description: Lesson updated }
 *       404: { description: Not found }
 */
router.patch("/lesson/:id", authRequired, async (req, res, next) => {
  try {
    const lesson = await repo.lessons.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: "lesson not found" });

    const course = await repo.courses.findById(lesson.course_id);
    if (!course) return res.status(404).json({ error: "course not found" });

    // Authorization: only admins or course owners can update
    if (req.user.role !== "admin" && course.educator_id !== req.user.sub) {
      return res.status(403).json({ error: "You don't have permission to update this lesson" });
    }

    const { title, video_url, duration, order_index, quiz } = req.body || {};
    const data = {};
    if (title !== undefined) data.title = title;
    if (video_url !== undefined) data.video_url = video_url;
    if (duration !== undefined) data.duration = duration;
    if (order_index !== undefined) data.order_index = order_index;

    const updatedLesson = await repo.lessons.update(req.params.id, data);

    if (quiz) {
      await repo.quizzes.deleteByLessonId(lesson.id);
      await repo.quizzes.create({
        lesson_id: lesson.id,
        questions: quiz,
        passing_score: 80
      });
    }

    return res.json(updatedLesson);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/lessons/{id}:
 *   delete:
 *     tags: [Lessons]
 *     summary: Delete a lesson
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Lesson deleted }
 *       404: { description: Not found }
 */
router.delete("/lesson/:id", authRequired, permissionRequired("lessons:delete"), async (req, res, next) => {
  try {
    const lesson = await repo.lessons.findById(req.params.id);
    if (!lesson) return res.status(404).json({ error: "lesson not found" });

    const course = await repo.courses.findById(lesson.course_id);
    if (!course) return res.status(404).json({ error: "course not found" });

    // Authorization: only admins or course owners can delete
    if (req.user.role !== "admin" && course.educator_id !== req.user.sub) {
      return res.status(403).json({ error: "You don't have permission to delete this lesson" });
    }

    await repo.lessons.delete(req.params.id);
    return res.status(204).send();
  } catch (err) { next(err); }
});

module.exports = router;
