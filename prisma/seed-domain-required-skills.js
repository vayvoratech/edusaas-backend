const { PrismaClient } = require("@prisma/client");
require("../src/config/env");

const prisma = new PrismaClient();

const roleRequirements = [
  {
    role: "AI Engineer",
    skills: [
      ["Python", 5],
      ["SQL", 3],
      ["Machine Learning", 5],
      ["Deep Learning", 5],
      ["Git", 3],
    ],
  },
  {
    role: "Machine Learning Engineer",
    skills: [
      ["Python", 5],
      ["SQL", 3],
      ["Machine Learning", 5],
      ["Deep Learning", 4],
      ["Feature Engineering", 4],
      ["Statistics", 4],
      ["MLOps", 3],
      ["MLflow", 3],
      ["Git", 4],
    ],
  },
  {
    role: "Generative AI Engineer",
    skills: [
      ["Python", 5],
      ["Prompt Engineering", 4],
      ["LLMs", 5],
      ["RAG", 4],
      ["Vector Databases", 4],
      ["Machine Learning", 4],
      ["Deep Learning", 4],
      ["REST APIs", 3],
      ["Git", 3],
    ],
  },
  {
    role: "MLOps Engineer",
    skills: [
      ["Python", 4],
      ["MLOps", 5],
      ["MLflow", 4],
      ["Docker", 4],
      ["Kubernetes", 4],
      ["CI/CD", 4],
      ["Jenkins", 3],
      ["Cloud Computing", 4],
      ["AWS", 4],
      ["Linux", 4],
      ["Git", 4],
    ],
  },
  {
    role: "Robotics and Computer Vision Engineer",
    skills: [
      ["Python", 4],
      ["Computer Vision", 5],
      ["OpenCV", 5],
      ["ROS", 4],
      ["Machine Learning", 4],
      ["Deep Learning", 4],
      ["Embedded C", 3],
      ["Arduino", 3],
      ["Raspberry Pi", 3],
      ["Git", 3],
    ],
  },
  {
    role: "Data Scientist",
    skills: [
      ["Python", 5],
      ["SQL", 4],
      ["Machine Learning", 4],
      ["Statistics", 5],
      ["Feature Engineering", 4],
      ["Data Visualization", 4],
      ["Apache Spark", 3],
      ["Git", 3],
    ],
  },
  {
    role: "Data Analyst",
    skills: [
      ["SQL", 5],
      ["Excel", 4],
      ["Power BI", 4],
      ["Tableau", 4],
      ["Statistics", 4],
      ["Data Visualization", 5],
      ["Python", 3],
      ["Git", 2],
    ],
  },
  {
    role: "Business Intelligence Developer",
    skills: [
      ["SQL", 5],
      ["Power BI", 5],
      ["Tableau", 4],
      ["Data Warehousing", 4],
      ["ETL", 4],
      ["Excel", 3],
      ["Data Visualization", 4],
    ],
  },
  {
    role: "Data Engineer",
    skills: [
      ["Python", 4],
      ["SQL", 5],
      ["Apache Spark", 4],
      ["ETL", 5],
      ["Data Warehousing", 4],
      ["Cloud Computing", 4],
      ["AWS", 3],
      ["Docker", 3],
      ["Git", 3],
      ["Apache Airflow", 3],
    ],
  },
  {
    role: "Backend Developer",
    skills: [
      ["Python", 4],
      ["Java", 4],
      ["Node.js", 4],
      ["SQL", 5],
      ["REST APIs", 5],
      ["Spring Boot", 4],
      ["Docker", 3],
      ["Git", 4],
      ["OOP", 4],
      ["Data Structures", 3],
      ["Authentication/Authorization", 4],
      ["Database Design", 4],
    ],
  },
  {
    role: "Frontend Developer",
    skills: [
      ["HTML", 5],
      ["CSS", 5],
      ["JavaScript", 5],
      ["React", 5],
      ["UI/UX", 3],
      ["Git", 4],
      ["TypeScript", 4],
    ],
  },
  {
    role: "Full Stack Developer",
    skills: [
      ["HTML", 4],
      ["CSS", 4],
      ["JavaScript", 5],
      ["React", 4],
      ["Node.js", 4],
      ["SQL", 4],
      ["REST APIs", 4],
      ["Git", 4],
      ["Docker", 3],
      ["TypeScript", 3],
      ["Authentication/Authorization", 3],
      ["Database Design", 3],
    ],
  },
  {
    role: "Mobile Application Developer",
    skills: [
      ["Flutter", 5],
      ["Dart", 5],
      ["Firebase", 4],
      ["Java", 3],
      ["REST APIs", 3],
      ["UI/UX", 3],
      ["Git", 3],
    ],
  },
  {
    role: "Software Development Engineer (SDE)",
    skills: [
      ["Data Structures", 5],
      ["Algorithms", 5],
      ["OOP", 4],
      ["Python", 4],
      ["Java", 4],
      ["SQL", 3],
      ["Git", 4],
    ],
  },
  {
    role: "Blockchain Developer",
    skills: [
      ["Solidity", 5],
      ["Ethereum", 4],
      ["Smart Contracts", 5],
      ["Web3", 4],
      ["JavaScript", 4],
      ["Node.js", 3],
      ["Git", 3],
    ],
  },
  {
    role: "Cloud Engineer",
    skills: [
      ["AWS", 5],
      ["Cloud Computing", 5],
      ["Linux", 4],
      ["Networking", 4],
      ["Docker", 4],
      ["Kubernetes", 3],
      ["CI/CD", 3],
      ["Terraform", 3],
    ],
  },
  {
    role: "DevOps Engineer",
    skills: [
      ["Docker", 5],
      ["Kubernetes", 4],
      ["CI/CD", 5],
      ["Jenkins", 4],
      ["Linux", 4],
      ["AWS", 4],
      ["Cloud Computing", 4],
      ["Git", 4],
      ["Terraform", 4],
    ],
  },
  {
    role: "Cybersecurity Analyst",
    skills: [
      ["Network Security", 5],
      ["Ethical Hacking", 4],
      ["SIEM", 4],
      ["Incident Response", 5],
      ["Linux", 4],
      ["Networking", 4],
      ["Vulnerability Management", 4],
    ],
  },
  {
    role: "UI/UX Designer",
    skills: [
      ["UI/UX", 5],
      ["Figma", 5],
      ["Wireframing", 4],
      ["Prototyping", 4],
      ["UX Research", 4],
      ["Design Principles", 4],
    ],
  },
  {
    role: "IoT Engineer",
    skills: [
      ["Embedded C", 5],
      ["Arduino", 4],
      ["Raspberry Pi", 4],
      ["IoT Protocols", 5],
      ["Python", 3],
      ["Linux", 3],
      ["Networking", 3],
      ["Git", 3],
    ],
  },
  {
    role: "Software Test Engineer",
    skills: [
      ["Manual Testing", 4],
      ["API Testing", 5],
      ["Selenium", 4],
      ["Bug Tracking (Jira)", 4],
      ["SQL", 3],
      ["Git", 3],
    ],
  },
  {
    role: "Software Development Engineer",
    skills: [
      ["Data Structures", 4],
      ["Algorithms", 4],
      ["OOP", 4],
      ["Python", 4],
      ["Java", 4],
      ["SQL", 3],
      ["Git", 4],
    ],
  },
];

