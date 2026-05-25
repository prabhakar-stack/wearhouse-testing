import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`;

    if (authHeader !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const results = {
      l2Alerts: 0,
      nudges: 0,
      escalations: 0,
      l4Alerts: 0
    };

    // Helper: create alert only if one doesn't already exist (unresolved) for same manifest + type
    const createAlertIfNew = async (data: {
      level: 'L1' | 'L2' | 'L3' | 'L4';
      type: string;
      title: string;
      description: string;
      manifestId?: string;
      targetUserId?: string;
    }) => {
      const existing = await prisma.alert.findFirst({
        where: {
          type: data.type,
          manifestId: data.manifestId || undefined,
          resolved: false,
        }
      });
      if (existing) return null; // Already exists, skip

      return prisma.alert.create({ data });
    };

    // 1. The 10:30 AM SLA Breach (L2 Alert)
    const l2Manifests = await prisma.manifest.findMany({
      where: {
        status: 'AT_DOCK',
        receivedAt: { lt: today },
        inspectedBy: null // Handshake is replaced by direct inspectedBy indicator
      }
    });

    for (const manifest of l2Manifests) {
      const alert = await createAlertIfNew({
        level: 'L2',
        type: 'SLA_BREACH',
        title: `10:30 AM Handover SLA Breach`,
        description: `Package ${manifest.trackingId} received yesterday has not been handed over to an inspector. Received at: ${manifest.receivedAt ? new Date(manifest.receivedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : 'Unknown'}.`,
        manifestId: manifest.id,
      });
      if (alert) results.l2Alerts++;
    }

    // 2. Claims Nudges & Escalations
    const claimsManifests = await prisma.manifest.findMany({
      where: { status: 'CLAIMS_STAGING' }
    });

    const hours48 = 48 * 60 * 60 * 1000;
    const hours72 = 72 * 60 * 60 * 1000;

    for (const manifest of claimsManifests) {
      const startTime = manifest.receivedAt || manifest.createdAt;
      if (!startTime) continue;
      const timeStaged = now.getTime() - new Date(startTime).getTime();

      if (timeStaged > hours72) {
        const alert = await createAlertIfNew({
          level: 'L3',
          type: 'CLAIM_STALLED',
          title: `Claim Stalled Over 72 Hours`,
          description: `Claim for tracking ID ${manifest.trackingId} has been in staging for over 72 hours without action. Staging started at: ${new Date(startTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
          manifestId: manifest.id,
        });
        if (alert) results.escalations++;
      } else if (timeStaged > hours48) {
        const alert = await createAlertIfNew({
          level: 'L1',
          type: 'CLAIM_NUDGE',
          title: `Claim Pending — 48 Hour Nudge`,
          description: `Claim for tracking ID ${manifest.trackingId} has been pending for 48+ hours. Claims specialist should begin filing.`,
          manifestId: manifest.id,
        });
        if (alert) results.nudges++;
      }
    }

    // 3. Ghost Delivery (L4 Alert)
    const hours48Ago = new Date(now.getTime() - hours48);

    const ghostDeliveries = await prisma.manifest.findMany({
      where: {
        status: 'EXPECTED',
        expectedDate: { lt: hours48Ago }
      }
    });

    for (const ghost of ghostDeliveries) {
      const alert = await createAlertIfNew({
        level: 'L4',
        type: 'GHOST_DELIVERY',
        title: `Ghost Delivery — Courier Says Delivered`,
        description: `Package ${ghost.trackingId} expected ${ghost.expectedDate ? new Date(ghost.expectedDate).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : 'Unknown'} has not been scanned at the warehouse after 48+ hours. Possible missing delivery.`,
        manifestId: ghost.id,
      });
      if (alert) results.l4Alerts++;
    }

    // 4. Missing Items from Inspection (L3 Alert)
    // Scan consolidated Evidence table for missing item claims
    const missingEvidence = await prisma.evidence.findMany({
      where: {
        claimReason: 'MISSING',
        manifest: {
          alerts: {
            none: { type: 'MISSING_ITEMS', resolved: false }
          }
        }
      },
      include: { manifest: true }
    });

    for (const ev of missingEvidence) {
      if (ev.manifest) {
        await createAlertIfNew({
          level: 'L3',
          type: 'MISSING_ITEMS',
          title: `Missing Items Detected in Inspection`,
          description: `Inspection of tracking ID ${ev.manifest.trackingId} found missing items.`,
          manifestId: ev.manifestId!,
        });
      }
    }

    console.log(`[Cron Escalations] Results:`, results);
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
