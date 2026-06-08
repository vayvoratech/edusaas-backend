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
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Key-value map of settings }
 *   patch:
 *     tags: [Settings]
 *     summary: Update one or more settings (admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *             example:
 *               enable_auto_backup: true
 *               language: en-US
 *     responses:
 *       200: { description: Updated settings map }
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    res.json(await repo.settings.all());
  } catch (err) {
    next(err);
  }
});

router.patch("/", authRequired, permissionRequired("settings:update"), async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ error: "expected an object of key/value updates" });
    }
    res.json(await repo.settings.update(req.body));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
