import "dotenv/config";
import { prisma } from "../lib/prisma";
import { runEscalationsJob } from "../lib/cron";

async function main() {
  console.log("Setting up test data for Group 8 Alerts...");

  // Mock inspector
  let inspector = await prisma.user.findFirst({ where: { role: 'INSPECTOR' } });
  if (!inspector) {
    inspector = await prisma.user.create({
      data: {
        email: 'test_inspector8@example.com',
        role: 'INSPECTOR',
      }
    });
  }

  const now = new Date();

  // Test 1: approx 12 working hours -> 24 raw hours ago
  const past24Hours = new Date(now.getTime() - (36 * 60 * 60 * 1000));
  // Test 2: approx 18+ working hours -> 60 raw hours ago
  const past48Hours = new Date(now.getTime() - (60 * 60 * 60 * 1000));

  await prisma.manifest.deleteMany({
    where: { trackingId: { startsWith: 'TEST-GROUP8' } }
  });

  const manifest = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP8-MANIFEST', status: 'INSPECTED', inspectedBy: inspector.email }
  });

  await prisma.itemStatus.deleteMany({
    where: { lpn: { startsWith: 'TEST-LPN-GROUP8' } }
  });

  const item12H = await prisma.itemStatus.create({
    data: { lpn: 'TEST-LPN-GROUP8-12H', status: 'RECOVERY', recoveryHandoverAt: null, manifestId: manifest.id, createdAt: past24Hours }
  });

  const item18H = await prisma.itemStatus.create({
    data: { lpn: 'TEST-LPN-GROUP8-18H', status: 'RECOVERY', recoveryHandoverAt: null, manifestId: manifest.id, createdAt: past48Hours }
  });

  await prisma.alert.deleteMany({
    where: { manifestId: manifest.id }
  });

  console.log("Running runEscalationsJob()...");
  const result = await runEscalationsJob();
  console.log("Job Results:", result);

  const alerts = await prisma.alert.findMany({
    where: { manifestId: manifest.id },
    include: { targetUser: true }
  });

  const allItems = await prisma.itemStatus.findMany({ where: { manifestId: manifest.id }});
  console.log("ItemStatuses created:", allItems);

  console.log("\nAlerts Generated:");
  alerts.forEach(a => {
    console.log(`- [${a.level}] ${a.type} for Manifest ID: ${a.manifestId} (Target: ${a.targetUser?.email || 'None'})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
