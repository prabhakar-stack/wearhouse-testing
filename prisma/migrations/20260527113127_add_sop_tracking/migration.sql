-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "sopAcknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sopViewedAt" TIMESTAMP(3);
