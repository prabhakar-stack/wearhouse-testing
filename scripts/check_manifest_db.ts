import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkDb() {
  const ids = ["52103826316"];
  console.log("=== Checking Database Records ===");
  
  for (const trackingNumber of ids) {
    console.log(`\n-------------------------------------`);
    console.log(`Tracking ID: ${trackingNumber}`);
    
    // Check ShipmentTracking
    const trackRecord = await prisma.shipmentTracking.findUnique({
      where: { trackingNumber }
    });
    if (trackRecord) {
      console.log(`[ShipmentTracking]`);
      console.log(`  - latestStatus: "${trackRecord.latestStatus}"`);
      console.log(`  - scheduledDelivery: ${trackRecord.scheduledDelivery}`);
      console.log(`  - manifestId: ${trackRecord.manifestId}`);
    } else {
      console.log(`[ShipmentTracking] No record found!`);
    }

    // Check Manifest
    const manifest = await prisma.manifest.findFirst({
      where: {
        OR: [
          { trackingId: trackingNumber },
          { id: trackRecord?.manifestId || undefined }
        ]
      }
    });

    if (manifest) {
      console.log(`[Manifest]`);
      console.log(`  - ID: ${manifest.id}`);
      console.log(`  - trackingId: ${manifest.trackingId}`);
      console.log(`  - status: ${manifest.status}`);
      console.log(`  - expectedDate: ${manifest.expectedDate}`);
    } else {
      console.log(`[Manifest] No matching manifest record found!`);
    }

    // Check AMZRemovalShipment
    const shipments = await prisma.aMZRemovalShipment.findMany({
      where: { trackingNumber }
    });
    console.log(`[AMZRemovalShipment] Count: ${shipments.length}`);
    for (const ship of shipments) {
      console.log(`  - ID: ${ship.id}`);
      console.log(`  - orderId: ${ship.orderId}`);
      console.log(`  - sku: ${ship.sku}`);
      console.log(`  - shippedQuantity: ${ship.shippedQuantity}`);
      console.log(`  - carrier: ${ship.carrier}`);
      console.log(`  - shipmentStatus: ${ship.shipmentStatus}`);
      console.log(`  - requestDate: ${ship.requestDate}`);
      console.log(`  - shipmentDate: ${ship.shipmentDate}`);
    }

    // Check Order
    const orders = await prisma.order.findMany({
      where: { trackingNumber }
    });
    console.log(`[Order] Count: ${orders.length}`);
    for (const ord of orders) {
      console.log(`  - platformOrderId: ${ord.platformOrderId}`);
      console.log(`  - trackingNumber: ${ord.trackingNumber}`);
      console.log(`  - manifestId: ${ord.manifestId}`);
    }
  }
}

checkDb().catch(console.error).finally(() => prisma.$disconnect());

