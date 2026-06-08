const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

// User rows are always fetched with role + role.permissions included so we can
// expose `role` (name) and `permissions[]` to callers.
const userInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
};

const mapUser = (u) =>
  u && {
    id: u.id, name: u.name, email: u.email,
    role_id: u.role_id,
    role: u.role?.name || null,
    permissions: u.role?.permissions?.map((rp) => rp.permission.name) || [],
    password_hash: u.password_hash, status: u.status,
    last_login: iso(u.last_login), created_at: iso(u.created_at),
  };

const mapAssessment = (a) => a && { ...a, date_taken: iso(a.date_taken) };
const mapEnrollment = (e) => e && { ...e, enrolled_at: iso(e.enrolled_at) };
const mapJob = (j) => j && { ...j, created_at: iso(j.created_at) };
const mapApp = (a) => a && { ...a, applied_at: iso(a.applied_at) };
const mapNotif = (n) => n && { ...n, created_at: iso(n.created_at) };
const mapCourse = (c) => c && { ...c, created_at: iso(c.created_at) };
const mapReportRow = (r) =>
  r && { ...r, generated_at: iso(r.generated_at), exported_at: iso(r.exported_at) };
const mapGap = (r) => r && { ...r, created_at: iso(r.created_at), updated_at: iso(r.updated_at) };
const mapSub = (s) => s && { ...s, start_date: iso(s.start_date), end_date: iso(s.end_date) };
const mapLesson = (l) => l && { ...l, created_at: iso(l.created_at) };
const mapAssignment = (a) => a && { ...a, created_at: iso(a.created_at) };
const mapProgress = (p) => p && { ...p, updated_at: iso(p.updated_at) };
const mapCert = (c) => c && { ...c, issued_date: iso(c.issued_date) };
const mapAch = (a) => a && { ...a, earned_at: iso(a.earned_at) };
const mapTask = (t) => t && { ...t, due_date: iso(t.due_date), created_at: iso(t.created_at) };
const mapRec = (r) => r && { ...r, created_at: iso(r.created_at) };
const mapAnn = (a) => a && { ...a, scheduled_at: iso(a.scheduled_at), created_at: iso(a.created_at) };

