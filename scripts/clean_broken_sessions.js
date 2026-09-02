const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sessions = await prisma.quizSession.findMany({
    where: {
      current_question_id: null,
      status: { in: ['In Progress', 'Paused'] }
    }
  });
  
  console.log('Broken sessions:', sessions.length);
  
  for (let s of sessions) {
    await prisma.quizSession.delete({
      where: { session_id: s.session_id }
    });
    console.log('Deleted broken session', s.session_id);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
