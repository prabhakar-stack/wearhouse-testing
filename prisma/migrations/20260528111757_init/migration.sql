/*
  Warnings:

  - The primary key for the `AMZ_customer_returns` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `lpn` on the `AMZ_customer_returns` table. All the data in the column will be lost.
  - Added the required column `license-plate-number` to the `AMZ_customer_returns` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AMZ_customer_returns" DROP CONSTRAINT "AMZ_customer_returns_pkey",
DROP COLUMN "lpn",
ADD COLUMN     "license-plate-number" TEXT NOT NULL,
ADD CONSTRAINT "AMZ_customer_returns_pkey" PRIMARY KEY ("license-plate-number");
