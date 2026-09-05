const express = require("express");
const repo = require("../data");
const uploadResume = require("../middleware/uploadResume");
const {
  authRequired,
  roleRequired,
} = require("../middleware/auth");


const router = express.Router();

const { clerkMiddleware, getAuth, clerkClient } = require('@clerk/express');
const { generateAccessToken, generateRefreshToken } = require("../config/jwt");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

/**
 * @openapi
 * /api/users/sync:
 *   post:
 *     tags: [Users]
 *     summary: Synchronize Clerk user to PostgreSQL DB
 *     security: [{ bearerAuth: [] }]
 */
router.post("/sync", clerkMiddleware({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY
}), async (req, res, next) => {
  console.log("[SYNC ROUTE HIT] Starting user sync process...");
  try {
    const auth = getAuth(req);
    const clerkId = auth.userId;
    
    if (!clerkId) {
      return res.status(401).json({ error: "Unauthorized: Missing valid Clerk session token." });
    }
    
    console.log("[SYNC] Authenticated Clerk ID:", clerkId);
    
    const clerkUser = await clerkClient.users.getUser(clerkId);
    console.log("[SYNC] Clerk User Data:", JSON.stringify({
      id: clerkUser.id,
      emailAddresses: clerkUser.emailAddresses,
      primaryEmailAddressId: clerkUser.primaryEmailAddressId,
      unsafeMetadata: clerkUser.unsafeMetadata
    }));
    
    const primaryEmailObj = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
    const email = primaryEmailObj ? primaryEmailObj.emailAddress.toLowerCase() : null;
    
    if (!email) {
      console.log("[SYNC] No primary email found!");
      return res.status(400).json({ error: "Clerk user has no primary email" });
    }

    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User';
    const username = clerkUser.username || null;
    const role = req.body.role || clerkUser.unsafeMetadata.role || 'student';
    const domainRoleId = req.body.domainRoleId || clerkUser.unsafeMetadata.domain_role_id || null;
    
    console.log("[SYNC] Parsed Data - Email:", email, "Name:", name, "Username:", username, "Role:", role, "Domain:", domainRoleId);

    let user = await repo.users.findByEmail(email);

    if (!user) {
      console.log("[SYNC] Creating new user in postgres...");
      // Create user in postgres
      const dummyPassword = crypto.randomBytes(16).toString('hex');
      const password_hash = await bcrypt.hash(dummyPassword, 10);
      
      try {
        user = await repo.users.create({
          name,
          username,
          clerk_id: clerkId,
          email,
          role,
          password_hash,
          domain_role_id: role === "student" ? domainRoleId : null,
        });
        console.log("[SYNC] Successfully created user:", user.id);
      } catch (dbErr) {
        console.error("[SYNC] Database Creation Error:", dbErr);
        throw dbErr;
      }

      if (role === "student") {
        await repo.profiles.upsert(user.id, {
          institution: null,
          company: null,
          preferences: {},
          initial_assessment_completed: false,
        });
      }
    } else {
      console.log("[SYNC] User already exists in postgres:", user.id);
      
      let updateData = {};
      
      // Update clerk_id if they recreated their Clerk account
      if (user.clerk_id !== clerkId) {
        updateData.clerk_id = clerkId;
      }

      // If the frontend explicitly passed a role (e.g. from Onboarding screen),
      // we must update Postgres to respect their choice!
      if (req.body.role && req.body.role !== user.role) {
        console.log(`[SYNC] Updating user role from ${user.role} to ${req.body.role}`);
        updateData.role = req.body.role;
        updateData.domain_role_id = req.body.role === 'student' ? (req.body.domainRoleId || null) : null;
      }

      // Apply updates to the database if needed
      if (Object.keys(updateData).length > 0) {
        user = await repo.users.update(user.id, updateData);
      }

      // Sync postgres role UP to Clerk so Clerk context is correct
      if (clerkUser.unsafeMetadata.role !== user.role) {
        console.log(`[SYNC] Pushing Postgres role (${user.role}) back to Clerk metadata`);
        await clerkClient.users.updateUserMetadata(clerkId, {
          unsafeMetadata: {
            role: user.role,
            domain_role_id: user.domain_role_id
          }
        });
      }
    }

    await repo.users.touchLogin(user.id);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const tokenDigest = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const token_hash = await bcrypt.hash(tokenDigest, 10);
    const decodedRefreshToken = jwt.decode(refreshToken);

    await repo.refreshTokens.create({
      user_id: user.id,
      token_hash,
      expires_at: new Date(decodedRefreshToken.exp * 1000),
    });

    console.log("[SYNC] Sync completely successful!");
    return res.json({
      accessToken,
      refreshToken,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("[SYNC] FATAL ERROR:", err);
    next(err);
  }
});

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users by username
 *     security: [{ bearerAuth: [] }]
 */
router.get("/search", authRequired, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Search query 'q' is required" });
    }
    const results = await repo.users.searchByUsername(q, req.user.sub);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});


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