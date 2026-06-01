import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const shipments = await prisma.aMZRemovalShipment.findMany({
    select: { orderId: true },
    distinct: ["orderId"],
  });
  const shipmentOrderIds = shipments.map(s => s.orderId).filter(Boolean);

  const extraOrders = await prisma.order.findMany({
    where: {
      platformOrderId: {
        notIn: shipmentOrderIds,
      },
    },
    select: {
      platformOrderId: true,
      marketplace: true,
      fulfillmentChannel: true,
    },
    take: 20,
  });

  console.log("Extra Orders in Order table (not in removal shipments):", extraOrders.length);
  console.log("Samples:", extraOrders);
}

main().finally(() => prisma.$disconnect());
