import { prisma } from '../lib/prisma.ts';
import { dispatchAlert } from '../lib/alertDispatcher.ts';
import { ALERT_RULE_BY_TYPE } from '../lib/alertRules.ts';

async function main() {
  console.log("Creating dummy alert for Google Chat Template Test...");
  
  // Clean up any old test alert by manifest trackingId
  const oldManifests = await prisma.manifest.findMany({
    where: { trackingId: "TEST-TEMPLATE-REPLACE-001" }
  });
  
  if (oldManifests.length > 0) {
    const ids = oldManifests.map(m => m.id);
    await prisma.alert.deleteMany({
      where: { manifestId: { in: ids } }
    });
    await prisma.manifest.deleteMany({
      where: { trackingId: "TEST-TEMPLATE-REPLACE-001" }
    });
  }
  
  // Create a fake manifest for the alert
  const testManifest = await prisma.manifest.create({
    data: {
      trackingId: "TEST-TEMPLATE-REPLACE-001",
      courierName: "DummyCourier",
      status: "EXPECTED"
    }
  });

  const rule = ALERT_RULE_BY_TYPE["RECEIVE_UPDATE_PENDING_2H"];

  // Create the alert with a type that has {trackingId} in description
  const alert = await prisma.alert.create({
    data: {
      type: rule.type,
      level: rule.level,
      title: "TEMPLATE TEST - " + rule.title,
      description: rule.description,
      manifestId: testManifest.id,
    }
  });
  
  console.log(`Alert created: ${alert.id}`);
  console.log("Dispatching alert...");
  
  await dispatchAlert(alert.id);
  
  console.log("Dispatch complete. Check your Google Chat / Hangouts for the message with the dynamic text!");
  
}

main().catch(console.error).finally(() => prisma.$disconnect());
