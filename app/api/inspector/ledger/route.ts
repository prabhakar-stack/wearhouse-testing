import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    // For now we'll fetch packages marked as AT_DOCK or assigned to inspector
    // To simulate packages that inspector needs to inspect but hasn't yet,
    // assuming status = 'AT_DOCK' or 'CLAIMS_STAGING' (if testing or something), 
    // actually AT_DOCK means it's ready for inspector to do Takeover 
    // or maybe they did Takeover and it's 'IN_CUSTODY'? 
    // The PRD says: "The Second Handshake: An Inspector scans the package. Accountability now moves from the Receiver to the Inspector... The item disappears from the Receiver's handover list."
    // Let's assume after takeover, status = 'IN_INSPECTION_CUSTODY' or we use 'AT_DOCK' (receiver assigned to it?).
    // We'll mock it if Prisma fails.
    
    let ledger: any[] = [];
    
    // We'll return mock data for the ledger 
    ledger = [
      {
        id: 'mock-insp-1',
        trackingAwb: 'AMZ-100200300',
        orderId: 'ORD-111',
        marketplace: 'Amazon',
        status: 'INSPECTING',
        receivedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        itemsExpected: 3,
        itemsInspected: 1
      },
      {
        id: 'mock-insp-2',
        trackingAwb: 'FLP-998877665',
        orderId: 'ORD-222',
        marketplace: 'Flipkart',
        status: 'PENDING_INSPECTION',
        receivedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        itemsExpected: 2,
        itemsInspected: 0
      }
    ];

    return NextResponse.json({ ledger });
  } catch (error) {
    console.error('Ledger fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch ledger packages' }, { status: 500 });
  }
}
