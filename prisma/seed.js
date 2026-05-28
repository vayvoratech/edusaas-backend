// Seed initial data for Postgres. Run with: npx prisma db seed
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@edu.local";
  const studentEmail = "priya.sharma@email.com";

  // Admin
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Admin User",
      email: adminEmail,
      role: "admin",
      password_hash: bcrypt.hashSync("admin123", 10),
    },
  });

  // Student
  await prisma.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      name: "Priya Sharma",
      email: studentEmail,
      role: "student",
      password_hash: bcrypt.hashSync("demo123", 10),
    },
  });

  // Courses
  const existingCourses = await prisma.course.count();
  if (existingCourses === 0) {
    await prisma.course.createMany({
      data: [
        {
          title: "Intro to Web Development",
          description: "HTML, CSS, JavaScript fundamentals.",
          provider: "EDU-SAAS",
          category: "Web",
        },
        {
          title: "Data Structures with Python",
          description: "Lists, trees, graphs, hashing.",
          provider: "EDU-SAAS",
          category: "Programming",
        },
        {
          title: "AWS Cloud Practitioner",
          description: "Cloud fundamentals on AWS.",
          provider: "AWS",
          category: "Cloud",
        },
        {
          title: "DevOps Foundations",
          description: "CI/CD, containers, infrastructure as code.",
          provider: "EDU-SAAS",
          category: "DevOps",
        },
      ],
    });
  }

  // Sample job posted by admin
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const existingJobs = await prisma.job.count();
  if (existingJobs === 0 && admin) {
    await prisma.job.create({
      data: {
        employer_id: admin.id,
        title: "Junior Frontend Developer",
        required_skills: ["html", "css", "javascript", "react"],
        status: "open",
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
