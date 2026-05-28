-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ACCESS', 'ADMIN', 'RECEIVER', 'INSPECTOR', 'CLAIMS_SPECIALIST');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('AMAZON', 'SHOPIFY');

-- CreateEnum
CREATE TYPE "PackageState" AS ENUM ('EXPECTED', 'IN_TRANSIT', 'LOST_IN_TRANSIT', 'AT_DOCK', 'IN_INSPECTION', 'INSPECTED', 'CLAIMS_STAGING', 'CLAIM_RESOLVED', 'RECOVERED_TO_INVENTORY');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD_SELLABLE', 'PACKAGING_DAMAGED', 'PRODUCT_DAMAGED', 'WRONG_ITEM', 'MISSING', 'BAD_FAKE_PRODUCT');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('L1', 'L2', 'L3', 'L4');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('RECEIVER_REJECTION', 'INSPECTOR_REJECTION', 'INSPECTION_VIDEO', 'PRODUCT_DAMAGE_PHOTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "accuracyRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "alertLevel" "AlertLevel",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manifest" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "status" "PackageState" NOT NULL,
    "marketplace" "Marketplace",
    "courierName" TEXT,
    "removalOrderId" TEXT,
    "expectedDate" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "inspectedBy" TEXT,
    "claimId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "marketplace" "Marketplace" NOT NULL,
    "platformOrderId" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3),
    "totalAmount" DOUBLE PRECISION,
    "totalQuantity" INTEGER,
    "fulfillmentChannel" TEXT,
    "manifestId" TEXT,
    "trackingNumber" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("platformOrderId")
);

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

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL,
    "returnItemId" TEXT NOT NULL,
    "platformReimbursementId" TEXT,
    "amountReimbursed" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "reimbursementReason" TEXT,
    "status" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Reimbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "lpn" TEXT NOT NULL,
    "orderId" TEXT,
    "orderDriveLink" TEXT,
    "lpnDriveLink" TEXT,
    "type" "EvidenceType" NOT NULL,
    "rawReference" TEXT,
    "uploadedByEmail" TEXT,
    "manifestId" TEXT,
    "returnItemId" TEXT,
    "claimReason" TEXT,
    "claimSubReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "level" "AlertLevel" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manifestId" TEXT,
    "targetUserId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "sopAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "sopViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronJobState" (
    "jobKey" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CronJobState_pkey" PRIMARY KEY ("jobKey")
);

-- CreateTable
CREATE TABLE "ItemStatus" (
    "lpn" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recoveryType" TEXT,
    "orderId" TEXT,
    "lpnDriveLink" TEXT,
    "orderDriveLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemStatus_pkey" PRIMARY KEY ("lpn")
);

-- CreateTable
CREATE TABLE "MissingItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fnsku" TEXT NOT NULL,
    "missingQuantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMZ_removal_orders" (
    "order-id" TEXT NOT NULL,
    "request-date" TIMESTAMP(3),
    "order-source" TEXT,
    "order-type" TEXT,
    "service-speed" TEXT,
    "order-status" TEXT,
    "last-updated-date" TIMESTAMP(3),
    "sku" TEXT,
    "fnsku" TEXT,
    "disposition" TEXT,
    "requested-quantity" INTEGER,
    "cancelled-quantity" INTEGER,
    "disposed-quantity" INTEGER,
    "shipped-quantity" INTEGER,
    "in-process-quantity" INTEGER,
    "removal-fee" DOUBLE PRECISION,
    "currency" TEXT,

    CONSTRAINT "AMZ_removal_orders_pkey" PRIMARY KEY ("order-id")
);

