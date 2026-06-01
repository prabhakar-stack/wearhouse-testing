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
        const courierName = group.find(s => s.carrier)?.carrier || null;
        
        // ----------------------------------------------------
        // [DATABASE LOAD & SYNC PROCESS] Core Manifest Sync
        // Target: Manifest (Operational Table)
        // Operation: Upserting Manifest entry mapping fields from the Order data
        // ----------------------------------------------------
        const manifest = await prisma.manifest.upsert({
          where: { trackingId: trackingNumber },
          update: {
            orderId: orderId,
            removalOrderId: orderId,
            marketplace: orderMarketplace, // manifest.marketplace = order.marketplace
            courierName: courierName,
          },
          create: {
            trackingId: trackingNumber,
            status: "EXPECTED",
            marketplace: orderMarketplace, // manifest.marketplace = order.marketplace
            orderId: orderId,
            removalOrderId: orderId,
            courierName: courierName,
          },
        });
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

  // ----------------------------------------------------
  // [DATABASE CLEANUP PROCESS] Core Order Cleanup
  // Operation: Delete any Amazon orders that are NOT part of the active 25 removal shipment orders
  // ----------------------------------------------------
  const activeOrderIds = Object.keys(shipmentsByOrderId);
  try {
    const deleteResult = await prisma.order.deleteMany({
      where: {
        marketplace: "AMAZON",
        platformOrderId: {
          notIn: activeOrderIds,
        },
      },
    });
    console.log(`Cleaned up ${deleteResult.count} old/stale Amazon orders from operational Order table.`);
  } catch (e) {
    console.error(`[ERROR] Failed to clean up old Amazon orders:`, e.message);
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
