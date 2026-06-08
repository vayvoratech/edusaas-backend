// In-memory data store. Same shape as the Postgres tables.
const { v4: uuid } = require("uuid");
const bcrypt = require("bcryptjs");
const { PERMISSIONS, ROLES, ROLE_PERMISSIONS } = require("../config/rbac");

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
  lessons: [],
  quizzes: [],
  assignments: [],
  progress: [],
  certificates: [],
  achievements: [],
  tasks: [],
  recommendations: [],
  announcements: [],
  // RBAC
  roles: [],
  permissions: [],
  rolePermissions: [],
};

const newId = () => uuid();

function isoOffset(days, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function seed() {
  const now = new Date().toISOString();

  // ---- RBAC: roles, permissions, role_permissions ----
  const roleIdByName = {};
  for (const name of ROLES) {
    const id = newId();
    roleIdByName[name] = id;
    db.roles.push({
      id, name,
      description: `${name[0].toUpperCase()}${name.slice(1)} role`,
      created_at: now,
    });
  }

  const permIdByName = {};
  for (const p of PERMISSIONS) {
    const id = newId();
    permIdByName[p.name] = id;
    db.permissions.push({ id, ...p, created_at: now });
  }

  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role_id = roleIdByName[roleName];
    for (const permName of perms) {
      const permission_id = permIdByName[permName];
      if (!permission_id) continue;
      db.rolePermissions.push({ role_id, permission_id, assigned_at: now });
    }
  }

  // ---- Users (now reference role_id, not a string role) ----
  const adminId = newId();
  const studentId = newId();
  const educatorId = newId();
  const educator2Id = newId();
  const employerId = newId();
  const susEducatorId = newId();

  db.users.push(
    { id: adminId, name: "Admin User", email: "admin@edu.local", role_id: roleIdByName.admin,
      password_hash: bcrypt.hashSync("admin123", 10), status: "active", last_login: now, created_at: now },
    { id: studentId, name: "Priya Sharma", email: "priya.sharma@email.com", role_id: roleIdByName.student,
      password_hash: bcrypt.hashSync("demo123", 10), status: "active", last_login: now, created_at: now },
    { id: educatorId, name: "Yash Mehta", email: "yash@educator.local", role_id: roleIdByName.educator,
      password_hash: bcrypt.hashSync("demo123", 10), status: "active", last_login: now, created_at: now },
    { id: educator2Id, name: "Alisha Kumar", email: "alisha@educator.local", role_id: roleIdByName.educator,
      password_hash: bcrypt.hashSync("demo123", 10), status: "active", last_login: now, created_at: now },
    { id: employerId, name: "Ankit Verma", email: "ankit@employer.local", role_id: roleIdByName.employer,
      password_hash: bcrypt.hashSync("demo123", 10), status: "active", last_login: now, created_at: now },
    { id: susEducatorId, name: "Rajesh Kumar", email: "rajesh@educator.local", role_id: roleIdByName.educator,
      password_hash: bcrypt.hashSync("demo123", 10), status: "suspended", last_login: null, created_at: now }
  );

  // Profiles
  db.profiles.push({
    id: newId(), user_id: studentId, career_goal: "Cloud Engineer",
    institution: "XYZ University", company: null, preferences: { theme: "light" },
  });

  // Courses (mix of statuses + educators)
  const courses = [
    { id: newId(), title: "Advanced Python", description: "Decorators, generators, dataclasses.",
      provider: "EDU-SAAS", category: "Programming", difficulty: "advanced", status: "active", educator_id: educatorId, created_at: now },
    { id: newId(), title: "Data Science Basics", description: "Pandas, numpy, visualization.",
      provider: "EDU-SAAS", category: "Data Science", difficulty: "beginner", status: "active", educator_id: educatorId, created_at: now },
    { id: newId(), title: "Web Development", description: "HTML, CSS, JavaScript.",
      provider: "EDU-SAAS", category: "Web Dev", difficulty: "beginner", status: "active", educator_id: educator2Id, created_at: now },
    { id: newId(), title: "Soft Skills Development", description: "Communication and teamwork.",
      provider: "EDU-SAAS", category: "Soft Skills", difficulty: "beginner", status: "active", educator_id: educator2Id, created_at: now },
    { id: newId(), title: "Machine Learning 101", description: "Intro to ML algorithms.",
      provider: "EDU-SAAS", category: "AI & ML", difficulty: "intermediate", status: "draft", educator_id: educatorId, created_at: now },
    { id: newId(), title: "Project Management Fundamentals", description: "Agile, Scrum, Kanban.",
      provider: "EDU-SAAS", category: "Management", difficulty: "beginner", status: "active", educator_id: educator2Id, created_at: now },
    { id: newId(), title: "Legacy Java Basics", description: "Older Java intro.",
      provider: "EDU-SAAS", category: "Programming", difficulty: "beginner", status: "archived", educator_id: educatorId, created_at: now },
  ];
  db.courses.push(...courses);

  // Lessons for Advanced Python (the deep-link target from mockup)
  const advPython = courses[0];
  const lessons = [
    { id: newId(), course_id: advPython.id, title: "Python Decorators",
      video_url: "https://example.com/decorators.mp4", duration: 8, order_index: 1, created_at: now },
    { id: newId(), course_id: advPython.id, title: "Generators in Python",
      video_url: "https://example.com/generators.mp4", duration: 7, order_index: 2, created_at: now },
    { id: newId(), course_id: advPython.id, title: "Working with Dataclasses",
      video_url: "https://example.com/dataclasses.mp4", duration: 6, order_index: 3, created_at: now },
    { id: newId(), course_id: advPython.id, title: "Effective Python Testing Modules",
      video_url: "https://example.com/testing.mp4", duration: 10, order_index: 4, created_at: now },
  ];
  db.lessons.push(...lessons);

  // Quizzes (one per lesson)
  lessons.forEach((l) => {
    db.quizzes.push({
      id: newId(), lesson_id: l.id,
      questions: [
        { q: `Demo question on ${l.title}?`, options: ["A", "B", "C", "D"], answer: 0 },
      ],
      passing_score: 60,
    });
  });

  // Assignment on lesson 1
  db.assignments.push({
    id: newId(), lesson_id: lessons[0].id,
    instructions: "Write a Python decorator that times function execution.",
    submission_link: null,
    created_at: now,
  });

  // Enroll the student in Advanced Python + Soft Skills + Data Science
  db.enrollments.push(
    { id: newId(), user_id: studentId, course_id: advPython.id, status: "active",
      completion_percentage: 40, enrolled_at: now },
    { id: newId(), user_id: studentId, course_id: courses[1].id, status: "active",
      completion_percentage: 70, enrolled_at: now },
    { id: newId(), user_id: studentId, course_id: courses[3].id, status: "active",
      completion_percentage: 25, enrolled_at: now }
  );

  // Progress: lesson 1 done, lesson 2 in progress
  db.progress.push(
    { id: newId(), user_id: studentId, lesson_id: lessons[0].id,
      watched_duration: 480, quiz_score: 90, assignment_status: "submitted",
      completion_flag: true, updated_at: now },
    { id: newId(), user_id: studentId, lesson_id: lessons[1].id,
      watched_duration: 200, quiz_score: null, assignment_status: "pending",
      completion_flag: false, updated_at: now }
  );

  // Certificate for soft skills
  const certId = newId();
  db.certificates.push({
    id: certId, user_id: studentId, course_id: courses[3].id,
    certificate_code: "EDU-SS-" + Math.floor(Math.random() * 100000),
    issued_date: now,
  });

  // Achievements (12 badges to match mockup)
  const badges = [
    "Python Basics", "First Project", "Quiz Whiz", "Communicator",
    "Streak 5 Days", "Excel Pro", "SQL Star", "Team Player",
    "Top Performer", "Fast Learner", "Mentor", "Certified Cloud",
  ];
  badges.forEach((b, i) => {
    db.achievements.push({
      id: newId(), user_id: studentId, badge_name: b,
      milestone: i < 4 ? "Foundational" : i < 8 ? "Intermediate" : "Advanced",
      certificate_id: b === "Communicator" ? certId : null,
      earned_at: now,
    });
  });

  // Tasks (4 upcoming)
  db.tasks.push(
    { id: newId(), user_id: studentId, course_id: advPython.id,
      title: "Submit Python Assignment", due_date: isoOffset(2), status: "pending", created_at: now },
    { id: newId(), user_id: studentId, course_id: courses[1].id,
      title: "Data Science Notes Review", due_date: isoOffset(3), status: "pending", created_at: now },
    { id: newId(), user_id: studentId, course_id: courses[3].id,
      title: "Soft Skills Quiz", due_date: isoOffset(5), status: "pending", created_at: now },
    { id: newId(), user_id: studentId, course_id: advPython.id,
      title: "Watch Lesson 3", due_date: isoOffset(7), status: "pending", created_at: now }
  );

  // Recommendations (4 for the student)
  db.recommendations.push(
    { id: newId(), user_id: studentId, course_id: courses[0].id,
      reason: "Take your Python skills to the next level.", created_at: now },
    { id: newId(), user_id: studentId, course_id: courses[2].id,
      reason: "Learn to create interactive charts and dashboards.", created_at: now },
    { id: newId(), user_id: studentId, course_id: courses[3].id,
      reason: "Improve communication and teamwork skills.", created_at: now },
    { id: newId(), user_id: studentId, course_id: courses[4].id,
      reason: "Understand the basics of machine learning.", created_at: now }
  );

  // Announcements
  db.announcements.push(
    { id: newId(), educator_id: educatorId, title: "New Course Launch",
      message: "Advanced Python is live!", audience: "all",
      scheduled_at: null, attachment: null, created_at: isoOffset(-1) },
    { id: newId(), educator_id: educatorId, title: "Exam Reminder",
      message: "Final exam in 2 days.", audience: "course",
      scheduled_at: null, attachment: null, created_at: isoOffset(-2) },
    { id: newId(), educator_id: educatorId, title: "System Maintenance Notice",
      message: "Brief downtime Saturday 2-3 AM.", audience: "all",
      scheduled_at: null, attachment: null, created_at: isoOffset(-3) }
  );

  // Jobs with description + requirements
  db.jobs.push(
    { id: newId(), employer_id: employerId, title: "Data Analyst Intern",
      description: "Analyze datasets and build dashboards.",
      requirements: "SQL, Python, Excel.",
      required_skills: ["sql", "python", "excel"], status: "open", created_at: isoOffset(-2) },
    { id: newId(), employer_id: employerId, title: "Software Developer",
      description: "Build full-stack web apps.",
      requirements: "React, Node.js, PostgreSQL.",
      required_skills: ["react", "node", "postgres"], status: "open", created_at: isoOffset(-2) },
    { id: newId(), employer_id: employerId, title: "Marketing Coordinator",
      description: "Run digital campaigns.",
      requirements: "Communication, Analytics.",
      required_skills: ["communication", "analytics"], status: "open", created_at: isoOffset(-2) }
  );

  // Reports (admin demo data)
  db.reports.push(
    { id: newId(), title: "Enrollment Statistics", type: "enrollment",
      generated_at: now, exported_at: now, format: "pdf", payload: { rows: 340 } },
    { id: newId(), title: "Assessment Results", type: "assessment",
      generated_at: now, exported_at: null, format: "csv", payload: { rows: 286 } },
    { id: newId(), title: "Activity Logs", type: "activity",
      generated_at: now, exported_at: now, format: "csv", payload: { rows: 1240 } },
    { id: newId(), title: "User Satisfaction Survey", type: "satisfaction",
      generated_at: now, exported_at: null, format: "pdf", payload: { rows: 98 } }
  );

  // Settings
  db.settings.push(
    { id: newId(), scope: "system", key: "enable_auto_backup", value: true },
    { id: newId(), scope: "system", key: "two_factor_auth", value: true },
    { id: newId(), scope: "system", key: "language", value: "en-US" },
    { id: newId(), scope: "system", key: "time_zone", value: "GMT-05:00" },
    { id: newId(), scope: "system", key: "email_alerts", value: true },
    { id: newId(), scope: "system", key: "user_registration", value: false },
    { id: newId(), scope: "system", key: "api_access", value: true },
    { id: newId(), scope: "system", key: "organization_name", value: "EduSaaS InfoNestFarms" },
    { id: newId(), scope: "system", key: "theme", value: "SaaS Blue-White" },
    { id: newId(), scope: "system", key: "password_policy", value: "Strong" },
    { id: newId(), scope: "system", key: "password_expiry_days", value: 90 },
    { id: newId(), scope: "system", key: "session_timeout", value: true },
    { id: newId(), scope: "system", key: "failed_attempts_before_lockout", value: 5 },
    { id: newId(), scope: "system", key: "lockout_duration_minutes", value: 15 },
    { id: newId(), scope: "system", key: "ip_whitelist", value: ["192.168.1.10", "10.0.0.5"] }
  );
}

seed();

module.exports = { db, newId };
