import { PrismaClient, PackageState, Marketplace } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching removal shipments...");
  const shipments = await prisma.aMZRemovalShipment.findMany({
    where: { orderId: { not: null } }
  });

  console.log(`Found ${shipments.length} shipments. Grouping by tracking number...`);

  // Group by trackingNumber
  const shipmentsByTrackingId = {};
  for (const item of shipments) {
    if (!item.trackingNumber) continue;
    if (!shipmentsByTrackingId[item.trackingNumber]) {
      shipmentsByTrackingId[item.trackingNumber] = [];
    }
    shipmentsByTrackingId[item.trackingNumber].push(item);
  }

  let processed = 0;
  for (const [trackingNumber, group] of Object.entries(shipmentsByTrackingId)) {
    const orderId = group[0]?.orderId || null;
    const totalQuantity = group.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);
    const firstItem = group[0];

    // Create or update Manifest keyed by trackingNumber (idempotent unique key)
    const manifest = await prisma.manifest.upsert({
      where: { trackingId: trackingNumber },
      update: {
        marketplace: Marketplace.AMAZON,
        removalOrderId: orderId || null,
      },
      create: {
        trackingId: trackingNumber,
        status: PackageState.EXPECTED,
        marketplace: Marketplace.AMAZON,
        removalOrderId: orderId || null,
        expectedDate: null,
      },
    });

    // Upsert Order (independent metadata lookup table)
    if (orderId) {
      await prisma.order.upsert({
        where: { platformOrderId: orderId },
        update: {
          marketplace: Marketplace.AMAZON,
          requestDate: firstItem.requestDate,
          totalQuantity: totalQuantity,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
        create: {
          marketplace: Marketplace.AMAZON,
          platformOrderId: orderId,
          requestDate: firstItem.requestDate,
          totalQuantity: totalQuantity,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
      });
    }

    processed++;
    console.log(`Processed Manifest trackingId=${trackingNumber} (Order=${orderId})`);
  }
  console.log(`All ${processed} orders and manifests successfully populated.`);
}

main()
  .catch((e) => {
    console.error('Error generating orders:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
