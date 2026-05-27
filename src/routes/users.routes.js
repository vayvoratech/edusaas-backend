const express = require("express");
const { db } = require("../data/dataStore");
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
router.get("/:id", authRequired, (req, res) => {
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "user not found" });
  const profile = db.profiles.find((p) => p.user_id === user.id) || null;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profile,
  });
});

module.exports = router;
