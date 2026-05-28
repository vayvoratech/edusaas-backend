const express = require("express");
const repo = require("../data");
const { authRequired, roleRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: List job postings
 *     responses:
 *       200: { description: Array of jobs }
 *   post:
 *     tags: [Jobs]
 *     summary: Create job posting (employer/admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               required_skills:
 *                 type: array
 *                 items: { type: string }
 *               status: { type: string, example: open }
 *     responses:
 *       201: { description: Job created }
 */
router.get("/", async (req, res, next) => {
  try {
    res.json(await repo.jobs.list());
  } catch (err) {
    next(err);
  }
});

router.post("/", authRequired, roleRequired("employer", "admin"), async (req, res, next) => {
  try {
    const { title, required_skills, status } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const job = await repo.jobs.create({
      employer_id: req.user.sub,
      title,
      required_skills: required_skills || [],
      status: status || "open",
    });
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/jobs/{id}/apply:
 *   post:
 *     tags: [Jobs]
 *     summary: Apply for job
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Application submitted }
 *       404: { description: Job not found }
 *       409: { description: Already applied }
 */
router.post("/:id/apply", authRequired, async (req, res, next) => {
  try {
    const job = await repo.jobs.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "job not found" });
    const studentId = req.user.sub;
    const existing = await repo.applications.findOne(job.id, studentId);
    if (existing) return res.status(409).json({ error: "already applied" });
    const application = await repo.applications.create({
      job_id: job.id,
      student_id: studentId,
      status: "submitted",
    });
    await repo.notifications.create({
      user_id: job.employer_id,
      type: "application",
      message: `New application for ${job.title}`,
    });
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
