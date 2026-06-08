import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const delayedManifests = await prisma.manifest.findMany({
    where: {
      status: 'IN_TRANSIT',
      expectedDate: { lt: today }
    },
    include: {
      trackingSnapshots: true
    }
  });

  console.log(`Found ${delayedManifests.length} manifests with expectedDate < today still marked as IN_TRANSIT:\n`);

  for (const m of delayedManifests) {
    console.log(`Manifest ID: ${m.id}`);
    console.log(`Tracking ID: ${m.trackingId}`);
    console.log(`Expected Date: ${m.expectedDate?.toISOString().slice(0, 10)}`);
    console.log(`Current Status: ${m.status}`);
    
    if (m.trackingSnapshots && m.trackingSnapshots.length > 0) {
      console.log(`Tracking Snapshots:`);
      for (const snap of m.trackingSnapshots) {
        console.log(`  - Number: ${snap.trackingNumber}`);
        console.log(`    Courier Status: ${snap.latestStatus}`);
        console.log(`    Courier ETA: ${snap.scheduledDelivery?.toISOString().slice(0, 10)}`);
        console.log(`    Fetched At: ${snap.fetchedAt.toISOString()}`);
      }
    } else {
      console.log(`No tracking snapshots found.`);
    }
    console.log('--------------------------------------------------');
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
