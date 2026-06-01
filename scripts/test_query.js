import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const order = await prisma.order.findFirst({ include: { removalOrder: true } });
  console.log('Fetched order with removal data:', order);
  const total = await prisma.order.count();
  console.log('Total orders:', total);
  const withTotalAmt = await prisma.order.count({ where: { totalAmount: { not: null } } });
  console.log('Orders with totalAmount populated:', withTotalAmt);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