-- CreateTable
CREATE TABLE "AMZ_removal_shipments" (
    "id" TEXT NOT NULL,
    "request-date" TIMESTAMP(3),
    "order-id" TEXT,
    "shipment-date" TIMESTAMP(3),
    "sku" TEXT,
    "fnsku" TEXT,
    "disposition" TEXT,
    "shipped-quantity" INTEGER,
    "carrier" TEXT,
    "tracking-number" TEXT,
    "processedAt" TIMESTAMP(3),
    "shipment-status" TEXT,

    CONSTRAINT "AMZ_removal_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AMZ_reimbursements" (
    "reimbursement-id" TEXT NOT NULL,
    "approval-date" TIMESTAMP(3),
    "case-id" TEXT,
    "amazon-order-id" TEXT,
    "reason" TEXT,
    "sku" TEXT,
    "fnsku" TEXT,
    "asin" TEXT,
    "product-name" TEXT,
    "condition" TEXT,
    "currency-unit" TEXT,
    "amount-per-unit" DOUBLE PRECISION,
    "amount-total" DOUBLE PRECISION,
    "quantity-reimbursed-cash" INTEGER,
    "quantity-reimbursed-inventory" INTEGER,
    "quantity-reimbursed-total" INTEGER,
    "original-reimbursement-id" TEXT,
    "original-reimbursement-type" TEXT,

    CONSTRAINT "AMZ_reimbursements_pkey" PRIMARY KEY ("reimbursement-id")
);

-- CreateTable
CREATE TABLE "AMZ_customer_returns" (
    "lpn" TEXT NOT NULL,
    "return-date" TIMESTAMP(3),
    "order-id" TEXT,
    "sku" TEXT,
    "asin" TEXT,
    "fnsku" TEXT,
    "product-name" TEXT,
    "quantity" INTEGER,
    "fulfillment-center-id" TEXT,
    "detailed-disposition" TEXT,
    "reason" TEXT,
    "customer-comments" TEXT,
    "removal-order-type" TEXT,

    CONSTRAINT "AMZ_customer_returns_pkey" PRIMARY KEY ("lpn")
);

-- CreateTable
CREATE TABLE "return_prime_returns" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT,
    "requestType" TEXT,
    "status" TEXT,
    "channel" TEXT,
    "order_id" TEXT,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_prime_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shiprocket_returns" (
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
    "shipmentId" TEXT,
    "trackingNumber" TEXT,
    "sku" TEXT,
    "productName" TEXT,
    "quantity" INTEGER,
    "amount" DOUBLE PRECISION,
    "marketplace" "Marketplace" NOT NULL DEFAULT 'SHOPIFY',
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shiprocket_returns_pkey" PRIMARY KEY ("id")
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_return_tracking_pkey" PRIMARY KEY ("trackingNumber")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "lpn" TEXT NOT NULL,
    "return-date" TIMESTAMP(3),
    "sku" TEXT,
    "asin" TEXT,
    "fnsku" TEXT,
    "product-name" TEXT,
    "quantity" INTEGER,
    "fulfillment-center-id" TEXT,
    "detailed-disposition" TEXT,
    "reason" TEXT,
    "customer-comments" TEXT,
    "removal-order-type" TEXT,
    "marketplace" TEXT DEFAULT 'amazon',
    "orderId" TEXT,
    "itemPrice" DOUBLE PRECISION,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("lpn")
);

-- CreateTable
CREATE TABLE "AMZ_filed_claims" (
    "lpn" TEXT NOT NULL,
    "filed_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "case_id" TEXT,

    CONSTRAINT "AMZ_filed_claims_pkey" PRIMARY KEY ("lpn")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Manifest_trackingId_key" ON "Manifest"("trackingId");

-- CreateIndex
CREATE INDEX "ShipmentTracking_manifestId_idx" ON "ShipmentTracking"("manifestId");

-- CreateIndex
CREATE UNIQUE INDEX "Reimbursement_returnItemId_key" ON "Reimbursement"("returnItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Reimbursement_platformReimbursementId_key" ON "Reimbursement"("platformReimbursementId");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_lpn_key" ON "Evidence"("lpn");

-- CreateIndex
CREATE UNIQUE INDEX "MissingItem_orderId_fnsku_key" ON "MissingItem"("orderId", "fnsku");

-- CreateIndex
CREATE INDEX "return_prime_returns_order_id_idx" ON "return_prime_returns"("order_id");

-- CreateIndex
CREATE INDEX "return_prime_returns_trackingNumber_idx" ON "return_prime_returns"("trackingNumber");

-- CreateIndex
CREATE INDEX "shiprocket_returns_orderId_idx" ON "shiprocket_returns"("orderId");

-- CreateIndex
CREATE INDEX "shiprocket_returns_shipmentId_idx" ON "shiprocket_returns"("shipmentId");

-- CreateIndex
CREATE INDEX "shiprocket_returns_trackingNumber_idx" ON "shiprocket_returns"("trackingNumber");

-- CreateIndex
CREATE INDEX "shopify_return_tracking_sourceType_sourceId_idx" ON "shopify_return_tracking"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "shopify_return_tracking_marketplace_idx" ON "shopify_return_tracking"("marketplace");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentTracking" ADD CONSTRAINT "ShipmentTracking_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
