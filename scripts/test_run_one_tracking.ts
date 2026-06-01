// scripts/run_one_tracking.ts
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { fetchTrackingSnapshot } from "../lib/trackcourier";

// Helper to get carrier from AMZRemovalShipment
async function getCarrierByTracking(trackingNumber: string): Promise<string | null> {
  const rec = await prisma.aMZRemovalShipment.findFirst({
    where: { trackingNumber },
    select: { carrier: true },
  });
  return rec?.carrier ?? null;
}

async function run(trackingId: string) {
  const carrier = await getCarrierByTracking(trackingId);
  const courier = carrier ?? "UNKNOWN";
  console.log(`Running for ${trackingId} → carrier: ${courier}`);

  const snapshot = await fetchTrackingSnapshot(trackingId, courier);
  console.log(JSON.stringify(snapshot, null, 2));
}

const id = process.argv[2];
if (!id) {
  console.error("Usage: npx tsx scripts/run_one_tracking.ts <TRACKING_ID>");
  process.exit(1);
}
run(id).catch((e) => {
  console.error("❌ Error:", e);
});
