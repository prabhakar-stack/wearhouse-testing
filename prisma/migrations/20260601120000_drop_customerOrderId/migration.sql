/* Migration to drop the now‑removed customerOrderId column */

DROP TABLE IF EXISTS "_prisma_migrations"; -- (no‑op, ensures migration runs even if previous state missing)

ALTER TABLE "Manifest" DROP COLUMN IF EXISTS "customerOrderId";
