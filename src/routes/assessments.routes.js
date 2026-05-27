const express = require("express");
const { db, newId } = require("../data/dataStore");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/assessments:
 *   post:
 *     tags: [Assessments]
 *     summary: Submit skill test
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, score]
 *             properties:
 *               type: { type: string, example: javascript-basics }
 *               score: { type: number, example: 82 }
 *               answers:
 *                 type: array
 *                 items: { type: object }
 *     responses:
 *       201: { description: Assessment recorded }
 */
router.post("/", authRequired, (req, res) => {
  const { type, score, answers } = req.body || {};
  if (!type || typeof score !== "number") {
    return res.status(400).json({ error: "type (string) and score (number) are required" });
  }
  const assessment = {
    id: newId(),
    user_id: req.user.sub,
    type,
    score,
    answers: answers || [],
    date_taken: new Date().toISOString(),
  };
  db.assessments.push(assessment);
  res.status(201).json(assessment);
});

/**
 * @openapi
 * /api/assessments/{id}/results:
 *   get:
 *     tags: [Assessments]
 *     summary: Get assessment results
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Assessment with results }
 *       404: { description: Not found }
 */
router.get("/:id/results", authRequired, (req, res) => {
  const a = db.assessments.find((x) => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: "assessment not found" });
  res.json(a);
});

module.exports = router;
