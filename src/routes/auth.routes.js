const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require('crypto')
const repo = require("../data");
const { sendOtpEmail } = require("../config/mail");
const router = express.Router();
const {authRequired} = require('../middleware/auth')

const { refreshJwtSecret } = require("../config/env");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../config/jwt");

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Create new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string, example: Jane Doe }
 *               email: { type: string, example: jane@edu.local }
 *               password: { type: string, example: secret123 }
 *               role:
 *                 type: string
 *                 enum: [student, educator, employer, admin]
 *                 example: student
 *     responses:
 *       201: { description: User created, returns token }
 *       400: { description: Validation error }
 *       409: { description: Email already exists }
 */
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role, career_goal } = req.body || {};

    // Validate Request
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: "name, email, password, role are required",
      });
    }

    if (!["student", "educator", "employer", "admin"].includes(role)) {
      return res.status(400).json({
        error: "invalid role",
      });
    }

    // Check Existing User
    if (await repo.users.findByEmail(email.trim().toLowerCase())) {
      return res.status(409).json({
        error: "email already registered",
      });
    }

    // Create User
    const password_hash = await bcrypt.hash(password, 10);

    const user = await repo.users.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      password_hash,
      career_goal: role === "student" ? career_goal :null
    });

    // Generate Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Convert refresh token to SHA-256 digest
    const tokenDigest = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Store bcrypt hash of digest
    const token_hash = await bcrypt.hash(tokenDigest, 10);

    // Decode refresh token expiry
    const decodedRefreshToken = jwt.decode(refreshToken);

    // Save Refresh Token
    await repo.refreshTokens.create({
      user_id: user.id,
      token_hash,
      expires_at: new Date(decodedRefreshToken.exp * 1000),
    });

    // Success Response
    return res.status(201).json({
      accessToken,
      refreshToken,
      user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      career_goal: user.career_goal,
      permissions: user.permissions || [],
    },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: admin@edu.local }
 *               password: { type: string, example: admin123 }
 *     responses:
 *       200: { description: Authenticated, returns token }
 *       401: { description: Invalid credentials }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    // Validate Request
    if (!email || !password) {
      return res.status(400).json({
        error: "email and password are required",
      });
    }

    // Find User
    const user = await repo.users.findByEmail(
      email.trim().toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        error: "invalid credentials",
      });
    }

    // Verify Password
    const ok = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!ok) {
      return res.status(401).json({
        error: "invalid credentials",
      });
    }

    // Check Account Status
    if (user.status === "suspended") {
      return res.status(403).json({
        error: "account suspended",
      });
    }

    // Update Last Login
    await repo.users.touchLogin(user.id);

    // Generate Tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Convert refresh token to SHA-256 digest
    const tokenDigest = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Store bcrypt hash of the digest
    const token_hash = await bcrypt.hash(tokenDigest, 10);

    // Decode Refresh Token to get expiry
    const decodedRefreshToken = jwt.decode(refreshToken);

    // Save Refresh Token
    await repo.refreshTokens.create({
      user_id: user.id,
      token_hash,
      expires_at: new Date(decodedRefreshToken.exp * 1000),
    })
    
    // Success Response
    return res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        career_goal: user.career_goal,
        permissions: user.permissions || [],
      },
    });

  } catch (err) {
    next(err);
  }
});


router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token is required.",
      });
    }

    // Verify JWT signature and expiry
    let payload;
    try {
      payload = jwt.verify(refreshToken, refreshJwtSecret);
    } catch (err) {
      return res.status(401).json({
        error: "Invalid or expired refresh token.",
      });
    }

    // Find User
    const user = await repo.users.findById(payload.sub);
    if (!user) {
      return res.status(401).json({
        error: "User not found.",
      });
    }

    // Find all stored refresh tokens for this user
    const storedTokens = await repo.refreshTokens.findByUserId(user.id);
    if (!storedTokens || storedTokens.length === 0) {
      return res.status(401).json({
        error: "Refresh token not found in store.",
      });
    }

    // Stored hashes are bcrypt(sha256(rawToken)) — see register/login/logout.
    // Must hash the incoming token the same way before comparing, or bcrypt.compare
    // will never match.
    const incomingTokenDigest = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    let matchedStoredToken = null;
    for (const stored of storedTokens) {
      const ok = await bcrypt.compare(incomingTokenDigest, stored.token_hash);
      if (ok) {
        matchedStoredToken = stored;
        break;
      }
    }

    if (!matchedStoredToken) {
      return res.status(401).json({
        error: "Invalid refresh token.",
      });
    }

    // Delete the used refresh token
    await repo.refreshTokens.delete(matchedStoredToken.id);

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Store bcrypt(sha256(newRefreshToken)) — same scheme as register/login,
    // so the NEXT refresh call's comparison above also matches.
    const newTokenDigest = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");
    const token_hash = await bcrypt.hash(newTokenDigest, 10);

    // Decode expiry from the new token
    const decodedRefreshToken = jwt.decode(newRefreshToken);

    // Save new refresh token hash to the database
    await repo.refreshTokens.create({
      user_id: user.id,
      token_hash,
      expires_at: new Date(decodedRefreshToken.exp * 1000),
    });

    // Return both new tokens
    return res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
    });

  } catch (err) {
    next(err);
  }
});


