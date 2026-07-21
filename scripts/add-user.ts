import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const role = process.argv[3] || 'ADMIN';
  const name = process.argv[4] || null;

  if (!email) {
    console.error('Usage: npx tsx scripts/add-user.ts <email> [role] [name]');
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role: role as any },
    create: { email: email.toLowerCase(), role: role as any, name },
  });

  console.log(`User ${user.email} — role: ${user.role}, id: ${user.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
