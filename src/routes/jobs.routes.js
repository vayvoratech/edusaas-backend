const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const repo = require("../data");
const { authRequired, permissionRequired } = require("../middleware/auth");

const router = express.Router();

// --------------------------------------------------
// Resume Upload Configuration
// --------------------------------------------------
const uploadResume = require("../middleware/uploadResume");



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
 * 
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





/**
 * @openapi
 * /api/jobs/recommended:
 *   get:
 *     tags: [Jobs]
 *     summary: Get jobs recommended for the current student
 *     security:
 *       - bearerAuth: []
 */

  router.get(
  "/recommended",
  authRequired,
  async (req, res, next) => {
    try {
      // Only students can receive job recommendations
      if (req.user.role !== "student") {
        return res.status(403).json({
          error: "Only students can view recommended jobs.",
        });
      }

      // 1. Get current student
      const student = await repo.users.findById(req.user.sub);

      if (!student) {
        return res.status(404).json({
          error: "Student not found.",
        });
      }

      // 2. Student must have selected a domain
      if (!student.domain_role_id) {
        return res.json({
          jobs: [],
          message: "Student has not selected a career domain.",
        });
      }

      // 3. Get student's domain role
      const domainRoles = await repo.domainRoles.list();

      const studentDomain = domainRoles.find(
        (role) =>
          String(role.domain_role_id) ===
          String(student.domain_role_id)
      );

      if (!studentDomain) {
        return res.json({
          jobs: [],
          message: "Student domain role was not found.",
        });
      }

      // 4. Get all jobs
      const jobs = await repo.jobs.list();


      const recommendedJobs = [];

      // 5. Show open jobs matching student's domain
      for (const job of jobs) {
        if (job.status !== "open") {
          continue;
        }

        const jobRole =
          job.title?.trim().toLowerCase();

        const studentRole =
          studentDomain.domain_name
            ?.trim()
            .toLowerCase();

    

        if (jobRole !== studentRole) {
          continue;
        }

        recommendedJobs.push({
          ...job,
          eligible: true,
          match_reason:
            "This job matches your selected career domain.",
        });
      }

      // Newest jobs first
      recommendedJobs.sort(
        (a, b) =>
          new Date(b.created_at) -
          new Date(a.created_at)
      );

      return res.json({
        jobs: recommendedJobs,
        count: recommendedJobs.length,
      });

    } catch (err) {
      next(err);
    }
  }
);

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

/**
 * Get eligible students for a job
 *
 * Matching:
 * 1. Job title -> domain_roles.domain_name
 * 2. Student domain_role_id must match the job domain
 * 3. Student must have a completed assessment
 * 4. Compare student skill levels with domain required skill levels
 * 5. Students with >= 70% match are eligible
 */
