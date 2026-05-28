-- CreateTable
CREATE TABLE "shopify_b2c_returns" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT,
    "requestType" TEXT,
    "status" TEXT,
    "channel" TEXT,
    "orderId" TEXT,
    "orderName" TEXT,
    "orderCreatedAt" TIMESTAMP(3),
    "fulfillmentId" TEXT,
    "deliveryStatus" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "customerEmail" TEXT,
    "postalCode" TEXT,
    "receivedStatus" BOOLEAN NOT NULL DEFAULT false,
    "inspectedStatus" BOOLEAN NOT NULL DEFAULT false,
    "rejectedStatus" BOOLEAN NOT NULL DEFAULT false,
    "archivedStatus" BOOLEAN NOT NULL DEFAULT false,
    "refundStatus" TEXT,
    "eligibleRefundStatus" BOOLEAN NOT NULL DEFAULT false,
    "refundedAmount" DOUBLE PRECISION DEFAULT 0,
    "originalProductId" TEXT,
    "sku" TEXT,
    "trackingNumber" TEXT,
    "quantity" INTEGER,
    "actualAmount" DOUBLE PRECISION,
    "imageSrc" TEXT,
    "marketplace" "Marketplace" NOT NULL DEFAULT 'SHOPIFY',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_b2c_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_b2b_returns" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT,
    "requestType" TEXT,
    "status" TEXT,
    "channel" TEXT,
    "orderId" TEXT,
    "orderName" TEXT,
    "orderCreatedAt" TIMESTAMP(3),
    "fulfillmentId" TEXT,
    "deliveryStatus" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "customerEmail" TEXT,
    "postalCode" TEXT,
    "courierName" TEXT,
    "courierSlug" TEXT,
    "trackingNumber" TEXT,
    "sku" TEXT,
    "productName" TEXT,
    "quantity" INTEGER,
    "amount" DOUBLE PRECISION,
    "marketplace" "Marketplace" NOT NULL DEFAULT 'SHOPIFY',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_b2b_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_return_tracking" (
    "trackingNumber" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL DEFAULT 'SHOPIFY',
    "courierName" TEXT,
    "courierSlug" TEXT,
    "latestStatus" TEXT,
    "latestLocation" TEXT,
    "scheduledDelivery" TIMESTAMP(3),
    "checkpointCount" INTEGER NOT NULL DEFAULT 0,
    "checkpoints" JSONB,
    "rawText" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_return_tracking_pkey" PRIMARY KEY ("trackingNumber")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_b2c_returns_requestNumber_key" ON "shopify_b2c_returns"("requestNumber");

-- CreateIndex
CREATE INDEX "shopify_b2c_returns_orderId_idx" ON "shopify_b2c_returns"("orderId");

-- CreateIndex
CREATE INDEX "shopify_b2c_returns_trackingNumber_idx" ON "shopify_b2c_returns"("trackingNumber");

-- CreateIndex
CREATE INDEX "shopify_b2b_returns_orderId_idx" ON "shopify_b2b_returns"("orderId");

-- CreateIndex
CREATE INDEX "shopify_b2b_returns_trackingNumber_idx" ON "shopify_b2b_returns"("trackingNumber");

-- CreateIndex
CREATE INDEX "shopify_return_tracking_sourceType_sourceId_idx" ON "shopify_return_tracking"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "shopify_return_tracking_marketplace_idx" ON "shopify_return_tracking"("marketplace");
