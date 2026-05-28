const express = require("express");
const repo = require("../data");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/courses:
 *   get:
 *     tags: [Courses]
 *     summary: List available courses
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
 *     responses:
 *       201: { description: Course created }
 */
router.get("/", async (req, res, next) => {
  try {
    res.json(await repo.courses.list());
  } catch (err) {
    next(err);
  }
});

router.post("/", authRequired, roleRequired("educator", "admin"), async (req, res, next) => {
  try {
    const { title, description, provider, category } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const course = await repo.courses.create({
      title,
      description: description || "",
      provider: provider || "EDU-SAAS",
      category: category || "General",
    });
    res.status(201).json(course);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
