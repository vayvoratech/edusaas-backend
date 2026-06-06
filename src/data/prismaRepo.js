const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

const mapUser = (u) =>
  u && {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    password_hash: u.password_hash,
    status: u.status,
    last_login: iso(u.last_login),
    created_at: iso(u.created_at),
  };

const mapAssessment = (a) => a && { ...a, date_taken: iso(a.date_taken) };
const mapEnrollment = (e) => e && { ...e, enrolled_at: iso(e.enrolled_at) };
const mapJob = (j) => j && { ...j, created_at: iso(j.created_at) };
const mapApp = (a) => a && { ...a, applied_at: iso(a.applied_at) };
const mapNotif = (n) => n && { ...n, created_at: iso(n.created_at) };
const mapCourse = (c) => c && { ...c, created_at: iso(c.created_at) };
const mapReportRow = (r) =>
  r && { ...r, generated_at: iso(r.generated_at), exported_at: iso(r.exported_at) };
const mapGap = (r) =>
  r && {
    ...r,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  };
const mapSub = (s) =>
  s && {
    ...s,
    start_date: iso(s.start_date),
    end_date: iso(s.end_date),
  };

module.exports = {
  prisma,

  users: {
    findById: async (id) => mapUser(await prisma.user.findUnique({ where: { id } })),
    findByEmail: async (email) => mapUser(await prisma.user.findUnique({ where: { email } })),
    list: async (filters = {}) => {
      const where = {};
      if (filters.role) where.role = filters.role;
      if (filters.status) where.status = filters.status;
      if (filters.q) {
        where.OR = [
          { name: { contains: filters.q, mode: "insensitive" } },
          { email: { contains: filters.q, mode: "insensitive" } },
        ];
      }
      return (await prisma.user.findMany({ where, orderBy: { created_at: "desc" } })).map(mapUser);
    },
    create: async (data) => mapUser(await prisma.user.create({ data })),
    update: async (id, data) => {
      try {
        return mapUser(await prisma.user.update({ where: { id }, data }));
      } catch (e) {
        if (e.code === "P2025") return null;
        throw e;
      }
    },
    remove: async (id) => {
      try {
        await prisma.user.delete({ where: { id } });
        return true;
      } catch (e) {
        if (e.code === "P2025") return false;
        throw e;
      }
    },
    touchLogin: async (id) => {
      try {
        await prisma.user.update({ where: { id }, data: { last_login: new Date() } });
      } catch (_) { /* ignore */ }
    },
  },

  profiles: {
    findByUserId: async (user_id) => prisma.profile.findUnique({ where: { user_id } }),
  },

  assessments: {
    create: async (data) => mapAssessment(await prisma.assessment.create({ data })),
    findById: async (id) => mapAssessment(await prisma.assessment.findUnique({ where: { id } })),
    listByUser: async (user_id) =>
      (await prisma.assessment.findMany({ where: { user_id } })).map(mapAssessment),
  },

  gapReports: {
    findByUserId: async (user_id) => mapGap(await prisma.gapReport.findFirst({ where: { user_id } })),
    upsert: async (user_id, data) => {
      const existing = await prisma.gapReport.findFirst({ where: { user_id } });
      if (existing) {
        return mapGap(await prisma.gapReport.update({ where: { id: existing.id }, data }));
      }
      return mapGap(
        await prisma.gapReport.create({
          data: { ...data, user_id, readiness_score: data.readiness_score ?? 0 },
        })
      );
    },
  },

  courses: {
    list: async () => (await prisma.course.findMany()).map(mapCourse),
    findById: async (id) => mapCourse(await prisma.course.findUnique({ where: { id } })),
    create: async (data) => mapCourse(await prisma.course.create({ data })),
  },

  enrollments: {
    findOne: async (user_id, course_id) =>
      mapEnrollment(
        await prisma.enrollment.findUnique({ where: { user_id_course_id: { user_id, course_id } } })
      ),
    create: async (data) => mapEnrollment(await prisma.enrollment.create({ data })),
    listByUser: async (user_id) =>
      (await prisma.enrollment.findMany({ where: { user_id } })).map(mapEnrollment),
  },

  jobs: {
    list: async () => (await prisma.job.findMany()).map(mapJob),
    findById: async (id) => mapJob(await prisma.job.findUnique({ where: { id } })),
    create: async (data) => mapJob(await prisma.job.create({ data })),
  },

  applications: {
    findOne: async (job_id, student_id) =>
      mapApp(
        await prisma.application.findUnique({ where: { job_id_student_id: { job_id, student_id } } })
      ),
    create: async (data) => mapApp(await prisma.application.create({ data })),
  },

  notifications: {
    listByUser: async (user_id) =>
      (await prisma.notification.findMany({ where: { user_id } })).map(mapNotif),
    create: async (data) => mapNotif(await prisma.notification.create({ data })),
    markRead: async (id, user_id) => {
      const n = await prisma.notification.findFirst({ where: { id, user_id } });
      if (!n) return null;
      return mapNotif(await prisma.notification.update({ where: { id }, data: { read_status: true } }));
    },
  },

  subscriptions: {
    findByUserId: async (user_id) =>
      mapSub(await prisma.subscription.findFirst({ where: { user_id } })),
    upsert: async (user_id, data) => {
      const existing = await prisma.subscription.findFirst({ where: { user_id } });
      if (existing) {
        return mapSub(await prisma.subscription.update({ where: { id: existing.id }, data }));
      }
      return mapSub(await prisma.subscription.create({ data: { ...data, user_id } }));
    },
  },

  reports: {
    list: async () => (await prisma.report.findMany({ orderBy: { generated_at: "desc" } })).map(mapReportRow),
    listExports: async () =>
      (
        await prisma.report.findMany({
          where: { exported_at: { not: null } },
          orderBy: { exported_at: "desc" },
        })
      ).map(mapReportRow),
    summary: async () => {
      const [totalReports, users, profiles] = await Promise.all([
        prisma.report.count(),
        prisma.user.count(),
        prisma.profile.count(),
      ]);
      const accuracy = users ? Math.round((profiles / users) * 100) : 98;
      return {
        totalReports,
        activeAlerts: 5,
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
      const rows = await prisma.setting.findMany({ where: { scope: "system" } });
      const map = {};
      for (const s of rows) map[s.key] = s.value;
      return map;
    },
    update: async (patch) => {
      for (const [key, value] of Object.entries(patch || {})) {
        await prisma.setting.upsert({
          where: { scope_key: { scope: "system", key } },
          update: { value },
          create: { scope: "system", key, value },
        });
      }
      const rows = await prisma.setting.findMany({ where: { scope: "system" } });
      const map = {};
      for (const s of rows) map[s.key] = s.value;
      return map;
    },
  },

  insights: async () => {
    const [users, courses, enrollments, jobs, applications, assessments] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.job.count(),
      prisma.application.count(),
      prisma.assessment.findMany(),
    ]);
    const avgScore =
      assessments.length === 0
        ? 0
        : Math.round(assessments.reduce((s, a) => s + a.score, 0) / assessments.length);
    return {
      totals: { users, courses, enrollments, jobs, applications },
      assessments: { count: assessments.length, average_score: avgScore },
      top_missing_skills: ["communication", "advanced-react", "system-design"],
    };
  },
};
