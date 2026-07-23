// In-memory repository. Same async API as prismaRepo.js so routes don't care which is active.
const { db, newId } = require("./dataStore");

const clone = (x) => (x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)));

// Buckets records into the last 4 rolling 7-day windows (Week 1 = oldest, Week 4 = most
// recent, i.e. this week), summing valueFn(record) into whichever window record[dateField]
// falls in. Records older than 28 days are dropped.
function weeklyBuckets(records, dateField, valueFn) {
  const buckets = [0, 0, 0, 0];
  const now = Date.now();
  const msDay = 24 * 60 * 60 * 1000;
  for (const r of records) {
    const ts = new Date(r[dateField]).getTime();
    if (Number.isNaN(ts)) continue;
    const daysAgo = Math.floor((now - ts) / msDay);
    if (daysAgo < 0 || daysAgo >= 28) continue;
    const idx = 3 - Math.floor(daysAgo / 7);
    if (idx >= 0 && idx < 4) buckets[idx] += valueFn(r);
  }
  return buckets.map((value, i) => ({ week: `Week ${i + 1}`, value: Math.round(value * 10) / 10 }));
}

// ---- RBAC helpers ----
function roleByName(name) {
  return db.roles.find((r) => r.name === name) || null;
}
function roleById(id) {
  return db.roles.find((r) => r.id === id) || null;
}
function permsForRoleId(roleId) {
  const links = db.rolePermissions.filter((rp) => rp.role_id === roleId);
  const ids = new Set(links.map((rp) => rp.permission_id));
  return db.permissions.filter((p) => ids.has(p.id)).map((p) => p.name);
}

// Decorate a stored user with `role` (name) + `permissions[]` for the rest of the app.
function decorate(u) {
  if (!u) return u;
  const role = roleById(u.role_id);
  const out = {
    ...u,
    role: role?.name || null,
    permissions: role ? permsForRoleId(role.id) : [],
  };
  return clone(out);
}

