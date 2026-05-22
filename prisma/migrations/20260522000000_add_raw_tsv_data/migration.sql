ALTER TABLE "Order"
ADD COLUMN "rawTsvData" JSONB;

ALTER TABLE "ReturnItem"
ADD COLUMN "rawTsvData" JSONB;

ALTER TABLE "Reimbursement"
ADD COLUMN "rawTsvData" JSONB;

ALTER TABLE "RemovalShipment"
ADD COLUMN "rawTsvData" JSONB;