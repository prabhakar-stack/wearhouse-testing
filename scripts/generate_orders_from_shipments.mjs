import { PrismaClient, PackageState } from '@prisma/client';
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Fetching removal shipments...");
  const shipments = await prisma.aMZRemovalShipment.findMany({
    where: { orderId: { not: null } }
  });

  console.log(`Found ${shipments.length} shipments. Grouping by order ID...`);

  // Group in memory
  const grouped = {};
  for (const s of shipments) {
    const orderId = s.orderId;
    if (!orderId) continue;
    if (!grouped[orderId]) {
      grouped[orderId] = {
        orderId,
        shippedQuantity: 0,
        requestDate: null,
        trackingNumber: null,
      };
    }
    
    grouped[orderId].shippedQuantity += s.shippedQuantity ?? 0;
    
    if (s.requestDate) {
      const sDate = new Date(s.requestDate);
      if (!grouped[orderId].requestDate || sDate < grouped[orderId].requestDate) {
        grouped[orderId].requestDate = sDate;
      }
    }
    
    if (!grouped[orderId].trackingNumber && s.trackingNumber) {
      grouped[orderId].trackingNumber = s.trackingNumber;
    }
  }

  const groupedArray = Object.values(grouped);
  console.log(`Grouped into ${groupedArray.length} unique orders. Processing...`);

  for (const g of groupedArray) {
    const orderId = g.orderId;

    // Check if manifest already exists for this removalOrderId
    let manifest = await prisma.manifest.findFirst({
      where: { removalOrderId: orderId }
    });

    if (!manifest) {
      // Find a tracking ID, fallback to random UUID if none
      const trackingId = g.trackingNumber || randomUUID();

      // Check if trackingId is already used to avoid unique constraint violations
      let existingManifestWithTracking = await prisma.manifest.findUnique({
        where: { trackingId }
      });

      if (existingManifestWithTracking) {
        manifest = existingManifestWithTracking;
        // Optionally update it to link the removalOrderId
        if (!manifest.removalOrderId) {
          manifest = await prisma.manifest.update({
            where: { id: manifest.id },
            data: { removalOrderId: orderId }
          });
        }
      } else {
        manifest = await prisma.manifest.create({
          data: {
            trackingId,
            status: PackageState.EXPECTED,
            removalOrderId: orderId,
          },
        });
      }
    }

    // Upsert the Order and link it to the Manifest
    await prisma.order.upsert({
      where: { platformOrderId: orderId },
      update: {
        requestDate: g.requestDate,
        totalQuantity: g.shippedQuantity || undefined,
        trackingNumber: g.trackingNumber,
        fulfillmentId: orderId,
        manifestId: manifest.id,
      },
      create: {
        platformOrderId: orderId,
        marketplace: "AMAZON",
        requestDate: g.requestDate,
        totalQuantity: g.shippedQuantity || undefined,
        trackingNumber: g.trackingNumber,
        fulfillmentId: orderId,
        manifestId: manifest.id,
      },
    });

    console.log(`Processed Order ${orderId}`);
  }
  console.log("All orders and manifests successfully populated.");
}

main()
  .catch((e) => {
    console.error('Error generating orders:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
