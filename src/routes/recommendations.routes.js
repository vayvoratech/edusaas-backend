const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/recommendations:
 *   get:
 *     tags: [Recommendations]
 *     summary: Course recommendations for the current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Array of recommendations with course info
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    // Recommendations are intended for students.
    if (req.user.role !== "student") {
      return res.json([]);
    }

    const recommendations =
      await repo.recommendations.listByUser(req.user.sub);

    const result = await Promise.all(
      recommendations.map(async (recommendation) => {
        const course = await repo.courses.findById(
          recommendation.course_id
        );

        return {
          ...recommendation,
          course,
        };
      })
    );

    return res.json(result);

  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/recommendations:
 *   post:
 *     tags: [Recommendations]
 *     summary: Create a recommendation (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - course_id
 *             properties:
 *               user_id:
 *                 type: string
 *               course_id:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Recommendation created
 */
router.post("/", authRequired, async (req, res, next) => {
  try {
    // Only admins can manually create recommendations.
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Only administrators can create recommendations.",
      });
    }

    const { user_id, course_id, reason } = req.body || {};

    if (!user_id || !course_id) {
      return res.status(400).json({
        error: "user_id and course_id are required.",
      });
    }

    const user = await repo.users.findById(user_id);

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const course = await repo.courses.findById(course_id);

    if (!course) {
      return res.status(404).json({
        error: "Course not found.",
      });
    }

    const recommendation = await repo.recommendations.create({
      user_id,
      course_id,
      reason,
    });

    return res.status(201).json(recommendation);

  } catch (err) {
    next(err);
  }
});

module.exports = router;