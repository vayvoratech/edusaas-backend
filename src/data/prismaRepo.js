const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

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

function learningProgressByEnrollment(
  records,
  enrollments,
  dateField,
  valueFn
) {
  if (!enrollments.length) return [];

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const MAX_DAYS = 28;

  // Student's first enrollment date
  const enrollmentDate = new Date(
    Math.min(
      ...enrollments.map((e) => new Date(e.enrolled_at).getTime())
    )
  );
  enrollmentDate.setHours(0, 0, 0, 0);

  // Today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Days since enrollment
  const elapsedDays = Math.min(
    MAX_DAYS,
    Math.max(
      0,
      Math.floor(
        (today.getTime() - enrollmentDate.getTime()) / MS_PER_DAY
      )
    )
  );

  // Always build 29 points (Day0 -> Day28)
  const dailyProgress = Array(MAX_DAYS + 1).fill(null);

  // Starting point
  dailyProgress[0] = 0;

  // Count completed lessons on each day
  for (const record of records) {
    if (!record[dateField]) continue;

    const completedDate = new Date(record[dateField]);
    completedDate.setHours(0, 0, 0, 0);

    const dayIndex = Math.floor(
      (completedDate.getTime() - enrollmentDate.getTime()) /
        MS_PER_DAY
    );

    if (dayIndex < 0 || dayIndex > elapsedDays) continue;

    if (dailyProgress[dayIndex] === null) {
      dailyProgress[dayIndex] = 0;
    }

    dailyProgress[dayIndex] += valueFn(record);
  }

  // Convert to cumulative values
  for (let day = 1; day <= elapsedDays; day++) {
    if (dailyProgress[day] === null) {
      dailyProgress[day] = dailyProgress[day - 1];
    } else {
      dailyProgress[day] += dailyProgress[day - 1];
    }
  }

  // Build chart data
  return dailyProgress.map((value, day) => {
    let week = "";

    if (day === 0) week = "Week 0";
    else if (day === 7) week = "Week 1";
    else if (day === 14) week = "Week 2";
    else if (day === 21) week = "Week 3";
    else if (day === 28) week = "Week 4";

    return {
      day,
      week,
      value: day <= elapsedDays ? value : null,
    };
  });
}

/**
 * A higher-order function to wrap Prisma queries for safe error handling.
 * It catches Prisma's "Record Not Found" error (P2025) and returns null,
 * while re-throwing any other errors.
 * @param {Promise<T>} query - The Prisma query to execute.
 * @returns {Promise<T|null>}
 * @template T
 */
const safeQuery = async (query) => {
  try {
    return await query;
  } catch (e) {
    if (e.code === "P2025") return null;
    throw e;
  }
};

// User rows are always fetched with role + role.permissions included so we can
// expose `role` (name) and `permissions[]` to callers.
const userInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
};

