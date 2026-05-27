// In-memory data store. Swap this module for Mongoose models when wiring MongoDB.
// All collections are plain arrays of plain objects with the same shape as the
// MongoDB documents that will replace them.

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
};

const newId = () => uuid();

function seed() {
  const adminId = newId();
  const studentId = newId();
  db.users.push(
    {
      id: adminId,
      name: "Admin User",
      email: "admin@edu.local",
      role: "admin",
      password_hash: bcrypt.hashSync("admin123", 10),
      created_at: new Date().toISOString(),
    },
    {
      id: studentId,
      name: "Priya Sharma",
      email: "priya.sharma@email.com",
      role: "student",
      password_hash: bcrypt.hashSync("demo123", 10),
      created_at: new Date().toISOString(),
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
      created_at: new Date().toISOString(),
    },
    {
      id: c2,
      title: "Data Structures with Python",
      description: "Lists, trees, graphs, hashing.",
      provider: "EDU-SAAS",
      category: "Programming",
      created_at: new Date().toISOString(),
    }
  );

  const j1 = newId();
  db.jobs.push({
    id: j1,
    employer_id: adminId,
    title: "Junior Frontend Developer",
    required_skills: ["html", "css", "javascript", "react"],
    status: "open",
    created_at: new Date().toISOString(),
  });
}

seed();

module.exports = { db, newId };
