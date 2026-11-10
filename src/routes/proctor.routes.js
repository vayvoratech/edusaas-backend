const express = require("express");
const proctoringGateway = require("../services/proctoringGateway");

const router = express.Router();

router.get("/health", async (_req, res) => {
  try {
    const service = await proctoringGateway.checkProctorHealth();
    return res.status(200).json(service);
  } catch (error) {
    console.error(
      "[proctoring] Health check failed:",
      proctoringGateway.getProctorErrorDetails(error)
    );
    return res.status(503).json({
      error: proctoringGateway.PROCTORING_UNAVAILABLE_MESSAGE,
    });
  }
});

module.exports = router;
