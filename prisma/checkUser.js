const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany();
  console.log('ALL USERS IN DATABASE:');
  users.forEach(function(u) {
    console.log(JSON.stringify(u, null, 2));
  });
}

main()
  .catch(function(e) { console.error(e); process.exit(1); })
  .finally(function() { p.$disconnect(); });

