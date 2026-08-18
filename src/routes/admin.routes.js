const express = require("express");
const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

const stripPwd = (user) => {
  if (!user) return user;

  const { password_hash, ...safeUser } = user;
  return safeUser;
};

/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users (filterable by role / status / search)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of users
 */
router.get(
  "/users",
  authRequired,
  permissionRequired("users:list"),
  async (req, res, next) => {
    try {
      const users = await repo.users.list({
        role: req.query.role || undefined,
        status: req.query.status || undefined,
        q: req.query.q || undefined,
      });

      return res.json(users.map(stripPwd));

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update a user
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a user
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/users/:id",
  authRequired,
  permissionRequired("users:update"),
  async (req, res, next) => {
    try {
      const user = await repo.users.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          error: "User not found.",
        });
      }

      const allowed = ["name", "role", "status"];
      const data = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          data[key] = req.body[key];
        }
      }

      if (
        data.role &&
        !["student", "educator", "employer", "admin"].includes(data.role)
      ) {
        return res.status(400).json({
          error: "Invalid role.",
        });
      }

      if (
        data.status &&
        !["active", "suspended"].includes(data.status)
      ) {
        return res.status(400).json({
          error: "Invalid status.",
        });
      }

      // Prevent admin from removing their own admin role
      if (
        req.params.id === req.user.sub &&
        data.role &&
        data.role !== "admin"
      ) {
        return res.status(400).json({
          error: "You cannot remove your own admin role.",
        });
      }

      const updatedUser = await repo.users.update(
        req.params.id,
        data
      );

      return res.json(stripPwd(updatedUser));

    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/users/:id",
  authRequired,
  permissionRequired("users:delete"),
  async (req, res, next) => {
    try {
      if (req.params.id === req.user.sub) {
        return res.status(400).json({
          error: "You cannot delete your own account.",
        });
      }

      const user = await repo.users.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          error: "User not found.",
        });
      }

      await repo.users.remove(req.params.id);

      return res.status(204).end();

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/admin/insights:
 *   get:
 *     tags: [Admin]
 *     summary: AI insights hub
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Insights object
 */
router.get(
  "/insights",
  authRequired,
  permissionRequired("admin:insights"),
  async (req, res, next) => {
    try {
      const insights = await repo.insights();

      return res.json(insights);

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;