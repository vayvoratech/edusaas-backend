const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const repo = require("../data");
const { jwtSecret, jwtExpiresIn } = require("../config/env");

const router = express.Router();

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
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "name, email, password, role are required" });
    }
    if (!["student", "educator", "employer", "admin"].includes(role)) {
      return res.status(400).json({ error: "invalid role" });
    }
    if (await repo.users.findByEmail(email)) {
      return res.status(409).json({ error: "email already registered" });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await repo.users.create({ name, email, role, password_hash });
    const token = jwt.sign(
      { sub: user.id, role: user.role, permissions: user.permissions || [] },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );
    res.status(201).json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, permissions: user.permissions || [],
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
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });
    const user = await repo.users.findByEmail(email);
    if (!user) return res.status(401).json({ error: "invalid credentials" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });
    if (user.status === "suspended") return res.status(403).json({ error: "account suspended" });
    await repo.users.touchLogin(user.id);
    const token = jwt.sign(
      { sub: user.id, role: user.role, permissions: user.permissions || [] },
      jwtSecret,
      { expiresIn: jwtExpiresIn }
    );
    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, permissions: user.permissions || [],
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
