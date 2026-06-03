import { prisma } from '../lib/prisma.ts';
import { runEscalationsJob } from '../lib/cron.ts';

async function main() {
  console.log("Setting up test data for Group 5 Alerts...");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const startOfYesterday = new Date(today);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  
  const dayBeforeYesterday = new Date(today);
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);

  // Clean up
  await prisma.alert.deleteMany({
    where: { manifest: { trackingId: { startsWith: 'TEST-GROUP5-' } } }
  });
  await prisma.manifest.deleteMany({
    where: { trackingId: { startsWith: 'TEST-GROUP5-' } }
  });

  // Mock 1: Received yesterday
  const m1 = await prisma.manifest.create({
    data: {
      trackingId: 'TEST-GROUP5-YEST',
      status: 'AT_DOCK',
      receivedAt: startOfYesterday,
      inspectedBy: null,
      expectedDate: startOfYesterday
    }
  });

  // Mock 2: Received day before yesterday
  const m2 = await prisma.manifest.create({
    data: {
      trackingId: 'TEST-GROUP5-PREV',
      status: 'AT_DOCK',
      receivedAt: dayBeforeYesterday,
      inspectedBy: null,
      expectedDate: dayBeforeYesterday
    }
  });

  console.log("Running runEscalationsJob()...");
  const result = await runEscalationsJob();
  
  console.log("Job Results:", result);

  const alerts1 = await prisma.alert.findMany({ where: { manifestId: m1.id } });
  const alerts2 = await prisma.alert.findMany({ where: { manifestId: m2.id } });

  console.log(`\nAlerts for Yesterday's Package (${m1.trackingId}):`);
  alerts1.forEach(a => console.log(`- [${a.level}] ${a.type} (Resolved: ${a.resolved})`));

  console.log(`\nAlerts for Day Before Yesterday's Package (${m2.trackingId}):`);
  alerts2.forEach(a => console.log(`- [${a.level}] ${a.type} (Resolved: ${a.resolved})`));

}

main().catch(console.error).finally(() => prisma.$disconnect());
