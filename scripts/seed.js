// scripts/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // SUPER_ACCESS origin user email defined in the PRD
  const superAccessEmail = process.env.SUPER_ADMIN_EMAIL || 'prabhakar16032004@gmail.com';
  
  console.log(`Checking setup for SUPER_ACCESS user: ${superAccessEmail}`);

  const user = await prisma.user.upsert({
    where: { email: superAccessEmail },
    update: {
      role: 'SUPER_ACCESS',
    },
    create: {
      email: superAccessEmail,
      role: 'SUPER_ACCESS',
    },
  });

  console.log('Seed completed successfully. Origin Super Admin:', user);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
