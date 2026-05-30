/*
  Warnings:

  - You are about to drop the column `order_id` on the `return_prime_returns` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "return_prime_returns_order_id_idx";

-- AlterTable
ALTER TABLE "return_prime_returns" DROP COLUMN "order_id",
ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "return_prime_returns_orderId_idx" ON "return_prime_returns"("orderId");
