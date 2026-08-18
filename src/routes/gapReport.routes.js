// const express = require("express");
// const repo = require("../data");
// const { authRequired } = require("../middleware/auth");

// const router = express.Router();

// /**
//  * @openapi
//  * /api/gap-report/{userId}:
//  *   get:
//  *     tags: [GapReport]
//  *     summary: Generate skill gap report
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: userId
//  *         required: true
//  *         schema:
//  *           type: string
//  *     responses:
//  *       200:
//  *         description: Gap report
//  */
// router.get("/:userId", authRequired, async (req, res, next) => {
//   try {
//     const { userId } = req.params;

//     const isOwner = req.user.sub === userId;
//     const isAdmin = req.user.role === "admin";

//     if (!isOwner && !isAdmin) {
//       return res.status(403).json({
//         error: "You are not authorized to access this gap report.",
//       });
//     }

//     const user = await repo.users.findById(userId);

//     if (!user) {
//       return res.status(404).json({
//         error: "User not found.",
//       });
//     }

//     const assessments = await repo.assessments.listByUser(userId);

//     const readinessScore =
//       assessments.length === 0
//         ? 0
//         : Math.round(
//             assessments.reduce((sum, assessment) => sum + assessment.score, 0) /
//               assessments.length
//           );

//     const missingSkills =
//       readinessScore >= 80
//         ? []
//         : [
//             "communication",
//             "advanced-react",
//             "system-design",
//           ];

//     const recommendations = missingSkills.map((skill) => ({
//       skill,
//       suggestion: `Consider a course on ${skill}`,
//     }));

//     const report = await repo.gapReports.upsert(userId, {
//       readiness_score: readinessScore,
//       missing_skills: missingSkills,
//       recommendations,
//     });

//     return res.json(report);

//   } catch (err) {
//     next(err);
//   }
// });

// module.exports = router;



const express = require("express");
const { authRequired } = require("../middleware/auth");
const skillGapService = require("../services/skillGapService");

const router = express.Router();

/**
 * @openapi
 * /api/gap-report/{userId}:
 *   get:
 *     tags: [GapReport]
 *     summary: Get (and regenerate) a student's skill gap report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Gap report
 *       404:
 *         description: No completed assessment to base the report on
 */
router.get("/:userId", authRequired, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const isOwner = req.user.sub === userId;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "You are not authorized to access this gap report.",
      });
    }

    // This is also invoked automatically right after an assessment
    // completes (see assessmentService.js) — hitting this endpoint just
    // regenerates it on demand from the same underlying data.
    const report = await skillGapService.generateGapReport(userId);

    return res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;