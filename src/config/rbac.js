// Canonical RBAC catalog. Edit here, then run the seed/dataStore restart to apply.
// Names follow "resource:action" convention.

const PERMISSIONS = [
  // Courses
  { name: "courses:view", category: "Courses", description: "View courses" },
  { name: "courses:create", category: "Courses", description: "Create new course" },
  { name: "courses:update", category: "Courses", description: "Edit a course" },
  { name: "courses:delete", category: "Courses", description: "Delete a course" },

  // Lessons
  { name: "lessons:create", category: "Courses", description: "Add lessons to a course" },

  // Enrollments
  { name: "enrollments:create", category: "Learning", description: "Enroll in a course" },
  { name: "enrollments:view-mine", category: "Learning", description: "View own enrollments" },

  // Progress
  { name: "progress:update", category: "Learning", description: "Update lesson progress" },

  // Assessments
  { name: "assessments:submit", category: "Learning", description: "Submit an assessment" },

  // Gap report
  { name: "gap-report:view", category: "Learning", description: "View own gap report" },

  // Jobs
  { name: "jobs:view", category: "Jobs", description: "View job postings" },
  { name: "jobs:create", category: "Jobs", description: "Create job postings" },
  { name: "jobs:update", category: "Jobs", description: "Edit job postings" },
  { name: "jobs:delete", category: "Jobs", description: "Delete job postings" },
  { name: "jobs:apply", category: "Jobs", description: "Apply to a job" },
  { name: "jobs:view-applications", category: "Jobs", description: "See applicants for a job" },

  // Candidates
  { name: "candidates:view", category: "Jobs", description: "Browse student candidates" },

  // Announcements
  { name: "announcements:view", category: "Communication", description: "Read announcements" },
  { name: "announcements:send", category: "Communication", description: "Send announcements" },

  // Tasks
  { name: "tasks:manage", category: "Learning", description: "Manage own tasks" },

  // Achievements / Certificates
  { name: "achievements:view-mine", category: "Achievements", description: "View own badges" },
  { name: "certificates:view-mine", category: "Achievements", description: "View own certs" },
  { name: "certificates:issue", category: "Achievements", description: "Issue certificates" },

  // Insights/Dashboards
  { name: "dashboards:student", category: "Insights", description: "Student dashboard" },
  { name: "dashboards:educator", category: "Insights", description: "Educator dashboard" },
  { name: "dashboards:employer", category: "Insights", description: "Employer dashboard" },

  // Admin scope
  { name: "users:list", category: "Admin", description: "List all users" },
  { name: "users:update", category: "Admin", description: "Edit other users" },
  { name: "users:delete", category: "Admin", description: "Delete users" },
  { name: "admin:insights", category: "Admin", description: "Platform insights" },
  { name: "reports:view", category: "Admin", description: "Reports module" },
  { name: "settings:read", category: "Admin", description: "Read system settings" },
  { name: "settings:update", category: "Admin", description: "Update system settings" },

  // Subscriptions
  { name: "subscriptions:manage-mine", category: "Billing", description: "Manage own subscription" },

  // Profile
  { name: "profile:edit-own", category: "Profile", description: "Edit own profile" },
];

const ROLES = ["student", "educator", "employer", "admin"];

// Role → permission mapping. Easy to read, easy to extend.
const ROLE_PERMISSIONS = {
  student: [
    "courses:view",
    "enrollments:create", "enrollments:view-mine",
    "progress:update",
    "assessments:submit",
    "gap-report:view",
    "jobs:view", "jobs:apply",
    "announcements:view",
    "tasks:manage",
    "achievements:view-mine", "certificates:view-mine",
    "dashboards:student",
    "subscriptions:manage-mine",
    "profile:edit-own",
  ],
  educator: [
    "courses:view", "courses:create", "courses:update", "courses:delete",
    "lessons:create",
    "announcements:view", "announcements:send",
    "certificates:issue",
    "dashboards:educator",
    "profile:edit-own",
  ],
  employer: [
    "jobs:view", "jobs:create", "jobs:update", "jobs:delete",
    "jobs:view-applications",
    "candidates:view",
    "dashboards:employer",
    "profile:edit-own",
  ],
  admin: [
    // admin gets everything
    ...new Set(PERMISSIONS.map((p) => p.name)),
  ],
};

module.exports = { PERMISSIONS, ROLES, ROLE_PERMISSIONS };
