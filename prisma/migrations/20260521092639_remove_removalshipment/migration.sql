-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ACCESS', 'ADMIN', 'RECEIVER', 'INSPECTOR', 'CLAIMS_SPECIALIST');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('AMAZON', 'SHOPIFY');

-- CreateEnum
CREATE TYPE "PackageState" AS ENUM ('EXPECTED', 'LOST_IN_TRANSIT', 'AT_DOCK', 'IN_INSPECTION', 'INSPECTED', 'CLAIMS_STAGING', 'CLAIM_RESOLVED', 'RECOVERED_TO_INVENTORY');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD_SELLABLE', 'PACKAGING_DAMAGED', 'PRODUCT_DAMAGED', 'WRONG_ITEM', 'MISSING', 'BAD_FAKE_PRODUCT');

-- CreateEnum
CREATE TYPE "InspectorDefectType" AS ENUM ('WAREHOUSE_DAMAGE', 'CARRIER_DAMAGE', 'CUSTOMER_DAMAGE', 'DEFECTIVE', 'EXPIRED', 'WRONG_ITEM_RECEIVED', 'MISSING_PARTS_ACCESSORIES', 'NOT_AS_DESCRIBED', 'FAKE_COUNTERFEIT');

-- CreateEnum
CREATE TYPE "HandshakeType" AS ENUM ('COURIER_TO_RECEIVER', 'RECEIVER_TO_INSPECTOR');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('L1', 'L2', 'L3', 'L4');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('RECEIVER_REJECTION', 'INSPECTION_VIDEO', 'PRODUCT_DAMAGE_PHOTO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL,
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "accuracyRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Manifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Handshake" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "senderId" TEXT,
    "receiverId" TEXT NOT NULL,
    "type" "HandshakeType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Handshake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "inspectorId" TEXT NOT NULL,
    "totalItemsExpected" INTEGER NOT NULL,
    "totalItemsScanned" INTEGER NOT NULL,
    "isMissingItems" BOOLEAN NOT NULL,
    "evidenceUrl" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "marketplace" "Marketplace" NOT NULL,
    "platformOrderId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT,
    "totalAmount" DOUBLE PRECISION,
    "fulfillmentChannel" TEXT,
    "imageUrl" TEXT,
    "manifestId" TEXT,
    "claimId" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("platformOrderId")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "orderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "lpn" TEXT NOT NULL,
    "asin" TEXT,
    "fnsku" TEXT,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL,
    "returnReason" TEXT NOT NULL,
    "customerComments" TEXT,
    "amazonDisposition" TEXT,
    "condition" "ItemCondition",
    "inspectorDefectType" "InspectorDefectType",
    "claimReason" TEXT,
    "claimSubReason" TEXT,
    "itemPrice" DOUBLE PRECISION,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("lpn")
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
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "manifestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemovalShipment" (
    "id" TEXT NOT NULL,
    "removalOrderId" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "shipmentDate" TIMESTAMP(3) NOT NULL,
    "sku" TEXT NOT NULL,
    "shippedQuantity" INTEGER NOT NULL,
    "disposition" TEXT NOT NULL,
    "manifestId" TEXT,

    CONSTRAINT "RemovalShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "lpn" TEXT NOT NULL,
    "orderId" TEXT,
    "orderDriveLink" TEXT,
    "lpnDriveLink" TEXT,
    "type" "EvidenceType" NOT NULL,
    "reason" TEXT,
    "rawReference" TEXT,
    "uploadedById" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSopStep" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertSopStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Manifest_trackingId_key" ON "Manifest"("trackingId");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_manifestId_key" ON "Inspection"("manifestId");

-- CreateIndex
CREATE UNIQUE INDEX "Reimbursement_returnItemId_key" ON "Reimbursement"("returnItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Reimbursement_platformReimbursementId_key" ON "Reimbursement"("platformReimbursementId");

-- CreateIndex
CREATE UNIQUE INDEX "RemovalShipment_trackingNumber_key" ON "RemovalShipment"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Evidence_lpn_key" ON "Evidence"("lpn");

-- AddForeignKey
ALTER TABLE "Handshake" ADD CONSTRAINT "Handshake_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handshake" ADD CONSTRAINT "Handshake_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handshake" ADD CONSTRAINT "Handshake_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("platformOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reimbursement" ADD CONSTRAINT "Reimbursement_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("lpn") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovalShipment" ADD CONSTRAINT "RemovalShipment_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("lpn") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "Manifest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
