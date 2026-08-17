const { PrismaClient } = require("@prisma/client");
require("../src/config/env");

const PERMISSIONS = [
  // Dashboards
  { name: "dashboards:student", category: "Dashboards", description: "Access the student dashboard" },
  { name: "dashboards:educator", category: "Dashboards", description: "Access the educator dashboard" },
  { name: "dashboards:employer", category: "Dashboards", description: "Access the employer dashboard" },
  { name: "admin:insights", category: "Admin", description: "Access admin insights" },

  // Courses
  { name: "courses:create", category: "Courses", description: "Create a new course" },
  { name: "courses:update", category: "Courses", description: "Update a course" },
  { name: "courses:delete", category: "Courses", description: "Delete a course" },
  { name: "courses:assign", category: "Courses", description: "Assign a course to a student" },
  { name: "courses:enroll", category: "Courses", description: "Enroll in a course" },

  // Lessons
  { name: "lessons:create", category: "Lessons", description: "Create a new lesson" },
  { name: "lessons:update", category: "Lessons", description: "Update a lesson" },
  { name: "lessons:delete", category: "Lessons", description: "Delete a lesson" },

  // Users
  { name: "users:list", category: "Users", description: "List all users" },
  { name: "users:profile:view", category: "Users", description: "View user profiles" },
  { name: "users:profile:update", category: "Users", description: "Update user profiles" },

  // Jobs
  { name: "jobs:create", category: "Jobs", description: "Create a job posting" },
];

const ROLES = ["student", "educator", "admin", "employer"];

const ROLE_PERMISSIONS = {
  student: [
    "dashboards:student",
    "courses:enroll",
    "users:profile:view",
    "users:profile:update",
  ],
  educator: [
    "dashboards:educator",
    "courses:create",
    "courses:update",
    "courses:delete",
    "courses:assign", // <-- This is the new permission being added
    "lessons:create",
    "lessons:update",
    "lessons:delete",
  ],
  admin: PERMISSIONS.map((p) => p.name), // Admin gets all permissions
  employer: [
    "dashboards:employer",
    "jobs:create",
  ],
};
const prisma = new PrismaClient();

async function main() {
  console.log("Start seeding...");
  const permissionByName = new Map();
  for (const permission of PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { name: permission.name },
      update: {
        category: permission.category,
        description: permission.description,
      },
      create: {
        name: permission.name,
        category: permission.category,
        description: permission.description,
      },
    });
    permissionByName.set(row.name, row);
  }
  console.log("Permissions created/verified.");

  const roleByName = new Map();
  for (const roleName of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        description: `${roleName[0].toUpperCase()}${roleName.slice(1)} role`,
      },
      create: {
        name: roleName,
        description: `${roleName[0].toUpperCase()}${roleName.slice(1)} role`,
      },
    });
    roleByName.set(role.name, role);
  }
  console.log("Roles created/verified.");

  for (const [roleName, permissionNames] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleByName.get(roleName);
    if (!role) {
      throw new Error(`RBAC config references unknown role: ${roleName}`);
    }

    const permissionsToConnect = [];

    for (const permissionName of permissionNames) {
      const permission = permissionByName.get(permissionName);
      if (!permission) {
        throw new Error(`RBAC config references unknown permission: ${permissionName}`);
      }
      permissionsToConnect.push({ id: permission.id });
    }

    // First, delete all existing permissions for this role to ensure a clean slate.
    await prisma.rolePermission.deleteMany({
      where: {
        role_id: role.id,
      },
    });

    // Now, create the new associations in the RolePermission join table.
    await prisma.role.update({
      where: {
        name: roleName,
      },
      data: {
        permissions: {
          create: permissionsToConnect.map(p => ({ permission_id: p.id })),
        },
      },
    });
  }
  console.log("Permissions mapped to roles.");

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: {
      permissions: {
        include: { permission: true },
        orderBy: { permission: { name: "asc" } },
      },
    },
  });

  console.log("[seed] RBAC initialized");
  for (const role of roles) {
    console.log(`[seed] ${role.name}: ${role.permissions.length} permissions`);
  }
  console.log("Seeding finished.");
}

main()
  .catch((err) => {
    console.error("[seed] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
