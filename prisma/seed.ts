import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Cubelelo Returns Management Support Data...');

  // 1. Create required baseline users
  await prisma.user.upsert({
    where: { email: 'receiver@cubelelo.com' },
    update: {},
    create: {
      email: 'receiver@cubelelo.com',
      role: 'RECEIVER',
      name: 'Receiver User',
    },
  });

  await prisma.user.upsert({
    where: { email: 'inspector@cubelelo.com' },
    update: {},
    create: {
      email: 'inspector@cubelelo.com',
      role: 'INSPECTOR',
      name: 'Inspector User',
    },
  });

  await prisma.user.upsert({
    where: { email: 'superaccess@cubelelo.com' },
    update: {},
    create: {
      email: 'superaccess@cubelelo.com',
      role: 'SUPER_ACCESS',
      name: 'Super Access User',
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@cubelelo.com' },
    update: {},
    create: {
      email: 'admin@cubelelo.com',
      role: 'ADMIN',
      name: 'Admin User',
    },
  });

  await prisma.user.upsert({
    where: { email: 'prabhakar16032004@gmail.com' },
    update: {},
    create: {
      email: 'prabhakar16032004@gmail.com',
      role: 'SUPER_ACCESS',
      name: 'Prabhakar SuperAdmin',
    },
  });

  // 2. Clear old data that might conflict
  await prisma.evidence.deleteMany();
  await prisma.reimbursement.deleteMany();
  await prisma.returnItem.deleteMany();
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
      requestDate: new Date(),
      totalAmount: 13894.00, // Sum of 499 + 399 + (4599*2) + (1899*2)
      fulfillmentChannel: 'FBA',
      manifestId: manifestMulti.id,
      trackingNumber: '52103257345',
    }
  });

  // Create 6 ReturnItems (LPNs)
  await prisma.returnItem.create({
    data: {
      sku: 'CUBE-PRO-LITE',
      lpn: 'LPN-MULTI-001',
      reason: 'Quality not as expected',
      productName: 'Cubelelo Pro Lite 3x3 Speed Cube',
    }
  });

  await prisma.returnItem.create({
    data: {
      sku: 'CUBE-DRIFT-3X3',
      lpn: 'LPN-MULTI-002',
      reason: 'Performance issue',
      productName: 'Cubelelo Drift 3x3 Magnetic Cube',
    }
  });

  // GAN-11-PRO (2 units -> 2 distinct LPNs)
  await prisma.returnItem.create({
    data: {
      sku: 'GAN-11-PRO',
      lpn: 'LPN-MULTI-003',
      reason: 'Scratched exterior',
      productName: 'GAN 11 M Pro UV 3x3',
    }
  });

  await prisma.returnItem.create({
    data: {
      sku: 'GAN-11-PRO',
      lpn: 'LPN-MULTI-004',
      reason: 'Scratched exterior',
      productName: 'GAN 11 M Pro UV 3x3',
    }
  });

  // MOYU-SUPER-RS3M (2 units -> 2 distinct LPNs)
  await prisma.returnItem.create({
    data: {
      sku: 'MOYU-SUPER-RS3M',
      lpn: 'LPN-MULTI-005',
      reason: 'Missing accessories',
      productName: 'MoYu Super RS3M Ball-Core',
    }
  });

  await prisma.returnItem.create({
    data: {
      sku: 'MOYU-SUPER-RS3M',
      lpn: 'LPN-MULTI-006',
      reason: 'Defective tensioning system',
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
