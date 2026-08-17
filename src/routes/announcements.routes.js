const express = require("express");
const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/announcements:
 *   get:
 *     tags: [Announcements]
 *     summary: List all announcements (most recent first)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of announcements
 *   post:
 *     tags: [Announcements]
 *     summary: Send an announcement (Educator/Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - message
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               audience:
 *                 type: string
 *                 enum:
 *                   - all
 *                   - course
 *                   - educators
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *               attachment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Announcement created
 */

router.get("/", authRequired, async (req, res, next) => {
  try {
    const announcements = await repo.announcements.list();

    return res.json(announcements);

  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  authRequired,
  permissionRequired("announcements:send"),
  async (req, res, next) => {
    try {
      const {
        title,
        message,
        audience,
        scheduled_at,
        attachment,
      } = req.body || {};

      if (!title || !message) {
        return res.status(400).json({
          error: "Title and message are required.",
        });
      }

      if (
        audience &&
        !["all", "course", "educators"].includes(audience)
      ) {
        return res.status(400).json({
          error: "Invalid audience.",
        });
      }

      let scheduledDate = null;

      if (scheduled_at) {
        scheduledDate = new Date(scheduled_at);

        if (Number.isNaN(scheduledDate.getTime())) {
          return res.status(400).json({
            error: "Invalid scheduled_at date.",
          });
        }
      }

      const announcement = await repo.announcements.create({
        educator_id: req.user.sub,
        title,
        message,
        audience: audience || "all",
        scheduled_at: scheduledDate,
        attachment: attachment || null,
      });

      return res.status(201).json(announcement);

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;