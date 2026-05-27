const express = require("express");
const { db, newId } = require("../data/dataStore");
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
router.get("/", (req, res) => {
  res.json(db.courses);
});

router.post("/", authRequired, roleRequired("educator", "admin"), (req, res) => {
  const { title, description, provider, category } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required" });
  const course = {
    id: newId(),
    title,
    description: description || "",
    provider: provider || "EDU-SAAS",
    category: category || "General",
    created_at: new Date().toISOString(),
  };
  db.courses.push(course);
  res.status(201).json(course);
});

module.exports = router;
