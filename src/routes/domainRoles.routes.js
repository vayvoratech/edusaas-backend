const express = require("express");
const router = express.Router();

const repo = require("../data");

router.get("/", async (req, res, next) => {
  try {
    const domainRoles = await repo.domainRoles.list();

    return res.status(200).json({
      success: true,
      data: domainRoles,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;