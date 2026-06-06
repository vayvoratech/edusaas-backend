const express = require("express");
const repo = require("../data");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/reports/summary:
 *   get:
 *     tags: [Reports]
 *     summary: Reports dashboard summary (totals + charts)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Summary object }
 */
router.get("/summary", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    res.json(await repo.reports.summary());
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/reports:
 *   get:
 *     tags: [Reports]
 *     summary: Top reports list
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of reports }
 */
router.get("/", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    res.json(await repo.reports.list());
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/reports/exports:
 *   get:
 *     tags: [Reports]
 *     summary: Export history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of exported reports }
 */
router.get("/exports", authRequired, roleRequired("admin"), async (req, res, next) => {
  try {
    res.json(await repo.reports.listExports());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
