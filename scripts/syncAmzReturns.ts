// scripts/syncAmzReturns.ts

/**
 * Synchronize data from AMZ_customer_returns (aMZCustomerReturn) to ReturnItem.
 * Uses the LPN field as the unique identifier.
 * This script can be run manually (`ts-node scripts/syncAmzReturns.ts`) or invoked from an API/cron.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Helper to map aMZCustomerReturn fields to ReturnItem fields
const mapReturn = (src: any) => {
  return {
    lpn: src.lpn,
    returnDate: src.returnDate ?? null,
    sku: src.sku ?? 'UNKNOWN_SKU',
    asin: src.asin ?? null,
    fnsku: src.fnsku ?? null,
    productName: src.productName ?? `SKU: ${src.sku ?? 'UNKNOWN'}`,
    quantity: src.quantity ?? null,
    fulfillmentCenterId: src.fulfillmentCenterId ?? null,
    detailedDisposition: src.detailedDisposition ?? null,
    reason: src.reason ?? null,
    customerComments: src.customerComments ?? null,
    removalOrderType: src.removalOrderType ?? null,
    // marketplace defaults to "amazon" via Prisma default, no need to set explicitly.
  };
};

export async function runSync() {
  console.log('[Sync] Starting AMZ_customer_returns → ReturnItem sync');
  try {
    // Fetch all source rows
    const sourceRows = await prisma.aMZCustomerReturn.findMany();
    console.log(`[Sync] Fetched ${sourceRows.length} source rows`);

    let upserted = 0;
    for (const row of sourceRows) {
      // Ensure LPN exists – it's the foreign key
      if (!row.lpn) {
        console.warn('[Sync] Skipping row without LPN', row.lpn);
        continue;
      }
      const data = mapReturn(row);
      await prisma.returnItem.upsert({
        where: { lpn: data.lpn },
        update: data,
        create: data,
      });
      upserted++;
    }
    console.log(`[Sync] Completed. Upserted/updated ${upserted} ReturnItem records.`);
  } catch (err) {
    console.error('[Sync] Error during sync:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

runSync()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
