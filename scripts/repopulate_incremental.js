import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const CHUNK = 10;

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

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

  const allTrackingNumbers = Object.keys(groups);
  const allOrderIds = [...new Set(
    Object.values(groups).map(g => g[0]?.orderId).filter(Boolean)
  )];

  // Pre-fetch manifests + raw orders in two batch queries instead of N individual lookups
  const [existingManifests, rawOrders] = await Promise.all([
    prisma.manifest.findMany({
      where: { trackingId: { in: allTrackingNumbers } },
      select: { id: true, trackingId: true },
    }),
    allOrderIds.length > 0
      ? prisma.aMZRemovalOrder.findMany({ where: { orderId: { in: allOrderIds } } })
      : Promise.resolve([]),
  ]);
  const manifestMap = new Map(existingManifests.map(m => [m.trackingId, m]));
  const rawOrderMap = new Map(rawOrders.map(o => [o.orderId, o]));

  // ── Process each tracking-grouped shipment in parallel chunks ───────────────
  let processedCount = 0;
  const processedIds = [];

  const entries = Object.entries(groups);
  for (const chunk of chunkArray(entries, CHUNK)) {
    const results = await Promise.allSettled(chunk.map(async ([trackingNumber, shipments]) => {
      const orderId = shipments[0]?.orderId || null;

      const rawOrder = orderId ? (rawOrderMap.get(orderId) ?? null) : null;

      const requestDate =
        rawOrder?.requestDate ||
        shipments.find(s => s.requestDate)?.requestDate ||
        shipments.find(s => s.shipmentDate)?.shipmentDate ||
        new Date();

      const totalAmount = rawOrder?.removalFee || 0.0;
      const totalQuantity = shipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

      if (manifestMap.has(trackingNumber)) {
        await prisma.manifest.update({
          where: { trackingId: trackingNumber },
          data: {
            marketplace: 'AMAZON',
            ...(orderId ? { removalOrderId: orderId } : {}),
          },
        });
      } else {
        const created = await prisma.manifest.create({
          data: {
            trackingId: trackingNumber,
            status: 'IN_TRANSIT',
            marketplace: 'AMAZON',
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

      return shipments.map(s => s.id);
    }));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        processedIds.push(...r.value);
        processedCount++;
      } else {
        console.error(`[ERROR] Failed to process tracking group:`, r.reason?.message || r.reason);
      }
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