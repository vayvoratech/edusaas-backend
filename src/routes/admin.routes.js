const express = require("express");
const repo = require("../data");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Admin user management - list all users
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of users (no password_hash) }
 *       403: { description: Forbidden }
 */
router.get("/users", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    const users = await repo.users.list();
    res.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/insights:
 *   get:
 *     tags: [Admin]
 *     summary: AI insights hub - aggregate platform metrics
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Insights object }
 *       403: { description: Forbidden }
 */
router.get("/insights", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    res.json(await repo.insights());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
