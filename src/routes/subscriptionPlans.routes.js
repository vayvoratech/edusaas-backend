const express = require("express");
const { getActiveSubscriptionPlans } = require("../config/subscriptionPlans");

const router = express.Router();

/**
 * @openapi
 * /api/subscription-plans:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get available subscription plans
 *     responses:
 *       200:
 *         description: List of active subscription plans
 */

router.get("/", (req, res) => {
  return res.json(getActiveSubscriptionPlans());
});

module.exports = router;
