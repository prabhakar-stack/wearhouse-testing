import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

/**
 * Incremental repopulation — Shipment-Centric (Tracking-First)
 *
 * Groups pending AMZRemovalShipment rows by trackingNumber, creating one
 * Manifest per unique tracking ID. Order is written independently with no
 * manifestId FK — it exists only for order-level metadata and alert triggers.
 *
 * Rows with no trackingNumber are skipped with a console warning (admin should
 * be alerted via the ORDER_NO_TRACKING_ID alert rule in the cron escalation job).
 */
async function main(batchSize = 100) {
  console.log('Starting incremental repopulation task (tracking-first)...');

  // Find shipments not yet processed
  const pending = await prisma.aMZRemovalShipment.findMany({
    where: { processedAt: null },
    orderBy: { requestDate: 'asc' },
    take: batchSize,
  });

  if (!pending || pending.length === 0) {
    console.log('No pending shipments to process.');
    return;
  }

  console.log(`Found ${pending.length} pending shipment rows to process.`);

  // ── Group by trackingNumber (one manifest per physical shipment box) ─────────
  // Rows without a tracking number are skipped — they cannot be received at dock.
  const groups = {};
  const skippedNoTracking = [];

  for (const s of pending) {
    if (!s.trackingNumber) {
      skippedNoTracking.push(s);
      continue;
    }
    groups[s.trackingNumber] = groups[s.trackingNumber] || [];
    groups[s.trackingNumber].push(s);
  }

  if (skippedNoTracking.length > 0) {
    console.warn(`[WARN] Skipped ${skippedNoTracking.length} shipment row(s) with no trackingNumber:`);
    skippedNoTracking.forEach(s =>
      console.warn(`  - id=${s.id} orderId=${s.orderId} sku=${s.sku} (no tracking number assigned by Amazon yet)`)
    );
  }

  // ── Process each tracking-grouped shipment ───────────────────────────────────
  let processedCount = 0;
  const processedIds = []; // collect all shipment row IDs to mark as processed

  for (const [trackingNumber, shipments] of Object.entries(groups)) {
    try {
      const orderId = shipments[0]?.orderId || null;

      // Fetch order metadata (request date, fee) from the removal order staging table
      const rawOrder = orderId
        ? await prisma.aMZRemovalOrder.findFirst({ where: { orderId } })
        : null;

      const requestDate =
        rawOrder?.requestDate ||
        shipments.find(s => s.requestDate)?.requestDate ||
        shipments.find(s => s.shipmentDate)?.shipmentDate ||
        new Date();

      const totalAmount = rawOrder?.removalFee || 0.0;
      const totalQuantity = shipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

      // ── Create or update the Manifest for this tracking ID ────────────────────
      const existingManifest = await prisma.manifest.findUnique({
        where: { trackingId: trackingNumber },
      });

      let manifest;
      if (existingManifest) {
        manifest = await prisma.manifest.update({
          where: { trackingId: trackingNumber },
          data: {
            marketplace: 'AMAZON',
            // Keep removalOrderId as metadata reference only (non-null when known)
            ...(orderId ? { removalOrderId: orderId } : {}),
          },
        });
      } else {
        manifest = await prisma.manifest.create({
          data: {
            trackingId: trackingNumber,
            status: 'IN_TRANSIT',
            marketplace: 'AMAZON',
            removalOrderId: orderId || null,
            expectedDate: null,
          },
        });
        console.log(`[MANIFEST CREATED] trackingId=${trackingNumber} orderId=${orderId}`);
      }

      // ── Upsert Order (independent — no manifestId FK) ─────────────────────────
      // Order exists purely for order-level metadata: request date, quantity,
      // reimbursement window alerting. It does NOT link back to any manifest.
      if (orderId) {
        await prisma.order.upsert({
          where: { platformOrderId: orderId },
          update: {
            marketplace: 'AMAZON',
            requestDate,
            totalAmount,
            totalQuantity,
            fulfillmentChannel: 'AMAZON_REMOVAL',
          },
          create: {
            platformOrderId: orderId,
            marketplace: 'AMAZON',
            requestDate,
            totalAmount,
            totalQuantity,
            fulfillmentChannel: 'AMAZON_REMOVAL',
          },
        });
      }



      // Collect IDs to mark as processed in a single batch call at the end
      processedIds.push(...shipments.map(s => s.id));
      processedCount++;
    } catch (err) {
      console.error(
        `[ERROR] Failed to process tracking group trackingNumber=${trackingNumber}:`,
        err?.message || err
      );
    }
  }

  // ── Mark all successfully processed shipment rows in one batch ───────────────
  if (processedIds.length > 0) {
    await prisma.aMZRemovalShipment.updateMany({
      where: { id: { in: processedIds } },
      data: { processedAt: new Date() },
    });
  }

  // Also mark skipped (no-tracking) rows so they don't loop forever.
  // They stay processedAt-stamped but no manifest is created — the admin alert
  // (ORDER_NO_TRACKING_ID) will surface them in the dashboard.
  if (skippedNoTracking.length > 0) {
    await prisma.aMZRemovalShipment.updateMany({
      where: { id: { in: skippedNoTracking.map(s => s.id) } },
      data: { processedAt: new Date() },
    });
  }

  console.log(
    `Incremental repopulation completed: ${processedCount} tracking groups processed, ` +
    `${skippedNoTracking.length} skipped (no tracking number).`
  );
}

// Equivalent of require.main === module in ES Modules
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main()
    .catch(e => {
      console.error('Fatal incremental repopulation error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { main };