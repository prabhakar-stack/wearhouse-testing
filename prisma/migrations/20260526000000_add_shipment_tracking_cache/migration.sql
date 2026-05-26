-- CreateTable
CREATE TABLE "ShipmentTracking" (
    "trackingNumber" TEXT NOT NULL,
    "manifestId" TEXT,
    "courierName" TEXT,
    "courierSlug" TEXT,
    "latestStatus" TEXT,
    "latestLocation" TEXT,
    "scheduledDelivery" TIMESTAMP(3),
    "checkpointCount" INTEGER NOT NULL DEFAULT 0,
    "checkpoints" JSONB,
    "rawText" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentTracking_pkey" PRIMARY KEY ("trackingNumber")
);

-- CreateIndex
CREATE INDEX "ShipmentTracking_manifestId_idx" ON "ShipmentTracking"("manifestId");

-- AddForeignKey
ALTER TABLE "ShipmentTracking" ADD CONSTRAINT "ShipmentTracking_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
