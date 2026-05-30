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
const REPORT_MAX_WAIT_MS = 45000;

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
    // console.log(`\n======================================`);
    // console.log(`SP-API: Requesting ${reportType}`);
    // console.log(`Time Range: ${start.toISOString()} to ${end.toISOString()}`);

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
        setTimeout(() => reject(new Error("createReport timeout")), 60000),
      ),
    ]);

    // console.log(`Report created successfully. ID: ${report.reportId}`);

    let reportStatus;
    const startedAt = Date.now();

    while (true) {
      reportStatus = await sp.callAPI({
        operation: "getReport",
        endpoint: "reports",
        path: { reportId: report.reportId },
      });

      // console.log(`Report status: ${reportStatus.processingStatus}`);

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
        `[WARN] SP-API report generation ${reportType} failed with status: ${reportStatus.processingStatus}`,
      );
      if (fs.existsSync(localPath)) {
        console.log(`Falling back to local file: ${fileName}.tsv`);
        return fs.readFileSync(localPath, "utf8");
      }
      return null;
    }

    // console.log("Downloading report document...");
    const document = await sp.callAPI({
      operation: "getReportDocument",
      endpoint: "reports",
      path: { reportDocumentId: reportStatus.reportDocumentId },
    });

    const reportData = await sp.download(document);
    fs.writeFileSync(localPath, reportData);
    // console.log(`Saved report output locally to ${fileName}.tsv`);
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
      await prisma.aMZRemovalOrder.upsert({
        where: { orderId: mapped.orderId ,sku:mapped.sku},
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
        await prisma.aMZRemovalShipment.create({
          data: mapped,
        });
      } else {
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

// ==========================================
// Core Application Mapping & Sync Functions
// ==========================================

function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

function toInt(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value) {
  const parsed = Number.parseFloat(
    String(value ?? "").replace(/[^0-9.-]/g, ""),
  );
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      value,
    ]),
  );
}

function getOrderId(row) {
  return pick(
    row.amazon_order_id,
    row.order_id,
    row.orderid,
    row.merchant_order_id,
  );
}

function mapReturnRow(row) {
  const normalized = normalizeRow(row);

  const orderId = getOrderId(normalized);

  const lpn = pick(
    normalized.license_plate_number,
    normalized.license_plate,
    normalized.lpn,
    normalized.return_authorization_id,
  );

  return {
    orderId,
    lpn,
    sku:
      pick(normalized.sku, normalized.merchant_sku, normalized.asin) ||
      lpn ||
      orderId,
    asin: pick(normalized.asin),
    fnsku: pick(normalized.fnsku),
    productName: pick(
      normalized.product_name,
      normalized.item_name,
      normalized.title,
    ),
    quantity: toInt(pick(normalized.quantity, normalized.qty), 1),
    reason:
      pick(
        normalized.return_reason,
        normalized.reason,
        normalized.customer_comment,
        normalized.customer_comments,
      ) || "Unknown",
    customerComments: pick(
      normalized.customer_comments,
      normalized.customer_comment,
    ),
    detailedDisposition: pick(
      normalized.detailed_disposition,
      normalized.disposition,
    ),
    itemPrice: toFloat(
      pick(normalized.item_price, normalized.price, normalized.item_amount),
    ),
    requestDate: toDate(
      pick(
        normalized.purchase_date,
        normalized.order_date,
        normalized.created_date,
        normalized.return_date,
      ),
    ),
  };
}

