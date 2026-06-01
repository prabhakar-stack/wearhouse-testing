import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Step 1: AMZRemovalShipment → Order
//   Group by orderId, sum shippedQuantity, pick first trackingNumber/carrier
// ─────────────────────────────────────────────────────────────────────────────

async function materializeOrders() {
  const shipments = await prisma.aMZRemovalShipment.findMany();

  // Group all rows by orderId
  const groups = new Map();
  for (const row of shipments) {
    if (!row.orderId) continue;
    if (!groups.has(row.orderId)) groups.set(row.orderId, []);
    groups.get(row.orderId).push(row);
  }

  let count = 0;
  for (const [orderId, rows] of groups) {
    const totalQuantity = rows.reduce((sum, r) => sum + (r.shippedQuantity ?? 0), 0);
    const requestDate   = rows.find((r) => r.requestDate)?.requestDate ?? null;
    const trackingNumber = rows.map((r) => r.trackingNumber).find(Boolean) ?? null;

    try {
      await prisma.order.upsert({
        where:  { platformOrderId: orderId },
        update: { marketplace: "AMAZON", requestDate, totalQuantity, trackingNumber, totalAmount: null, fulfillmentChannel: null },
        create: { platformOrderId: orderId, marketplace: "AMAZON", requestDate, totalQuantity, trackingNumber, totalAmount: null, fulfillmentChannel: null },
      });
      count++;
    } catch (e) {
      console.error(`[ERROR] Order ${orderId}:`, e.message);
    }
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2: Order → Manifest
//   One manifest per Order that has a trackingNumber
// ─────────────────────────────────────────────────────────────────────────────

async function materializeManifests() {
  const orders = await prisma.order.findMany({
    where: { marketplace: "AMAZON", trackingNumber: { not: null } },
  });

  let count = 0;
  for (const order of orders) {
    const { platformOrderId, trackingNumber, requestDate } = order;

    const shipment = await prisma.aMZRemovalShipment.findFirst({
      where:  { orderId: platformOrderId, trackingNumber },
      select: { shipmentDate: true },
    });
    const expectedDate = shipment?.shipmentDate ?? null;

    try {
      const manifest = await prisma.manifest.upsert({
        where:  { trackingId: trackingNumber },
        update: { orderId: platformOrderId, removalOrderId: platformOrderId, marketplace: "AMAZON", expectedDate },
        create: { trackingId: trackingNumber, orderId: platformOrderId, removalOrderId: platformOrderId, marketplace: "AMAZON", status: "IN_TRANSIT", expectedDate },
      });

      // Link Order → Manifest
      await prisma.order.update({
        where: { platformOrderId },
        data:  { manifestId: manifest.id },
      });
      count++;
    } catch (e) {
      console.error(`[ERROR] Manifest for order ${platformOrderId}:`, e.message);
    }
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3: AMZCustomerReturn → ReturnItem
//   One row per LPN (license plate number)
// ─────────────────────────────────────────────────────────────────────────────

async function materializeReturnItems() {
  const returns = await prisma.aMZCustomerReturn.findMany();

  let count = 0;
  for (const row of returns) {
    const lpn = row.lpn;
    if (!lpn) continue;

    const data = {
      orderId:             row.orderId,
      sku:                 row.sku,
      asin:                row.asin,
      fnsku:               row.fnsku,
      productName:         row.productName,
      quantity:            row.quantity,
      fulfillmentCenterId: row.fulfillmentCenterId,
      detailedDisposition: row.detailedDisposition,
      reason:              row.reason,
      customerComments:    row.customerComments,
      removalOrderType:    row.removalOrderType,
      returnDate:          row.returnDate,
      marketplace:         "amazon",
    };

    try {
      await prisma.returnItem.upsert({
        where:  { lpn },
        update: data,
        create: { lpn, ...data },
      });
      count++;
    } catch (e) {
      console.error(`[ERROR] ReturnItem lpn=${lpn}:`, e.message);
    }
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔄 Step 1: AMZRemovalShipment → Order");
  const orderCount = await materializeOrders();
  console.log(`  ✅ Orders upserted: ${orderCount}`);

  console.log("🔄 Step 2: Order → Manifest");
  const manifestCount = await materializeManifests();
  console.log(`  ✅ Manifests upserted: ${manifestCount}`);

  console.log("🔄 Step 3: AMZCustomerReturn → ReturnItem");
  const returnItemCount = await materializeReturnItems();
  console.log(`  ✅ ReturnItems upserted: ${returnItemCount}`);

  console.log("\n✅ Materialization complete.");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => { await prisma.$disconnect().catch(() => {}); });
