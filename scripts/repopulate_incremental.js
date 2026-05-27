const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main(batchSize = 100) {
  console.log('Starting incremental repopulation task...');

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

  // Group by orderId
  const groups = pending.reduce((acc, s) => {
    const key = s.orderId || `__no_order__${s.id}`;
    acc[key] = acc[key] || [];
    acc[key].push(s);
    return acc;
  }, {});

  let processedOrders = 0;

  for (const [orderId, shipments] of Object.entries(groups)) {
    try {
      const trackingNumber = shipments.find(s => s.trackingNumber)?.trackingNumber || `TRK-VIRT-${orderId}`;

      const rawOrder = orderId.startsWith('__no_order__') ? null : await prisma.aMZRemovalOrder.findFirst({ where: { orderId } });
      const requestDate = rawOrder?.requestDate || shipments.find(s => s.shipmentDate)?.shipmentDate || new Date();
      const totalAmount = rawOrder?.removalFee || 0.0;
      const totalQuantity = shipments.reduce((sum, s) => sum + (s.shippedQuantity || 0), 0);

      // Upsert manifest
      const manifest = await prisma.manifest.upsert({
        where: { trackingId: trackingNumber },
        update: {
          status: 'EXPECTED',
          marketplace: 'AMAZON',
          courierName: shipments[0]?.carrier || 'Amazon Logistics',
          removalOrderId: orderId.startsWith('__no_order__') ? null : orderId,
          expectedDate: requestDate,
        },
        create: {
          trackingId: trackingNumber,
          status: 'EXPECTED',
          marketplace: 'AMAZON',
          courierName: shipments[0]?.carrier || 'Amazon Logistics',
          removalOrderId: orderId.startsWith('__no_order__') ? null : orderId,
          expectedDate: requestDate,
        }
      });

      // Upsert order
      if (!orderId.startsWith('__no_order__')) {
        await prisma.order.upsert({
          where: { platformOrderId: orderId },
          update: {
            marketplace: 'AMAZON',
            requestDate,
            totalAmount,
            totalQuantity,
            fulfillmentChannel: 'AMAZON_REMOVAL',
            manifestId: manifest.id,
            trackingNumber,
          },
          create: {
            platformOrderId: orderId,
            marketplace: 'AMAZON',
            requestDate,
            totalAmount,
            totalQuantity,
            fulfillmentChannel: 'AMAZON_REMOVAL',
            manifestId: manifest.id,
            trackingNumber,
          }
        });
      }

      // Upsert virtual return items per shipment
      for (const shipment of shipments) {
        const qty = shipment.shippedQuantity || 1;
        const skuVal = shipment.sku || 'UNKNOWN_SKU';

        for (let i = 0; i < qty; i++) {
          const virtualLpn = `LPN-${trackingNumber}-${skuVal}-${i}`.toUpperCase();

          const rawReturn = await prisma.aMZCustomerReturn.findFirst({
            where: {
              OR: [
                { lpn: virtualLpn },
                { orderId: orderId.startsWith('__no_order__') ? null : orderId, sku: skuVal }
              ].filter(Boolean)
            }
          });

          const customerOrderId = rawReturn?.orderId || (orderId.startsWith('__no_order__') ? 'UNKNOWN_CUSTOMER_ORDER' : orderId);

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

      // Mark shipments as processed for this batch
      await prisma.aMZRemovalShipment.updateMany({
        where: { id: { in: shipments.map(s => s.id) } },
        data: { processedAt: new Date() }
      });

      processedOrders++;
    } catch (err) {
      console.error('[ERROR] Failed to process order group', orderId, err?.message || err);
    }
  }

  console.log(`Incremental repopulation completed for ${processedOrders} order groups.`);
}

if (require.main === module) {
  main()
    .catch(e => {
      console.error('Fatal incremental repopulation error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
} else {
  module.exports = { main };
}
