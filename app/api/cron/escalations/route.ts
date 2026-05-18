import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const expectedToken = `Bearer ${process.env.CRON_SECRET || 'secret-cron-token'}`; // Ensure CRON_SECRET is set

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

    // 1. The 10:30 AM SLA Breach (L2 Alert)
    // Query for any Manifest where status is AT_DOCK, receivedAt is less than today's date
    // AND there is no RECEIVER_TO_INSPECTOR handshake.
    const l2Manifests = await prisma.manifest.findMany({
      where: {
        status: 'AT_DOCK',
        receivedAt: {
          lt: today
        },
        handshakes: {
          none: {
            type: 'RECEIVER_TO_INSPECTOR'
          }
        }
      }
    });

    for (const manifest of l2Manifests) {
      console.warn(`L2 ALERT: SLA Breach on AWB ${manifest.trackingAwb}. Emailing Admin.`);
      mockEmailAdmin(manifest.trackingAwb, 'L2 SLA Breach');
      results.l2Alerts++;
    }

    // 2. Claims Nudges
    const claimsManifests = await prisma.manifest.findMany({
      where: {
        status: 'CLAIMS_STAGING',
      },
      include: {
        inspection: true
      }
    });

    const hours48 = 48 * 60 * 60 * 1000;
    const hours72 = 72 * 60 * 60 * 1000;

    for (const manifest of claimsManifests) {
      const startTime = manifest.inspection?.completedAt || manifest.receivedAt || manifest.createdAt; // rough proxy
      if(!startTime) continue;
      const timeStaged = now.getTime() - new Date(startTime).getTime();

      if (timeStaged > hours72) {
        console.warn(`ESCALATION: Alerting Warehouse Admin - Claim Stalled. AWB: ${manifest.trackingAwb}`);
        results.escalations++;
      } else if (timeStaged > hours48) {
        console.warn(`NUDGE: Reminding Claims Specialist. AWB: ${manifest.trackingAwb}`);
        results.nudges++;
      }
    }

    // 3. Ghost Delivery (L4 Alert)
    // EXPECTED, expectedDate > 48 hours ago
    const hours48Ago = new Date(now.getTime() - hours48);
    
    const ghostDeliveries = await prisma.manifest.findMany({
      where: {
        status: 'EXPECTED',
        expectedDate: {
          lt: hours48Ago
        }
      }
    });

    for (const ghost of ghostDeliveries) {
      console.error(`L4 CRITICAL: Ghost Delivery detected for AWB ${ghost.trackingAwb}. Initiating leadership WhatsApp protocol.`);
      results.l4Alerts++;
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

function mockEmailAdmin(awb: string, type: string) {
  // Placeholder for email function
  // e.g. await sendEmail('admin@cubelelo.com', `Alert: ${type}`, `Please check AWB: ${awb}`);
}
