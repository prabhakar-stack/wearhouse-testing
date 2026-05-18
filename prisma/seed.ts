import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Cubelelo Returns Management Support Data...');

  // 1. Create a SUPER_ACCESS user and other required users
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@cubelelo.com' },
    update: {},
    create: {
      email: 'admin@cubelelo.com',
      role: 'SUPER_ACCESS',
    },
  });

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
  await prisma.reimbursement.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.handshake.deleteMany();
  await prisma.manifest.deleteMany();
  await prisma.order.deleteMany();
  await prisma.removalShipment.deleteMany();

  // 3. Create dummy data for 2 Orders (1 Amazon, 1 Shopify)
  const orderAmazon = await prisma.order.create({
    data: {
      marketplace: 'AMAZON',
      platformOrderId: '407-1234567-8901234',
      purchaseDate: new Date(Date.now() - 10 * 24 * 3600 * 1000), // 10 days ago
      customerName: 'Rahul Kumar',
      totalAmount: 2599.00,
    }
  });

  const orderShopify = await prisma.order.create({
    data: {
      marketplace: 'SHOPIFY',
      platformOrderId: 'CUB-98765',
      purchaseDate: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
      customerName: 'Priya Sharma',
      totalAmount: 899.00,
    }
  });

  // 4. Create a Manifest and link it to ReturnItem using real Cubelelo speedcube SKUs
  const manifestAmazon = await prisma.manifest.create({
    data: {
      trackingAwb: 'AWB-AMZ-001',
      status: 'AT_DOCK',
      courierName: 'Delhivery',
      expectedDate: new Date(Date.now() - 1 * 24 * 3600 * 1000),
      receivedAt: new Date(),
    }
  });

  const manifestShopify = await prisma.manifest.create({
    data: {
      trackingAwb: 'AWB-SHP-002',
      status: 'EXPECTED',
      courierName: 'BlueDart',
      expectedDate: new Date(Date.now() + 1 * 24 * 3600 * 1000),
    }
  });

  // ReturnItem for Amazon Order linked to ManifestAmazon
  await prisma.returnItem.create({
    data: {
      orderId: orderAmazon.id,
      manifestId: manifestAmazon.id,
      sku: 'GAN-13-MAGLEV-UV',
      lpn: 'LPN-AMZ-9991',
      quantity: 1,
      returnReason: 'Defective/Does not work properly',
      customerComments: 'Magnets are loose inside the pieces',
      condition: 'PRODUCT_DAMAGED'
    }
  });

  // ReturnItem for Shopify Order linked to ManifestShopify
  await prisma.returnItem.create({
    data: {
      orderId: orderShopify.id,
      manifestId: manifestShopify.id,
      sku: 'MOYU-RS3M-2020',
      quantity: 2,
      returnReason: 'No longer needed',
      customerComments: 'Ordered by mistake',
    }
  });

  // 5. Create a Handshake for the AT_DOCK manifest
  await prisma.handshake.create({
    data: {
      manifestId: manifestAmazon.id,
      receiverId: receiver.id,
      type: 'COURIER_TO_RECEIVER',
      timestamp: new Date()
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
