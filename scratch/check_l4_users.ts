import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, alertLevel: true }
  });
  console.log("All Users:", users);
  
  const alertLevels = ['L4'];
  const l4Users = await prisma.user.findMany({
    where: {
      alertLevel: { in: alertLevels as any }
    },
    select: { email: true, role: true, alertLevel: true }
  });
  
  console.log("Users targeted by { alertLevel: { in: ['L4'] } }:", l4Users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
