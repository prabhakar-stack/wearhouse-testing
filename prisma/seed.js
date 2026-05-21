const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.evidence.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.manifest.deleteMany();

  // Create Manifest
  const manifest = await prisma.manifest.create({
    data: {
      trackingId: 'TRK123',
      status: 'IN_INSPECTION',
      marketplace: 'AMAZON',
      handshakes: { create: [] },
    },
  });

  // Create Order linked to Manifest
  const order = await prisma.order.create({
    data: {
      platformOrderId: 'ORD001',
      purchaseDate: new Date('2024-01-01'),
      marketplace: 'AMAZON',
      // Connect to manifest via relation field
      manifest: { connect: { id: manifest.id } },
      returnItems: { create: [] },
    },
  });

  // Create ReturnItems (LPN wise)
  await prisma.returnItem.createMany({
    data: [
      {
        lpn: 'LPN001',
        sku: 'SKU-A',
        orderId: order.platformOrderId,
        quantity: 1,
        returnReason: 'Damaged',
        condition: null,
      },
      {
        lpn: 'LPN002',
        sku: 'SKU-B',
        orderId: order.platformOrderId,
        quantity: 2,
        returnReason: 'Wrong Item',
        condition: null,
      },
    ],
  });

  console.log('Seed data inserted');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
