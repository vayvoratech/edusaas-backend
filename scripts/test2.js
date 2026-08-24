const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.domainRole.findMany().then(d => console.log(d)).finally(() => p.$disconnect());
