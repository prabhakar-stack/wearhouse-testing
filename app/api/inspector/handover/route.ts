import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const role = req.headers.get('x-user-role');
    const userId = req.headers.get('x-user-id');

    if (!role || !['INSPECTOR', 'ADMIN', 'SUPER_ACCESS'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized — missing user ID' }, { status: 401 });
    }

    const body = await req.json();
    const { lpns } = body;

    if (!lpns || !Array.isArray(lpns) || lpns.length === 0) {
      return NextResponse.json({ error: 'Missing or empty lpns array' }, { status: 400 });
    }

    const now = new Date();
    
    // Update recoveryHandoverAt for any matching LPNs that are marked for RECOVERY
    const result = await prisma.itemStatus.updateMany({
      where: {
        lpn: { in: lpns },
        status: 'RECOVERY',
        recoveryHandoverAt: null, // Only update if not already handed over
      },
      data: {
        recoveryHandoverAt: now
      }
    });

    console.log(`[Inspector Handover] Handed over ${result.count} RECOVERY items.`);

    // Optionally: If LPNs include GOOD items, we could mark goodHandoverAt if it existed,
    // but the requirement currently focuses on RECOVERY.

    // Resolve any INSP_RECOVERY_HANDSHAKE alerts for these LPNs. 
    // Wait, the alert is currently tied to Manifest. If they handover items individually, 
    // it will be handled by cron not generating the alert anymore, 
    // but we can also auto-resolve any existing alert for the manifest if ALL recovery items are handed over.
    // For now, simple update is enough.

    return NextResponse.json({
      success: true,
      message: `Handed over ${result.count} RECOVERY items successfully.`,
      updatedCount: result.count
    });

  } catch (error: any) {
    console.error('Inspector Handover Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
