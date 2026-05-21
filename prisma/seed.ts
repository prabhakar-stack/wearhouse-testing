import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Cubelelo Returns Management Support Data...');

  // 1. Create required baseline users (SUPER_ACCESS and ADMIN are managed manually, not auto-seeded)
  const receiver = await prisma.user.upsert({
    where: { email: 'receiver@cubelelo.com' },
    update: {},
    create: {
      email: 'receiver@cubelelo.com',
      role: 'RECEIVER',
    },
  });

  const inspector = await prisma.user.upsert({
    where: { email: 'inspector@cubelelo.com' },
    update: {},
    create: {
      email: 'inspector@cubelelo.com',
      role: 'INSPECTOR',
    },
  });

  // 2. Clear old data that might conflict
  await prisma.evidence.deleteMany();
  await prisma.reimbursement.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.handshake.deleteMany();
  await prisma.manifest.deleteMany();
  await prisma.order.deleteMany();

  // 3. Create Multi-Item expected Manifest for receiver and inspector evaluation
  const multiTrackingId = 'AWB-MULTI-ITEM-777';
  const manifestMulti = await prisma.manifest.create({
    data: {
      trackingId: multiTrackingId,
      status: 'EXPECTED',
      marketplace: 'AMAZON',
      courierName: 'Delhivery',
      expectedDate: new Date(),
    }
  });

  // Create 1 single order representing the compressed platformOrderId
  const order = await prisma.order.create({
    data: {
      marketplace: 'AMAZON',
      platformOrderId: multiTrackingId,
      purchaseDate: new Date(),
      customerName: 'Aarav Mehta',
      totalAmount: 13894.00, // Sum of 499 + 399 + (4599*2) + (1899*2)
      fulfillmentChannel: 'FBA',
      manifestId: manifestMulti.id,
    }
  });

  // Create 6 ReturnItems (LPNs) associated with this Order
  await prisma.returnItem.create({
    data: {
      orderId: order.platformOrderId,
      sku: 'CUBE-PRO-LITE',
      lpn: 'LPN-MULTI-001',
      quantity: 1,
      returnReason: 'Quality not as expected',
      itemPrice: 499.00,
      productName: 'Cubelelo Pro Lite 3x3 Speed Cube',
    }
  });

  await prisma.returnItem.create({
    data: {
      orderId: order.platformOrderId,
      sku: 'CUBE-DRIFT-3X3',
      lpn: 'LPN-MULTI-002',
      quantity: 1,
      returnReason: 'Performance issue',
      itemPrice: 399.00,
      productName: 'Cubelelo Drift 3x3 Magnetic Cube',
    }
  });

  // GAN-11-PRO (2 units -> 2 distinct LPNs)
  await prisma.returnItem.create({
    data: {
      orderId: order.platformOrderId,
      sku: 'GAN-11-PRO',
      lpn: 'LPN-MULTI-003',
      quantity: 1,
      returnReason: 'Scratched exterior',
      itemPrice: 4599.00,
      productName: 'GAN 11 M Pro UV 3x3',
    }
  });

  await prisma.returnItem.create({
    data: {
      orderId: order.platformOrderId,
      sku: 'GAN-11-PRO',
      lpn: 'LPN-MULTI-004',
      quantity: 1,
      returnReason: 'Scratched exterior',
      itemPrice: 4599.00,
      productName: 'GAN 11 M Pro UV 3x3',
    }
  });

  // MOYU-SUPER-RS3M (2 units -> 2 distinct LPNs)
  await prisma.returnItem.create({
    data: {
      orderId: order.platformOrderId,
      sku: 'MOYU-SUPER-RS3M',
      lpn: 'LPN-MULTI-005',
      quantity: 1,
      returnReason: 'Missing accessories',
      itemPrice: 1899.00,
      productName: 'MoYu Super RS3M Ball-Core',
    }
  });

  await prisma.returnItem.create({
    data: {
      orderId: order.platformOrderId,
      sku: 'MOYU-SUPER-RS3M',
      lpn: 'LPN-MULTI-006',
      quantity: 1,
      returnReason: 'Defective tensioning system',
      itemPrice: 1899.00,
      productName: 'MoYu Super RS3M Ball-Core',
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
