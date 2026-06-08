const express = require("express");
const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/jobs:
 *   get:
 *     tags: [Jobs]
 *     summary: List job postings
 *     parameters:
 *       - in: query
 *         name: employer_id
 *         schema: { type: string }
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
 *               description: { type: string }
 *               requirements: { type: string }
 *               required_skills:
 *                 type: array
 *                 items: { type: string }
 *               status: { type: string, example: open }
 *     responses:
 *       201: { description: Job created }
 */
router.get("/", async (req, res, next) => {
  try {
    if (req.query.employer_id) {
      return res.json(await repo.jobs.listByEmployer(req.query.employer_id));
    }
    res.json(await repo.jobs.list());
  } catch (err) { next(err); }
});

router.post("/", authRequired, permissionRequired("jobs:create"), async (req, res, next) => {
  try {
    const { title, description, requirements, required_skills, status } = req.body || {};
    if (!title) return res.status(400).json({ error: "title is required" });
    const job = await repo.jobs.create({
      employer_id: req.user.sub, title,
      description: description || null,
      requirements: requirements || null,
      required_skills: required_skills || [],
      status: status || "open",
    });
    res.status(201).json(job);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/jobs/{id}:
 *   patch:
 *     tags: [Jobs]
 *     summary: Update a job (employer/admin)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Jobs]
 *     summary: Delete (archive) a job (employer/admin)
 *     security: [{ bearerAuth: [] }]
 */
router.patch("/:id", authRequired, permissionRequired("jobs:update"), async (req, res, next) => {
  try {
    const allowed = ["title", "description", "requirements", "required_skills", "status"];
    const data = {};
    for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k];
    const updated = await repo.jobs.update(req.params.id, data);
    if (!updated) return res.status(404).json({ error: "job not found" });
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete("/:id", authRequired, permissionRequired("jobs:delete"), async (req, res, next) => {
  try {
    const ok = await repo.jobs.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: "job not found" });
    res.status(204).end();
  } catch (err) { next(err); }
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
    // crude skill_match score from how many required skills are in the URL: query / default 70
    const skill_match = typeof req.body?.skill_match === "number" ? req.body.skill_match : 70;
    const application = await repo.applications.create({
      job_id: job.id, student_id: studentId, status: "submitted", skill_match,
    });
    await repo.notifications.create({
      user_id: job.employer_id, type: "application",
      message: `New application for ${job.title}`,
    });
    res.status(201).json(application);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/jobs/{id}/applications:
 *   get:
 *     tags: [Jobs]
 *     summary: List applications for a job (employer/admin)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of applications }
 */
router.get("/:id/applications", authRequired, permissionRequired("jobs:view-applications"), async (req, res, next) => {
  try {
    const apps = await repo.applications.listByJob(req.params.id);
    // hydrate with student names
    const out = await Promise.all(apps.map(async (a) => {
      const u = await repo.users.findById(a.student_id);
      return { ...a, student_name: u?.name, student_email: u?.email };
    }));
    res.json(out);
  } catch (err) { next(err); }
});

module.exports = router;
