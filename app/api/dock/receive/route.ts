import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { trackingAwb, tapeIntact, boxCrushed, isTampered, otpProvided, evidenceUrl } = body;

    if (!trackingAwb) {
      return NextResponse.json({ error: 'Tracking AWB is required' }, { status: 400 });
    }

    console.log(`[Dock Receive] Intake recorded for AWB: ${trackingAwb}`, body);

    const isDamaged = !tapeIntact || boxCrushed || isTampered;

    // Resolve Manifest
    let manifest = await prisma.manifest.findUnique({
      where: { trackingAwb }
    });

    if (!manifest) {
      manifest = await prisma.manifest.create({
        data: {
          trackingAwb,
          status: 'EXPECTED',
          courierName: 'Unknown',
          expectedDate: new Date(),
        }
      });
      console.log(`[Dock Receive Dynamic Create] Created missing Manifest for AWB: ${trackingAwb}`);
    }

    await prisma.$transaction(async (tx) => {
      // Update Manifest status and receive timestamp
      await tx.manifest.update({
        where: { id: manifest.id },
        data: {
          status: isDamaged ? 'EXPECTED' : 'AT_DOCK', // Remains expected if rejected, otherwise dock intake complete
          receivedAt: isDamaged ? null : new Date()
        }
      });

      // Create a Dispute if visually damaged/tampered (L1 alert)
      if (isDamaged) {
        await tx.dispute.create({
          data: {
            manifestId: manifest.id,
            type: 'L1_DOCK_ALERT',
            evidenceUrl: evidenceUrl || null
          }
        });
        console.log(`[Dock Receive Dispute Alert] Created L1 Dispute for manifest: ${manifest.id}`);
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: isDamaged 
        ? 'Package intake rejected due to visual damage. Dispute registered.'
        : 'Package intake recorded at dock successfully',
      data: body
    }, { status: 200 });

  } catch (error: any) {
    console.error('🔥 DOCK RECEIVE CRASHED:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}