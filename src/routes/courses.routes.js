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
    res.json(await repo.courses.list({
      status: req.query.status,
      educator_id: req.query.educator_id,
      category: req.query.category,
      difficulty: req.query.difficulty,
    }));
  } catch (err) { next(err); }
});

router.post("/", authRequired, permissionRequired("courses:create"), async (req, res, next) => {
  try {
    const { title, description, provider, category, difficulty, status } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const course = await repo.courses.create({
      title, description: description || "",
      provider: provider || "EDU-SAAS",
      category: category || "General",
      difficulty: difficulty || "beginner",
      status: status || "active",
      educator_id: req.user.role === "educator" ? req.user.sub : (req.body.educator_id || null),
    });
    res.status(201).json(course);
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
    res.json({ ...c, enrollment_count });
  } catch (err) { next(err); }
});

router.patch("/:id", authRequired, permissionRequired("courses:update"), async (req, res, next) => {
  try {
    const allowed = ["title", "description", "provider", "category", "difficulty", "status", "educator_id"];
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
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete("/:id", authRequired, permissionRequired("courses:delete"), async (req, res, next) => {
  try {
    const ok = await repo.courses.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "course not found" });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
