import "dotenv/config";
import SellingPartnerAPI from "amazon-sp-api";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

const RETURNS_REPORT_TYPE = "GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA";
const REIMBURSEMENTS_REPORT_TYPE = "GET_FBA_REIMBURSEMENTS_DATA";
const REMOVAL_ORDERS_REPORT_TYPE = "GET_FBA_FULFILLMENT_REMOVAL_ORDER_DETAIL_DATA";
const REMOVAL_SHIPMENTS_REPORT_TYPE = "GET_FBA_FULFILLMENT_REMOVAL_SHIPMENT_DETAIL_DATA";

const REPORT_POLL_INTERVAL_MS = 15000;
const REPORT_MAX_WAIT_MS = 300000;

// Field definitions mapping database fields to Amazon report headers
const REMOVAL_ORDER_FIELDS = {
  orderId: { source: "order-id", type: "string", isId: true },
  requestDate: { source: "request-date", type: "date" },
  orderSource: { source: "order-source", type: "string" },
  orderType: { source: "order-type", type: "string" },
  serviceSpeed: { source: "service-speed", type: "string" },
  orderStatus: { source: "order-status", type: "string" },
  lastUpdatedDate: { source: "last-updated-date", type: "date" },
  sku: { source: "sku", type: "string" },
  fnsku: { source: "fnsku", type: "string" },
  disposition: { source: "disposition", type: "string" },
  requestedQuantity: { source: "requested-quantity", type: "int" },
  cancelledQuantity: { source: "cancelled-quantity", type: "int" },
  disposedQuantity: { source: "disposed-quantity", type: "int" },
  shippedQuantity: { source: "shipped-quantity", type: "int" },
  inProcessQuantity: { source: "in-process-quantity", type: "int" },
  removalFee: { source: "removal-fee", type: "float" },
  currency: { source: "currency", type: "string" },
};

const REMOVAL_SHIPMENT_FIELDS = {
  requestDate: { source: "request-date", type: "date" },
  orderId: { source: "order-id", type: "string" },
  shipmentDate: { source: "shipment-date", type: "date" },
  sku: { source: "sku", type: "string" },
  fnsku: { source: "fnsku", type: "string" },
  disposition: { source: "disposition", type: "string" },
  shippedQuantity: { source: "shipped-quantity", type: "int" },
  carrier: { source: "carrier", type: "string" },
  trackingNumber: { source: "tracking-number", type: "string" },
  shipmentStatus: { source: "shipment-status", type: "string" },
};

const REIMBURSEMENT_FIELDS = {
  reimbursementId: { source: "reimbursement-id", type: "string", isId: true },
  approvalDate: { source: "approval-date", type: "date" },
  caseId: { source: "case-id", type: "string" },
  amazonOrderId: { source: "amazon-order-id", type: "string" },
  reason: { source: "reason", type: "string" },
  sku: { source: "sku", type: "string" },
  fnsku: { source: "fnsku", type: "string" },
  asin: { source: "asin", type: "string" },
  productName: { source: "product-name", type: "string" },
  condition: { source: "condition", type: "string" },
  currencyUnit: { source: "currency-unit", type: "string" },
  amountPerUnit: { source: "amount-per-unit", type: "float" },
  amountTotal: { source: "amount-total", type: "float" },
  quantityReimbursedCash: { source: "quantity-reimbursed-cash", type: "int" },
  quantityReimbursedInventory: {
    source: "quantity-reimbursed-inventory",
    type: "int",
  },
  quantityReimbursedTotal: { source: "quantity-reimbursed-total", type: "int" },
  originalReimbursementId: {
    source: "original-reimbursement-id",
    type: "string",
  },
  originalReimbursementType: {
    source: "original-reimbursement-type",
    type: "string",
  },
};

const CUSTOMER_RETURN_FIELDS = {
  lpn: { source: "license-plate-number", type: "string", isId: true },
  returnDate: { source: "return-date", type: "date" },
  orderId: { source: "order-id", type: "string" },
  sku: { source: "sku", type: "string" },
  asin: { source: "asin", type: "string" },
  fnsku: { source: "fnsku", type: "string" },
  productName: { source: "product-name", type: "string" },
  quantity: { source: "quantity", type: "int" },
  fulfillmentCenterId: { source: "fulfillment-center-id", type: "string" },
  detailedDisposition: { source: "detailed-disposition", type: "string" },
  reason: { source: "reason", type: "string" },
  customerComments: { source: "customer-comments", type: "string" },
  removalOrderType: { source: "removal-order-type", type: "string" },
};

// Check if credentials are set
const hasConfig =
  process.env.REGION &&
  process.env.REFRESH_TOKEN &&
  process.env.CLIENT_ID &&
  process.env.CLIENT_SECRET &&
  process.env.MARKETPLACE_ID;