async function syncCoreReturns(rows) {
  if (!rows || rows.length === 0) {
    console.log("No rows for Core Returns to sync.");
    return 0;
  }

  console.log(`Syncing ${rows.length} Customer Returns to Core Tables...`);
  let successCount = 0;

  for (const group of chunkArray(rows, 10)) {
    const groupSaved = await Promise.all(
      group.map(async (rawRow) => {
        const mapped = mapReturnRow(rawRow);

        if (!mapped.orderId || !mapped.lpn) {
          console.log(
            "[WARN] Skipping Core Return row without orderId or lpn:",
            rawRow,
          );
          return null;
        }

        const rawLpns = mapped.lpn;
        const lpns =
          typeof rawLpns === "string"
            ? rawLpns
                .split(/[,\s]+/)
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean)
            : [mapped.lpn];

        const qty = Math.max(mapped.quantity || 1, lpns.length);
        const returnItems = [];

        try {
          for (let i = 0; i < qty; i++) {
            const lpnVal = lpns[i] || `${lpns[0] || "LPN"}-${i}`;

            const returnItem = await prisma.returnItem.upsert({
              where: { lpn: lpnVal },
              update: {
                orderId: mapped.orderId,
                sku: mapped.sku,
                asin: mapped.asin,
                fnsku: mapped.fnsku,
                productName: mapped.productName,
                returnDate: mapped.requestDate,
                fulfillmentCenterId: pick(
                  rawRow.fulfillment_center_id,
                  rawRow.fulfillmentcenterid,
                ),
                reason: mapped.reason,
                customerComments: mapped.customerComments,
                detailedDisposition: mapped.detailedDisposition,
                itemPrice: mapped.itemPrice,
              },
              create: {
                orderId: mapped.orderId,
                sku: mapped.sku,
                lpn: lpnVal,
                asin: mapped.asin,
                fnsku: mapped.fnsku,
                productName: mapped.productName,
                returnDate: mapped.requestDate,
                fulfillmentCenterId: pick(
                  rawRow.fulfillment_center_id,
                  rawRow.fulfillmentcenterid,
                ),
                reason: mapped.reason,
                customerComments: mapped.customerComments,
                detailedDisposition: mapped.detailedDisposition,
                itemPrice: mapped.itemPrice,
              },
            });
            returnItems.push(returnItem);
          }
          return returnItems[0] || null;
        } catch (e) {
          console.error(
            `[ERROR] Failed to upsert Core Return orderId=${mapped.orderId} lpn=${mapped.lpn}:`,
            e.message,
          );
          return null;
        }
      }),
    );

    successCount += groupSaved.filter(Boolean).length;
  }

  console.log(
    `Successfully synced ${successCount}/${rows.length} Customer Returns to Core Tables.`,
  );
  return successCount;
}

async function findOrCreateReturnItemForReimbursement(row) {
  const normalized = normalizeRow(row);
  const orderId = getOrderId(normalized);
  const sku = pick(normalized.sku, normalized.asin, normalized.fnsku);
  const lpn = pick(
    normalized.original_reimbursement_id,
    normalized.reimbursement_id,
    `reimbursement_${orderId || "unknown"}_${sku || "unknown"}`,
  );

  if (!sku) {
    return null;
  }

  const identityFilters = [
    sku ? { sku } : null,
    pick(normalized.fnsku) ? { fnsku: pick(normalized.fnsku) } : null,
    pick(normalized.asin) ? { asin: pick(normalized.asin) } : null,
  ].filter(Boolean);

  const existing =
    identityFilters.length > 0
      ? await prisma.returnItem.findFirst({
          where: {
            OR: identityFilters,
          },
        })
      : null;

  if (existing) {
    return existing;
  }

  return prisma.returnItem.upsert({
    where: { lpn },
    update: {
      orderId,
      sku,
      reason:
        pick(normalized.reason, normalized.original_reimbursement_type) ||
        "Reimbursement",
      productName: pick(normalized.product_name),
      fnsku: pick(normalized.fnsku),
      asin: pick(normalized.asin),
      itemPrice: toFloat(
        pick(normalized.amount_per_unit, normalized.amount_total),
      ),
    },
    create: {
      orderId,
      sku,
      lpn,
      reason:
        pick(normalized.reason, normalized.original_reimbursement_type) ||
        "Reimbursement",
      productName: pick(normalized.product_name),
      fnsku: pick(normalized.fnsku),
      asin: pick(normalized.asin),
      itemPrice: toFloat(
        pick(normalized.amount_per_unit, normalized.amount_total),
      ),
    },
  });
}

