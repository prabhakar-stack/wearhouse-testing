-- CreateTable
CREATE TABLE "DeliveryOtp" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT,
    "otp" TEXT NOT NULL,
    "source" TEXT,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryOtp_trackingId_consumedAt_createdAt_idx" ON "DeliveryOtp"("trackingId", "consumedAt", "createdAt");