let sp = null;
if (hasConfig) {
  sp = new SellingPartnerAPI({
    region: process.env.REGION,
    refresh_token: process.env.REFRESH_TOKEN,
    credentials: {
      SELLING_PARTNER_APP_CLIENT_ID: process.env.CLIENT_ID,
      SELLING_PARTNER_APP_CLIENT_SECRET: process.env.CLIENT_SECRET,
    },
  });
}

const MARKETPLACE_ID = process.env.MARKETPLACE_ID;

/**
 * Fetch report from Selling Partner API or fallback to local file
 */
async function fetchReportData(reportType, fileName, startDaysAgo, endDaysAgo) {
  const localPath = path.join(process.cwd(), `${fileName}.tsv`);

  if (!hasConfig) {
    console.log(
      `[WARN] SP-API credentials not configured. Falling back to local file ${fileName}.tsv`,
    );
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, "utf8");
    }
    console.log(`[ERROR] Local file ${fileName}.tsv not found.`);
    return null;
  }

  const end = new Date();
  end.setDate(end.getDate() - endDaysAgo);
  const start = new Date();
  start.setDate(start.getDate() - startDaysAgo);

  try {
    console.log(`\n======================================`);
    console.log(`SP-API: Requesting ${reportType}`);
    console.log(`Time Range: ${start.toISOString()} to ${end.toISOString()}`);

    const report = await Promise.race([
      sp.callAPI({
        operation: "createReport",
        endpoint: "reports",
        body: {
          reportType,
          dataStartTime: start.toISOString(),
          dataEndTime: end.toISOString(),
          marketplaceIds: [MARKETPLACE_ID],
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("createReport timeout")), 180000),
      ),
    ]);

    console.log(`Report created successfully. ID: ${report.reportId}`);

    let reportStatus;
    const startedAt = Date.now();

    while (true) {
      reportStatus = await sp.callAPI({
        operation: "getReport",
        endpoint: "reports",
        path: { reportId: report.reportId },
      });

      console.log(`Report processing status: ${reportStatus.processingStatus}`);

      if (
        reportStatus.processingStatus === "DONE" ||
        reportStatus.processingStatus === "DONE_NO_DATA" ||
        reportStatus.processingStatus === "FATAL" ||
        reportStatus.processingStatus === "CANCELLED"
      ) {
        break;
      }

      // Safety timeout to prevent infinite loop
      if (Date.now() - startedAt >= REPORT_MAX_WAIT_MS) {
        console.log(
          `[WARN] SP-API report ${reportType} stayed in ${reportStatus.processingStatus} for ${Math.round(
            REPORT_MAX_WAIT_MS / 1000,
          )}s. Falling back to local file if available.`,
        );
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, REPORT_POLL_INTERVAL_MS));
    }

    if (reportStatus.processingStatus !== "DONE") {
      console.log(
        `[WARN] SP-API report generation ${reportType} failed/incomplete with status: ${reportStatus.processingStatus}`,
      );
      if (fs.existsSync(localPath)) {
        console.log(`Falling back to local file: ${fileName}.tsv`);
        return fs.readFileSync(localPath, "utf8");
      }
      return null;
    }

    console.log("Downloading report document from Amazon...");
    const document = await sp.callAPI({
      operation: "getReportDocument",
      endpoint: "reports",
      path: { reportDocumentId: reportStatus.reportDocumentId },
    });

    const reportData = await sp.download(document);
    fs.writeFileSync(localPath, reportData);
    console.log(`Saved downloaded report output locally to ${fileName}.tsv`);
    return reportData.toString();
  } catch (error) {
    console.error(
      `[ERROR] SP-API error during ${reportType}:`,
      error.response?.data || error.message || error,
    );
    if (fs.existsSync(localPath)) {
      console.log(`Falling back to local file: ${fileName}.tsv`);
      return fs.readFileSync(localPath, "utf8");
    }
    return null;
  }
}

/**
 * Parse TSV text to array of objects
 */
function parseTSV(tsv) {
  if (!tsv) return [];
  const lines = tsv.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const header = lines[0].split("\t").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = cols[j] !== undefined ? cols[j] : null;
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Normalize and find corresponding value case/character insensitively
 */
function getNormalizedValue(row, sourceHeader) {
  const target = sourceHeader.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [key, value] of Object.entries(row)) {
    const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normKey === target) {
      return value;
    }
  }
  return undefined;
}

/**
 * Map raw TSV row to Prisma model fields
 */
