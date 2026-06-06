const express = require("express");
const repo = require("../data");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

const stripPwd = (u) => {
  if (!u) return u;
  // eslint-disable-next-line no-unused-vars
  const { password_hash, ...safe } = u;
  return safe;
};

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (filterable by role / status / search)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of users }
 *       403: { description: Forbidden }
 */
router.get("/users", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    const users = await repo.users.list({
      role: req.query.role || undefined,
      status: req.query.status || undefined,
      q: req.query.q || undefined,
    });
    res.json(users.map(stripPwd));
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a user (name, role, status)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               role:
 *                 type: string
 *                 enum: [student, educator, employer, admin]
 *               status:
 *                 type: string
 *                 enum: [active, suspended]
 *     responses:
 *       200: { description: Updated user }
 *       404: { description: Not found }
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
router.patch("/users/:id", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    const allowed = ["name", "role", "status"];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (data.role && !["student", "educator", "employer", "admin"].includes(data.role)) {
      return res.status(400).json({ error: "invalid role" });
    }
    if (data.status && !["active", "suspended"].includes(data.status)) {
      return res.status(400).json({ error: "invalid status" });
    }
    const updated = await repo.users.update(req.params.id, data);
    if (!updated) return res.status(404).json({ error: "user not found" });
    res.json(stripPwd(updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: "cannot delete yourself" });
    }
    const ok = await repo.users.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "user not found" });
    res.status(204).end();
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
