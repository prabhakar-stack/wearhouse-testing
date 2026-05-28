ALTER TABLE "shiprocket_returns" ADD COLUMN "shipmentId" TEXT;
CREATE INDEX "shiprocket_returns_shipmentId_idx" ON "shiprocket_returns"("shipmentId");