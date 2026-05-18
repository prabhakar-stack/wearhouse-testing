const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const superAccessEmail = process.env.SUPER_ADMIN_EMAIL || 'prabhakar16032004@gmail.com';
  
  console.log(`Checking setup for users`);

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

  const superAdmin2 = await prisma.user.upsert({
    where: { email: 'admin@cubelelo.com' },
    update: {
      role: 'SUPER_ACCESS',
    },
    create: {
      email: 'admin@cubelelo.com',
      role: 'SUPER_ACCESS',
    },
  });

  const warehouseAdmin = await prisma.user.upsert({
    where: { email: 'warehouse@cubelelo.com' },
    update: {
      role: 'ADMIN',
    },
    create: {
      email: 'warehouse@cubelelo.com',
      role: 'ADMIN',
    },
  });

  console.log('Seed completed successfully. Users created/updated!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
