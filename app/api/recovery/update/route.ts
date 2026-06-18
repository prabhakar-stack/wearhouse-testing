import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Generates the next sequential temp_id for the current year group.
 * Format: [YY]TS[000001..999999]  e.g. "26TS000001"
 *
 * Queries the max existing numeric counter among all temp_id values
 * that start with the current year prefix, increments by 1, and
 * zero-pads to 6 digits.
 */
async function generateNextTempId(): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2); // "26"
  const prefix = `${year}TS`;

  // Fetch all existing temp_ids for this year group
  const existing = await prisma.itemStatus.findMany({
    where: {
      temp_id: {
        startsWith: prefix,
      },
    },
    select: { temp_id: true },
  });

  let maxCounter = 0;
  for (const row of existing) {
    if (!row.temp_id) continue;
    const numericPart = row.temp_id.slice(prefix.length);
    const parsed = parseInt(numericPart, 10);
    if (!isNaN(parsed) && parsed > maxCounter) {
      maxCounter = parsed;
    }
  }

  const nextCounter = maxCounter + 1;
  const paddedCounter = String(nextCounter).padStart(6, '0');
  return `${prefix}${paddedCounter}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const lpn = typeof body?.lpn === 'string' ? body.lpn.trim().toUpperCase() : '';
    const status = typeof body?.status === 'string' ? body.status.trim() : '';
    const isRefurbished = typeof body?.isRefurbished === 'boolean' ? body.isRefurbished : false;
    const triggerAction: string | undefined = body?.triggerAction; // 'boxChanged' | 'barcodeChanged'

    if (!lpn || !status) {
      return NextResponse.json({ error: 'Missing required fields: lpn, status' }, { status: 400 });
    }

    // Build the update payload
    const updateData: Record<string, unknown> = {
      status,
      isRefurbished,
    };

    // Assign a new temp_id when either the box or barcode was physically swapped
    if (triggerAction === 'boxChanged' || triggerAction === 'barcodeChanged') {
      updateData.temp_id = await generateNextTempId();
    }

    const updated = await prisma.itemStatus.update({
      where: { lpn },
      data: updateData,
    });

    return NextResponse.json({ success: true, lpn: updated.lpn, temp_id: updated.temp_id ?? null });
  } catch (error: unknown) {
    console.error('[recovery/update]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