router.post("/logout", authRequired, async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token is required.",
      });
    }

    // Verify refresh token
    let payload;

    try {
      payload = jwt.verify(refreshToken, refreshJwtSecret);
    } catch (err) {
      return res.status(401).json({
        error: "Invalid or expired refresh token.",
      });
    }

    // Get all refresh tokens for this user
    const storedTokens = await repo.refreshTokens.findByUserId(payload.sub);

    if (!storedTokens.length) {
      return res.status(200).json({
        message: "Logged out successfully.",
      });
    }

    // Find matching token
    let tokenId = null;

    // Convert incoming refresh token to SHA-256 digest to match the stored format
    const incomingTokenDigest = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    for (const stored of storedTokens) {
      const matched = await bcrypt.compare(
        incomingTokenDigest,
        stored.token_hash
      );

      if (matched) {
        tokenId = stored.id;
        break;
      }
    }

    // Delete matching token
    if (tokenId) {
      await repo.refreshTokens.delete(tokenId);
    }

    return res.status(200).json({
      message: "Logged out successfully.",
    });

  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};

    // Validate email
    if (!email || !email.trim()) {
      return res.status(400).json({
        error: "Email is required.",
      });
    }

    // Find user
    const user = await repo.users.findByEmail(email.trim().toLowerCase());

    // Prevent email enumeration
    if (!user) {
      return res.status(200).json({
        message: "If an account exists, an OTP has been sent.",
      });
    }

    // Remove any existing OTP
    await repo.authOtps.deleteByUserId(user.id);

    // Generate 6-digit OTP
    const otp = generateOtp();

    // Hash OTP
    const otp_hash = await bcrypt.hash(otp, 10);

    // OTP expires in 10 minutes
    const expires_at = new Date(Date.now() + 10 * 60 * 1000);

    // Store OTP
    await repo.authOtps.create({
      user_id: user.id,
      otp_hash,
      expires_at,
    });

    // Send Email
    await sendOtpEmail(user.email, otp);

    return res.status(200).json({
      message: "If an account exists, an OTP has been sent.",
    });

  } catch (err) {
    next(err);
  }
});

router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = req.body || {};

    // Step 1: Validate request
    if (!email || !otp) {
      return res.status(400).json({
        error: "Email and OTP are required.",
      });
    }

    // Step 2: Find user
    const user = await repo.users.findByEmail(
      email.trim().toLowerCase()
    );

    if (!user) {
      return res.status(400).json({
        error: "Invalid OTP.",
      });
    }

    // Step 3: Find OTP
    const otpRecord = await repo.authOtps.findByUserId(user.id);

    if (!otpRecord) {
      return res.status(400).json({
        error: "Invalid OTP.",
      });
    }

    // Step 4: Check already verified
    if (otpRecord.verified_at) {
      return res.status(400).json({
        error: "OTP already verified.",
      });
    }

    // Step 5: Check expiry
    if (new Date() > otpRecord.expires_at) {
      return res.status(400).json({
        error: "OTP has expired.",
      });
    }

    // Step 6: Compare OTP
    const isValid = await bcrypt.compare(
      otp,
      otpRecord.otp_hash
    );

    if (!isValid) {
      return res.status(400).json({
        error: "Invalid OTP.",
      });
    }

    // Step 7: Mark OTP as verified
    await repo.authOtps.verify(otpRecord.id);

    // Step 8: Success
    return res.status(200).json({
      message: "OTP verified successfully.",
    });

  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const { email, newPassword } = req.body || {};
    // Step 1: Validate Request
    if (!email || !newPassword) {
      return res.status(400).json({
        error: "Email and new password are required.",
      });
    }

    // Step 2: Find User
    const user = await repo.users.findByEmail(
      email.trim().toLowerCase()
    );

    if (!user) {
      return res.status(400).json({
        error: "Invalid request.",
      });
    }

    // Step 3: Find OTP
    const otpRecord = await repo.authOtps.findByUserId(user.id);

    if (!otpRecord) {
      return res.status(400).json({
        error: "OTP verification required.",
      });
    }

    // Step 4: Check OTP verified
    if (!otpRecord.verified_at) {
      return res.status(400).json({
        error: "OTP not verified.",
      });
    }

    // Step 5: Check expiry
    if (new Date() > otpRecord.expires_at) {
      return res.status(400).json({
        error: "OTP has expired.",
      });
    }

    // Step 6: Hash New Password
    const password_hash = await bcrypt.hash(newPassword, 10);

    // Step 7: Update Password
    await repo.users.updatePassword(
      user.id,
      password_hash
    );

    // Step 8: Delete OTP
    await repo.authOtps.deleteByUserId(user.id);

    // Step 9: Success
    return res.status(200).json({
      message: "Password reset successfully.",
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;