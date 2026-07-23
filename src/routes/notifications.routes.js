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
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of notifications
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    const notifications = await repo.notifications.listByUser(req.user.sub);

    return res.json(notifications);
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
 *         description: Updated notification
 *       404:
 *         description: Notification not found
 */
router.patch("/:id/read", authRequired, async (req, res, next) => {
  try {
    // Verify the notification belongs to the current user
    const notification = await repo.notifications.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found.",
      });
    }

    if (notification.user_id !== req.user.sub) {
      return res.status(403).json({
        error: "You are not authorized to modify this notification.",
      });
    }

    const updatedNotification = await repo.notifications.markRead(
      req.params.id,
      req.user.sub
    );

    return res.json(updatedNotification);

  } catch (err) {
    next(err);
  }
});

module.exports = router;