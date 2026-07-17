-- CreateTable
CREATE TABLE "disposition_images" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "driveFileId" TEXT,
    "driveLink" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disposition_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disposition_other_logs" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "disposition_text" TEXT NOT NULL,
    "tracking_id" TEXT,
    "lpn" TEXT,
    "recorded_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disposition_other_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disposition_images_sku_category_key" ON "disposition_images"("sku", "category");
