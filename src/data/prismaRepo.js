const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Map DB rows to the wire shape routes/tests already expect.
const mapUser = (u) =>
  u && {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    password_hash: u.password_hash,
    created_at: u.created_at.toISOString(),
  };

const mapAssessment = (a) =>
  a && { ...a, date_taken: a.date_taken.toISOString() };

const mapEnrollment = (e) =>
  e && { ...e, enrolled_at: e.enrolled_at.toISOString() };

const mapJob = (j) =>
  j && { ...j, created_at: j.created_at.toISOString() };

const mapApp = (a) => a && { ...a, applied_at: a.applied_at.toISOString() };

const mapNotif = (n) => n && { ...n, created_at: n.created_at.toISOString() };

const mapCourse = (c) => c && { ...c, created_at: c.created_at.toISOString() };

const mapReport = (r) =>
  r && {
    ...r,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  };

const mapSub = (s) =>
  s && {
    ...s,
    start_date: s.start_date.toISOString(),
    end_date: s.end_date.toISOString(),
  };

module.exports = {
  prisma,

  users: {
    findById: async (id) => mapUser(await prisma.user.findUnique({ where: { id } })),
    findByEmail: async (email) => mapUser(await prisma.user.findUnique({ where: { email } })),
    list: async () => (await prisma.user.findMany()).map(mapUser),
    create: async (data) => mapUser(await prisma.user.create({ data })),
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
    findByUserId: async (user_id) =>
      mapReport(await prisma.gapReport.findFirst({ where: { user_id } })),
    upsert: async (user_id, data) => {
      const existing = await prisma.gapReport.findFirst({ where: { user_id } });
      if (existing) {
        return mapReport(
          await prisma.gapReport.update({ where: { id: existing.id }, data })
        );
      }
      return mapReport(
        await prisma.gapReport.create({ data: { ...data, user_id, readiness_score: data.readiness_score ?? 0 } })
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
