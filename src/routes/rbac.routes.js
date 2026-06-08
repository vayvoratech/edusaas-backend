const express = require("express");
const repo = require("../data");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/rbac/roles:
 *   get:
 *     tags: [RBAC]
 *     summary: List all roles (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of roles }
 */
router.get("/roles", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    const roles = await repo.roles.list();
    // hydrate each with permissions[]
    const out = await Promise.all(
      roles.map(async (r) => ({
        ...r,
        permissions: await repo.roles.permissionsForRoleId(r.id),
      }))
    );
    res.json(out);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/rbac/permissions:
 *   get:
 *     tags: [RBAC]
 *     summary: List all permissions (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of permissions }
 */
router.get("/permissions", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    res.json(await repo.permissions.list());
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/rbac/me:
 *   get:
 *     tags: [RBAC]
 *     summary: Current user's role and permissions (decoded from JWT)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Permissions object }
 */
router.get("/me", authRequired, async (req, res) => {
  res.json({
    sub: req.user.sub,
    role: req.user.role,
    permissions: req.user.permissions || [],
  });
});

module.exports = router;
