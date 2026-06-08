const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Fetch user profile
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: User profile }
 *       404: { description: User not found }
 */
router.get("/:id", authRequired, async (req, res, next) => {
  try {
    const user = await repo.users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "user not found" });
    const profile = await repo.profiles.findByUserId(user.id);
    res.json({
      id: user.id, name: user.name, email: user.email, role: user.role,
      status: user.status, last_login: user.last_login,
      created_at: user.created_at,
      profile: profile || null,
    });
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/users/{id}/profile:
 *   put:
 *     tags: [Users]
 *     summary: Create or update extended profile info
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
 *               career_goal: { type: string }
 *               institution: { type: string }
 *               company: { type: string }
 *               preferences: { type: object }
 *     responses:
 *       200: { description: Saved profile }
 */
router.put("/:id/profile", authRequired, async (req, res, next) => {
  try {
    if (req.user.sub !== req.params.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "cannot edit another user's profile" });
    }
    const allowed = ["career_goal", "institution", "company", "preferences"];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const profile = await repo.profiles.upsert(req.params.id, data);
    res.json(profile);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/users/students/candidates:
 *   get:
 *     tags: [Users]
 *     summary: List students (for employer candidate search)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of student users }
 */
router.get("/students/candidates", authRequired, async (req, res, next) => {
  try {
    if (!["employer", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const students = await repo.users.list({ role: "student", status: "active" });
    res.json(students.map((u) => {
      // eslint-disable-next-line no-unused-vars
      const { password_hash, ...safe } = u;
      return safe;
    }));
  } catch (err) { next(err); }
});

module.exports = router;
