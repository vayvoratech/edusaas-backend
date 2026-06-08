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
    res.json(await repo.achievements.listByUser(req.user.sub));
  } catch (err) { next(err); }
});

router.post("/", authRequired, async (req, res, next) => {
  try {
    const { user_id, badge_name, milestone, certificate_id } = req.body || {};
    if (!user_id || !badge_name) return res.status(400).json({ error: "user_id, badge_name required" });
    res.status(201).json(await repo.achievements.create({ user_id, badge_name, milestone, certificate_id }));
  } catch (err) { next(err); }
});

module.exports = router;
