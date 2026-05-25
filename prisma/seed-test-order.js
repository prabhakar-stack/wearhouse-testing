const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  let trackingId = args[0];

  if (!trackingId) {
    // Generate a default ID with a random suffix for ease of repeated testing
    const suffix = Math.floor(100 + Math.random() * 900);
    trackingId = `AWB-EXPECTED-${suffix}`;
  }

  console.log(`\n📦 SEEDING EXPECTED TEST ORDER: "${trackingId}"...`);

  // Check if manifest already exists
  const existingManifest = await prisma.manifest.findUnique({
    where: { trackingId }
  });

  if (existingManifest) {
    console.error(`❌ Error: Manifest/Order with tracking ID "${trackingId}" already exists.`);
    process.exit(1);
  }

  // Create Manifest with EXPECTED status
  const manifest = await prisma.manifest.create({
    data: {
      trackingId: trackingId,
      status: 'EXPECTED',
      marketplace: 'AMAZON',
      courierName: 'Delhivery',
      expectedDate: new Date(),
    }
  });

  // Create Order connected to Manifest
  const order = await prisma.order.create({
    data: {
      marketplace: 'AMAZON',
      platformOrderId: trackingId,
      requestDate: new Date(),
      totalAmount: 13894.00,
      fulfillmentChannel: 'FBA',
      manifestId: manifest.id,
    }
  });

  // Define unique suffix for LPNs based on trackingId (keep it alphanumeric/uppercase)
  const lpnSuffix = trackingId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-5);

  // ReturnItems payload with 4 SKUs, 2 having 2 quantities (total 6 LPNs)
  const returnItemsData = [
    // SKU 1 - 1 quantity (1 LPN)
    {
      orderId: '406-1698600-6821160',
      sku: 'CUBE-PRO-LITE',
      lpn: `LPN-${lpnSuffix}-1`,
      returnReason: 'Quality not as expected',
      itemPrice: 499.00,
      productName: 'Cubelelo Pro Lite 3x3 Speed Cube',
    },
    // SKU 2 - 1 quantity (1 LPN)
    {
      orderId: '406-1698600-6821160',
      sku: 'CUBE-DRIFT-3X3',
      lpn: `LPN-${lpnSuffix}-2`,
      returnReason: 'Performance issue',
      itemPrice: 399.00,
      productName: 'Cubelelo Drift 3x3 Magnetic Cube',
    },
    // SKU 3 - 2 quantities (2 LPNs)
    {
      orderId: '406-1698600-6821160',
      sku: 'GAN-11-PRO',
      lpn: `LPN-${lpnSuffix}-3`,
      returnReason: 'Scratched exterior',
      itemPrice: 4599.00,
      productName: 'GAN 11 M Pro UV 3x3',
    },
    {
      orderId: '406-1698600-6821160',
      sku: 'GAN-11-PRO',
      lpn: `LPN-${lpnSuffix}-4`,
      returnReason: 'Scratched exterior',
      itemPrice: 4599.00,
      productName: 'GAN 11 M Pro UV 3x3',
    },
    // SKU 4 - 2 quantities (2 LPNs)
    {
      orderId: '406-1698600-6821160',
      sku: 'MOYU-SUPER-RS3M',
      lpn: `LPN-${lpnSuffix}-5`,
      returnReason: 'Missing accessories',
      itemPrice: 1899.00,
      productName: 'MoYu Super RS3M Ball-Core',
    },
    {
      orderId: '406-1698600-6821160',
      sku: 'MOYU-SUPER-RS3M',
      lpn: `LPN-${lpnSuffix}-6`,
      returnReason: 'Defective tensioning system',
      itemPrice: 1899.00,
      productName: 'MoYu Super RS3M Ball-Core',
    }
  ];

  for (const item of returnItemsData) {
    await prisma.returnItem.create({
      data: item
    });
  }

  console.log(`\n✅ Success! Seeding completed.`);
  console.log(`-----------------------------------------------`);
  console.log(`📋 Manifest Details:`);
  console.log(`   - Tracking / Order ID: ${trackingId}`);
  console.log(`   - Marketplace: AMAZON`);
  console.log(`   - Status: EXPECTED`);
  console.log(`   - Expected Date: ${new Date().toLocaleDateString()}`);
  console.log(`\n🔍 Return Items (6 LPNs total):`);
  console.log(`   1. LPN: LPN-${lpnSuffix}-1 | SKU: CUBE-PRO-LITE`);
  console.log(`   2. LPN: LPN-${lpnSuffix}-2 | SKU: CUBE-DRIFT-3X3`);
  console.log(`   3. LPN: LPN-${lpnSuffix}-3 | SKU: GAN-11-PRO`);
  console.log(`   4. LPN: LPN-${lpnSuffix}-4 | SKU: GAN-11-PRO`);
  console.log(`   5. LPN: LPN-${lpnSuffix}-5 | SKU: MOYU-SUPER-RS3M`);
  console.log(`   6. LPN: LPN-${lpnSuffix}-6 | SKU: MOYU-SUPER-RS3M`);
  console.log(`-----------------------------------------------`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
