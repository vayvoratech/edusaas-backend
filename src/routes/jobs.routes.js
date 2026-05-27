const express = require("express");
const { db, newId } = require("../data/dataStore");
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
router.get("/", (req, res) => {
  res.json(db.jobs);
});

router.post("/", authRequired, roleRequired("employer", "admin"), (req, res) => {
  const { title, required_skills, status } = req.body || {};
  if (!title) return res.status(400).json({ error: "title is required" });
  const job = {
    id: newId(),
    employer_id: req.user.sub,
    title,
    required_skills: required_skills || [],
    status: status || "open",
    created_at: new Date().toISOString(),
  };
  db.jobs.push(job);
  res.status(201).json(job);
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
router.post("/:id/apply", authRequired, (req, res) => {
  const job = db.jobs.find((j) => j.id === req.params.id);
  if (!job) return res.status(404).json({ error: "job not found" });
  const studentId = req.user.sub;
  const existing = db.applications.find(
    (a) => a.job_id === job.id && a.student_id === studentId
  );
  if (existing) return res.status(409).json({ error: "already applied" });
  const application = {
    id: newId(),
    job_id: job.id,
    student_id: studentId,
    status: "submitted",
    applied_at: new Date().toISOString(),
  };
  db.applications.push(application);

  // create a notification for the employer
  db.notifications.push({
    id: newId(),
    user_id: job.employer_id,
    type: "application",
    message: `New application for ${job.title}`,
    read_status: false,
    created_at: new Date().toISOString(),
  });

  res.status(201).json(application);
});

module.exports = router;
