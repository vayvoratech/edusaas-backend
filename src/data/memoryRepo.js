// In-memory repository. Same async API as prismaRepo.js so routes don't care which is active.
const { db, newId } = require("./dataStore");

const clone = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));

module.exports = {
  users: {
    findById: async (id) => clone(db.users.find((u) => u.id === id) || null),
    findByEmail: async (email) => clone(db.users.find((u) => u.email === email) || null),
    list: async () => clone(db.users),
    create: async (data) => {
      const user = { id: newId(), created_at: new Date().toISOString(), ...data };
      db.users.push(user);
      return clone(user);
    },
  },

  profiles: {
    findByUserId: async (userId) => clone(db.profiles.find((p) => p.user_id === userId) || null),
  },

  assessments: {
    create: async (data) => {
      const a = { id: newId(), date_taken: new Date().toISOString(), answers: [], ...data };
      db.assessments.push(a);
      return clone(a);
    },
    findById: async (id) => clone(db.assessments.find((x) => x.id === id) || null),
    listByUser: async (userId) => clone(db.assessments.filter((a) => a.user_id === userId)),
  },

  gapReports: {
    findByUserId: async (userId) => clone(db.gapReports.find((r) => r.user_id === userId) || null),
    upsert: async (userId, data) => {
      const existing = db.gapReports.find((r) => r.user_id === userId);
      if (existing) {
        Object.assign(existing, data, { updated_at: new Date().toISOString() });
        return clone(existing);
      }
      const report = {
        id: newId(),
        user_id: userId,
        created_at: new Date().toISOString(),
        ...data,
      };
      db.gapReports.push(report);
      return clone(report);
    },
  },

  courses: {
    list: async () => clone(db.courses),
    findById: async (id) => clone(db.courses.find((c) => c.id === id) || null),
    create: async (data) => {
      const c = { id: newId(), created_at: new Date().toISOString(), ...data };
      db.courses.push(c);
      return clone(c);
    },
  },

  enrollments: {
    findOne: async (userId, courseId) =>
      clone(db.enrollments.find((e) => e.user_id === userId && e.course_id === courseId) || null),
    create: async (data) => {
      const e = {
        id: newId(),
        status: "active",
        completion_percentage: 0,
        enrolled_at: new Date().toISOString(),
        ...data,
      };
      db.enrollments.push(e);
      return clone(e);
    },
    listByUser: async (userId) => clone(db.enrollments.filter((e) => e.user_id === userId)),
  },

  jobs: {
    list: async () => clone(db.jobs),
    findById: async (id) => clone(db.jobs.find((j) => j.id === id) || null),
    create: async (data) => {
      const j = {
        id: newId(),
        status: "open",
        required_skills: [],
        created_at: new Date().toISOString(),
        ...data,
      };
      db.jobs.push(j);
      return clone(j);
    },
  },

  applications: {
    findOne: async (jobId, studentId) =>
      clone(db.applications.find((a) => a.job_id === jobId && a.student_id === studentId) || null),
    create: async (data) => {
      const a = {
        id: newId(),
        status: "submitted",
        applied_at: new Date().toISOString(),
        ...data,
      };
      db.applications.push(a);
      return clone(a);
    },
  },

  notifications: {
    listByUser: async (userId) => clone(db.notifications.filter((n) => n.user_id === userId)),
    create: async (data) => {
      const n = {
        id: newId(),
        read_status: false,
        created_at: new Date().toISOString(),
        ...data,
      };
      db.notifications.push(n);
      return clone(n);
    },
    markRead: async (id, userId) => {
      const n = db.notifications.find((x) => x.id === id && x.user_id === userId);
      if (!n) return null;
      n.read_status = true;
      return clone(n);
    },
  },

  subscriptions: {
    findByUserId: async (userId) =>
      clone(db.subscriptions.find((s) => s.user_id === userId) || null),
    upsert: async (userId, data) => {
      const existing = db.subscriptions.find((s) => s.user_id === userId);
      if (existing) {
        Object.assign(existing, data);
        return clone(existing);
      }
      const s = { id: newId(), user_id: userId, ...data };
      db.subscriptions.push(s);
      return clone(s);
    },
  },

  insights: async () => {
    const totalAssessments = db.assessments.length;
    const avgScore =
      totalAssessments === 0
        ? 0
        : Math.round(db.assessments.reduce((s, a) => s + a.score, 0) / totalAssessments);
    return {
      totals: {
        users: db.users.length,
        courses: db.courses.length,
        enrollments: db.enrollments.length,
        jobs: db.jobs.length,
        applications: db.applications.length,
      },
      assessments: { count: totalAssessments, average_score: avgScore },
      top_missing_skills: ["communication", "advanced-react", "system-design"],
    };
  },
};
