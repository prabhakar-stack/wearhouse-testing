import { PrismaClient, PackageState, Marketplace } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Materialize Order & Manifest records directly from AMZRemovalShipment data.
 * groups shipments by trackingNumber (tracking-first box architecture).
 * links removalOrderId as metadata on Manifest.
 */
export async function materializeOrdersFromShipments() {
  console.log("Staging shipments to Manifest & Order (tracking-first)...");
  const rawShipments = await prisma.aMZRemovalShipment.findMany();

  // Group by trackingNumber
  const shipmentsByTrackingId = {};
  for (const item of rawShipments) {
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
    await prisma.manifest.upsert({
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
  }

  console.log(`🛒 materializeOrdersFromShipments processed ${processed} tracking IDs`);
}

// If run directly
if (process.argv[1] === import.meta.url.replace("file://", "")) {
  materializeOrdersFromShipments()
    .catch((e) => console.error("❌ Error:", e))
    .finally(() => prisma.$disconnect());
}
