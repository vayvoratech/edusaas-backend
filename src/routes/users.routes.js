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
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile: profile || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
