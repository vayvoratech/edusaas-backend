const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const quizzes = await prisma.quiz.findMany(); 
  console.log(JSON.stringify(quizzes, null, 2)); 
} 
main().catch(console.error).finally(() => prisma.$disconnect());
