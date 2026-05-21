const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log("🚀 Starting DB Dynamic Creation Integration Tests...");

  // Generate a unique tracking AWB for testing
  const testAwb = "AWB-TEST-" + Date.now();
  console.log("👉 Generated Test AWB:", testAwb);

  // 1. Simulate Dock Receive logic for a non-existent tracking ID
  let manifest = await prisma.manifest.findUnique({
    where: { trackingId: testAwb }
  });
  console.log("🔍 Manifest pre-check (should be null):", manifest ? "Found" : "Null");

  if (!manifest) {
    manifest = await prisma.manifest.create({
      data: {
        trackingId: testAwb,
        status: 'EXPECTED',
        courierName: 'Unknown',
        expectedDate: new Date(),
      }
    });
    console.log("✅ Dynamically created Manifest:", manifest);
  }

  // 2. Simulate Upload Finalize logic for a non-existent LPN under this AWB
  const testLpn = "LPN-TEST-" + Math.floor(Math.random() * 10000);
  console.log("👉 Generated Test LPN:", testLpn);

  let returnItem = await prisma.returnItem.findUnique({
    where: {
      lpn: testLpn,
    }
  });
  console.log("🔍 ReturnItem pre-check (should be null):", returnItem ? "Found" : "Null");

  if (!returnItem) {
    const platformOrderId = testAwb;
    let order = await prisma.order.findUnique({
      where: { platformOrderId },
    });

    if (!order) {
      order = await prisma.order.create({
        data: {
          platformOrderId: platformOrderId,
          marketplace: 'AMAZON',
          purchaseDate: new Date(),
          manifestId: manifest.id,
        },
      });
      console.log("✅ Dynamically created Order:", order);
    }

    returnItem = await prisma.returnItem.create({
      data: {
        orderId: order.platformOrderId,
        sku: testLpn,
        lpn: testLpn,
        quantity: 1,
        returnReason: 'Inspected Damage',
        condition: 'PRODUCT_DAMAGED',
      },
    });
    console.log("✅ Dynamically created ReturnItem:", returnItem);
  }

  // 3. Simulate Evidence record creation
  const ev = await prisma.evidence.create({
    data: {
      lpn: testLpn,
      orderId: testAwb,
      orderDriveLink: "https://drive.google.com/mock-folder-link",
      lpnDriveLink: "https://drive.google.com/mock-file-link",
      type: "PRODUCT_DAMAGE_PHOTO",
      reason: "Verified upload flow",
      manifestId: manifest.id,
      returnItemId: returnItem.lpn,
    }
  });
  console.log("✅ Dynamically created Evidence:", ev);

  console.log("🎉 All DB Dynamic Creation tests passed successfully!");
}

test()
  .catch(error => {
    console.error("❌ Test failed:", error);
  })
  .finally(() => prisma.$disconnect());
