import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { main as repopulateMain } from "./repopulate_incremental.js";

const prisma = new PrismaClient();

async function syncRemovalShipmentsToOrders() {
  console.log("Syncing Removal Shipments from Staging table (AMZ_removal_shipments) to operational Order & Manifest tables...");
  const rawShipments = await prisma.aMZRemovalShipment.findMany();
  
  // Group shipments by orderId in memory
  const shipmentsByOrderId = {};
  for (const item of rawShipments) {
    if (!item.orderId) continue;
    if (!shipmentsByOrderId[item.orderId]) {
      shipmentsByOrderId[item.orderId] = [];
    }
    shipmentsByOrderId[item.orderId].push(item);
  }

  let successCount = 0;

  for (const [orderId, group] of Object.entries(shipmentsByOrderId)) {
    try {
      const firstItem = group[0];
      const totalQuantity = group.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);
      const trackingNumber = group.map(s => s.trackingNumber).filter(Boolean)[0] || null;

      const orderMarketplace = "AMAZON";

      // Find or create Manifest linked to the trackingNumber mapping directly from Order-level fields
      let manifestId = null;
      if (trackingNumber) {
        const existingManifest = await prisma.manifest.findUnique({
          where: { trackingId: trackingNumber }
        });

        let manifest;
        if (existingManifest) {
          manifest = await prisma.manifest.update({
            where: { trackingId: trackingNumber },
            data: {
              removalOrderId: orderId,
              marketplace: orderMarketplace,
            }
          });
        } else {
          manifest = await prisma.manifest.create({
            data: {
              trackingId: trackingNumber,
              status: "IN_TRANSIT",
              marketplace: orderMarketplace,
              removalOrderId: orderId,
              expectedDate: null,
            }
          });
        }
        manifestId = manifest.id;
      }

      // ----------------------------------------------------
      // [DATABASE LOAD & SYNC PROCESS] Core Order Sync
      // Target: Order (Operational Table)
      // Operation: Upserting Order utilizing shipment groups
      // ----------------------------------------------------
      await prisma.order.upsert({
        where: { platformOrderId: orderId },
        update: {
          marketplace: orderMarketplace,
          requestDate: firstItem.requestDate,
          totalAmount: null,
          totalQuantity: totalQuantity,
          trackingNumber: trackingNumber,
          manifestId: manifestId,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
        create: {
          marketplace: orderMarketplace,
          platformOrderId: orderId,
          requestDate: firstItem.requestDate,
          totalAmount: null,
          totalQuantity: totalQuantity,
          trackingNumber: trackingNumber,
          manifestId: manifestId,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
      });
      successCount++;
    } catch (e) {
      console.error(`[ERROR] Failed to sync operational Order & Manifest for Order ${orderId}:`, e.message);
    }
  }

  // NOTE: We intentionally do NOT delete Amazon orders that aren't in the current
  // 7-day window. The Amazon report only covers the last 7 days, so older orders
  // are simply not in the active window — they are still valid historical records
  // with downstream manifest, inspection, and alert data linked to them.
  // Deleting them here would wipe real warehouse operational data every sync run.
  //
  // If you need to clean up truly stale/orphaned orders, do it manually or with a
  // dedicated audit query scoped to orders with no manifest activity.
  const activeOrderIds = Object.keys(shipmentsByOrderId);
  const staleCandidates = await prisma.order.findMany({
    where: {
      marketplace: "AMAZON",
      platformOrderId: { notIn: activeOrderIds },
      manifest: {
        status: { in: ["EXPECTED", "IN_TRANSIT"] },
        expectedDate: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      },
    },
    select: { platformOrderId: true },
  });
  if (staleCandidates.length > 0) {
    console.log(`[INFO] ${staleCandidates.length} Amazon order(s) not in current 7-day report and still in EXPECTED/IN_TRANSIT state older than 90 days. Review manually if needed.`);
    staleCandidates.forEach(o => console.log(`  - ${o.platformOrderId}`));
  }

  console.log(`Successfully synced ${successCount}/${Object.keys(shipmentsByOrderId).length} unique Orders from Removal Shipments.`);
  return successCount;
}

async function syncCustomerReturns() {
  console.log("Syncing Customer Returns from Staging table (AMZ_customer_returns) to operational ReturnItem table...");
  const rawReturns = await prisma.aMZCustomerReturn.findMany();
  let successCount = 0;

  for (const item of rawReturns) {
    if (!item.lpn) continue;
    try {
      // ----------------------------------------------------
      // [DATABASE LOAD & SYNC PROCESS] Core Operational Sync
      // Target: ReturnItem (Operational Table)
      // Operation: Upsert return items linking LPN with NO fallbacks (null if empty)
      // ----------------------------------------------------
      await prisma.returnItem.upsert({
        where: { lpn: item.lpn },
        update: {
          orderId: item.orderId,
          sku: item.sku || null, // No fallback for SKU, just null if empty
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
          sku: item.sku || null, // No fallback for SKU, just null if empty
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
      successCount++;
    } catch (e) {
      console.error(`[ERROR] Failed to upsert Core Return lpn=${item.lpn}:`, e.message);
    }
  }
  console.log(`Successfully synced ${successCount}/${rawReturns.length} Customer Returns to Core Tables.`);
  return successCount;
}

async function syncReimbursements() {
  console.log("Syncing Reimbursements from Staging table (AMZ_reimbursements) to operational Tables...");
  const rawReimbursements = await prisma.aMZReimbursement.findMany();
  let successCount = 0;

  for (const item of rawReimbursements) {
    if (!item.reimbursementId) continue;
    try {
      const reimbursementData = {
        returnItemId: item.reimbursementId, // Directly mapping the unique reimbursementId to returnItemId
        platformReimbursementId: item.reimbursementId,
        amountReimbursed: item.amountTotal || item.amountPerUnit || 0,
        currency: item.currencyUnit || "INR",
        reimbursementReason: item.reason || item.originalReimbursementType,
        status: item.condition || "DONE",
        filedAt: item.approvalDate,
        resolvedAt: item.approvalDate,
      };

      const reimbursementByPlatformId = await prisma.reimbursement.findUnique({
        where: { platformReimbursementId: item.reimbursementId },
      });
      const reimbursementByReturnItem = await prisma.reimbursement.findUnique({
        where: { returnItemId: item.reimbursementId },
      });

      if (
        reimbursementByPlatformId &&
        reimbursementByReturnItem &&
        reimbursementByPlatformId.id !== reimbursementByReturnItem.id
      ) {
        console.log(
          `[WARN] Skipping core reimbursement row with conflicting platformReimbursementId and returnItemId: reimbursementId=${item.reimbursementId}`
        );
        continue;
      }

      const existingReimbursement = reimbursementByPlatformId || reimbursementByReturnItem;

      if (existingReimbursement) {
        // ----------------------------------------------------
        // [DATABASE LOAD & SYNC PROCESS] Core Operational Sync
        // Target: Reimbursement (Operational Table)
        // Operation: Update existing operational Reimbursement
        // ----------------------------------------------------
        await prisma.reimbursement.update({
          where: { id: existingReimbursement.id },
          data: reimbursementData,
        });
      } else {
        // ----------------------------------------------------
        // [DATABASE LOAD & SYNC PROCESS] Core Operational Sync
        // Target: Reimbursement (Operational Table)
        // Operation: Create new operational Reimbursement
        // ----------------------------------------------------
        await prisma.reimbursement.create({
          data: reimbursementData,
        });
      }
      successCount++;
    } catch (e) {
      console.error(`[ERROR] Failed to sync Core Reimbursement reimbursementId=${item.reimbursementId}:`, e.message);
    }
  }
  console.log(`Successfully synced ${successCount}/${rawReimbursements.length} Reimbursements to Core Tables.`);
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
