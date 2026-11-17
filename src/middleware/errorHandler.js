function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;

  if (err.code === "INVALID_FILE_TYPE") {
    status = 400;
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    status = 413;
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    status = 400;
  }

  const response = {
    error: err.message || "Internal server error",
  };

  if (
    [
      "ASSESSMENT_TIME_EXPIRED",
      "ASSESSMENT_TERMINATED",
      "ASSESSMENT_ALREADY_COMPLETED",
    ].includes(err.code)
  ) {
    response.code = err.code;
  }

  res.status(status).json(response);
}

module.exports = { notFound, errorHandler };