async function syncCoreReimbursements(rows) {
  if (!rows || rows.length === 0) return 0;

  console.log(`Syncing ${rows.length} Reimbursements to Core Tables...`);
  let successCount = 0;

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    const reimbursementId = pick(row.reimbursement_id);
    let orderId = getOrderId(row);

    if (!reimbursementId) {
      console.log(
        "[WARN] Skipping core reimbursement row without reimbursementId:",
        rawRow,
      );
      continue;
    }

    try {
      const returnItem = await findOrCreateReturnItemForReimbursement(row);
      if (!returnItem) {
        console.log(
          "[WARN] Skipping core reimbursement row without a matching return item:",
          rawRow,
        );
        continue;
      }

      orderId = orderId || returnItem.orderId;

      if (!orderId) {
        console.log(
          "[WARN] Skipping reimbursement because orderId is missing:",
          reimbursementId,
        );
        continue;
      }

      const order = await prisma.order.upsert({
        where: { platformOrderId: orderId },
        update: {
          marketplace: "AMAZON",
        },
        create: {
          marketplace: "AMAZON",
          platformOrderId: orderId,
          requestDate: toDate(pick(row.approval_date), new Date()),
        },
      });

      const reimbursementData = {
        returnItemId: returnItem.lpn,
        platformReimbursementId: reimbursementId,
        amountReimbursed:
          toFloat(pick(row.amount_total, row.amount_per_unit)) || 0,
        currency: pick(row.currency_unit) || "INR",
        reimbursementReason: pick(row.reason, row.original_reimbursement_type),
        status: pick(row.condition) || "DONE",
        filedAt: toDate(pick(row.approval_date)),
        resolvedAt: toDate(pick(row.approval_date)),
      };

      const reimbursementByPlatformId = await prisma.reimbursement.findUnique({
        where: { platformReimbursementId: reimbursementId },
      });
      const reimbursementByReturnItem = await prisma.reimbursement.findUnique({
        where: { returnItemId: returnItem.lpn },
      });

      if (
        reimbursementByPlatformId &&
        reimbursementByReturnItem &&
        reimbursementByPlatformId.id !== reimbursementByReturnItem.id
      ) {
        console.log(
          "[WARN] Skipping core reimbursement row with conflicting platformReimbursementId and returnItemId:",
          rawRow,
        );
        continue;
      }

      const existingReimbursement =
        reimbursementByPlatformId || reimbursementByReturnItem;

      if (existingReimbursement) {
        await prisma.reimbursement.update({
          where: { id: existingReimbursement.id },
          data: reimbursementData,
        });
      } else {
        await prisma.reimbursement.create({
          data: reimbursementData,
        });
      }
      successCount++;
    } catch (e) {
      console.error(
        `[ERROR] Failed to sync Core Reimbursement platformReimbursementId=${reimbursementId}:`,
        e.message,
      );
    }
  }

  console.log(
    `Successfully synced ${successCount}/${rows.length} Reimbursements to Core Tables.`,
  );
  return successCount;
}