module.exports = {
  prisma,

  users: {
    findById: async (id) =>
      mapUser(await prisma.user.findUnique({ where: { id }, include: userInclude })),
    findByEmail: async (email) =>
      mapUser(await prisma.user.findUnique({ where: { email }, include: userInclude })),
    list: async (filters = {}) => {
      const where = {};
      if (filters.role) where.role = { name: filters.role };
      if (filters.status) where.status = filters.status;
      if (filters.q) {
        where.OR = [
          { name: { contains: filters.q, mode: "insensitive" } },
          { email: { contains: filters.q, mode: "insensitive" } },
        ];
      }
      return (await prisma.user.findMany({
        where, orderBy: { created_at: "desc" }, include: userInclude,
      })).map(mapUser);
    },
    create: async (data) => {
      // Translate `role` (name) → role_id if needed
      let { role, role_id, permissions, ...rest } = data;
      if (!role_id && role) {
        const r = await prisma.role.findUnique({ where: { name: role } });
        if (!r) throw new Error(`invalid role: ${role}`);
        role_id = r.id;
      }
      if (!role_id) throw new Error("role_id or role required");
      return mapUser(await prisma.user.create({
        data: { ...rest, role_id },
        include: userInclude,
      }));
    },
    update: async (id, data) => {
      let { role, role_id, permissions, ...rest } = data;
      if (!role_id && role) {
        const r = await prisma.role.findUnique({ where: { name: role } });
        if (!r) throw new Error(`invalid role: ${role}`);
        role_id = r.id;
      }
      const patch = role_id ? { ...rest, role_id } : rest;
      try {
        return mapUser(await prisma.user.update({
          where: { id }, data: patch, include: userInclude,
        }));
      } catch (e) {
        if (e.code === "P2025") return null;
        throw e;
      }
    },
    remove: async (id) => {
      try { await prisma.user.delete({ where: { id } }); return true; }
      catch (e) { if (e.code === "P2025") return false; throw e; }
    },
    touchLogin: async (id) => {
      try { await prisma.user.update({ where: { id }, data: { last_login: new Date() } }); }
      catch (_) {}
    },
  },

  roles: {
    list: async () => prisma.role.findMany({ orderBy: { name: "asc" } }),
    findByName: async (name) => prisma.role.findUnique({ where: { name } }),
    findById: async (id) => prisma.role.findUnique({ where: { id } }),
    permissionsForRoleId: async (roleId) => {
      const links = await prisma.rolePermission.findMany({
        where: { role_id: roleId }, include: { permission: true },
      });
      return links.map((l) => l.permission.name);
    },
  },

  permissions: {
    list: async () => prisma.permission.findMany({ orderBy: { name: "asc" } }),
  },

  profiles: {
    findByUserId: async (user_id) => prisma.profile.findUnique({ where: { user_id } }),
    upsert: async (user_id, data) => {
      return prisma.profile.upsert({
        where: { user_id }, update: data, create: { ...data, user_id },
      });
    },
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
      if (existing) return mapGap(await prisma.gapReport.update({ where: { id: existing.id }, data }));
      return mapGap(await prisma.gapReport.create({
        data: { ...data, user_id, readiness_score: data.readiness_score ?? 0 },
      }));
    },
  },

  courses: {
    list: async (filters = {}) => {
      const where = {};
      if (filters.status) where.status = filters.status;
      if (filters.educator_id) where.educator_id = filters.educator_id;
      if (filters.category) where.category = filters.category;
      if (filters.difficulty) where.difficulty = filters.difficulty;
      return (await prisma.course.findMany({ where, orderBy: { created_at: "desc" } })).map(mapCourse);
    },
    findById: async (id) => mapCourse(await prisma.course.findUnique({ where: { id } })),
    create: async (data) => mapCourse(await prisma.course.create({ data })),
    update: async (id, data) => {
      try { return mapCourse(await prisma.course.update({ where: { id }, data })); }
      catch (e) { if (e.code === "P2025") return null; throw e; }
    },
    remove: async (id) => {
      try { await prisma.course.delete({ where: { id } }); return true; }
      catch (e) { if (e.code === "P2025") return false; throw e; }
    },
    enrollmentCount: async (id) => prisma.enrollment.count({ where: { course_id: id } }),
  },

  enrollments: {
    findOne: async (user_id, course_id) =>
      mapEnrollment(await prisma.enrollment.findUnique({
        where: { user_id_course_id: { user_id, course_id } },
      })),
    create: async (data) => mapEnrollment(await prisma.enrollment.create({ data })),
    listByUser: async (user_id) =>
      (await prisma.enrollment.findMany({ where: { user_id } })).map(mapEnrollment),
    listByCourse: async (course_id) =>
      (await prisma.enrollment.findMany({ where: { course_id } })).map(mapEnrollment),
  },

  jobs: {
    list: async () => (await prisma.job.findMany({ orderBy: { created_at: "desc" } })).map(mapJob),
    findById: async (id) => mapJob(await prisma.job.findUnique({ where: { id } })),
    create: async (data) => mapJob(await prisma.job.create({ data })),
    update: async (id, data) => {
      try { return mapJob(await prisma.job.update({ where: { id }, data })); }
      catch (e) { if (e.code === "P2025") return null; throw e; }
    },
    remove: async (id) => {
      try { await prisma.job.delete({ where: { id } }); return true; }
      catch (e) { if (e.code === "P2025") return false; throw e; }
    },
    listByEmployer: async (employer_id) =>
      (await prisma.job.findMany({ where: { employer_id } })).map(mapJob),
  },

  applications: {
    findOne: async (job_id, student_id) =>
      mapApp(await prisma.application.findUnique({
        where: { job_id_student_id: { job_id, student_id } },
      })),
    create: async (data) => mapApp(await prisma.application.create({ data })),
    listByJob: async (job_id) =>
      (await prisma.application.findMany({ where: { job_id } })).map(mapApp),
    listByStudent: async (student_id) =>
      (await prisma.application.findMany({ where: { student_id } })).map(mapApp),
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
      if (existing) return mapSub(await prisma.subscription.update({ where: { id: existing.id }, data }));
      return mapSub(await prisma.subscription.create({ data: { ...data, user_id } }));
    },
  },

  reports: {
    list: async () => (await prisma.report.findMany({ orderBy: { generated_at: "desc" } })).map(mapReportRow),
    listExports: async () =>
      (await prisma.report.findMany({
        where: { exported_at: { not: null } }, orderBy: { exported_at: "desc" },
      })).map(mapReportRow),
    summary: async () => {
      const [totalReports, users, profiles] = await Promise.all([
        prisma.report.count(), prisma.user.count(), prisma.profile.count(),
      ]);
      const accuracy = users ? Math.round((profiles / users) * 100) : 98;
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
          { channel: "Logins", value: 580 }, { channel: "Sessions", value: 480 },
          { channel: "Forum Posts", value: 220 }, { channel: "Messages", value: 140 },
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
          update: { value }, create: { scope: "system", key, value },
        });
      }
      const rows = await prisma.setting.findMany({ where: { scope: "system" } });
      const map = {};
      for (const s of rows) map[s.key] = s.value;
      return map;
    },
  },

  lessons: {
    listByCourse: async (course_id) =>
      (await prisma.lesson.findMany({ where: { course_id }, orderBy: { order_index: "asc" } })).map(mapLesson),
    findById: async (id) => mapLesson(await prisma.lesson.findUnique({ where: { id } })),
    create: async (data) => mapLesson(await prisma.lesson.create({ data })),
  },

  quizzes: {
    findByLessonId: async (lesson_id) => prisma.quiz.findFirst({ where: { lesson_id } }),
    create: async (data) => prisma.quiz.create({ data }),
  },

  assignments: {
    listByLesson: async (lesson_id) =>
      (await prisma.assignment.findMany({ where: { lesson_id } })).map(mapAssignment),
    create: async (data) => mapAssignment(await prisma.assignment.create({ data })),
  },

  progress: {
    listByUser: async (user_id) =>
      (await prisma.progress.findMany({ where: { user_id } })).map(mapProgress),
    upsert: async (user_id, lesson_id, patch) => {
      const data = {
        watched_duration: 0, quiz_score: null, assignment_status: "pending",
        completion_flag: false, ...patch,
      };
      return mapProgress(await prisma.progress.upsert({
        where: { user_id_lesson_id: { user_id, lesson_id } },
        update: patch,
        create: { ...data, user_id, lesson_id },
      }));
    },
  },

  certificates: {
    listByUser: async (user_id) =>
      (await prisma.certificate.findMany({ where: { user_id } })).map(mapCert),
    create: async (data) => mapCert(await prisma.certificate.create({
      data: {
        certificate_code: "EDU-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        ...data,
      },
    })),
  },

  achievements: {
    listByUser: async (user_id) =>
      (await prisma.achievement.findMany({ where: { user_id } })).map(mapAch),
    create: async (data) => mapAch(await prisma.achievement.create({ data })),
  },

  tasks: {
    listByUser: async (user_id, filters = {}) => {
      const where = { user_id };
      if (filters.status) where.status = filters.status;
      return (await prisma.task.findMany({ where, orderBy: { due_date: "asc" } })).map(mapTask);
    },
    create: async (data) => mapTask(await prisma.task.create({ data })),
    update: async (id, user_id, data) => {
      const t = await prisma.task.findFirst({ where: { id, user_id } });
      if (!t) return null;
      return mapTask(await prisma.task.update({ where: { id }, data }));
    },
    remove: async (id, user_id) => {
      const t = await prisma.task.findFirst({ where: { id, user_id } });
      if (!t) return false;
      await prisma.task.delete({ where: { id } });
      return true;
    },
  },

  recommendations: {
    listByUser: async (user_id) =>
      (await prisma.recommendation.findMany({ where: { user_id } })).map(mapRec),
    create: async (data) => mapRec(await prisma.recommendation.create({ data })),
  },

  announcements: {
    list: async () =>
      (await prisma.announcement.findMany({ orderBy: { created_at: "desc" } })).map(mapAnn),
    listByEducator: async (educator_id) =>
      (await prisma.announcement.findMany({
        where: { educator_id }, orderBy: { created_at: "desc" },
      })).map(mapAnn),
    create: async (data) => mapAnn(await prisma.announcement.create({ data })),
  },

  insights: async () => {
    const [users, courses, enrollments, jobs, applications, assessments] = await Promise.all([
      prisma.user.count(), prisma.course.count(), prisma.enrollment.count(),
      prisma.job.count(), prisma.application.count(), prisma.assessment.findMany(),
    ]);
    const avgScore = assessments.length === 0
      ? 0
      : Math.round(assessments.reduce((s, a) => s + a.score, 0) / assessments.length);
    return {
      totals: { users, courses, enrollments, jobs, applications },
      assessments: { count: assessments.length, average_score: avgScore },
      top_missing_skills: ["communication", "advanced-react", "system-design"],
    };
  },

  educatorInsights: async (educator_id) => {
    const courses = await prisma.course.findMany({ where: { educator_id } });
    const courseIds = courses.map((c) => c.id);
    const enrollments = await prisma.enrollment.findMany({ where: { course_id: { in: courseIds } } });
    const learners = new Set(enrollments.map((e) => e.user_id));
    const avgCompletion = enrollments.length === 0
      ? 0
      : Math.round(enrollments.reduce((s, e) => s + (e.completion_percentage || 0), 0) / enrollments.length);
    return {
      enrolledLearners: learners.size,
      activeCourses: courses.filter((c) => c.status === "active").length,
      avgCompletion, avgRating: 4.6, courseRatings: 235,
      learnerProficiency: { basic: 23, intermediate: 45, advanced: 32 },
      skillGapAnalysis: [
        { skill: "Technical Skills", value: 80 }, { skill: "Communication", value: 60 },
        { skill: "Critical Thinking", value: 70 }, { skill: "Engagement", value: 55 },
      ],
      learnerPerformance: [
        { week: "Week 1", technical: 50, engagement: 30 },
        { week: "Week 2", technical: 70, engagement: 50 },
        { week: "Week 3", technical: 65, engagement: 55 },
        { week: "Week 4", technical: 85, engagement: 75 },
      ],
    };
  },

  employerInsights: async (employer_id) => {
    const jobs = await prisma.job.findMany({ where: { employer_id } });
    const jobIds = jobs.map((j) => j.id);
    const apps = await prisma.application.findMany({ where: { job_id: { in: jobIds } } });
    const topMatches = apps.filter((a) => (a.skill_match || 0) >= 80).length;
    return {
      jobOpenings: jobs.filter((j) => j.status === "open").length,
      newApplicants: apps.length, topMatches,
      candidateMatches: { strong: 40, good: 35, possible: 25 },
      skillsInsights: [
        { skill: "UI/UX Design", value: 80 },
        { skill: "Data Readiness", value: 65 },
        { skill: "Digital Marketing", value: 55 },
      ],
    };
  },

  studentDashboard: async (user_id) => {
    const [enrollments, tasks, achievements, progress] = await Promise.all([
      prisma.enrollment.findMany({ where: { user_id } }),
      prisma.task.findMany({ where: { user_id } }),
      prisma.achievement.findMany({ where: { user_id } }),
      prisma.progress.findMany({ where: { user_id } }),
    ]);
    const learningSeconds = progress.reduce((s, p) => s + (p.watched_duration || 0), 0);
    const hoursLogged = Math.round(learningSeconds / 3600);
    const skillsReadiness = enrollments.length === 0
      ? 0
      : Math.round(enrollments.reduce((s, e) => s + (e.completion_percentage || 0), 0) / enrollments.length);
    return {
      coursesEnrolled: enrollments.length,
      activeCourses: enrollments.length,
      achievementsCount: achievements.length,
      tasksDue: tasks.filter((t) => t.status === "pending").length,
      learningHoursLogged: hoursLogged || 28,
      skillsReadiness: skillsReadiness || 72,
      learningProgress: [
        { week: "Week 1", value: 20 }, { week: "Week 2", value: 60 },
        { week: "Week 3", value: 55 }, { week: "Week 4", value: 85 },
      ],
      recentActivity: [
        { id: "1", title: "Submitted Python Assignment", when: "2 hours ago" },
        { id: "2", title: "Completed Soft Skills Quiz", when: "Yesterday" },
        { id: "3", title: "Received Feedback on Project", when: "2 days ago" },
      ],
    };
  },
};
