const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const { port } = require("./src/config/env");
const swaggerSpec = require("./src/config/swagger");

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

const { notFound, errorHandler } = require("./src/middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    name: "EDU-SAAS Backend",
    status: "ok",
    docs: "/api-docs",
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

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

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`EDU-SAAS backend running at http://localhost:${port}`);
  console.log(`Swagger docs:           http://localhost:${port}/api-docs`);
});
