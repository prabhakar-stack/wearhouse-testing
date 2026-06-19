import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { main as repopulateMain } from "./repopulate_incremental.js";

// Scripts bypass the PgBouncer session-mode pooler (pool_size=15) by preferring
// DIRECT_URL, which connects straight to Postgres and has no session-mode cap.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const CHUNK = 10;

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function syncRemovalShipmentsToOrders() {
  console.log("Syncing Removal Shipments from Staging table (AMZ_removal_shipments) to operational Order & Manifest tables (tracking-first)...");
  const rawShipments = await prisma.aMZRemovalShipment.findMany();

  const shipmentsByTrackingId = {};
  const skippedNoTracking = [];

  for (const item of rawShipments) {
    if (!item.trackingNumber) {
      skippedNoTracking.push(item);
      continue;
    }
    if (!shipmentsByTrackingId[item.trackingNumber]) {
      shipmentsByTrackingId[item.trackingNumber] = [];
    }
    shipmentsByTrackingId[item.trackingNumber].push(item);
  }

  if (skippedNoTracking.length > 0) {
    console.warn(`[WARN] ${skippedNoTracking.length} shipment row(s) have no trackingNumber — skipping manifest creation for these.`);
  }

  const allTrackingNumbers = Object.keys(shipmentsByTrackingId);

  // Pre-fetch all manifests in one batch query instead of N individual lookups
  // Orders use upsert internally, so no pre-fetch needed for them
  const existingManifests = await prisma.manifest.findMany({
    where: { trackingId: { in: allTrackingNumbers } },
    select: { id: true, trackingId: true },
  });
  const manifestMap = new Map(existingManifests.map(m => [m.trackingId, m]));

  let successCount = 0;
  const entries = Object.entries(shipmentsByTrackingId);

  for (const chunk of chunkArray(entries, CHUNK)) {
    const results = await Promise.allSettled(chunk.map(async ([trackingNumber, group]) => {
      const orderId = group[0]?.orderId || null;
      const totalQuantity = group.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);
      const firstItem = group[0];
      const orderMarketplace = "AMAZON";

      if (manifestMap.has(trackingNumber)) {
        await prisma.manifest.update({
          where: { trackingId: trackingNumber },
          data: {
            marketplace: orderMarketplace,
            ...(orderId ? { removalOrderId: orderId } : {}),
          },
        });
      } else {
        const created = await prisma.manifest.create({
          data: {
            trackingId: trackingNumber,
            status: "IN_TRANSIT",
            marketplace: orderMarketplace,
            removalOrderId: orderId || null,
            expectedDate: null,
          },
        });
        manifestMap.set(trackingNumber, created);
        console.log(`[MANIFEST CREATED] trackingId=${trackingNumber} orderId=${orderId}`);
      }

      if (orderId) {
        await prisma.order.upsert({
          where: { platformOrderId: orderId },
          update: {
            marketplace: orderMarketplace,
            requestDate: firstItem.requestDate,
            totalAmount: null,
            totalQuantity: totalQuantity,
            fulfillmentChannel: "AMAZON_REMOVAL",
          },
          create: {
            marketplace: orderMarketplace,
            platformOrderId: orderId,
            requestDate: firstItem.requestDate,
            totalAmount: null,
            totalQuantity: totalQuantity,
            fulfillmentChannel: "AMAZON_REMOVAL",
          },
        });
      }
    }));

    for (const r of results) {
      if (r.status === "fulfilled") successCount++;
      else console.error(`[ERROR] Failed to sync Manifest & Order:`, r.reason?.message);
    }
  }

  console.log(`Successfully synced ${successCount}/${allTrackingNumbers.length} unique tracking IDs to Manifest & Order tables.`);
  if (skippedNoTracking.length > 0) {
    console.log(`[INFO] ${skippedNoTracking.length} shipment rows skipped (no tracking number). These will surface as ORDER_NO_TRACKING_ID alerts.`);
  }
  return successCount;
}

async function syncCustomerReturns() {
  console.log("Syncing Customer Returns from Staging table (AMZ_customer_returns) to operational ReturnItem table...");
  const rawReturns = await prisma.aMZCustomerReturn.findMany();
  const validReturns = rawReturns.filter(item => !!item.lpn);
  let successCount = 0;
  const syncedLpns = [];

  for (const chunk of chunkArray(validReturns, CHUNK)) {
    const results = await Promise.allSettled(chunk.map(async (item) => {
      await prisma.returnItem.upsert({
        where: { lpn: item.lpn },
        update: {
          orderId: item.orderId,
          sku: item.sku || null,
          asin: item.asin,
          fnsku: item.fnsku,
          productName: item.productName,
          returnDate: item.returnDate,
          fulfillmentCenterId: item.fulfillmentCenterId,
          reason: item.reason || "Unknown",
          customerComments: item.customerComments,
          detailedDisposition: item.detailedDisposition,
        },
        create: {
          orderId: item.orderId,
          sku: item.sku || null,
          lpn: item.lpn,
          asin: item.asin,
          fnsku: item.fnsku,
          productName: item.productName,
          returnDate: item.returnDate,
          fulfillmentCenterId: item.fulfillmentCenterId,
          reason: item.reason || "Unknown",
          customerComments: item.customerComments,
          detailedDisposition: item.detailedDisposition,
        },
      });
      return item.lpn;
    }));

    for (const r of results) {
      if (r.status === "fulfilled") {
        successCount++;
        syncedLpns.push(r.value);
      } else {
        console.error(`[ERROR] Failed to upsert Core Return:`, r.reason?.message);
      }
    }
  }

  // Delete all successfully synced staging rows in one batch — keeps the table small
  if (syncedLpns.length > 0) {
    await prisma.aMZCustomerReturn.deleteMany({ where: { lpn: { in: syncedLpns } } });
    console.log(`[CLEANUP] Removed ${syncedLpns.length} synced rows from AMZCustomerReturn staging table.`);
  }

  console.log(`Successfully synced ${successCount}/${validReturns.length} Customer Returns to Core Tables.`);
  return successCount;
}