router.get(
  "/:id/eligible-students",
  authRequired,
  async (req, res, next) => {
    try {
      // 1. Get the job
      const job = await repo.jobs.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: "Job not found.",
        });
      }

      // 2. Only the employer who owns the job or admin can view matches
      const isOwner = job.employer_id === req.user.sub;
      const isAdmin = req.user.role === "admin";

      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          error: "You are not authorized to view eligible students for this job.",
        });
      }

      // 3. Find the domain role using the job title
      const domainRoles = await repo.domainRoles.list();

      const domainRole = domainRoles.find(
        (role) =>
          role.domain_name?.trim().toLowerCase() ===
          job.title?.trim().toLowerCase()
      );

      if (!domainRole) {
        return res.status(404).json({
          error: `No domain role found for job title "${job.title}".`,
        });
      }

      // 4. Get required skills for this domain
      const requiredSkills =
        await repo.domainRequiredSkills.findByDomainRoleId(
          domainRole.domain_role_id || domainRole.id
        );

      if (!requiredSkills.length) {
        return res.status(404).json({
          error: "No required skills configured for this domain.",
        });
      }

      // 5. Get active students
      const students = await repo.users.list({
        role: "student",
        status: "active",
      });

      // Only students belonging to the same domain role
      const domainStudents = students.filter(
        (student) =>
          student.domain_role_id ===
          (domainRole.domain_role_id || domainRole.id)
      );

      // 6. Calculate match for every student
      const results = [];

      for (const student of domainStudents) {
        // Get latest completed assessment
        const completedSession =
  await repo.quizSessions.findCompletedByUser(student.id);

if (!completedSession) {
  continue;
}


        // Get student's skill results
        const skillResults =
          await repo.studentSkillResults.findBySessionId(
            completedSession.session_id
          );

        // Map skill_id -> student skill level
      // Map skill_id -> student's assessment result
const studentSkillMap = new Map();

for (const result of skillResults) {
  studentSkillMap.set(Number(result.skill_id), {
    percentage: Number(result.percentage || 0),
    skill_level: Number(result.skill_level || 0),
  });
}


// Calculate how well the student's skills match this job
let totalScore = 0;
let matchedSkills = 0;

const matchedSkillNames = [];
const missingSkillNames = [];

for (const requiredSkill of requiredSkills) {
  const requiredLevel = Number(
    requiredSkill.required_level || 0
  );

  const studentResult =
    studentSkillMap.get(Number(requiredSkill.skill_id));

  const studentLevel = studentResult?.skill_level || 0;

  console.log("SKILL MATCH CHECK:", {
    skill: requiredSkill.skill?.skill_name,
    requiredLevel,
    studentLevel,
  });

  if (requiredLevel <= 0) {
    matchedSkills++;
    totalScore += 1;
  } else {
    const matchRatio = Math.min(
      studentLevel / requiredLevel,
      1
    );

    totalScore += matchRatio;
    matchedSkills++;

    if (studentLevel >= requiredLevel) {
      matchedSkillNames.push(
        requiredSkill.skill?.skill_name
      );
    } else {
      missingSkillNames.push(
        requiredSkill.skill?.skill_name
      );
    }
  }
}

const skillMatch =
  matchedSkills > 0
    ? Math.round(
        (totalScore / matchedSkills) * 100
      )
    : 0;

// Determine fit category
let fitCategory;

if (skillMatch >= 80) {
  fitCategory = "Best Fit";
} else if (skillMatch >= 60) {
  fitCategory = "Good Fit";
} else {
  fitCategory = "Possible Fit";
}

results.push({
  id: student.id,
  name: student.name,
  email: student.email,
  domain_role_id: student.domain_role_id,
  domain_role:
    student.domainRole?.domain_name || job.title,

  skill_match: skillMatch,
  fit_category: fitCategory,

  matched_skills: matchedSkillNames,
  missing_skills: missingSkillNames,

  eligible: true,
});

      // Highest match first
      results.sort(
        (a, b) => b.skill_match - a.skill_match
      );

      return res.json({
        job: {
          id: job.id,
          title: job.title,
        },
        domain_role: {
          id: domainRole.domain_role_id || domainRole.id,
          name: domainRole.domain_name,
        },
        eligible_students: results,
        count: results.length,
      }); }
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  "/:id",
  authRequired,
  async (req, res, next) => {
    try {
      const job = await repo.jobs.findById(req.params.id);

      if (!job) {
        return res.status(404).json({
          error: "Job not found.",
        });
      }

      return res.json(job);
    } catch (err) {
      next(err);
    }
  }
);

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

router.post(
  "/:id/apply",
  authRequired,
  uploadResume.single("resume"),
  async (req, res, next) => {
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

      // --------------------------------------------
      // Parse application data from FormData
      // --------------------------------------------

      let applicationData = {};

if (req.body?.application_data) {
  try {
    applicationData = JSON.parse(
      req.body.application_data
    );
  } catch (err) {
    return res.status(400).json({
      error: "Invalid application data.",
    });
  }
}

console.log(
  "BACKEND APPLICATION DATA:",
  JSON.stringify(applicationData, null, 2)
);

      // --------------------------------------------
      // Resume information
      // --------------------------------------------

      if (req.file) {
  // New resume uploaded specifically for this application
  applicationData.resume = {
    file_name: req.file.originalname,
    stored_name: req.file.filename,
    file_type: req.file.mimetype,
    file_size: req.file.size,
    url: `/uploads/resumes/${req.file.filename}`,
  };
} else {
  // Use the student's profile resume
  const profile = await repo.profiles.findByUserId(
    req.user.sub
  );

  if (profile?.resume) {
    applicationData.resume = {
      ...profile.resume,
    };
  }
}

      // --------------------------------------------
      // Skill match
      // --------------------------------------------

      const skill_match =
        typeof applicationData.skill_match === "number"
          ? applicationData.skill_match
          : 70;

      // --------------------------------------------
      // Create application
      // --------------------------------------------

      const application =
        await repo.applications.create({
          job_id: job.id,
          student_id: req.user.sub,
          status: "submitted",
          skill_match,
          application_data: applicationData,
        });

      // --------------------------------------------
      // Notify employer
      // --------------------------------------------

      await repo.notifications.create({
        user_id: job.employer_id,
        type: "application",
        message: `New application for ${job.title}`,
      });

      return res.status(201).json(application);

    } catch (err) {
      next(err);
    }
  }
);

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