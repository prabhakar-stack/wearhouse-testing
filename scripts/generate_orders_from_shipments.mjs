import { PrismaClient, PackageState } from '@prisma/client';
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  // Group shipments by orderId, summing shippedQuantity and picking earliest requestDate & first trackingNumber
  const grouped = await prisma.aMZRemovalShipment.groupBy({
    by: ['orderId'],
    where: { orderId: { not: null } },
    _sum: { shippedQuantity: true },
    _min: { requestDate: true },
    _first: { trackingNumber: true },
  });

  for (const g of grouped) {
    const orderId = g.orderId;
    if (!orderId) continue;

    // Upsert a Manifest for this order (ensures idempotency)
    const manifest = await prisma.manifest.upsert({
      where: { removalOrderId: orderId },
      update: {},
      create: {
        trackingId: randomUUID(),
        status: PackageState.PENDING, // adjust if you have a different enum member
        removalOrderId: orderId,
      },
    });

    // Upsert the Order and link it to the Manifest
    await prisma.order.upsert({
      where: { platformOrderId: orderId },
      update: {
        requestDate: g._min?.requestDate,
        totalQuantity: g._sum?.shippedQuantity ?? undefined,
        trackingNumber: g._first?.trackingNumber,
        fulfillmentId: orderId,
        manifestId: manifest.id,
      },
      create: {
        platformOrderId: orderId,
        requestDate: g._min?.requestDate,
        totalQuantity: g._sum?.shippedQuantity ?? undefined,
        trackingNumber: g._first?.trackingNumber,
        fulfillmentId: orderId,
        manifestId: manifest.id,
      },
    });
    console.log(`Processed Order ${orderId}`);
  }
}

main()
  .catch((e) => {
    console.error('Error generating orders:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
