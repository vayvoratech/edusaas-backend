const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const skills = await p.skill.findMany();
  const difficulty = await p.difficultyLevel.findMany();
  console.log({skills, difficulty});
}
main().finally(() => p.$disconnect());
