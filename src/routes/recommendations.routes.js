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
 *       200: { description: Array of recommendations with course info }
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    const recs = await repo.recommendations.listByUser(req.user.sub);
    // hydrate course data
    const out = await Promise.all(
      recs.map(async (r) => {
        const course = await repo.courses.findById(r.course_id);
        return { ...r, course };
      })
    );
    res.json(out);
  } catch (err) { next(err); }
});

router.post("/", authRequired, async (req, res, next) => {
  try {
    const { user_id, course_id, reason } = req.body || {};
    if (!user_id || !course_id) return res.status(400).json({ error: "user_id, course_id required" });
    res.status(201).json(await repo.recommendations.create({ user_id, course_id, reason }));
  } catch (err) { next(err); }
});

module.exports = router;
