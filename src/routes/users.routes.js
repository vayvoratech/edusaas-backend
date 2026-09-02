const express = require("express");
const repo = require("../data");
const uploadResume = require("../middleware/uploadResume");
const {
  authRequired,
  roleRequired,
} = require("../middleware/auth");


const router = express.Router();



/**
 * Remove sensitive fields before sending user data
 */
function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    last_login: user.last_login,
    created_at: user.created_at,
  };
}

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Fetch user profile
 *     security: [{ bearerAuth: [] }]
 */
router.get("/:id", authRequired, async (req, res, next) => {
  try {
    // Only the owner or admin can view a profile
    if (
      req.user.sub !== req.params.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        error: "Cannot view another user's profile.",
      });
    }

    const user = await repo.users.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found.",
      });
    }

    const profile = await repo.profiles.findByUserId(user.id);

    return res.json({
      ...sanitizeUser(user),
      profile: profile || null,
    });

  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/users/{id}/profile:
 *   put:
 *     tags: [Users]
 *     summary: Create or update extended profile info
 *     security: [{ bearerAuth: [] }]
 */
router.put("/:id/profile", authRequired, async (req, res, next) => {
  try {

    // Only owner or admin
    if (
      req.user.sub !== req.params.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        error: "Cannot edit another user's profile.",
      });
    }

    const allowedFields = [
      "career_goal",
      "institution",
      "company",
      "preferences",
    ];

    const data = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }

    const profile = await repo.profiles.upsert(
      req.params.id,
      data
    );

    return res.json(profile);

  } catch (err) {
    next(err);
  }
});

router.post(
  "/:id/profile/resume",
  authRequired,
  uploadResume.single("resume"),
  async (req, res, next) => {
    try {
      // Only owner or admin
      if (
        req.user.sub !== req.params.id &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          error: "Cannot update another user's resume.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Please select a resume.",
        });
      }

      const resume = {
        file_name: req.file.originalname,
        stored_name: req.file.filename,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        url: `/uploads/resumes/${req.file.filename}`,
      };

      const profile = await repo.profiles.upsert(
        req.params.id,
        { resume }
      );

      return res.json({
        message: "Resume uploaded successfully.",
        resume: profile.resume,
      });
    } catch (err) {
      next(err);
    }
  }
);


router.post(
  "/:id/profile/resume",
  authRequired,
  uploadResume.single("resume"),
  async (req, res, next) => {
    try {
      // Only owner or admin
      if (
        req.user.sub !== req.params.id &&
        req.user.role !== "admin"
      ) {
        return res.status(403).json({
          error: "Cannot update another user's resume.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "Please select a resume.",
        });
      }

      const existingProfile =
        await repo.profiles.findByUserId(req.params.id);

      const resume = {
        file_name: req.file.originalname,
        stored_name: req.file.filename,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        url: `/uploads/resumes/${req.file.filename}`,
      };

      const profile = await repo.profiles.upsert(
        req.params.id,
        { resume }
      );

      return res.json({
        message: existingProfile?.resume
          ? "Resume replaced successfully."
          : "Resume uploaded successfully.",
        resume: profile.resume,
        profile,
      });

    } catch (err) {
      next(err);
    }
  }
);

/**
 * @openapi
 * /api/users/students/candidates:
 *   get:
 *     tags: [Users]
 *     summary: List students for employer candidate search
 *     security: [{ bearerAuth: [] }]
 */
router.get("/students/candidates", authRequired, roleRequired("educator","employer", "admin"),async (req, res, next) => {
  
    try {

      const students = await repo.users.list({
        role: "student",
        status: "active",
      });

      return res.json(
        students.map((student) => sanitizeUser(student))
      );

    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;