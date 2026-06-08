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
    res.json(await repo.certificates.listByUser(req.user.sub));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /api/certificates:
 *   post:
 *     tags: [Certificates]
 *     summary: Issue a certificate (educator/admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, course_id]
 *             properties:
 *               user_id: { type: string }
 *               course_id: { type: string }
 *     responses:
 *       201: { description: Certificate issued }
 */
router.post("/", authRequired, async (req, res, next) => {
  try {
    const { user_id, course_id } = req.body || {};
    if (!user_id || !course_id) return res.status(400).json({ error: "user_id, course_id required" });
    const cert = await repo.certificates.create({ user_id, course_id });
    res.status(201).json(cert);
  } catch (err) { next(err); }
});

module.exports = router;
