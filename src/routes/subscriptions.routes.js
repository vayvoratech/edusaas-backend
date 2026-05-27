const express = require("express");
const { db, newId } = require("../data/dataStore");
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
router.post("/", authRequired, (req, res) => {
  const { plan_type, months } = req.body || {};
  if (!plan_type) return res.status(400).json({ error: "plan_type is required" });
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + (months || 1));

  let sub = db.subscriptions.find((s) => s.user_id === req.user.sub);
  if (sub) {
    sub.plan_type = plan_type;
    sub.start_date = start.toISOString();
    sub.end_date = end.toISOString();
  } else {
    sub = {
      id: newId(),
      user_id: req.user.sub,
      plan_type,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };
    db.subscriptions.push(sub);
  }
  res.json(sub);
});

router.get("/", authRequired, (req, res) => {
  const sub = db.subscriptions.find((s) => s.user_id === req.user.sub) || null;
  res.json(sub);
});

module.exports = router;
