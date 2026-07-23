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
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - plan_type
 *             properties:
 *               plan_type:
 *                 type: string
 *                 enum:
 *                   - free
 *                   - basic
 *                   - pro
 *                   - enterprise
 *               months:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Subscription record
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get current user's active subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription or null
 */

router.post("/", authRequired, async (req, res, next) => {
  try {
    const { plan_type, months = 1 } = req.body || {};

    if (!plan_type) {
      return res.status(400).json({
        error: "plan_type is required.",
      });
    }

    const allowedPlans = [
      "free",
      "basic",
      "pro",
      "enterprise",
    ];

    if (!allowedPlans.includes(plan_type)) {
      return res.status(400).json({
        error: "Invalid subscription plan.",
      });
    }

    if (
      !Number.isInteger(months) ||
      months < 1 ||
      months > 36
    ) {
      return res.status(400).json({
        error: "months must be an integer between 1 and 36.",
      });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + months);

    const subscription = await repo.subscriptions.upsert(
      req.user.sub,
      {
        plan_type,
        start_date: startDate,
        end_date: endDate,
      }
    );

    return res.json(subscription);

  } catch (err) {
    next(err);
  }
});

router.get("/", authRequired, async (req, res, next) => {
  try {
    const subscription =
      await repo.subscriptions.findByUserId(req.user.sub);

    return res.json(subscription);

  } catch (err) {
    next(err);
  }
});

module.exports = router;