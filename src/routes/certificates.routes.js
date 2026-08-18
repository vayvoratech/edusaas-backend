const express = require("express");
const repo = require("../data");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /api/certificates:
 *   get:
 *     tags: [Certificates]
 *     summary: List certificates for the current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of certificates }
 */
router.get("/", authRequired, async (req, res, next) => {
  try {
    // Certificates are intended for students.
    if (req.user.role !== "student") {
      return res.json([]);
    }

    return res.json(
      await repo.certificates.listByUser(req.user.sub)
    );
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/certificates:
 *   post:
 *     tags: [Certificates]
 *     summary: Issue a certificate (Admin only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, course_id]
 *             properties:
 *               user_id:
 *                 type: string
 *               course_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Certificate issued
 */
router.post("/", authRequired, async (req, res, next) => {
  try {
    // Only admins can issue certificates
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "Only administrators can issue certificates.",
      });
    }

    const { user_id, course_id } = req.body || {};

    if (!user_id || !course_id) {
      return res.status(400).json({
        error: "user_id and course_id are required.",
      });
    }

    // Validate user
    const user = await repo.users.findById(user_id);

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    // Validate course
    const course = await repo.courses.findById(course_id);

    if (!course) {
      return res.status(404).json({
        error: "Course not found.",
      });
    }

    // Validate enrollment
    const enrollment = await repo.enrollments.findOne(
      user_id,
      course_id
    );

    if (!enrollment) {
      return res.status(400).json({
        error: "User is not enrolled in this course.",
      });
    }

    // Prevent issuing certificate before completion
    if (enrollment.completion_percentage < 100) {
      return res.status(400).json({
        error: "Course must be completed before issuing a certificate.",
      });
    }

    // Prevent duplicate certificates
    const existingCertificate =
      await repo.certificates.findByUserAndCourse(
        user_id,
        course_id
      );

    if (existingCertificate) {
      return res.status(409).json({
        error: "Certificate already exists.",
      });
    }

    const certificate = await repo.certificates.create({
      user_id,
      course_id,
    });

    return res.status(201).json(certificate);

  } catch (err) {
    next(err);
  }
});

module.exports = router;