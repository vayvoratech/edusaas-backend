const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/achievements:
 *   get:
 *     tags: [Achievements]
 *     summary: Achievements/badges for the current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of achievements }
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    if (req.user.role !== "student") {
      return res.json([]);
    }

    return res.json(
      await repo.achievements.listByUser(req.user.sub)
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/achievements:
 *   post:
 *     tags: [Achievements]
 *     summary: Create an achievement (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Achievement created }
 */
router.post("/", authRequired, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Only administrators can create achievements.",
      });
    }

    const { badge_name, milestone, certificate_id } = req.body || {};
    const user_id = req.body.user_id;

    if (!user_id || !badge_name) {
      return res.status(400).json({
        error: "user_id and badge_name are required.",
      });
    }

    const user = await repo.users.findById(user_id);

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const achievement = await repo.achievements.create({
      user_id,
      badge_name,
      milestone,
      certificate_id,
    });

    return res.status(201).json(achievement);

  } catch (err) {
    next(err);
  }
});

module.exports = router;