async function syncCoreRemovalOrdersToOrders(rows) {
  if (!rows || rows.length === 0) return 0;
  console.log(
    `Syncing ${rows.length} Removal Orders to operational Order table...`,
  );
  let successCount = 0;
  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    const orderId = getOrderId(row);
    if (!orderId) continue;

    const requestDate = toDate(pick(row.request_date), new Date());
    const removalFee = toFloat(pick(row.removal_fee));

    try {
      await prisma.order.upsert({
        where: { platformOrderId: orderId },
        update: {
          marketplace: "AMAZON",
          requestDate: requestDate,
          totalAmount: removalFee,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
        create: {
          marketplace: "AMAZON",
          platformOrderId: orderId,
          requestDate: requestDate,
          totalAmount: removalFee,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
      });
      successCount++;
    } catch (e) {
      console.error(
        `[ERROR] Failed to sync operational Order for Removal Order ${orderId}:`,
        e.message,
      );
    }
  }
  console.log(
    `Successfully synced ${successCount}/${rows.length} Removal Orders to operational Order table.`,
  );
  return successCount;
}

async function main() {
  console.log("STARTING AMAZON RAW AND CORE REPORTS SYNC TASK...");

  // 1. Sync Removal Orders
  const removalOrdersTSV = await fetchReportData(
    REMOVAL_ORDERS_REPORT_TYPE,
    "removal_orders_0_30",
    30,
    0,
  );
  const removalOrderRows = parseTSV(removalOrdersTSV);
  const syncedRemovalOrders = await syncRemovalOrders(removalOrderRows);
  const syncedCoreOrders =
    await syncCoreRemovalOrdersToOrders(removalOrderRows);

  // 2. Sync Removal Shipments
  const removalShipmentsTSV = await fetchReportData(
    REMOVAL_SHIPMENTS_REPORT_TYPE,
    "removal_shipments_0_30",
    30,
    0,
  );
  const removalShipmentRows = parseTSV(removalShipmentsTSV);
  const syncedRemovalShipments =
    await syncRemovalShipments(removalShipmentRows);

  // 3. Sync Reimbursements
  const reimbursementsTSV = await fetchReportData(
    REIMBURSEMENTS_REPORT_TYPE,
    "reimbursements_0_30",
    30,
    0,
  );
  const reimbursementRows = parseTSV(reimbursementsTSV);
  const syncedReimbursements = await syncReimbursements(reimbursementRows);
  const syncedCoreReimbursements =
    await syncCoreReimbursements(reimbursementRows);

  // 4. Sync Customer Returns
  const customerReturnsTSV = await fetchReportData(
    RETURNS_REPORT_TYPE,
    "customer_returns_0_30",
    30,
    0,
  );
  const customerReturnRows = parseTSV(customerReturnsTSV);
  const syncedCustomerReturns = await syncCustomerReturns(customerReturnRows);
  const syncedCoreReturns = await syncCoreReturns(customerReturnRows);

  console.log("\n======================================");
  console.log("SYNC SUMMARY:");
  console.log(
    `- AMZRemovalOrders: ${syncedRemovalOrders} records synced to Raw`,
  );
  console.log(
    `- Orders (from Removal Orders): ${syncedCoreOrders} records synced to Core`,
  );
  console.log(
    `- AMZRemovalShipments: ${syncedRemovalShipments} records synced to Raw`,
  );
  console.log(
    `- AMZReimbursements: ${syncedReimbursements} records synced to Raw`,
  );
  console.log(
    `- Reimbursements: ${syncedCoreReimbursements} records synced to Core`,
  );
  console.log(
    `- AMZCustomerReturns: ${syncedCustomerReturns} records synced to Raw`,
  );
  console.log(`- ReturnItems: ${syncedCoreReturns} records synced to Core`);
  console.log("======================================");

  // Run the incremental repopulator after the fetch completes
  if (!process.env.DISABLE_REPOPULATE) {
    try {
      console.log("\nTriggering incremental repopulation task (repopulate_incremental.js)...");
      const repopulate = await import("./repopulate_incremental.js");
      if (repopulate && typeof repopulate.main === "function") {
        await repopulate.main();
        console.log("Incremental repopulation task finished.");
      } else {
        console.log("Incremental repopulation module did not export a main() function.");
      }
    } catch (err) {
      console.error("[WARN] Incremental repopulation task failed:", err?.message || err);
    }
  } else {
    console.log("DISABLE_REPOPULATE is set - skipping repopulation task.");
  }
}

// Equivalent of require.main === module in ES Modules
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main()
    .catch((e) => console.error("[FATAL ERROR] Sync process failed:", e))
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
    });
}

export { main };