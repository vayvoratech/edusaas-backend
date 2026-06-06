// In-memory data store. Same shape as the Postgres tables.
const { v4: uuid } = require("uuid");
const bcrypt = require("bcryptjs");

const db = {
  users: [],
  profiles: [],
  assessments: [],
  gapReports: [],
  courses: [],
  enrollments: [],
  jobs: [],
  applications: [],
  notifications: [],
  subscriptions: [],
  reports: [],
  settings: [],
};

const newId = () => uuid();

function seed() {
  const adminId = newId();
  const studentId = newId();
  const employerId = newId();
  const educatorId = newId();
  const now = new Date().toISOString();

  db.users.push(
    {
      id: adminId,
      name: "Admin User",
      email: "admin@edu.local",
      role: "admin",
      password_hash: bcrypt.hashSync("admin123", 10),
      status: "active",
      last_login: now,
      created_at: now,
    },
    {
      id: studentId,
      name: "Priya Sharma",
      email: "priya.sharma@email.com",
      role: "student",
      password_hash: bcrypt.hashSync("demo123", 10),
      status: "active",
      last_login: now,
      created_at: now,
    },
    {
      id: employerId,
      name: "Ankit Verma",
      email: "ankit@employer.local",
      role: "employer",
      password_hash: bcrypt.hashSync("demo123", 10),
      status: "active",
      last_login: now,
      created_at: now,
    },
    {
      id: educatorId,
      name: "Yash Mehta",
      email: "yash@educator.local",
      role: "educator",
      password_hash: bcrypt.hashSync("demo123", 10),
      status: "suspended",
      last_login: null,
      created_at: now,
    }
  );

  const c1 = newId();
  const c2 = newId();
  db.courses.push(
    {
      id: c1,
      title: "Intro to Web Development",
      description: "HTML, CSS, JavaScript fundamentals.",
      provider: "EDU-SAAS",
      category: "Web",
      created_at: now,
    },
    {
      id: c2,
      title: "Data Structures with Python",
      description: "Lists, trees, graphs, hashing.",
      provider: "EDU-SAAS",
      category: "Programming",
      created_at: now,
    }
  );

  db.jobs.push({
    id: newId(),
    employer_id: employerId,
    title: "Junior Frontend Developer",
    required_skills: ["html", "css", "javascript", "react"],
    status: "open",
    created_at: now,
  });

  db.reports.push(
    {
      id: newId(),
      title: "Enrollment Statistics",
      type: "enrollment",
      generated_at: now,
      exported_at: now,
      format: "pdf",
      payload: { rows: 340 },
    },
    {
      id: newId(),
      title: "Assessment Results",
      type: "assessment",
      generated_at: now,
      exported_at: null,
      format: "csv",
      payload: { rows: 286 },
    },
    {
      id: newId(),
      title: "Activity Logs",
      type: "activity",
      generated_at: now,
      exported_at: now,
      format: "csv",
      payload: { rows: 1240 },
    },
    {
      id: newId(),
      title: "User Satisfaction Survey",
      type: "satisfaction",
      generated_at: now,
      exported_at: null,
      format: "pdf",
      payload: { rows: 98 },
    }
  );

  db.settings.push(
    { id: newId(), scope: "system", key: "enable_auto_backup", value: true },
    { id: newId(), scope: "system", key: "two_factor_auth", value: true },
    { id: newId(), scope: "system", key: "language", value: "en-US" },
    { id: newId(), scope: "system", key: "time_zone", value: "GMT-05:00" },
    { id: newId(), scope: "system", key: "email_alerts", value: true },
    { id: newId(), scope: "system", key: "user_registration", value: false },
    { id: newId(), scope: "system", key: "api_access", value: true }
  );
}

seed();

module.exports = { db, newId };
