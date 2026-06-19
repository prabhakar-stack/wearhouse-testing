import { prisma } from './prisma.ts';
import { PackageState } from '@prisma/client';

export interface SmarthubIngestResult {
  created: number;
  skipped: number;
  errors: number;
}

export async function runSmarthubIngestJob(): Promise<SmarthubIngestResult> {
  console.log('[SmartHub Ingest] Starting Amazon FBA B2C manifest creation...');

  const b2cRows: { returnTrackingId: string | null }[] = await (prisma as any).aMAZON_B2C_SMARTHUB.findMany({
    where: { returnTrackingId: { not: '' } },
    select: { returnTrackingId: true },
  });

  if (b2cRows.length === 0) {
    console.log('[SmartHub Ingest] No B2C rows with a tracking ID found.');
    return { created: 0, skipped: 0, errors: 0 };
  }

  const allTrackingIds = b2cRows
    .map((r: { returnTrackingId: string | null }) => r.returnTrackingId)
    .filter((id: string | null): id is string => !!id);

  const existing = await prisma.manifest.findMany({
    where: {
      marketplace: 'AMAZON_FBA' as any,
      trackingId: { in: allTrackingIds },
    },
    select: { trackingId: true },
  });
  const existingSet = new Set(existing.map(m => m.trackingId));

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of b2cRows) {
    const trackingId = row.returnTrackingId?.trim();
    if (!trackingId) { skipped++; continue; }
    if (existingSet.has(trackingId)) { skipped++; continue; }

    try {
      await prisma.manifest.create({
        data: {
          trackingId,
          removalOrderId: trackingId,
          status: PackageState.IN_TRANSIT,
          marketplace: 'AMAZON_FBA' as any,
        },
      });
      existingSet.add(trackingId);
      created++;
    } catch (err: any) {
      console.error(`[SmartHub Ingest] Failed to create manifest for ${trackingId}:`, err.message);
      errors++;
    }
  }

  console.log(`[SmartHub Ingest] Done — created: ${created}, skipped: ${skipped}, errors: ${errors}`);
  return { created, skipped, errors };
}
