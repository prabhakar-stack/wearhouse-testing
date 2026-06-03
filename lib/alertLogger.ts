import { prisma } from "./prisma";

export async function archiveAndScoreAlerts(
  alertIds: string[],
  status: "RESOLVED" | "ESCALATED",
  sopFollowed: boolean = false,
  resolvedById?: string | null
) {
  if (!alertIds || alertIds.length === 0) return;

  const alerts = await prisma.alert.findMany({
    where: { id: { in: alertIds } },
    include: { manifest: true },
  });

  if (alerts.length === 0) return;

  const logEntries: any[] = [];
  const userScoreIncrements: Record<string, number> = {};

  for (const alert of alerts) {
    const trackingId = alert.manifest?.trackingId || "UNKNOWN";
    const targetUserIds = alert.targetUserId ? [alert.targetUserId] : [];

    logEntries.push({
      trackingId,
      alertType: alert.type,
      targetUserIds,
      status,
      sopFollowed,
      resolvedById,
      createdAt: new Date(),
    });

    if (alert.targetUserId) {
      userScoreIncrements[alert.targetUserId] = (userScoreIncrements[alert.targetUserId] || 0) + 1;
    }
  }

  // 1. Write the logs
  if (logEntries.length > 0) {
    await prisma.alertLog.createMany({
      data: logEntries,
    });
  }

  // 2. Update user scores efficiently using transactions
  const userUpdates = Object.keys(userScoreIncrements).map((userId) => {
    const increment = userScoreIncrements[userId];
    const updateData: any = {};
    if (status === "RESOLVED") {
      updateData.alertsResolved = { increment };
    } else {
      updateData.alertsEscalated = { increment };
    }
    return prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  });

  if (userUpdates.length > 0) {
    await prisma.$transaction(userUpdates);
  }

  // 3. Delete the old heavy alerts to save space
  await prisma.alert.deleteMany({
    where: { id: { in: alertIds } },
  });
}
