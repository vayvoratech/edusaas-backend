const express = require("express");
const { db } = require("../data/dataStore");
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
router.get("/", authRequired, (req, res) => {
  res.json(db.notifications.filter((n) => n.user_id === req.user.sub));
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
router.patch("/:id/read", authRequired, (req, res) => {
  const n = db.notifications.find((x) => x.id === req.params.id && x.user_id === req.user.sub);
  if (!n) return res.status(404).json({ error: "notification not found" });
  n.read_status = true;
  res.json(n);
});

module.exports = router;
