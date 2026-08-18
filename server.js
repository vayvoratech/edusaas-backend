// Import required modules
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

// Import environment variables and Swagger configuration
const { port, appEnv } = require("./src/config/env");
const swaggerSpec = require("./src/config/swagger");

// Import route handlers
const authRoutes = require("./src/routes/auth.routes");
const usersRoutes = require("./src/routes/users.routes");
const assessmentsRoutes = require("./src/routes/assessments.routes");
const gapReportRoutes = require("./src/routes/gapReport.routes");
const coursesRoutes = require("./src/routes/courses.routes");
const enrollmentsRoutes = require("./src/routes/enrollments.routes");
const jobsRoutes = require("./src/routes/jobs.routes");
const notificationsRoutes = require("./src/routes/notifications.routes");
const adminRoutes = require("./src/routes/admin.routes");
const subscriptionsRoutes = require("./src/routes/subscriptions.routes");
const reportsRoutes = require("./src/routes/reports.routes");
const settingsRoutes = require("./src/routes/settings.routes");
const lessonsRoutes = require("./src/routes/lessons.routes");
const progressRoutes = require("./src/routes/progress.routes");
const certificatesRoutes = require("./src/routes/certificates.routes");
const achievementsRoutes = require("./src/routes/achievements.routes");
const tasksRoutes = require("./src/routes/tasks.routes");
const recommendationsRoutes = require("./src/routes/recommendations.routes");
const announcementsRoutes = require("./src/routes/announcements.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");
const rbacRoutes = require("./src/routes/rbac.routes");
const domainRolesRoutes = require("./src/routes/domainRoles.routes");
const communityRoutes = require("./src/routes/community.routes");

// Import error handling middleware
const { notFound, errorHandler } = require("./src/middleware/errorHandler");
const { attachProctoringGateway } = require("./src/services/proctoringGateway");

// Initialize the Express application
const app = express();

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors());
// Parse incoming JSON requests
app.use(express.json());

// Root endpoint to check the status of the service
app.get("/", (req, res) => {
  res.json({
    name: "EDU-SAAS Backend",
    status: "ok",
    docs: "/api-docs",
  });
});

// Serve Swagger API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Provide the Swagger specification as a JSON file
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

// Mount the various API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/gap-report", gapReportRoutes);
app.use("/api/courses", coursesRoutes);
app.use("/api/enrollments", enrollmentsRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subscriptions", subscriptionsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/domain-roles", domainRolesRoutes);

// Lesson routes are nested under /api/courses for /:id/lessons,
// plus a top-level /api/lessons/lesson/:id for single-lesson detail.
app.use("/api/courses", lessonsRoutes);
app.use("/api/lessons", lessonsRoutes);

app.use("/api/progress", progressRoutes);
app.use("/api/certificates", certificatesRoutes);
app.use("/api/achievements", achievementsRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/community", communityRoutes);

// Middleware to handle 404 Not Found errors
app.use(notFound);
// Centralized error handler
app.use(errorHandler);

// Start the server and listen on the configured port
const server = app.listen(port, () => {
  console.log(`[env] APP_ENV=${appEnv}`);
  console.log(`EDU-SAAS backend running at http://localhost:${port}`);
  console.log(`Swagger docs:           http://localhost:${port}/api-docs`);
});

attachProctoringGateway(server)