async function syncReimbursements() {
  console.log("Syncing Reimbursements from Staging table (AMZ_reimbursements) to operational Tables...");
  const rawReimbursements = await prisma.aMZReimbursement.findMany();
  const validReimbursements = rawReimbursements.filter(item => !!item.reimbursementId);

  // Pre-load ALL existing reimbursements once — eliminates 2x findUnique per row (was 3 round-trips/row, now 0)
  const allExisting = await prisma.reimbursement.findMany({
    select: { id: true, platformReimbursementId: true, returnItemId: true },
  });
  const byPlatformId = new Map(allExisting.map(r => [r.platformReimbursementId, r]));
  const byReturnItemId = new Map(allExisting.map(r => [r.returnItemId, r]));

  let successCount = 0;

  for (const chunk of chunkArray(validReimbursements, CHUNK)) {
    const results = await Promise.allSettled(chunk.map(async (item) => {
      const reimbursementData = {
        returnItemId: item.reimbursementId,
        platformReimbursementId: item.reimbursementId,
        amountReimbursed: item.amountTotal || item.amountPerUnit || 0,
        currency: item.currencyUnit || "INR",
        reimbursementReason: item.reason || item.originalReimbursementType,
        status: item.condition || "DONE",
        filedAt: item.approvalDate,
        resolvedAt: item.approvalDate,
      };

      const reimbByPlatformId = byPlatformId.get(item.reimbursementId) ?? null;
      const reimbByReturnItem = byReturnItemId.get(item.reimbursementId) ?? null;

      if (reimbByPlatformId && reimbByReturnItem && reimbByPlatformId.id !== reimbByReturnItem.id) {
        console.log(`[WARN] Skipping core reimbursement row with conflicting keys: reimbursementId=${item.reimbursementId}`);
        return;
      }

      const existingReimbursement = reimbByPlatformId || reimbByReturnItem;

      if (existingReimbursement) {
        await prisma.reimbursement.update({
          where: { id: existingReimbursement.id },
          data: reimbursementData,
        });
      } else {
        const created = await prisma.reimbursement.create({ data: reimbursementData });
        byPlatformId.set(item.reimbursementId, created);
        byReturnItemId.set(item.reimbursementId, created);
      }
    }));

    for (const r of results) {
      if (r.status === "fulfilled") successCount++;
      else console.error(`[ERROR] Failed to sync Core Reimbursement:`, r.reason?.message);
    }
  }
  console.log(`Successfully synced ${successCount}/${validReimbursements.length} Reimbursements to Core Tables.`);
  return successCount;
}

async function main() {
  console.log("STARTING AMAZON STAGING-TO-CORE SYNCHRONIZATION...");

  // 1. Sync Removal Shipments to Orders & Manifests
  const syncedOrders = await syncRemovalShipmentsToOrders();

  // 2. Sync Customer Returns to ReturnItems
  const syncedCustomerReturns = await syncCustomerReturns();

  // 3. Sync Reimbursements to operational Reimbursements & ReturnItems
  const syncedReimbursements = await syncReimbursements();

  console.log("\n======================================");
  console.log("SYNC TO CORE SUMMARY:");
  console.log(`- Orders & Manifests (from Removal Shipments): ${syncedOrders} records synced`);
  console.log(`- ReturnItems (from Returns): ${syncedCustomerReturns} records synced`);
  console.log(`- Reimbursements (from Reimbursements): ${syncedReimbursements} records synced`);
  console.log("======================================");

  // Run the incremental repopulator after the sync completes
  if (!process.env.DISABLE_REPOPULATE) {
    try {
      console.log("\nTriggering incremental repopulation task (repopulate_incremental.js)...");
      await repopulateMain();
      console.log("Incremental repopulation task finished.");
    } catch (err) {
      console.error("[WARN] Incremental repopulation task failed:", err?.message || err);
    }
  } else {
    console.log("DISABLE_REPOPULATE is set - skipping repopulation task.");
  }
}

main()
  .catch((e) => console.error("[FATAL ERROR] Sync to Core process failed:", e))
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
