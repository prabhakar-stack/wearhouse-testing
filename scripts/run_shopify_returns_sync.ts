import process from 'process';
process.emitWarning = ((originalEmit) => (warning, ...args) => {
  if (typeof warning === 'string' && warning.includes('fs.Stats constructor')) {
    // Silently ignore this specific deprecation warning
    return;
  }
  return (originalEmit as any).call(process, warning, ...args);
})(process.emitWarning);

import { runShopifyReturnsJob } from "../lib/shopifyReturns.ts";
import { prisma } from "../lib/prisma.ts";

async function main() {
  console.log("====================================================");
  console.log("STARTING SHOPIFY AND SHIPROCKET RETURNS SYNCHRONIZATION");
  console.log("====================================================\n");

  const startTime = new Date();

  try {
    const results = await runShopifyReturnsJob();
    console.log("Synchronization Completed Successfully.");

    // Let's query the database for tracking rows that were created or updated during this run
    const trackingRows = await prisma.shopifyReturnTracking.findMany({
      where: {
        updatedAt: {
          gte: startTime,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    console.log(`\nTRACKING ROWS CREATED/UPDATED DURING SYNC: ${trackingRows.length}`);
    if (trackingRows.length > 0) {
      for (const row of trackingRows) {
        console.log(`- Tracking Number/Key: ${row.trackingNumber}`);
        console.log(`  Source: ${row.sourceType} (ID: ${row.sourceId})`);
        console.log(`  Courier: ${row.courierName || "N/A"} (${row.courierSlug || "N/A"})`);
        console.log(`  Latest Status: ${row.latestStatus || "N/A"}`);
        console.log(`  Latest Location: ${row.latestLocation || "N/A"}`);
        console.log(`  Checkpoints: ${row.checkpointCount}`);
        console.log(`  Fetched At: ${row.fetchedAt.toISOString()}`);
        console.log("  --------------------------------------------------");
      }
    } else {
      console.log("No tracking rows were created or updated in this run (they may have been skipped due to the freshness threshold).");
    }

  } catch (error: any) {
    console.error("Synchronization Failed with Error:", error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error("Unhandled execution error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