module.exports = {
  // expose helpers for routes that need permissions but not a full user
  _rbac: { roleByName, roleById, permsForRoleId },

  users: {
    findById: async (id) => decorate(db.users.find((u) => u.id === id) || null),
    findByEmail: async (email) => decorate(db.users.find((u) => u.email === email) || null),
    list: async (filters = {}) => {
      let rows = db.users;
      if (filters.role) {
        const r = roleByName(filters.role);
        rows = r ? rows.filter((u) => u.role_id === r.id) : [];
      }
      if (filters.status) rows = rows.filter((u) => (u.status || "active") === filters.status);
      if (filters.q) {
        const q = filters.q.toLowerCase();
        rows = rows.filter(
          (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
      }
      return rows.map(decorate);
    },
    create: async (data) => {
      // Accept either role_id directly, or a role name we look up.
      let role_id = data.role_id;
      if (!role_id && data.role) {
        const r = roleByName(data.role);
        if (!r) throw new Error(`invalid role: ${data.role}`);
        role_id = r.id;
      }
      if (!role_id) throw new Error("role_id or role required");
      const user = {
        id: newId(), status: "active", last_login: null,
        created_at: new Date().toISOString(),
        ...data, role_id,
      };
      delete user.role;
      delete user.permissions;
      db.users.push(user);
      return decorate(user);
    },
    update: async (id, data) => {
      const u = db.users.find((x) => x.id === id);
      if (!u) return null;
      // Accept role name → role_id translation
      if (data.role && !data.role_id) {
        const r = roleByName(data.role);
        if (!r) throw new Error(`invalid role: ${data.role}`);
        data = { ...data, role_id: r.id };
      }
      const { role, permissions, ...rest } = data;
      Object.assign(u, rest);
      return decorate(u);
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

  // Roles + permissions (read-only for now; admin UI can come later)
  roles: {
    list: async () => clone(db.roles),
    findByName: async (name) => clone(roleByName(name)),
    findById: async (id) => clone(roleById(id)),
    permissionsForRoleId: async (roleId) => permsForRoleId(roleId),
  },

  permissions: {
    list: async () => clone(db.permissions),
  },

  profiles: {
    findByUserId: async (userId) => clone(db.profiles.find((p) => p.user_id === userId) || null),
    upsert: async (userId, data) => {
      const existing = db.profiles.find((p) => p.user_id === userId);
      if (existing) {
        Object.assign(existing, data);
        return clone(existing);
      }
      const p = { id: newId(), user_id: userId, ...data };
      db.profiles.push(p);
      return clone(p);
    },
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
      const report = { id: newId(), user_id: userId, created_at: new Date().toISOString(), ...data };
      db.gapReports.push(report);
      return clone(report);
    },
  },

  courses: {
    list: async (filters = {}) => {
      let rows = db.courses;
      if (filters.status) rows = rows.filter((c) => (c.status || "active") === filters.status);
      if (filters.educator_id) rows = rows.filter((c) => c.educator_id === filters.educator_id);
      if (filters.category) rows = rows.filter((c) => c.category === filters.category);
      if (filters.difficulty) rows = rows.filter((c) => c.difficulty === filters.difficulty);
      return clone(rows);
    },
    findById: async (id) => clone(db.courses.find((c) => c.id === id) || null),
    create: async (data) => {
      const c = {
        id: newId(), status: "active", created_at: new Date().toISOString(), ...data,
      };
      db.courses.push(c);
      return clone(c);
    },
    update: async (id, data) => {
      const c = db.courses.find((x) => x.id === id);
      if (!c) return null;
      Object.assign(c, data);
      return clone(c);
    },
    remove: async (id) => {
      const i = db.courses.findIndex((x) => x.id === id);
      if (i < 0) return false;
      db.courses.splice(i, 1);
      return true;
    },
    enrollmentCount: async (id) => db.enrollments.filter((e) => e.course_id === id).length,
  },

  enrollments: {
    findOne: async (userId, courseId) =>
      clone(db.enrollments.find((e) => e.user_id === userId && e.course_id === courseId) || null),
    create: async (data) => {
      const e = {
        id: newId(), status: "active", completion_percentage: 0,
        enrolled_at: new Date().toISOString(), ...data,
      };
      db.enrollments.push(e);
      return clone(e);
    },
    listByUser: async (userId) => clone(db.enrollments.filter((e) => e.user_id === userId)),
    listByCourse: async (courseId) => clone(db.enrollments.filter((e) => e.course_id === courseId)),
  },

  jobs: {
    list: async () => clone(db.jobs),
    findById: async (id) => clone(db.jobs.find((j) => j.id === id) || null),
    create: async (data) => {
      const j = {
        id: newId(), status: "open", required_skills: [],
        created_at: new Date().toISOString(), ...data,
      };
      db.jobs.push(j);
      return clone(j);
    },
    update: async (id, data) => {
      const j = db.jobs.find((x) => x.id === id);
      if (!j) return null;
      Object.assign(j, data);
      return clone(j);
    },
    remove: async (id) => {
      const i = db.jobs.findIndex((x) => x.id === id);
      if (i < 0) return false;
      db.jobs.splice(i, 1);
      return true;
    },
    listByEmployer: async (employerId) =>
      clone(db.jobs.filter((j) => j.employer_id === employerId)),
  },

  applications: {
    findOne: async (jobId, studentId) =>
      clone(db.applications.find((a) => a.job_id === jobId && a.student_id === studentId) || null),
    create: async (data) => {
      const a = {
        id: newId(), status: "submitted", skill_match: null,
        applied_at: new Date().toISOString(), ...data,
      };
      db.applications.push(a);
      return clone(a);
    },
    listByJob: async (jobId) => clone(db.applications.filter((a) => a.job_id === jobId)),
    listByStudent: async (studentId) => clone(db.applications.filter((a) => a.student_id === studentId)),
  },

  notifications: {
    listByUser: async (userId) => clone(db.notifications.filter((n) => n.user_id === userId)),
    create: async (data) => {
      const n = {
        id: newId(), read_status: false,
        created_at: new Date().toISOString(), ...data,
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
      if (existing) { Object.assign(existing, data); return clone(existing); }
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
      const usersCount = db.users.length || 1;
      const profileCount = db.profiles.length;
      const accuracy = Math.round((profileCount / usersCount) * 100) || 98;
      return {
        totalReports, activeAlerts: 5,
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

  // ---- New resources ----

  lessons: {
    listByCourse: async (courseId) =>
      clone(db.lessons.filter((l) => l.course_id === courseId).sort((a, b) => a.order_index - b.order_index)),
    findById: async (id) => clone(db.lessons.find((l) => l.id === id) || null),
    create: async (data) => {
      const l = { id: newId(), order_index: 0, created_at: new Date().toISOString(), ...data };
      db.lessons.push(l);
      return clone(l);
    },
  },

  quizzes: {
    findByLessonId: async (lessonId) => clone(db.quizzes.find((q) => q.lesson_id === lessonId) || null),
    create: async (data) => {
      const q = { id: newId(), passing_score: 60, questions: [], ...data };
      db.quizzes.push(q);
      return clone(q);
    },
  },

  assignments: {
    listByLesson: async (lessonId) => clone(db.assignments.filter((a) => a.lesson_id === lessonId)),
    create: async (data) => {
      const a = { id: newId(), created_at: new Date().toISOString(), ...data };
      db.assignments.push(a);
      return clone(a);
    },
  },

  progress: {
    listByUser: async (userId) => clone(db.progress.filter((p) => p.user_id === userId)),
    upsert: async (userId, lessonId, patch) => {
      const existing = db.progress.find((p) => p.user_id === userId && p.lesson_id === lessonId);
      let saved;
      if (existing) {
        Object.assign(existing, patch, { updated_at: new Date().toISOString() });
        saved = existing;
      } else {
        const p = {
          id: newId(), user_id: userId, lesson_id: lessonId,
          watched_duration: 0, quiz_score: null, assignment_status: "pending",
          completion_flag: false, updated_at: new Date().toISOString(),
          ...patch,
        };
        db.progress.push(p);
        saved = p;
      }

      // Roll lesson-level progress up into the enrollment's completion_percentage,
      // so dashboards/certificates reflect real course progress instead of staying
      // at the 0 they're set to on enrollment.
      const lesson = db.lessons.find((l) => l.id === lessonId);
      if (lesson) {
        const courseLessons = db.lessons.filter((l) => l.course_id === lesson.course_id);
        const totalLessons = courseLessons.length;
        if (totalLessons > 0) {
          const courseLessonIds = new Set(courseLessons.map((l) => l.id));
          const completedCount = db.progress.filter(
            (p) => p.user_id === userId && courseLessonIds.has(p.lesson_id) && p.completion_flag
          ).length;
          const pct = Math.min(100, Math.round((completedCount / totalLessons) * 100));
          const enrollment = db.enrollments.find(
            (e) => e.user_id === userId && e.course_id === lesson.course_id
          );
          if (enrollment) {
            enrollment.completion_percentage = pct;
            if (pct >= 100) enrollment.status = "completed";
          }
        }
      }

      return clone(saved);
    },
  },

  certificates: {
    listByUser: async (userId) => clone(db.certificates.filter((c) => c.user_id === userId)),
    create: async (data) => {
      const c = {
        id: newId(), issued_date: new Date().toISOString(),
        certificate_code: "EDU-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        ...data,
      };
      db.certificates.push(c);
      return clone(c);
    },
  },

  achievements: {
    listByUser: async (userId) => clone(db.achievements.filter((a) => a.user_id === userId)),
    create: async (data) => {
      const a = { id: newId(), earned_at: new Date().toISOString(), ...data };
      db.achievements.push(a);
      return clone(a);
    },
  },

  tasks: {
    listByUser: async (userId, filters = {}) => {
      let rows = db.tasks.filter((t) => t.user_id === userId);
      if (filters.status) rows = rows.filter((t) => t.status === filters.status);
      return clone(rows.sort((a, b) => (a.due_date || "") < (b.due_date || "") ? -1 : 1));
    },
    create: async (data) => {
      const t = { id: newId(), status: "pending", created_at: new Date().toISOString(), ...data };
      db.tasks.push(t);
      return clone(t);
    },
    update: async (id, userId, data) => {
      const t = db.tasks.find((x) => x.id === id && x.user_id === userId);
      if (!t) return null;
      Object.assign(t, data);
      return clone(t);
    },
    remove: async (id, userId) => {
      const i = db.tasks.findIndex((x) => x.id === id && x.user_id === userId);
      if (i < 0) return false;
      db.tasks.splice(i, 1);
      return true;
    },
  },

  recommendations: {
    listByUser: async (userId) => clone(db.recommendations.filter((r) => r.user_id === userId)),
    create: async (data) => {
      const r = { id: newId(), created_at: new Date().toISOString(), ...data };
      db.recommendations.push(r);
      return clone(r);
    },
  },

  announcements: {
    list: async () => clone(db.announcements.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))),
    listByEducator: async (educatorId) =>
      clone(db.announcements.filter((a) => a.educator_id === educatorId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))),
    create: async (data) => {
      const a = { id: newId(), audience: "all", created_at: new Date().toISOString(), ...data };
      db.announcements.push(a);
      return clone(a);
    },
  },

  // Insights aggregator (admin)
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

  // Educator-specific dashboard insights
  educatorInsights: async (educatorId) => {
    const courses = db.courses.filter((c) => c.educator_id === educatorId);
    const courseIds = courses.map((c) => c.id);
    const enrollments = db.enrollments.filter((e) => courseIds.includes(e.course_id));
    const learners = new Set(enrollments.map((e) => e.user_id));
    const avgCompletion = enrollments.length === 0
      ? 0
      : Math.round(enrollments.reduce((s, e) => s + (e.completion_percentage || 0), 0) / enrollments.length);
    return {
      enrolledLearners: learners.size,
      activeCourses: courses.filter((c) => c.status === "active").length,
      avgCompletion,
      avgRating: 4.6,
      courseRatings: 235,
      learnerProficiency: { basic: 23, intermediate: 45, advanced: 32 },
      skillGapAnalysis: [
        { skill: "Technical Skills", value: 10 },
        { skill: "Communication", value: 60 },
        { skill: "Critical Thinking", value: 70 },
        { skill: "Engagement", value: 55 },
      ],
      learnerPerformance: [
        { week: "Week 1", technical: 50, engagement: 30 },
        { week: "Week 2", technical: 70, engagement: 50 },
        { week: "Week 3", technical: 65, engagement: 55 },
        { week: "Week 4", technical: 85, engagement: 75 },
      ],
    };
  },

  // Employer-specific dashboard
  employerInsights: async (employerId) => {
    const jobs = db.jobs.filter((j) => j.employer_id === employerId);
    const jobIds = jobs.map((j) => j.id);
    const apps = db.applications.filter((a) => jobIds.includes(a.job_id));
    const topMatches = apps.filter((a) => (a.skill_match || 0) >= 80).length;
    return {
      jobOpenings: jobs.filter((j) => j.status === "open").length,
      newApplicants: apps.length,
      topMatches,
      candidateMatches: { strong: 40, good: 35, possible: 25 },
      skillsInsights: [
        { skill: "UI/UX Design", value: 80 },
        { skill: "Data Readiness", value: 65 },
        { skill: "Digital Marketing", value: 55 },
      ],
    };
  },

  // Student-side aggregate
  studentDashboard: async (userId) => {
    const enrollments = db.enrollments.filter((e) => e.user_id === userId);
    const courseIds = enrollments.map((e) => e.course_id);
    const courses = db.courses.filter((c) => courseIds.includes(c.id));
    const tasks = db.tasks.filter((t) => t.user_id === userId);
    const achievements = db.achievements.filter((a) => a.user_id === userId);
    const progress = db.progress.filter((p) => p.user_id === userId);
    const learningSeconds = progress.reduce((s, p) => s + (p.watched_duration || 0), 0);
    const hoursLogged = Math.round(learningSeconds / 3600);
    const skillsReadiness = enrollments.length === 0
      ? 0
      : Math.round(enrollments.reduce((s, e) => s + (e.completion_percentage || 0), 0) / enrollments.length);
    return {
      coursesEnrolled: enrollments.length,
      activeCourses: courses.filter((c) => c.status === "active").length,
      achievementsCount: achievements.length,
      tasksDue: tasks.filter((t) => t.status === "pending").length,
      learningHoursLogged: hoursLogged || 28,
      skillsReadiness: skillsReadiness || 72,
      // Weekly count of lessons completed — Dashboard's "Learning Progress" chart.
      learningProgress: weeklyBuckets(
        progress.filter((p) => p.completion_flag),
        "updated_at",
        () => 1
      ),
      // Weekly hours watched — Insights page's "Engagement Trends" chart.
      // Note: watched_duration is the latest reported total for a lesson (not additive),
      // so this reflects hours logged as of each lesson's most recent update, bucketed
      // by week — a reasonable proxy for engagement without a full event log.
      engagementTrends: weeklyBuckets(
        progress,
        "updated_at",
        (p) => (p.watched_duration || 0) / 3600
      ),
      recentActivity: [
        { id: "1", title: "Submitted Python Assignment", when: "2 hours ago" },
        { id: "2", title: "Completed Soft Skills Quiz", when: "Yesterday" },
        { id: "3", title: "Received Feedback on Project", when: "2 days ago" },
      ],
    };
  },
};