const express = require("express");
const repo = require("../data");

const {
  authRequired,
  permissionRequired,
} = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/dashboard/student:
 *   get:
 *     tags: [Dashboards]
 *     summary: Aggregated metrics for the student dashboard
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Aggregated student dashboard data }
 */
router.get(
  "/student",
  authRequired,
  permissionRequired("dashboards:student"),
  async (req, res, next) => {
    try {
      return res.json(
        await repo.studentDashboard(req.user.sub)
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/dashboard/educator:
 *   get:
 *     tags: [Dashboards]
 *     summary: Aggregated metrics for the educator dashboard
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Educator metrics }
 */
router.get(
  "/educator",
  authRequired,
  permissionRequired("dashboards:educator"),
  async (req, res, next) => {
    try {
      return res.json(
        await repo.educatorInsights(req.user.sub)
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/dashboard/employer:
 *   get:
 *     tags: [Dashboards]
 *     summary: Aggregated metrics for the employer dashboard
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Employer metrics }
 */
router.get(
  "/employer",
  authRequired,
  permissionRequired("dashboards:employer"),
  async (req, res, next) => {
    try {
      return res.json(
        await repo.employerInsights(req.user.sub)
      );
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;