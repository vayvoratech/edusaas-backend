const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.community_posts.deleteMany({});
  console.log('cleared');
}

main().finally(() => prisma.$disconnect());
