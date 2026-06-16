const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting dynamic database repopulation task...');
  console.log('1. Cleaning previous operational data...');

  // Delete dependent rows first
  await prisma.reimbursement.deleteMany({});
  await prisma.missingItem.deleteMany({});
  await prisma.evidence.deleteMany({});
  await prisma.itemStatus.deleteMany({});
  await prisma.alert.deleteMany({});
  await prisma.returnItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.manifest.deleteMany({});

  console.log('Operational tables cleared.');

  // 2. Fetch unique removal orders from raw shipments
  const rawShipments = await prisma.aMZRemovalShipment.findMany();
  console.log(`Fetched ${rawShipments.length} raw shipment rows from AMZ_removal_shipments.`);

  const orderIds = [...new Set(rawShipments.map(s => s.orderId).filter(Boolean))];
  console.log(`Found ${orderIds.length} unique removal order IDs.`);

  let count = 0;
  for (const orderId of orderIds) {
    const shipments = rawShipments.filter(s => s.orderId === orderId);
    
    // Sum total quantity
    const totalQuantity = shipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

    // Resolve carrier tracking number
    const trackingNumber = shipments.find(s => s.trackingNumber)?.trackingNumber || `TRK-VIRT-${orderId}`;

    // Get removal order fee and request date
    const rawOrder = await prisma.aMZRemovalOrder.findFirst({
      where: { orderId: orderId }
    });

    const requestDate = rawOrder?.requestDate || shipments.find(s => s.shipmentDate)?.shipmentDate || new Date();
    const expectedDate = new Date(requestDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    const totalAmount = rawOrder?.removalFee || 0.0;

    // Create manifest
    const manifest = await prisma.manifest.upsert({
      where: { trackingId: trackingNumber },
      update: {
        marketplace: 'AMAZON',
        removalOrderId: orderId,
      },
      create: {
        trackingId: trackingNumber,
        status: 'IN_TRANSIT',
        marketplace: 'AMAZON',
        removalOrderId: orderId,
        expectedDate: null,
      }
    });

    // Create order
    const opOrder = await prisma.order.upsert({
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
      }
    });

    count++;
    console.log(`[${count}/${orderIds.length}] Repopulated Order ${orderId}: Quantity ${totalQuantity}, Fee ${totalAmount}, Tracking: ${trackingNumber}`);
  }

  console.log('Database repopulation task completed successfully!');
}

if (require.main === module) {
  main()
    .catch(e => {
      console.error('Fatal repopulation error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
} else {
  // Export main for programmatic use (so callers can `require` and invoke)
  module.exports = { main };
}
