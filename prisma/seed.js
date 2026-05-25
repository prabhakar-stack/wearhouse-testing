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
    },
  });

  // Create Order linked to Manifest
  const order = await prisma.order.create({
    data: {
      platformOrderId: 'ORD001',
      requestDate: new Date('2024-01-01'),
      marketplace: 'AMAZON',
      manifest: { connect: { id: manifest.id } },
    },
  });

  // Create ReturnItems (LPN wise)
  await prisma.returnItem.create({
    data: {
      lpn: 'LPN001',
      sku: 'SKU-A',
      orderId: 'CUST-ORD-001',
      returnReason: 'Damaged',
      condition: null,
    },
  });

  await prisma.returnItem.create({
    data: {
      lpn: 'LPN002',
      sku: 'SKU-B',
      orderId: 'CUST-ORD-001',
      returnReason: 'Wrong Item',
      condition: null,
    },
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
