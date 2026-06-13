// Seed initial data for Postgres. Run with: npx prisma db seed
// Order matters: permissions + roles + role_permissions BEFORE users
// (users now require a role_id FK).
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { PERMISSIONS, ROLES, ROLE_PERMISSIONS } = require("../src/config/rbac");

const prisma = new PrismaClient();

async function main() {
  // ---- 1. Permissions ----
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: p.name },
      update: { description: p.description, category: p.category },
      create: { name: p.name, description: p.description, category: p.category },
    });
  }
  console.log(`✓ ${PERMISSIONS.length} permissions seeded`);

  // ---- 2. Roles ----
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, description: `${name[0].toUpperCase()}${name.slice(1)} role` },
    });
  }
  console.log(`✓ ${ROLES.length} roles seeded`);

  // ---- 3. Role-permission mappings ----
  const allPerms = await prisma.permission.findMany();
  const permByName = Object.fromEntries(allPerms.map((p) => [p.name, p]));
  const allRoles = await prisma.role.findMany();
  const roleByName = Object.fromEntries(allRoles.map((r) => [r.name, r]));

  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByName[roleName];
    if (!role) continue;
    for (const permName of permNames) {
      const perm = permByName[permName];
      if (!perm) continue;
      await prisma.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: role.id, permission_id: perm.id } },
        update: {},
        create: { role_id: role.id, permission_id: perm.id },
      });
    }
  }
  console.log("✓ role-permission mappings seeded");

  // ---- 4. Users (now with role_id) ----
  const usersToSeed = [
    { name: "Admin User", email: "admin@edu.local", role: "admin", password: "admin123" },
    { name: "Priya Sharma", email: "priya.sharma@email.com", role: "student", password: "demo123" },
    { name: "Yash Mehta", email: "yash@educator.local", role: "educator", password: "demo123" },
    { name: "Ankit Verma", email: "ankit@employer.local", role: "employer", password: "demo123" },
  ];

  for (const u of usersToSeed) {
    const role = roleByName[u.role];
    if (!role) {
      console.warn(`Skipping ${u.email} — role ${u.role} not found`);
      continue;
    }
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        role_id: role.id,
        password_hash: bcrypt.hashSync(u.password, 10),
        status: "active",
      },
    });
  }
  console.log(`✓ ${usersToSeed.length} users seeded`);

  // ---- 5. Courses ----
  const educator = await prisma.user.findUnique({ where: { email: "yash@educator.local" } });
  const existingCourses = await prisma.course.count();
  if (existingCourses === 0) {
    const courses = [
      { title: "Advanced Python", description: "Decorators, generators, dataclasses.", provider: "EDU-SAAS", category: "Programming", difficulty: "advanced", status: "active", educator_id: educator?.id },
      { title: "Data Science Basics", description: "Pandas, numpy, visualization.", provider: "EDU-SAAS", category: "Data Science", difficulty: "beginner", status: "active", educator_id: educator?.id },
      { title: "Web Development", description: "HTML, CSS, JavaScript.", provider: "EDU-SAAS", category: "Web Dev", difficulty: "beginner", status: "active", educator_id: educator?.id },
      { title: "Soft Skills Development", description: "Communication and teamwork.", provider: "EDU-SAAS", category: "Soft Skills", difficulty: "beginner", status: "active", educator_id: educator?.id },
      { title: "Machine Learning 101", description: "Intro to ML algorithms.", provider: "EDU-SAAS", category: "AI & ML", difficulty: "intermediate", status: "draft", educator_id: educator?.id },
    ];
    await prisma.course.createMany({ data: courses });
    console.log(`✓ ${courses.length} courses seeded`);
  }

  // ---- 6. Sample job ----
  const employer = await prisma.user.findUnique({ where: { email: "ankit@employer.local" } });
  const existingJobs = await prisma.job.count();
  if (existingJobs === 0 && employer) {
    await prisma.job.create({
      data: {
        employer_id: employer.id,
        title: "Junior Frontend Developer",
        description: "Build full-stack web apps.",
        requirements: "HTML, CSS, JavaScript, React.",
        required_skills: ["html", "css", "javascript", "react"],
        status: "open",
      },
    });
    console.log("✓ sample job seeded");
  }

  // ---- 7. Settings (system defaults) ----
  const defaultSettings = {
    enable_auto_backup: true,
    two_factor_auth: true,
    language: "en-US",
    time_zone: "GMT-05:00",
    email_alerts: true,
    user_registration: true,
    api_access: true,
    organization_name: "EduSaaS",
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({
      where: { scope_key: { scope: "system", key } },
      update: {},
      create: { scope: "system", key, value },
    });
  }
  console.log(`✓ ${Object.keys(defaultSettings).length} system settings seeded`);

  console.log("\n🌱 Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
