const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE education.community_posts
    DROP COLUMN visibility;
  `);
  console.log('Dropped visibility column');
}

main().catch(console.error).finally(() => prisma.$disconnect());
