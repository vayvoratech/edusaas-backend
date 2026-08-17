// Script to seed domain roles (career goals) into the database
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const domainRoles = [
  { domain_name: 'Software Engineer', category: 'Engineering' },
  { domain_name: 'Data Scientist', category: 'Data & Analytics' },
  { domain_name: 'Data Analyst', category: 'Data & Analytics' },
  { domain_name: 'Web Developer', category: 'Engineering' },
  { domain_name: 'Mobile App Developer', category: 'Engineering' },
  { domain_name: 'DevOps Engineer', category: 'Engineering' },
  { domain_name: 'Cloud Architect', category: 'Engineering' },
  { domain_name: 'Cybersecurity Analyst', category: 'Security' },
  { domain_name: 'UI/UX Designer', category: 'Design' },
  { domain_name: 'Product Manager', category: 'Product' },
  { domain_name: 'Business Analyst', category: 'Business' },
  { domain_name: 'Machine Learning Engineer', category: 'AI/ML' },
  { domain_name: 'AI/ML Researcher', category: 'AI/ML' },
  { domain_name: 'Digital Marketer', category: 'Marketing' },
  { domain_name: 'Project Manager', category: 'Management' },
  { domain_name: 'Database Administrator', category: 'Data & Analytics' },
  { domain_name: 'Embedded Systems Engineer', category: 'Engineering' },
  { domain_name: 'Blockchain Developer', category: 'Engineering' },
  { domain_name: 'Game Developer', category: 'Engineering' },
  { domain_name: 'Full Stack Developer', category: 'Engineering' },
];

async function main() {
  console.log('🌱 Seeding domain roles...');

  let created = 0;
  let skipped = 0;

  for (const dr of domainRoles) {
    const existing = await prisma.domainRole.findFirst({
      where: { domain_name: dr.domain_name },
    });

    if (existing) {
      console.log(`  ⏭  Skipping (already exists): ${dr.domain_name}`);
      skipped++;
    } else {
      await prisma.domainRole.create({ data: dr });
      console.log(`  ✅ Created: ${dr.domain_name}`);
      created++;
    }
  }

  console.log(`\n✨ Done! Created: ${created}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
