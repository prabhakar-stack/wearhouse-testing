const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const order = await prisma.order.findUnique({ where: { platformOrderId: 'Xq5m8x9933' } });
  console.log('Removal Order Xq5m8x9933:', order);
  const total = await prisma.order.count();
  console.log('Total orders:', total);
  const withTotalAmt = await prisma.order.count({ where: { totalAmount: { not: null } } });
  console.log('Orders with totalAmount populated:', withTotalAmt);
}
main().finally(() => prisma.$disconnect());
