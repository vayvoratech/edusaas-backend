const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE education.community_posts
    ALTER COLUMN visibility TYPE education.community_visibility[]
    USING ARRAY[visibility]::education.community_visibility[];
  `);
  console.log('Altered column successfully');
}

main().catch(console.error).finally(() => prisma.$disconnect());
