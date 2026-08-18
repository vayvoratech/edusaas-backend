const express = require("express");
const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List courses (filter by status/educator/category/difficulty)
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, draft, archived] }
 *       - in: query
 *         name: educator_id
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: difficulty
 *         schema: { type: string, enum: [beginner, intermediate, advanced] }
 *     responses:
 *       200: { description: Array of courses }
 *   post:
 *     tags: [Courses]
 *     summary: Create a course (educator/admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               provider: { type: string }
 *               category: { type: string }
 *               difficulty: { type: string, enum: [beginner, intermediate, advanced] }
 *               status: { type: string, enum: [active, draft, archived] }
 *     responses:
 *       201: { description: Course created }
 */
router.get("/", async (req, res, next) => {
  try {
    return res.json(await repo.courses.list({
      status: req.query.status,
      educator_id: req.query.educator_id,
      category: req.query.category,
      difficulty: req.query.difficulty,
    }));
  } catch (err) { next(err); }
});

router.post("/", authRequired, permissionRequired("courses:create"), async (req, res, next) => {
  try {
      const isAdmin = req.user.role === "admin";
      const isEducator = req.user.role === "educator";

      if (!isAdmin && !isEducator) {
        return res.status(403).json({
          error: "Only educators and admins can create courses.",
        });
      }

    const { title, description, provider, category, difficulty, status } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const course = await repo.courses.create({
      title, description: description || "",
      provider: provider || "EDU-SAAS",
      category: category || "General",
      difficulty: difficulty || "beginner",
      status: status || "active",
      educator_id:
      isEducator
        ? req.user.sub
        : (req.body.educator_id || null),
    });
    return res.status(201).json(course);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/courses/{id}:
 *   get:
 *     tags: [Courses]
 *     summary: Get a single course (with enrollment count)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Course detail }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Courses]
 *     summary: Update a course (educator/admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated course }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Courses]
 *     summary: Delete a course (educator/admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 */
router.get("/:id", async (req, res, next) => {
  try {
    const c = await repo.courses.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "course not found" });
    const enrollment_count = await repo.courses.enrollmentCount(c.id);
    return res.json({ ...c, enrollment_count });
  } catch (err) { next(err); }
});

router.patch("/:id", authRequired, permissionRequired("courses:update"), async (req, res, next) => {
  try {

    const course = await repo.courses.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        error: "Course not found.",
      });
    }

    const isOwner = course.educator_id === req.user.sub;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "You can update only your own courses.",
      });
    }

    const allowed = [
      "title",
      "description",
      "provider",
      "category",
      "difficulty",
      "status",
    ];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (data.status && !["active", "draft", "archived"].includes(data.status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    if (data.difficulty && !["beginner", "intermediate", "advanced"].includes(data.difficulty)) {
      return res.status(400).json({ error: "invalid difficulty" });
    }
    const updated = await repo.courses.update(req.params.id, data);
    if (!updated) return res.status(404).json({ error: "course not found" });
    return res.json(updated);
  } catch (err) { next(err); }
});

router.delete("/:id", authRequired, permissionRequired("courses:delete"), async (req, res, next) => {
  try {
    const course = await repo.courses.findById(req.params.id);

    if (!course) {
      return res.status(404).json({
        error: "Course not found.",
      });
    }

    const isOwner = course.educator_id === req.user.sub;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "You can delete only your own courses.",
      });
    }

    const ok = await repo.courses.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "course not found" });
    return res.status(204).end();
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/courses/{id}/assign:
 *   post:
 *     tags: [Courses]
 *     summary: Assign a course to a student (educator/admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string }
 *     responses:
 *       201: { description: Enrollment created }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *       409: { description: Already enrolled }
 */
router.post("/:id/assign", authRequired, permissionRequired("courses:assign"), async (req, res, next) => {
  try {

    const { id: course_id } = req.params;
    const { userId: user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "userId is required" });
    }
    
    // 1. Verify course exists and is active
    const course = await repo.courses.findById(course_id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    if (course.status !== "active") {
      return res.status(400).json({ error: "Only active courses can be assigned." });
    }

    // 2. Verify user exists and is a student
    const student = await repo.users.findById(user_id);
    if (!student || student.role !== 'student') {
      return res.status(404).json({ error: "Student not found" });
    }
    
    // 3. Check for existing enrollment
    const existing = await repo.enrollments.findOne(user_id, course_id);
    if (existing) {
      return res.status(409).json({ error: "Student is already enrolled in this course" });
    }
 
    // 4. Create the enrollment
    const enrollment = await repo.enrollments.create({
      user_id: user_id,
      course_id: course_id,
      status: "active",
      completion_percentage: 0,
    });

    return res.status(201).json(enrollment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
