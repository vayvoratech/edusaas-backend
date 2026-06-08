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
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of announcements }
 *   post:
 *     tags: [Announcements]
 *     summary: Send an announcement (educator/admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string }
 *               message: { type: string }
 *               audience:
 *                 type: string
 *                 enum: [all, course, educators]
 *               scheduled_at: { type: string, format: date-time }
 *               attachment: { type: string }
 *     responses:
 *       201: { description: Announcement created }
 */
router.get("/", authRequired, async (req, res, next) => {
  try { res.json(await repo.announcements.list()); }
  catch (err) { next(err); }
});

router.post("/", authRequired, permissionRequired("announcements:send"), async (req, res, next) => {
  try {
    const { title, message, audience, scheduled_at, attachment } = req.body || {};
    if (!title || !message) return res.status(400).json({ error: "title and message required" });
    if (audience && !["all", "course", "educators"].includes(audience)) {
      return res.status(400).json({ error: "invalid audience" });
    }
    const ann = await repo.announcements.create({
      educator_id: req.user.sub, title, message,
      audience: audience || "all",
      scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      attachment: attachment || null,
    });
    res.status(201).json(ann);
  } catch (err) { next(err); }
});

module.exports = router;
