import "dotenv/config";
import { prisma } from "../lib/prisma";
import { runEscalationsJob } from "../lib/cron";

async function main() {
  console.log("Setting up test data for Group 7 Alerts...");

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
  // Test 3: 24 working hours -> 96 raw hours ago
  const past96Hours = new Date(now.getTime() - (96 * 60 * 60 * 1000));

  await prisma.manifest.deleteMany({
    where: { trackingId: { startsWith: 'TEST-GROUP7' } }
  });

  const manifest6H = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP7-6H', status: 'CLAIMS_STAGING', inspectedBy: inspector.email, inspectedAt: past24Hours }
  });

  const manifest12H = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP7-12H', status: 'CLAIMS_STAGING', inspectedBy: inspector.email, inspectedAt: past48Hours }
  });

  const manifest24H = await prisma.manifest.create({
    data: { trackingId: 'TEST-GROUP7-24H', status: 'CLAIMS_STAGING', inspectedBy: inspector.email, inspectedAt: past96Hours }
  });
  
  await prisma.alert.deleteMany({
    where: { manifestId: { in: [manifest6H.id, manifest12H.id, manifest24H.id] } }
  });

  console.log("Running runEscalationsJob()...");
  const result = await runEscalationsJob();
  console.log("Job Results:", result);

  const alerts = await prisma.alert.findMany({
    where: { manifestId: { in: [manifest6H.id, manifest12H.id, manifest24H.id] } },
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
