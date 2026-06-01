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
    const rawOrders = await prisma.aMZRemovalOrder.findMany({
      where: { orderId: orderId }
    });

    const requestDate = rawOrders[0]?.requestDate || shipments.find(s => s.shipmentDate)?.shipmentDate || new Date();
    const totalAmount = rawOrders.reduce((sum, o) => sum + (o.removalFee || 0.0), 0.0);

    // Create manifest
    const manifest = await prisma.manifest.upsert({
      where: { trackingId: trackingNumber },
      update: {
        status: 'EXPECTED',
        marketplace: 'AMAZON',
        courierName: shipments[0]?.carrier || 'Amazon Logistics',
        removalOrderId: orderId,
        expectedDate: requestDate,
      },
      create: {
        trackingId: trackingNumber,
        status: 'EXPECTED',
        marketplace: 'AMAZON',
        courierName: shipments[0]?.carrier || 'Amazon Logistics',
        removalOrderId: orderId,
        expectedDate: requestDate,
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
        manifestId: manifest.id,
        trackingNumber: trackingNumber,
      },
      create: {
        platformOrderId: orderId,
        marketplace: 'AMAZON',
        requestDate,
        totalAmount,
        totalQuantity,
        fulfillmentChannel: 'AMAZON_REMOVAL',
        manifestId: manifest.id,
        trackingNumber: trackingNumber,
      }
    });

    // Create virtual LPN return items
    for (const shipment of shipments) {
      const qty = shipment.shippedQuantity || 1;
      const skuVal = shipment.sku || 'UNKNOWN_SKU';

      for (let i = 0; i < qty; i++) {
        const virtualLpn = `LPN-${trackingNumber}-${skuVal}-${i}`.toUpperCase();

        const rawReturn = await prisma.aMZCustomerReturn.findFirst({
          where: {
            OR: [
              { lpn: virtualLpn },
              { orderId: orderId, sku: skuVal }
            ]
          }
        });

        const customerOrderId = rawReturn?.orderId || 'UNKNOWN_CUSTOMER_ORDER';

        await prisma.returnItem.upsert({
          where: { lpn: virtualLpn },
          update: {
            orderId: customerOrderId,
            sku: skuVal,
            asin: rawReturn?.asin || null,
            fnsku: shipment.fnsku || rawReturn?.fnsku || null,
            productName: rawReturn?.productName || `SKU: ${skuVal}`,
            reason: rawReturn?.reason || 'Removal Order Shipment',
            customerComments: rawReturn?.customerComments || null,
            detailedDisposition: rawReturn?.detailedDisposition || shipment.disposition || 'SELLABLE',
            returnDate: rawReturn?.returnDate || null,
            fulfillmentCenterId: rawReturn?.fulfillmentCenterId || null,
          },
          create: {
            lpn: virtualLpn,
            orderId: customerOrderId,
            sku: skuVal,
            asin: rawReturn?.asin || null,
            fnsku: shipment.fnsku || rawReturn?.fnsku || null,
            productName: rawReturn?.productName || `SKU: ${skuVal}`,
            reason: rawReturn?.reason || 'Removal Order Shipment',
            customerComments: rawReturn?.customerComments || null,
            detailedDisposition: rawReturn?.detailedDisposition || shipment.disposition || 'SELLABLE',
            returnDate: rawReturn?.returnDate || null,
            fulfillmentCenterId: rawReturn?.fulfillmentCenterId || null,
          }
        });
      }
    }

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
