const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected successfully!');

    const manifestCount = await prisma.manifest.count();
    console.log('Total manifests:', manifestCount);

    const manifests = await prisma.manifest.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Recent manifests:', JSON.stringify(manifests, null, 2));

    const returnItemCount = await prisma.returnItem.count();
    console.log('Total return items:', returnItemCount);

    const returnItems = await prisma.returnItem.findMany({
      take: 5,
      select: { lpn: true, orderId: true, sku: true }
    });
    console.log('Recent return items:', JSON.stringify(returnItems, null, 2));

    const evidenceCount = await prisma.evidence.count();
    console.log('Total evidence records:', evidenceCount);

    const disputeCount = await prisma.dispute.count();
    console.log('Total disputes:', disputeCount);

  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