function mapRow(row, fieldDefs) {
  const mapped = {};
  for (const [destKey, def] of Object.entries(fieldDefs)) {
    const rawVal = getNormalizedValue(row, def.source);
    if (
      rawVal === undefined ||
      rawVal === null ||
      String(rawVal).trim() === ""
    ) {
      mapped[destKey] = null;
      continue;
    }

    const trimmed = String(rawVal).trim();
    if (def.type === "int") {
      const val = Number.parseInt(trimmed, 10);
      mapped[destKey] = Number.isFinite(val) ? val : null;
    } else if (def.type === "float") {
      const val = Number.parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
      mapped[destKey] = Number.isFinite(val) ? val : null;
    } else if (def.type === "date") {
      const val = new Date(trimmed);
      mapped[destKey] = Number.isNaN(val.getTime()) ? null : val;
    } else {
      mapped[destKey] = trimmed;
    }
  }
  return mapped;
}

/**
 * Chunk an array for batch operations
 */
function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Sync Removal Orders
 */
async function syncRemovalOrders(rows) {
  // console.log(`Syncing ${rows.length} Removal Orders...`);
  let successCount = 0;

  for (const rawRow of rows) {
    const mapped = mapRow(rawRow, REMOVAL_ORDER_FIELDS);

    if (!mapped.orderId) {
      console.log(
        `[WARN] Skipping Removal Order row without order-id:`,
        rawRow,
      );
      continue;
    }

    try {
      // ----------------------------------------------------
      // [DATABASE LOAD POINT] Staging Table Insertion
      // Target: AMZRemovalOrder (Staging/Raw Table)
      // Operation: Upserting record using combined key orderId_sku
      // ----------------------------------------------------
      await prisma.aMZRemovalOrder.upsert({
        where: { 
          orderId_sku: { 
            orderId: mapped.orderId, 
            sku: mapped.sku 
          } 
        },
        update: mapped,
        create: mapped,
      });
      successCount++;
    } catch (e) {
      console.error(
        `[ERROR] Failed to upsert Removal Order ${mapped.orderId}:`,
        e.message,
      );
    }
  }
  // console.log(
  //   `Successfully synced ${successCount}/${rows.length} Removal Orders.`,
  // );
  return successCount;
}

/**
 * Sync Removal Shipments
 */
async function syncRemovalShipments(rows) {
  // console.log(`Syncing ${rows.length} Removal Shipments...`);
  let successCount = 0;

  for (const rawRow of rows) {
    const mapped = mapRow(rawRow, REMOVAL_SHIPMENT_FIELDS);

    if (!mapped.orderId && !mapped.sku) {
      console.log(
        `[WARN] Skipping Removal Shipment row without order-id and sku:`,
        rawRow,
      );
      continue;
    }

    try {
      // Avoid duplicates: check if a record with the same key fields already exists
      const existing = await prisma.aMZRemovalShipment.findFirst({
        where: {
          orderId: mapped.orderId,
          sku: mapped.sku,
          trackingNumber: mapped.trackingNumber,
          shipmentDate: mapped.shipmentDate,
          shippedQuantity: mapped.shippedQuantity,
        },
      });

      if (!existing) {
        // ----------------------------------------------------
        // [DATABASE LOAD POINT] Staging Table Insertion
        // Target: AMZRemovalShipment (Staging/Raw Table)
        // Operation: Creating new record since no duplicate was found
        // ----------------------------------------------------
        await prisma.aMZRemovalShipment.create({
          data: mapped,
        });
      } else {
        // ----------------------------------------------------
        // [DATABASE LOAD POINT] Staging Table Update
        // Target: AMZRemovalShipment (Staging/Raw Table)
        // Operation: Updating existing record with matching key fields
        // ----------------------------------------------------
        await prisma.aMZRemovalShipment.update({
          where: { id: existing.id },
          data: mapped,
        });
      }
      successCount++;
    } catch (e) {
      console.error(
        `[ERROR] Failed to sync Removal Shipment order=${mapped.orderId} sku=${mapped.sku}:`,
        e.message,
      );
    }
  }
  // console.log(
  //   `Successfully synced ${successCount}/${rows.length} Removal Shipments.`,
  // );
  return successCount;
}

/**
 * Sync Reimbursements
 */
async function syncReimbursements(rows) {
  // console.log(`Syncing ${rows.length} Reimbursements...`);
  let successCount = 0;

  for (const rawRow of rows) {
    const mapped = mapRow(rawRow, REIMBURSEMENT_FIELDS);

    if (!mapped.reimbursementId) {
      console.log(
        `[WARN] Skipping Reimbursement row without reimbursement-id:`,
        rawRow,
      );
      continue;
    }

    try {
      // ----------------------------------------------------
      // [DATABASE LOAD POINT] Staging Table Insertion
      // Target: AMZReimbursement (Staging/Raw Table)
      // Operation: Upserting record using reimbursementId key
      // ----------------------------------------------------
      await prisma.aMZReimbursement.upsert({
        where: { reimbursementId: mapped.reimbursementId },
        update: mapped,
        create: mapped,
      });
      successCount++;
    } catch (e) {
      console.error(
        `[ERROR] Failed to upsert Reimbursement ${mapped.reimbursementId}:`,
        e.message,
      );
    }
  }
  // console.log(
  //   `Successfully synced ${successCount}/${rows.length} Reimbursements.`,
  // );
  return successCount;
}