async function populateRoleRequirements() {
  const skippedRoles = [];
  const [roles, skills] = await Promise.all([
    prisma.domainRole.findMany({
      select: { domain_role_id: true, domain_name: true },
    }),
    prisma.skill.findMany({
      select: { skill_id: true, skill_name: true },
    }),
  ]);
  const roleByName = new Map(
    roles.map((role) => [role.domain_name, role])
  );
  const skillByName = new Map(
    skills.map((skill) => [skill.skill_name, skill])
  );

  const hasMissingSkill = roleRequirements.some(
    (requirement) =>
      roleByName.has(requirement.role) &&
      requirement.skills.some(([skillName]) => !skillByName.has(skillName))
  );
  if (hasMissingSkill) {
    await prisma.$queryRaw`
      SELECT setval(
        pg_get_serial_sequence('"education"."skills"', 'skill_id'),
        GREATEST(COALESCE(MAX(skill_id), 1), 1),
        COUNT(*) > 0
      )
      FROM "education"."skills"
    `;
  }

  for (const requirement of roleRequirements) {
    const role = roleByName.get(requirement.role);
    if (!role) {
      const message = `Role "${requirement.role}" is missing from the domain_roles table.`;
      console.warn(`⚠ Skipping unavailable domain role: ${message}`);
      skippedRoles.push(requirement.role);
      continue;
    }

    const mappingData = [];
    const mappedSkillNames = [];

    for (const [skillName, requiredLevel] of requirement.skills) {
      let skill = skillByName.get(skillName);
      if (!skill) {
        skill = await prisma.skill.upsert({
          where: { skill_name: skillName },
          update: {},
          create: { skill_name: skillName },
        });
        skillByName.set(skillName, skill);
        console.log(`✓ Added missing required skill "${skillName}".`);
      }

      mappingData.push({
        domain_role_id: role.domain_role_id,
        skill_id: skill.skill_id,
        required_level: requiredLevel,
      });
      mappedSkillNames.push(skill.skill_name);
    }

    const result = mappingData.length
      ? await prisma.domainRequiredSkill.createMany({
          data: mappingData,
          skipDuplicates: true,
        })
      : { count: 0 };

    const mappedCount = mappingData.length
      ? await prisma.domainRequiredSkill.count({
          where: {
            domain_role_id: role.domain_role_id,
            skill_id: { in: mappingData.map(({ skill_id }) => skill_id) },
          },
        })
      : 0;
    const alreadyMappedCount = mappedCount - result.count;

    console.log(
      `✓ ${requirement.role} -> ${mappedCount} skills (${result.count} added, ${alreadyMappedCount} already mapped)`
    );
    if (mappingData.length) {
      console.log(`  Skills: ${mappedSkillNames.join(", ")}`);
    }
  }

  if (skippedRoles.length) {
    console.warn(
      `Skipped ${skippedRoles.length} role requirement set(s) because those roles are not present in domain_roles: ${skippedRoles.join(", ")}.`
    );
  }
  console.log(
    `Role-skill population completed for ${roles.length} available domain roles.`
  );
}

async function main() {
  try {
    await populateRoleRequirements();
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("[seed-domain-required-skills] failed", error);
    process.exitCode = 1;
  });
}

module.exports = { roleRequirements };
