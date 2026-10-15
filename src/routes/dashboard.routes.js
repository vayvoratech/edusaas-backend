const express = require("express");
const repo = require("../data");
const {
  getCareerJourneyEligibility,
} = require("../services/careerJourneyService");

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
      const userId = req.user.sub;

      const dashboard = await repo.studentDashboard(userId);
      const careerJourney =
        await getCareerJourneyEligibility(userId);

      return res.json({
        ...dashboard,
        careerJourney,
      });
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
      const courseId = req.query.course_id || null;
      return res.json(
        await repo.educatorInsights(req.user.sub, courseId)
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