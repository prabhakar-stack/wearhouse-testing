-- Migration: add_temp_id_and_scanned_at
-- Adds temp_id to ItemStatus and sample_recovery, plus scannedAt to sample_recovery.
-- claims-process/server.ts may have already added these via raw SQL (IF NOT EXISTS guards are safe either way).

-- ItemStatus: temp_id for QC/recovery audit tracking
ALTER TABLE "ItemStatus" ADD COLUMN IF NOT EXISTS "temp_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ItemStatus_temp_id_key" ON "ItemStatus"("temp_id");

-- sample_recovery: temp_id (same purpose) and scannedAt (IST scan timestamp)
ALTER TABLE "sample_recovery" ADD COLUMN IF NOT EXISTS "temp_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "sample_recovery_temp_id_key" ON "sample_recovery"("temp_id");
ALTER TABLE "sample_recovery" ADD COLUMN IF NOT EXISTS "scannedAt" TIMESTAMP(3);
