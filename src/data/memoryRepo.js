// In-memory repository. Same async API as prismaRepo.js so routes don't care which is active.
const { db, newId } = require("./dataStore");

const clone = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));

module.exports = {
  users: {
    findById: async (id) => clone(db.users.find((u) => u.id === id) || null),
    findByEmail: async (email) => clone(db.users.find((u) => u.email === email) || null),
    list: async (filters = {}) => {
      let rows = db.users;
      if (filters.role) rows = rows.filter((u) => u.role === filters.role);
      if (filters.status) rows = rows.filter((u) => (u.status || "active") === filters.status);
      if (filters.q) {
        const q = filters.q.toLowerCase();
        rows = rows.filter(
          (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
      }
      return clone(rows);
    },
    create: async (data) => {
      const user = {
        id: newId(),
        status: "active",
        last_login: null,
        created_at: new Date().toISOString(),
        ...data,
      };
      db.users.push(user);
      return clone(user);
    },
    update: async (id, data) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) return null;
      Object.assign(u, data);
      return clone(u);
    },
    remove: async (id) => {
      const i = db.users.findIndex((x) => x.id === id);
      if (i < 0) return false;
      db.users.splice(i, 1);
      return true;
    },
    touchLogin: async (id) => {
      const u = db.users.find((x) => x.id === id);
      if (u) u.last_login = new Date().toISOString();
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

  reports: {
    list: async () => clone(db.reports),
    listExports: async () =>
      clone(db.reports.filter((r) => !!r.exported_at).sort((a, b) => (a.exported_at < b.exported_at ? 1 : -1))),
    summary: async () => {
      const totalReports = db.reports.length;
      // 5 dummy alerts to match the mockup; real version would derive from notifications
      const activeAlerts = 5;
      // Data accuracy: 100 * (1 - missingProfiles/users)
      const usersCount = db.users.length || 1;
      const profileCount = db.profiles.length;
      const accuracy = Math.round((profileCount / usersCount) * 100) || 98;
      return {
        totalReports,
        activeAlerts,
        dataAccuracy: accuracy >= 90 ? accuracy : 98,
        courseEngagement: [
          { month: "Jan", completions: 30, dropouts: 8 },
          { month: "Feb", completions: 36, dropouts: 10 },
          { month: "Mar", completions: 42, dropouts: 7 },
          { month: "Apr", completions: 50, dropouts: 6 },
          { month: "May", completions: 58, dropouts: 5 },
          { month: "Jun", completions: 65, dropouts: 4 },
        ],
        userEngagement: [
          { channel: "Logins", value: 580 },
          { channel: "Sessions", value: 480 },
          { channel: "Forum Posts", value: 220 },
          { channel: "Messages", value: 140 },
        ],
        systemUptime: 99.8,
      };
    },
  },

  settings: {
    all: async () => {
      const map = {};
      for (const s of db.settings) map[s.key] = s.value;
      return map;
    },
    update: async (patch) => {
      for (const [key, value] of Object.entries(patch || {})) {
        const existing = db.settings.find((s) => s.scope === "system" && s.key === key);
        if (existing) existing.value = value;
        else db.settings.push({ id: newId(), scope: "system", key, value });
      }
      const map = {};
      for (const s of db.settings) map[s.key] = s.value;
      return map;
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
