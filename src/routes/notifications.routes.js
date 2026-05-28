const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Fetch notifications for current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of notifications }
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    res.json(await repo.notifications.listByUser(req.user.sub));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Updated notification }
 *       404: { description: Not found }
 */
router.patch("/:id/read", authRequired, async (req, res, next) => {
  try {
    const n = await repo.notifications.markRead(req.params.id, req.user.sub);
    if (!n) return res.status(404).json({ error: "notification not found" });
    res.json(n);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