/**
 * Sync Customer Returns
 */
async function syncCustomerReturns(rows) {
  // console.log(`Syncing ${rows.length} Customer Returns...`);
  let successCount = 0;

  for (const rawRow of rows) {
    const mapped = mapRow(rawRow, CUSTOMER_RETURN_FIELDS);

    if (!mapped.lpn) {
      console.log(
        `[WARN] Skipping Customer Return row without license-plate-number (lpn):`,
        rawRow,
      );
      continue;
    }

    try {
      // ----------------------------------------------------
      // [DATABASE LOAD POINT] Staging Table Insertion
      // Target: AMZCustomerReturn (Staging/Raw Table)
      // Operation: Upserting record using LPN (License Plate Number)
      // ----------------------------------------------------
      await prisma.aMZCustomerReturn.upsert({
        where: { lpn: mapped.lpn },
        update: mapped,
        create: mapped,
      });
      successCount++;
    } catch (e) {
      console.error(
        `[ERROR] Failed to upsert Customer Return ${mapped.lpn}:`,
        e.message,
      );
    }
  }
  // console.log(
  //   `Successfully synced ${successCount}/${rows.length} Customer Returns.`,
  // );
  return successCount;
}

async function main() {
  console.log("STARTING AMAZON RAW DATA FETCH TASK...");

  // =========================================================================
  // STAGE 1: REMOVAL ORDERS RAW FETCH & STAGING
  // =========================================================================
  console.log("\n[STAGE 1] Fetching and Staging Removal Orders...");
  const removalOrdersTSV = await fetchReportData(
    REMOVAL_ORDERS_REPORT_TYPE,
    "removal_orders_0_30",
    30,
    0,
  );
  const removalOrderRows = parseTSV(removalOrdersTSV);
  
  console.log("[STAGE 1.1] Loading raw data into AMZRemovalOrder staging table...");
  const syncedRemovalOrders = await syncRemovalOrders(removalOrderRows);

  // =========================================================================
  // STAGE 2: REMOVAL SHIPMENTS RAW FETCH & STAGING
  // =========================================================================
  console.log("\n[STAGE 2] Fetching and Staging Removal Shipments...");
  const removalShipmentsTSV = await fetchReportData(
    REMOVAL_SHIPMENTS_REPORT_TYPE,
    "removal_shipments_0_30",
    30,
    0,
  );
  const removalShipmentRows = parseTSV(removalShipmentsTSV);
  
  console.log("[STAGE 2.1] Loading raw data into AMZRemovalShipment staging table...");
  const syncedRemovalShipments =
    await syncRemovalShipments(removalShipmentRows);

  // =========================================================================
  // STAGE 3: REIMBURSEMENTS RAW FETCH & STAGING
  // =========================================================================
  console.log("\n[STAGE 3] Fetching and Staging Reimbursements...");
  const reimbursementsTSV = await fetchReportData(
    REIMBURSEMENTS_REPORT_TYPE,
    "reimbursements_0_30",
    30,
    0,
  );
  const reimbursementRows = parseTSV(reimbursementsTSV);
  
  console.log("[STAGE 3.1] Loading raw data into AMZReimbursement staging table...");
  const syncedReimbursements = await syncReimbursements(reimbursementRows);

  // =========================================================================
  // STAGE 4: CUSTOMER RETURNS RAW FETCH & STAGING
  // =========================================================================
  console.log("\n[STAGE 4] Fetching and Staging Customer Returns...");
  const customerReturnsTSV = await fetchReportData(
    RETURNS_REPORT_TYPE,
    "customer_returns_0_30",
    30,
    0,
  );
  const customerReturnRows = parseTSV(customerReturnsTSV);
  
  console.log("[STAGE 4.1] Loading raw data into AMZCustomerReturn staging table...");
  const syncedCustomerReturns = await syncCustomerReturns(customerReturnRows);

  console.log("\n======================================");
  console.log("RAW FETCH AND STAGE SUMMARY:");
  console.log(`- AMZRemovalOrders: ${syncedRemovalOrders} records loaded to staging`);
  console.log(`- AMZRemovalShipments: ${syncedRemovalShipments} records loaded to staging`);
  console.log(`- AMZReimbursements: ${syncedReimbursements} records loaded to staging`);
  console.log(`- AMZCustomerReturns: ${syncedCustomerReturns} records loaded to staging`);
  console.log("======================================");
}

// Equivalent of require.main === module in ES Modules
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main()
    .catch((e) => console.error("[FATAL ERROR] Fetch task failed:", e))
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
    });
}

export { main };