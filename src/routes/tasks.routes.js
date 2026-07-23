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
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, done]
 *     responses:
 *       200:
 *         description: Array of tasks
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               course_id:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Task created
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    if (
      req.query.status &&
      !["pending", "done"].includes(req.query.status)
    ) {
      return res.status(400).json({
        error: "Invalid task status.",
      });
    }

    const tasks = await repo.tasks.listByUser(req.user.sub, {
      status: req.query.status,
    });

    return res.json(tasks);

  } catch (err) {
    next(err);
  }
});

router.post("/", authRequired, async (req, res, next) => {
  try {
    const { title, course_id, due_date } = req.body || {};

    if (!title) {
      return res.status(400).json({
        error: "Title is required.",
      });
    }

    let dueDate = null;

    if (due_date) {
      dueDate = new Date(due_date);

      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({
          error: "Invalid due_date.",
        });
      }
    }

    if (course_id) {
      const course = await repo.courses.findById(course_id);

      if (!course) {
        return res.status(404).json({
          error: "Course not found.",
        });
      }
    }

    const task = await repo.tasks.create({
      user_id: req.user.sub,
      title,
      course_id: course_id || null,
      due_date: dueDate,
    });

    return res.status(201).json(task);

  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated task
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Deleted
 */

router.patch("/:id", authRequired, async (req, res, next) => {
  try {
    const allowed = ["title", "due_date", "status"];
    const data = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        data[key] = req.body[key];
      }
    }

    if (
      data.status &&
      !["pending", "done"].includes(data.status)
    ) {
      return res.status(400).json({
        error: "Invalid task status.",
      });
    }

    if (data.due_date) {
      const dueDate = new Date(data.due_date);

      if (Number.isNaN(dueDate.getTime())) {
        return res.status(400).json({
          error: "Invalid due_date.",
        });
      }

      data.due_date = dueDate;
    }

    const task = await repo.tasks.update(
      req.params.id,
      req.user.sub,
      data
    );

    if (!task) {
      return res.status(404).json({
        error: "Task not found.",
      });
    }

    return res.json(task);

  } catch (err) {
    next(err);
  }
});

router.delete("/:id", authRequired, async (req, res, next) => {
  try {
    const deleted = await repo.tasks.remove(
      req.params.id,
      req.user.sub
    );

    if (!deleted) {
      return res.status(404).json({
        error: "Task not found.",
      });
    }

    return res.status(204).end();

  } catch (err) {
    next(err);
  }
});

module.exports = router;