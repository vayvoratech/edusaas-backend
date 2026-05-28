const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/subscriptions:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Create or update subscription / billing plan
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan_type]
 *             properties:
 *               plan_type:
 *                 type: string
 *                 enum: [free, basic, pro, enterprise]
 *                 example: pro
 *               months: { type: integer, example: 1 }
 *     responses:
 *       200: { description: Subscription record }
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get current user's active subscription
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Subscription or null }
 */
router.post("/", authRequired, async (req, res, next) => {
  try {
    const { plan_type, months } = req.body || {};
    if (!plan_type) return res.status(400).json({ error: "plan_type is required" });
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + (months || 1));
    const sub = await repo.subscriptions.upsert(req.user.sub, {
      plan_type,
      start_date: start,
      end_date: end,
    });
    res.json(sub);
  } catch (err) {
    next(err);
  }
});

router.get("/", authRequired, async (req, res, next) => {
  try {
    res.json(await repo.subscriptions.findByUserId(req.user.sub));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
