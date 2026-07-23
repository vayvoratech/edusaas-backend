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
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Array of jobs
 *   post:
 *     tags: [Jobs]
 *     summary: Create job posting (Employer/Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               requirements:
 *                 type: string
 *               required_skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 example: open
 *     responses:
 *       201:
 *         description: Job created
 */

router.get("/", async (req, res, next) => {
  try {
    if (req.query.employer_id) {
      return res.json(
        await repo.jobs.listByEmployer(req.query.employer_id)
      );
    }

    return res.json(await repo.jobs.list());

  } catch (err) {
    next(err);
  }
});

router.post(
  "/",
  authRequired,
  permissionRequired("jobs:create"),
  async (req, res, next) => {
    try {
      const {
        title,
        description,
        requirements,
        required_skills,
        status,
      } = req.body || {};

      if (!title) {
        return res.status(400).json({
          error: "Title is required.",
        });
      }

      if (
        required_skills &&
        !Array.isArray(required_skills)
      ) {
        return res.status(400).json({
          error: "required_skills must be an array.",
        });
      }

      if (
        status &&
        !["open", "closed", "draft"].includes(status)
      ) {
        return res.status(400).json({
          error: "Invalid job status.",
        });
      }

      const job = await repo.jobs.create({
        employer_id: req.user.sub,
        title,
        description: description || null,
        requirements: requirements || null,
        required_skills: required_skills || [],
        status: status || "open",
      });

      return res.status(201).json(job);

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/jobs/{id}:
 *   patch:
 *     tags: [Jobs]
 *     summary: Update a job
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     tags: [Jobs]
 *     summary: Delete a job
 *     security:
 *       - bearerAuth: []
 */

router.patch(
  "/:id",
  authRequired,
  permissionRequired("jobs:update"),
  async (req, res, next) => {
    try {
      const job = await repo.jobs.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: "Job not found.",
        });
      }

      const isOwner = job.employer_id === req.user.sub;
      const isAdmin = req.user.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error: "You are not authorized to update this job.",
        });
      }

      const allowed = [
        "title",
        "description",
        "requirements",
        "required_skills",
        "status",
      ];

      const data = {};

      for (const key of allowed) {
        if (req.body[key] !== undefined) {
          data[key] = req.body[key];
        }
      }

      if (
        data.required_skills &&
        !Array.isArray(data.required_skills)
      ) {
        return res.status(400).json({
          error: "required_skills must be an array.",
        });
      }

      if (
        data.status &&
        !["open", "closed", "draft"].includes(data.status)
      ) {
        return res.status(400).json({
          error: "Invalid job status.",
        });
      }

      const updated = await repo.jobs.update(
        req.params.id,
        data
      );

      return res.json(updated);

    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  "/:id",
  authRequired,
  permissionRequired("jobs:delete"),
  async (req, res, next) => {
    try {
      const job = await repo.jobs.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: "Job not found.",
        });
      }

      const isOwner = job.employer_id === req.user.sub;
      const isAdmin = req.user.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error: "You are not authorized to delete this job.",
        });
      }

      await repo.jobs.remove(req.params.id);

      return res.status(204).end();

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/jobs/{id}/apply:
 *   post:
 *     tags: [Jobs]
 *     summary: Apply for a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Application submitted
 */

router.post("/:id/apply", authRequired, async (req, res, next) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        error: "Only students can apply for jobs.",
      });
    }

    const job = await repo.jobs.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: "Job not found.",
      });
    }

    if (job.status !== "open") {
      return res.status(400).json({
        error: "This job is not accepting applications.",
      });
    }

    const existing = await repo.applications.findOne(
      job.id,
      req.user.sub
    );

    if (existing) {
      return res.status(409).json({
        error: "You have already applied for this job.",
      });
    }

    const skill_match =
      typeof req.body?.skill_match === "number"
        ? req.body.skill_match
        : 70;

    const application = await repo.applications.create({
      job_id: job.id,
      student_id: req.user.sub,
      status: "submitted",
      skill_match,
    });

    await repo.notifications.create({
      user_id: job.employer_id,
      type: "application",
      message: `New application for ${job.title}`,
    });

    return res.status(201).json(application);

  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/jobs/{id}/applications:
 *   get:
 *     tags: [Jobs]
 *     summary: List job applications
 *     security:
 *       - bearerAuth: []
 */

router.get(
  "/:id/applications",
  authRequired,
  permissionRequired("jobs:view-applications"),
  async (req, res, next) => {
    try {
      const job = await repo.jobs.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: "Job not found.",
        });
      }

      const isOwner = job.employer_id === req.user.sub;
      const isAdmin = req.user.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error:
            "You are not authorized to view these applications.",
        });
      }

      const applications =
        await repo.applications.listByJob(req.params.id);

      const result = await Promise.all(
        applications.map(async (application) => {
          const student = await repo.users.findById(
            application.student_id
          );

          return {
            ...application,
            student_name: student?.name,
            student_email: student?.email,
          };
        })
      );

      return res.json(result);

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;