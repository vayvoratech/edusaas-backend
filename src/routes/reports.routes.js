const express = require("express");
const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/reports/summary:
 *   get:
 *     tags: [Reports]
 *     summary: Reports dashboard summary (totals + charts)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary object
 */
router.get(
  "/summary",
  authRequired,
  permissionRequired("reports:view"),
  async (req, res, next) => {
    try {
      const summary = await repo.reports.summary();

      return res.json(summary);

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/reports:
 *   get:
 *     tags: [Reports]
 *     summary: Top reports list
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of reports
 */
router.get(
  "/",
  authRequired,
  permissionRequired("reports:view"),
  async (req, res, next) => {
    try {
      const reports = await repo.reports.list();

      return res.json(reports);

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/reports/exports:
 *   get:
 *     tags: [Reports]
 *     summary: Export history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of exported reports
 */
router.get(
  "/exports",
  authRequired,
  permissionRequired("reports:view"),
  async (req, res, next) => {
    try {
      const exports = await repo.reports.listExports();

      return res.json(exports);

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;