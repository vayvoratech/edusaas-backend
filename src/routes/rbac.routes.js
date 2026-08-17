const express = require("express");
const repo = require("../data");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/rbac/roles:
 *   get:
 *     tags: [RBAC]
 *     summary: List all roles (Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of roles
 */
router.get(
  "/roles",
  authRequired,
  roleRequired("admin"),
  async (req, res, next) => {
    try {
      const roles = await repo.roles.list();

      const rolesWithPermissions = await Promise.all(
        roles.map(async (role) => ({
          ...role,
          permissions: await repo.roles.permissionsForRoleId(role.id),
        }))
      );

      return res.json(rolesWithPermissions);

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/rbac/permissions:
 *   get:
 *     tags: [RBAC]
 *     summary: List all permissions (Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of permissions
 */
router.get(
  "/permissions",
  authRequired,
  roleRequired("admin"),
  async (req, res, next) => {
    try {
      const permissions = await repo.permissions.list();

      return res.json(permissions);

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/rbac/me:
 *   get:
 *     tags: [RBAC]
 *     summary: Current user's role and permissions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user's RBAC information
 */
router.get("/me", authRequired, (req, res) => {
  return res.json({
    sub: req.user.sub,
    role: req.user.role,
    permissions: req.user.permissions || [],
  });
});

module.exports = router;