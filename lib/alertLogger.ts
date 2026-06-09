import { prisma } from "./prisma.ts";

export async function archiveAndScoreAlerts(
  alertIds: string[],
  status: "RESOLVED" | "ESCALATED",
  sopFollowed: boolean = false,
  resolvedById?: string | null
) {
  if (!alertIds || alertIds.length === 0) return;

  const alerts = await prisma.alert.findMany({
    where: { id: { in: alertIds } },
    include: { manifest: true, targetUsers: { select: { id: true } } },
  });

  if (alerts.length === 0) return;

  const logEntries: any[] = [];
  const userScoreIncrements: Record<string, number> = {};

  for (const alert of alerts) {
    const trackingId = alert.manifest?.trackingId || "UNKNOWN";
    const targetUserIds = alert.targetUsers.map((u) => u.id);

    logEntries.push({
      trackingId,
      alertType: alert.type,
      targetUserIds,
      status,
      sopFollowed,
      resolvedById,
      createdAt: new Date(),
    });

    for (const userId of targetUserIds) {
      userScoreIncrements[userId] = (userScoreIncrements[userId] || 0) + 1;
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
