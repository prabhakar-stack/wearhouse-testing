import { PrismaClient, PackageState, Marketplace } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

/**
 * Materialize Order records directly from AMZRemovalShipment data.
 * - Groups shipments by orderId.
 * - Sums shippedQuantity for each order.
 * - Creates a Manifest (if not exists) and links it via manifestId.
 * - Upserts Order with required fields and foreign key.
 */
export async function materializeOrdersFromShipments() {
  // Group shipments by orderId, capture earliest requestDate and a trackingNumber via _min aggregation
  const grouped = await prisma.aMZRemovalShipment.groupBy({
    by: ["orderId"],
    where: { orderId: { not: null } },
    _sum: { shippedQuantity: true },
    _min: { requestDate: true, trackingNumber: true },
  });

  let processed = 0;

  for (const g of grouped) {
    const orderId = g.orderId;
    if (!orderId) continue;

    // Ensure a Manifest exists for this order (idempotent)
    const manifest = await prisma.manifest.upsert({
      where: { orderId: orderId },
      update: {},
      create: {
        trackingId: randomUUID(),
        status: PackageState.PENDING,
        marketplace: Marketplace.AMAZON,
        removalOrderId: orderId,
        orderId,
      },
    });

    // Fetch a representative tracking number (earliest requestDate)
    const shipment = await prisma.aMZRemovalShipment.findFirst({
      where: { orderId, trackingNumber: { not: null } },
      orderBy: { requestDate: 'asc' },
    });
    const trackingNumber = shipment?.trackingNumber ?? null;

    // Upsert Order and link to Manifest
    await prisma.order.upsert({
      where: { platformOrderId: orderId },
      update: {
        marketplace: Marketplace.AMAZON,
        requestDate: g._min?.requestDate,
        totalQuantity: g._sum?.shippedQuantity ?? undefined,
        trackingNumber,
        fulfillmentId: orderId,
        manifestId: manifest.id,
      },
      create: {
        marketplace: Marketplace.AMAZON,
        platformOrderId: orderId,
        requestDate: g._min?.requestDate,
        totalQuantity: g._sum?.shippedQuantity ?? undefined,
        trackingNumber,
        fulfillmentId: orderId,
        manifestId: manifest.id,
      },
    });

    processed++;
  }

  console.log(`🛒 materializeOrdersFromShipments processed ${processed} orders`);
}

// If run directly
if (process.argv[1] === import.meta.url.replace("file://", "")) {
  materializeOrdersFromShipments()
    .catch((e) => console.error("❌ Error:", e))
    .finally(() => prisma.$disconnect());
}
