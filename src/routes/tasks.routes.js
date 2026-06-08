const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tasks for the current user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, done] }
 *     responses:
 *       200: { description: Array of tasks }
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               course_id: { type: string }
 *               due_date: { type: string, format: date-time }
 *     responses:
 *       201: { description: Task created }
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    res.json(await repo.tasks.listByUser(req.user.sub, { status: req.query.status }));
  } catch (err) { next(err); }
});

router.post("/", authRequired, async (req, res, next) => {
  try {
    const { title, course_id, due_date } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const task = await repo.tasks.create({
      user_id: req.user.sub, title, course_id: course_id || null,
      due_date: due_date ? new Date(due_date) : null,
    });
    res.status(201).json(task);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update a task (title, due_date, status)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated task }
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 */
router.patch("/:id", authRequired, async (req, res, next) => {
  try {
    const allowed = ["title", "due_date", "status"];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (data.status && !["pending", "done"].includes(data.status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    if (data.due_date) data.due_date = new Date(data.due_date);
    const t = await repo.tasks.update(req.params.id, req.user.sub, data);
    if (!t) return res.status(404).json({ error: "task not found" });
    res.json(t);
  } catch (err) { next(err); }
});

router.delete("/:id", authRequired, async (req, res, next) => {
  try {
    const ok = await repo.tasks.remove(req.params.id, req.user.sub);
    if (!ok) return res.status(404).json({ error: "task not found" });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
