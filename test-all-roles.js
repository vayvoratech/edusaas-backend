require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAllRoles() {
  console.log('='.repeat(60));
  console.log('  SIGNUP TEST — ALL ROLES');
  console.log('='.repeat(60));

  // Get a domain role for student signup
  const domain = await prisma.domainRole.findFirst();
  if (!domain) {
    console.error('❌ No domain roles found. Run: node prisma/seed-domain-roles.js');
    process.exit(1);
  }

  const testUsers = [
    {
      role: 'student',
      name: 'Test Student',
      email: `test.student.${Date.now()}@example.com`,
      password: 'Test@1234',
      domain_role_id: domain.domain_role_id,
    },
    {
      role: 'educator',
      name: 'Test Educator',
      email: `test.educator.${Date.now()}@example.com`,
      password: 'Test@1234',
    },
    {
      role: 'employer',
      name: 'Test Employer',
      email: `test.employer.${Date.now()}@example.com`,
      password: 'Test@1234',
    },
    {
      role: 'admin',
      name: 'Test Admin',
      email: `test.admin.${Date.now()}@example.com`,
      password: 'Test@1234',
    },
  ];

  const results = [];

  for (const user of testUsers) {
    process.stdout.write(`\n[${user.role.toUpperCase()}] Signing up as "${user.name}"...`);
    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      const data = await res.json();

      if (res.ok && data.user?.id) {
        // Verify in DB
        const dbUser = await prisma.user.findUnique({ where: { id: data.user.id } });
        if (dbUser) {
          console.log(` ✅ PASS`);
          console.log(`   ├─ User ID    : ${dbUser.id}`);
          console.log(`   ├─ Email      : ${dbUser.email}`);
          console.log(`   ├─ Role       : ${user.role}`);
          console.log(`   └─ DB Stored  : YES`);
          results.push({ role: user.role, status: 'PASS', userId: dbUser.id });
        } else {
          console.log(` ❌ FAIL — API returned success but user NOT found in DB`);
          results.push({ role: user.role, status: 'DB_MISS' });
        }
      } else {
        console.log(` ❌ FAIL`);
        console.log(`   └─ Error: ${JSON.stringify(data)}`);
        results.push({ role: user.role, status: 'API_FAIL', error: JSON.stringify(data) });
      }
    } catch (err) {
      console.log(` ❌ ERROR — ${err.message}`);
      results.push({ role: user.role, status: 'ERROR', error: err.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('  SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.role.padEnd(10)} → ${r.status}`);
  }

  // Final count in DB
  const totalUsers = await prisma.user.count();
  console.log(`\n  Total users in DB: ${totalUsers}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
}

testAllRoles().catch(e => { console.error(e); process.exit(1); });
