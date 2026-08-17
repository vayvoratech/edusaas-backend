const express = require("express");
const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get system settings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Key-value map of settings
 *   patch:
 *     tags: [Settings]
 *     summary: Update one or more settings (Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *             example:
 *               enable_auto_backup: true
 *               language: en-US
 *     responses:
 *       200:
 *         description: Updated settings map
 */

router.get("/", authRequired, async (req, res, next) => {
  try {
    const settings = await repo.settings.all();

    return res.json(settings);

  } catch (err) {
    next(err);
  }
});

router.patch(
  "/",
  authRequired,
  permissionRequired("settings:update"),
  async (req, res, next) => {
    try {
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          error: "Expected an object containing setting updates.",
        });
      }

      // Allowed system settings
      const allowedSettings = [
        "enable_auto_backup",
        "language",
        "maintenance_mode",
        "default_timezone",
        "max_login_attempts",
        "session_timeout",
      ];

      const updates = {};

      for (const key of allowedSettings) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: "No valid settings provided.",
        });
      }

      const settings = await repo.settings.update(updates);

      return res.json(settings);

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;