const mapUser = (u) =>
  u && {
    id: u.id,
    name: u.name,
    email: u.email,
    role_id: u.role_id,
    role: u.role?.name || null,

    career_goal: u.career_goal,

    permissions: u.role?.permissions?.map((rp) => rp.permission.name) || [],
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
      return mapUser(await safeQuery(prisma.user.update({
        where: { id }, data: patch, include: userInclude,
      })));
    },
    remove: async (id) => {
      try { await prisma.user.delete({ where: { id } }); return true; }
      catch (e) { if (e.code === "P2025") return false; throw e; }
    },
    touchLogin: async (id) => {
      try { await prisma.user.update({ where: { id }, data: { last_login: new Date() } }); }
      catch (_) {}
    },
    async updatePassword(userId, password_hash) {
      return prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          password_hash,
        },
      });
    },
  },

  authOtps: {
  async create(data) {
    return prisma.authOtp.create({ data });
  },

  async findByUserId(userId) {
    return prisma.authOtp.findUnique({
      where: {
        user_id: userId,
      },
    });
  },

  async deleteByUserId(userId) {
    return prisma.authOtp.deleteMany({
      where: {
        user_id: userId,
      },
    });
  },

  verify: async (id) => {
    return prisma.authOtp.update({
      where: {
        id,
      },
      data: {
        verified_at: new Date(),
      },
    });
  },
  },

  refreshTokens: {
    create: async (data) => {
      return prisma.refreshToken.create({ data });
    },

    findById: async (id) => {
      return prisma.refreshToken.findUnique({
        where: { id },
      });
    },

    findByUserId: async (userId) => {
      return prisma.refreshToken.findMany({
        where: { user_id: userId },
      });
    },

    delete: async (id) => {
      return prisma.refreshToken.delete({
        where: { id },
      });
    },

    deleteByUserId: async (userId) => {
      return prisma.refreshToken.deleteMany({
        where: { user_id: userId },
      });
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
    findByUserId: async (user_id) =>
      prisma.profile.findUnique({
        where: { user_id },
      }),

    upsert: async (user_id, data) => {
      return prisma.profile.upsert({
        where: { user_id },
        update: data,
        create: {
          ...data,
          user_id,
        },
      });
    },

    markInitialAssessmentCompleted: async (tx, user_id) =>
      tx.profile.update({
        where: {
          user_id,
        },
        data: {
          initial_assessment_completed: true,
        },
      }),
  },

  assessments: {
    create: async (data) => {
      const assessment = await prisma.$transaction(async (tx) => {
        const createdAssessment = await tx.assessment.create({
          data,
        });

        await tx.profile.update({
          where: {
            user_id: data.user_id,
          },
          data: {
            initial_assessment_completed: true,
          },
        });

        return createdAssessment;
      });

      return mapAssessment(assessment);
    },

    findById: async (id) =>
      mapAssessment(
        await prisma.assessment.findUnique({
          where: { id },
        })
      ),

    listByUser: async (user_id) =>
      (
        await prisma.assessment.findMany({
          where: { user_id },
        })
      ).map(mapAssessment),

    findInitialByUser: (userId) =>
      prisma.assessment.findFirst({
        where: {
          user_id: userId,
          is_initial: true,
        },
      }),

    createInitial: async (data) => {
    const assessment = await prisma.$transaction(async (tx) => {
      const createdAssessment = await tx.assessment.create({
        data,
      });

      await tx.profile.update({
        where: {
          user_id: data.user_id,
        },
        data: {
          initial_assessment_completed: true,
        },
      });

      return createdAssessment;
    });

    return mapAssessment(assessment);
    },
  },

  gapReports: {
    findByUserId: async (user_id) => mapGap(await prisma.gapReport.findFirst({ where: { user_id } })),
    upsert: async (user_id, data) => {
    const existing = await prisma.gapReport.findFirst({
      where: { user_id },
    });

    if (existing) {
      return mapGap(
        await prisma.gapReport.update({
          where: { id: existing.id },
          data,
        })
      );
    }

    return mapGap(
      await prisma.gapReport.create({
        data: {
          ...data,
          user_id,
          readiness_score: data.readiness_score ?? 0,
        },
      })
    );
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
      return mapCourse(await safeQuery(prisma.course.update({ where: { id }, data })));
    },
    remove: async (id) => !!(await safeQuery(prisma.course.delete({ where: { id } }))),
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
      return mapJob(await safeQuery(prisma.job.update({ where: { id }, data })));
    },
    remove: async (id) => !!(await safeQuery(prisma.job.delete({ where: { id } }))),
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
      const notification = await prisma.notification.findFirst({
        where: { id, user_id },
      });

      if (!notification) return null;

      return mapNotif(
        await prisma.notification.update({
          where: { id },
          data: { read_status: true },
        })
      );
    },
  },

  subscriptions: {
    findByUserId: async (user_id) =>
      mapSub(await prisma.subscription.findFirst({ where: { user_id } })),
    upsert: async (user_id, data) => {
      const existing = await prisma.subscription.findFirst({
        where: { user_id },
      });

      if (existing) {
        return mapSub(
          await prisma.subscription.update({
            where: { id: existing.id },
            data,
          })
        );
      }

      return mapSub(
        await prisma.subscription.create({
          data: {
            ...data,
            user_id,
          },
        })
      );
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
      const updates = Object.entries(patch || {}).map(([key, value]) =>
        prisma.setting.upsert({
          where: { scope_key: { scope: "system", key } },
          update: { value }, create: { scope: "system", key, value },
        })
      );

      await prisma.$transaction(updates);
      return module.exports.settings.all(); // Reuse all() to return the updated map
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
      const updateData = { ...patch };

      if ("completion_flag" in patch) {
        updateData.completed_at = patch.completion_flag
        ? new Date()
        : null;
}

      const saved = await prisma.progress.upsert({
          where: {
              user_id_lesson_id: {
                  user_id,
                  lesson_id,
              },
          },

          update: updateData,

          create: {
              ...data,
              user_id,
              lesson_id,
              completed_at: data.completion_flag
                  ? new Date()
                  : null,
          },
      });

      // Roll lesson-level progress up into the enrollment's completion_percentage,
      // so dashboards/certificates reflect real course progress instead of staying
      // at the 0 they're set to on enrollment.
      const lesson = await prisma.lesson.findUnique({ where: { id: lesson_id } });
      if (lesson) {
        const totalLessons = await prisma.lesson.count({
          where: { course_id: lesson.course_id },
        });
        if (totalLessons > 0) {
          const completedCount = await prisma.progress.count({
            where: {
              user_id,
              completion_flag: true,
              lesson: { course_id: lesson.course_id },
            },
          });
          const pct = Math.min(100, Math.round((completedCount / totalLessons) * 100));
          await prisma.enrollment.updateMany({
            where: { user_id, course_id: lesson.course_id },
            data: pct >= 100
              ? { completion_percentage: pct, status: "completed" }
              : { completion_percentage: pct },
          });
        }
      }

      return mapProgress(saved);
    },
  },

  certificates: {
    listByUser: async (user_id) =>
      (await prisma.certificate.findMany({ where: { user_id } })).map(mapCert),
    create: async (data) => mapCert(await prisma.certificate.create({
      data: {
        certificate_code: `EDU-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
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
      const task = await prisma.task.findFirst({
        where: { id, user_id },
      });

      if (!task) return null;

      return mapTask(
        await prisma.task.update({
          where: { id },
          data,
        })
      );
    },
    remove: async (id, user_id) => {
    const task = await prisma.task.findFirst({
      where: {
        id,
        user_id,
      },
    });

    if (!task) return false;

    await prisma.task.delete({
      where: { id },
    });

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

  domainRoles: {
  list: async () =>
    prisma.domainRole.findMany({
      orderBy: {
        domain_name: "asc",
      },
    }),

  findById: async (id) =>
    prisma.domainRole.findUnique({
      where: {
        id,
      },
      include: {
        requiredSkills: {
          include: {
            skill: true,
          },
        },
      },
    }),

  findByName: async (domain_name) =>
    prisma.domainRole.findUnique({
      where: {
        domain_name,
      },
      include: {
        requiredSkills: {
          include: {
            skill: true,
          },
        },
      },
    }),

  create: async (data) =>
    prisma.domainRole.create({
      data,
    }),

  update: async (id, data) =>
    safeQuery(
      prisma.domainRole.update({
        where: {
          id,
        },
        data,
      })
    ),

  remove: async (id) =>
    !!(
      await safeQuery(
        prisma.domainRole.delete({
          where: {
            id,
          },
        })
      )
    ),
  },
  
  skills: {
  list: async () =>
    prisma.skill.findMany({
      orderBy: {
        skill_name: "asc",
      },
    }),

  findById: async (id) =>
    prisma.skill.findUnique({
      where: {
        id,
      },
    }),

  findByName: async (skill_name) =>
    prisma.skill.findUnique({
      where: {
        skill_name,
      },
    }),

  create: async (data) =>
    prisma.skill.create({
      data,
    }),

  update: async (id, data) =>
    safeQuery(
      prisma.skill.update({
        where: {
          id,
        },
        data,
      })
    ),

  remove: async (id) =>
    !!(
      await safeQuery(
        prisma.skill.delete({
          where: {
            id,
          },
        })
      )
    ),
  },

  domainRequiredSkills: {
  list: async () =>
    prisma.domainRequiredSkill.findMany({
      include: {
        domainRole: true,
        skill: true,
      },
      orderBy: [
        {
          domain_role_id: "asc",
        },
        {
          skill_id: "asc",
        },
      ],
    }),

  findById: async (id) =>
    prisma.domainRequiredSkill.findUnique({
      where: {
        id,
      },
      include: {
        domainRole: true,
        skill: true,
      },
    }),

  findByDomainRoleId: async (domainRoleId) =>
    prisma.domainRequiredSkill.findMany({
      where: {
        domain_role_id: domainRoleId,
      },
      include: {
        skill: true,
      },
      orderBy: {
        required_level: "desc",
      },
    }),

  create: async (data) =>
    prisma.domainRequiredSkill.create({
      data,
    }),

  update: async (id, data) =>
    safeQuery(
      prisma.domainRequiredSkill.update({
        where: {
          id,
        },
        data,
      })
    ),

  remove: async (id) =>
    !!(
      await safeQuery(
        prisma.domainRequiredSkill.delete({
          where: {
            id,
          },
        })
      )
    ),
  },

  difficultyLevels: {
  list: async () =>
    prisma.difficultyLevel.findMany({
      orderBy: {
        difficulty_order: "asc",
      },
    }),

  findById: async (id) =>
    prisma.difficultyLevel.findUnique({
      where: {
        id,
      },
    }),

  findByName: async (difficulty_name) =>
    prisma.difficultyLevel.findUnique({
      where: {
        difficulty_name,
      },
    }),

  create: async (data) =>
    prisma.difficultyLevel.create({
      data,
    }),

  update: async (id, data) =>
    safeQuery(
      prisma.difficultyLevel.update({
        where: {
          id,
        },
        data,
      })
    ),

  remove: async (id) =>
    !!(
      await safeQuery(
        prisma.difficultyLevel.delete({
          where: {
            id,
          },
        })
      )
    ),
  },

  questions: {
  list: async (filters = {}) => {
    const where = {};

    if (filters.skill_id !== undefined)
      where.skill_id = filters.skill_id;

    if (filters.difficulty_id !== undefined)
      where.difficulty_id = filters.difficulty_id;

    if (filters.is_active !== undefined)
      where.is_active = filters.is_active;

    return prisma.question.findMany({
      where,
      include: {
        skill: true,
        difficulty: true,
      },
      orderBy: [
        {
          skill_id: "asc",
        },
        {
          difficulty_id: "asc",
        },
      ],
    });
  },

  findById: async (id) =>
    prisma.question.findUnique({
      where: {
        id,
      },
      include: {
        skill: true,
        difficulty: true,
      },
    }),

  findBySkillId: async (skillId) =>
    prisma.question.findMany({
      where: {
        skill_id: skillId,
        is_active: true,
      },
      include: {
        skill: true,
        difficulty: true,
      },
      orderBy: [
        {
          difficulty_id: "asc",
        },
        {
          id: "asc",
        },
      ],
    }),

  findBySkillIds: async (skillIds) =>
    prisma.question.findMany({
      where: {
        skill_id: {
          in: skillIds,
        },
        is_active: true,
      },
      include: {
        skill: true,
        difficulty: true,
      },
      orderBy: [
        {
          skill_id: "asc",
        },
        {
          difficulty_id: "asc",
        },
      ],
    }),

  findBySkillAndDifficulty: async (skillId, difficultyId) =>
    prisma.question.findMany({
      where: {
        skill_id: skillId,
        difficulty_id: difficultyId,
        is_active: true,
      },
      include: {
        skill: true,
        difficulty: true,
      },
      orderBy: {
        id: "asc",
      },
    }),

  create: async (data) =>
    prisma.question.create({
      data,
    }),

  createMany: async (data) =>
    prisma.question.createMany({
      data,
    }),

  update: async (id, data) =>
    safeQuery(
      prisma.question.update({
        where: {
          id,
        },
        data,
      })
    ),

  remove: async (id) =>
    !!(
      await safeQuery(
        prisma.question.delete({
          where: {
            id,
          },
        })
      )
    ),
  },

  quizSessions: {
    list: async () =>
      prisma.quizSession.findMany({
        include: {
          user: true,
          domainRole: true,
        },
        orderBy: {
          created_at: "desc",
        },
      }),

    findById: async (id) =>
      prisma.quizSession.findUnique({
        where: { id },
        include: {
          user: true,
          domainRole: true,
          answers: true,
          skillResults: true,
        },
      }),

    findByUserId: async (userId) =>
      prisma.quizSession.findMany({
        where: {
          user_id: userId,
        },
        include: {
          domainRole: true,
        },
        orderBy: {
          created_at: "desc",
        },
      }),

    create: async (data) =>
      prisma.quizSession.create({
        data,
      }),

    update: async (id, data) =>
      safeQuery(
        prisma.quizSession.update({
          where: { id },
          data,
        })
      ),

    remove: async (id) =>
      !!(
        await safeQuery(
          prisma.quizSession.delete({
            where: { id },
          })
        )
      ),
  },

  studentAnswers: {
  list: async () =>
    prisma.studentAnswer.findMany({
      include: {
        session: true,
        question: true,
        skill: true,
        difficulty: true,
      },
    }),

  findById: async (id) =>
    prisma.studentAnswer.findUnique({
      where: { id },
      include: {
        session: true,
        question: true,
        skill: true,
        difficulty: true,
      },
    }),

  findBySessionId: async (sessionId) =>
    prisma.studentAnswer.findMany({
      where: {
        session_id: sessionId,
      },
      include: {
        question: true,
        skill: true,
        difficulty: true,
      },
      orderBy: {
        answered_at: "asc",
      },
    }),

  create: async (data) =>
    prisma.studentAnswer.create({
      data,
    }),

  createMany: async (data) =>
    prisma.studentAnswer.createMany({
      data,
    }),

  update: async (id, data) =>
    safeQuery(
      prisma.studentAnswer.update({
        where: { id },
        data,
      })
    ),

  remove: async (id) =>
    !!(
      await safeQuery(
        prisma.studentAnswer.delete({
          where: { id },
        })
      )
    ),
  },

  studentSkillResults: {
  list: async () =>
    prisma.studentSkillResult.findMany({
      include: {
        session: true,
        skill: true,
      },
    }),

  findById: async (id) =>
    prisma.studentSkillResult.findUnique({
      where: { id },
      include: {
        session: true,
        skill: true,
      },
    }),

  findBySessionId: async (sessionId) =>
    prisma.studentSkillResult.findMany({
      where: {
        session_id: sessionId,
      },
      include: {
        skill: true,
      },
      orderBy: {
        skill_id: "asc",
      },
    }),

  create: async (data) =>
    prisma.studentSkillResult.create({
      data,
    }),

  createMany: async (data) =>
    prisma.studentSkillResult.createMany({
      data,
    }),

  update: async (id, data) =>
    safeQuery(
      prisma.studentSkillResult.update({
        where: { id },
        data,
      })
    ),

  remove: async (id) =>
    !!(
      await safeQuery(
        prisma.studentSkillResult.delete({
          where: { id },
        })
      )
    ),
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
    const [
      user,
      initialAssessment,
      enrollments,
      tasks,
      achievements,
      progress,
      certificates,
    ] = await Promise.all([

      prisma.user.findUnique({
      where: { id: user_id },
      select: {
        name: true,
        career_goal: true,
        profile: {
          select: {
            initial_assessment_completed: true,
            },
          },
        },
      }),

      prisma.assessment.findFirst({
        where: {
          user_id,
          is_initial: true,
        },
        select: {
          score : true,
          completed: true,
          answers: true
        },
      }),

      prisma.enrollment.findMany({
        where: { user_id },
        include: {
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),

      prisma.task.findMany({
        where: { user_id },
        include: {
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),

      prisma.achievement.findMany({
        where: { user_id },
      }),

      prisma.progress.findMany({
        where: { user_id },
        include: {
          lesson: {
            select: {
              id: true,
              title: true,
              course: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      }),

      prisma.certificate.findMany({
        where: { user_id },
        include: {
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    ]);
    const learningSeconds = progress.reduce(
     (sum, record) => sum + (record.watched_duration || 0),0);

    const learningHoursLogged = Math.round(learningSeconds / 3600);

    const activeCourses = enrollments.filter(
      (enrollment) => enrollment.status === "active"
    ).length;

    const skillsReadiness = enrollments.length > 0 ? Math.round(enrollments.reduce(
                  (sum, enrollment) =>sum + (enrollment.completion_percentage || 0),0) 
                  / enrollments.length): 0;
    
    const enrollmentActivities = enrollments.map((enrollment) => ({
      id: enrollment.id,
      title: `Enrolled in ${enrollment.course.title}`,
      when: enrollment.enrolled_at,
      type: "enrollment",
    }));

    const lessonActivities = progress.filter((record) => record.completion_flag)
      .map((record) => ({
        id: record.id,
        title: `Completed lesson "${record.lesson.title}"`,
        when: record.updated_at,
        type: "lesson",
      }));

    const taskActivities = tasks
      .filter((task) => task.status === "done")
      .map((task) => ({
        id: task.id,
        title: `Completed task "${task.title}"`,
        when: task.created_at,
        type: "task",
      }));

    const achievementActivities = achievements.map((achievement) => ({
      id: achievement.id,
      title: `Earned "${achievement.badge_name}" badge`,
      when: achievement.earned_at,
      type: "achievement",
    }));

    const certificateActivities = certificates.map((certificate) => ({
      id: certificate.id,
      title: `Received certificate for ${certificate.course.title}`,
      when: certificate.issued_date,
      type: "certificate",
    }));

    const recentActivity = [
      ...enrollmentActivities,
      ...lessonActivities,
      ...taskActivities,
      ...achievementActivities,
      ...certificateActivities,
    ]
      .sort((a, b) => new Date(b.when) - new Date(a.when))
      .slice(0, 5);

    return {
    studentName: user?.name,
    careerGoal: user?.career_goal,
    assessmentCompleted:
      initialAssessment?.completed ?? false,

    readinessScore:
      initialAssessment?.score ?? null,

    skillBreakdown:
     initialAssessment?.answers ?? {},

    coursesEnrolled: enrollments.length,
    activeCourses,
    achievementsCount: achievements.length,
    tasksDue: tasks.filter(task => task.status === "pending").length,
    learningHoursLogged,
    skillsReadiness,

    learningProgress: learningProgressByEnrollment(
      progress.filter((p) => p.completed_at),
      enrollments,
      "completed_at",
      () => 1
    ),

    engagementTrends: weeklyBuckets(
      progress,
      "updated_at",
      (p) => (p.watched_duration || 0) / 3600
    ),

    recentActivity,
    };
   },
};