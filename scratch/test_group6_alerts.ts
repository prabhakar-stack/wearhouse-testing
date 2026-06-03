import "dotenv/config";
import { prisma } from "../lib/prisma";
import { runEscalationsJob } from "../lib/cron";
import { resolveTargetUserId } from "../lib/alertTargeting";

async function main() {
  console.log("Setting up test data for Group 6 Alerts...");

  // Mock inspector
  let inspector = await prisma.user.findFirst({ where: { role: 'INSPECTOR' } });
  if (!inspector) {
    inspector = await prisma.user.create({
      data: {
        email: 'test_inspector@example.com',
        role: 'INSPECTOR',
      }
    });
  }

  const now = new Date();

  // Test 1: 6 working hours -> 24 raw hours ago
  const past24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  // Test 2: 12 working hours -> 48 raw hours ago
  const past48Hours = new Date(now.getTime() - (48 * 60 * 60 * 1000));
  // Test 3: 18 working hours -> 72 raw hours ago
  const past72Hours = new Date(now.getTime() - (72 * 60 * 60 * 1000));
  // Test 4: 24 working hours -> 96 raw hours ago
  const past96Hours = new Date(now.getTime() - (96 * 60 * 60 * 1000));

  await prisma.manifest.deleteMany({
    where: { trackingId: { startsWith: 'TEST-GROUP6' } }
  });

  const manifest6H = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP6-6H', status: 'IN_INSPECTION', inspectedBy: inspector.email, inspectorHandoverAt: past24Hours }
  });

  const manifest12H = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP6-12H', status: 'IN_INSPECTION', inspectedBy: inspector.email, inspectorHandoverAt: past48Hours }
  });

  const manifest18H = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP6-18H', status: 'IN_INSPECTION', inspectedBy: inspector.email, inspectorHandoverAt: past72Hours }
  });

  const manifest24H = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP6-24H', status: 'IN_INSPECTION', inspectedBy: inspector.email, inspectorHandoverAt: past96Hours }
  });
  
  await prisma.alert.deleteMany({
    where: { manifestId: { in: [manifest6H.id, manifest12H.id, manifest18H.id, manifest24H.id] } }
  });

  console.log("Running runEscalationsJob()...");
  const result = await runEscalationsJob();
  console.log("Job Results:", result);

  const alerts = await prisma.alert.findMany({
    where: { manifestId: { in: [manifest6H.id, manifest12H.id, manifest18H.id, manifest24H.id] } },
    include: { manifest: true, targetUser: true }
  });

  console.log("\nAlerts Generated:");
  alerts.forEach(a => {
    console.log(`- [${a.level}] ${a.type} for ${a.manifest?.trackingId} (Target: ${a.targetUser?.email || 'None'})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
