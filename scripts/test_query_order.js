import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Replace with an actual platformOrderId from your data
  const orderId = 'Xq5m8x9933';
  const order = await prisma.order.findUnique({
    where: { platformOrderId: orderId },
    include: { manifest: true },
  });
  console.log('Order:', order);
}

main()
  .catch(e => {
    console.error('Error querying order:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
