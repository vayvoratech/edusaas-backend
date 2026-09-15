const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const roles = [
  { domain_name: 'AI Engineer', category: 'AI & Machine Learning' },
  { domain_name: 'Machine Learning Engineer', category: 'AI & Machine Learning' },
  { domain_name: 'Generative AI Engineer', category: 'AI & Machine Learning' },
  { domain_name: 'MLOps Engineer', category: 'AI & Machine Learning' },
  { domain_name: 'Robotics and Computer Vision Engineer', category: 'AI & Machine Learning' },
  { domain_name: 'Data Scientist', category: 'Data Science & Analytics' },
  { domain_name: 'Data Analyst', category: 'Data Science & Analytics' },
  { domain_name: 'Business Intelligence Developer', category: 'Data Science & Analytics' },
  { domain_name: 'Data Engineer', category: 'Data Engineering' },
  { domain_name: 'Backend Developer', category: 'Software Engineering' },
  { domain_name: 'Frontend Developer', category: 'Software Engineering' },
  { domain_name: 'Full Stack Developer', category: 'Software Engineering' },
  { domain_name: 'Mobile Application Developer', category: 'Software Engineering' },
  { domain_name: 'Software Development Engineer (SDE)', category: 'Software Engineering' },
  { domain_name: 'Blockchain Developer', category: 'Software Engineering' },
  { domain_name: 'Cloud Engineer', category: 'Cloud & Infrastructure' },
  { domain_name: 'DevOps Engineer', category: 'Cloud & Infrastructure' },
  { domain_name: 'Cybersecurity Analyst', category: 'Security' },
  { domain_name: 'UI/UX Designer', category: 'Design' },
  { domain_name: 'IoT Engineer', category: 'Embedded & Hardware' },
  { domain_name: 'Software Test Engineer', category: 'Quality Assurance' },
  { domain_name: 'Software Development Engineer', category: 'Software Development' },
];

async function main() {
  for (const r of roles) {
    await prisma.domainRole.create({ data: r });
  }
  console.log('Done! Seeded', roles.length, 'domain roles.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
