-- Migration: remove_item_price_add_removal_order_id
-- ReturnItem: drop itemPrice, add removalOrderId, enforce marketplace NOT NULL
-- All new DB indexes from schema audit

-- ── ReturnItem structural changes ────────────────────────────────────────────

-- 1. Normalise existing marketplace values before making the column NOT NULL
UPDATE "ReturnItem"
SET "marketplace" = 'AMAZON'
WHERE "marketplace" IS NULL OR lower("marketplace") = 'amazon';

UPDATE "ReturnItem"
SET "marketplace" = 'SHOPIFY'
WHERE lower("marketplace") = 'shopify';

-- 2. Enforce NOT NULL and switch default to uppercase token
ALTER TABLE "ReturnItem"
  ALTER COLUMN "marketplace" SET NOT NULL,
  ALTER COLUMN "marketplace" SET DEFAULT 'AMAZON';

-- 3. Drop itemPrice (no longer tracked on ReturnItem)
ALTER TABLE "ReturnItem" DROP COLUMN IF EXISTS "itemPrice";

-- 4. Add removalOrderId — populated at inspection time from manifest.removalOrderId
ALTER TABLE "ReturnItem" ADD COLUMN IF NOT EXISTS "removalOrderId" TEXT;

-- ── New indexes ───────────────────────────────────────────────────────────────

-- ReturnItem
CREATE INDEX IF NOT EXISTS "ReturnItem_fnsku_idx"    ON "ReturnItem"("fnsku");
CREATE INDEX IF NOT EXISTS "ReturnItem_sku_idx"      ON "ReturnItem"("sku");
CREATE INDEX IF NOT EXISTS "ReturnItem_orderId_idx"  ON "ReturnItem"("orderId");

-- Manifest
CREATE INDEX IF NOT EXISTS "Manifest_status_idx"             ON "Manifest"("status");
CREATE INDEX IF NOT EXISTS "Manifest_status_receivedAt_idx"  ON "Manifest"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "Manifest_inspectedBy_idx"        ON "Manifest"("inspectedBy");

-- Evidence
CREATE INDEX IF NOT EXISTS "Evidence_orderId_idx"          ON "Evidence"("orderId");
CREATE INDEX IF NOT EXISTS "Evidence_manifestId_type_idx"  ON "Evidence"("manifestId", "type");

-- Alert
CREATE INDEX IF NOT EXISTS "Alert_resolved_level_createdAt_idx"  ON "Alert"("resolved", "level", "createdAt");
CREATE INDEX IF NOT EXISTS "Alert_manifestId_resolved_idx"       ON "Alert"("manifestId", "resolved");
CREATE INDEX IF NOT EXISTS "Alert_type_manifestId_resolved_idx"  ON "Alert"("type", "manifestId", "resolved");

-- ItemStatus
CREATE INDEX IF NOT EXISTS "ItemStatus_manifestId_idx"  ON "ItemStatus"("manifestId");
CREATE INDEX IF NOT EXISTS "ItemStatus_status_idx"      ON "ItemStatus"("status");
CREATE INDEX IF NOT EXISTS "ItemStatus_orderId_idx"     ON "ItemStatus"("orderId");

-- MissingItem
CREATE INDEX IF NOT EXISTS "MissingItem_manifestId_idx"  ON "MissingItem"("manifestId");

-- AMZCustomerReturn  (column names use hyphenated @map aliases)
CREATE INDEX IF NOT EXISTS "AMZ_customer_returns_order_id_idx"  ON "AMZ_customer_returns"("order-id");
CREATE INDEX IF NOT EXISTS "AMZ_customer_returns_sku_idx"       ON "AMZ_customer_returns"("sku");

-- AMZRemovalShipment
CREATE INDEX IF NOT EXISTS "AMZ_removal_shipments_tracking_number_idx"  ON "AMZ_removal_shipments"("tracking-number");
CREATE INDEX IF NOT EXISTS "AMZ_removal_shipments_order_id_idx"         ON "AMZ_removal_shipments"("order-id");
