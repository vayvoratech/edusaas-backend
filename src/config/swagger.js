const swaggerJSDoc = require("swagger-jsdoc");
const path = require("path");

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "EDU-SAAS Backend API",
      version: "1.0.0",
      description:
        "REST API for EDU-SAAS platform. Currently backed by an in-memory store; will switch to MongoDB later without endpoint changes.",
    },
    servers: [{ url: "http://localhost:5000", description: "Local dev" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    tags: [
      { name: "Auth" },
      { name: "Users" },
      { name: "Assessments" },
      { name: "GapReport" },
      { name: "Courses" },
      { name: "Enrollments" },
      { name: "Jobs" },
      { name: "Notifications" },
      { name: "Admin" },
      { name: "Subscriptions" },
    ],
  },
  apis: [path.join(__dirname, "..", "routes", "*.js")],
};

module.exports = swaggerJSDoc(options);
