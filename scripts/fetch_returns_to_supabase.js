import "dotenv/config";
import SellingPartnerAPI from "amazon-sp-api";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

const sp = new SellingPartnerAPI({
  region: process.env.REGION,
  refresh_token: process.env.REFRESH_TOKEN,
  credentials: {
    SELLING_PARTNER_APP_CLIENT_ID: process.env.CLIENT_ID,
    SELLING_PARTNER_APP_CLIENT_SECRET: process.env.CLIENT_SECRET,
  },
});

const MARKETPLACE_ID = process.env.MARKETPLACE_ID;
const prisma = new PrismaClient();

const RETURNS_REPORT_TYPE       = "GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA";
const REIMBURSEMENTS_REPORT_TYPE= "GET_FBA_REIMBURSEMENTS_DATA";
const REMOVAL_ORDERS_REPORT_TYPE= "GET_FBA_FULFILLMENT_REMOVAL_ORDER_DETAIL_DATA";
const REMOVAL_SHIPMENTS_REPORT_TYPE = "GET_FBA_FULFILLMENT_REMOVAL_SHIPMENT_DETAIL_DATA";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) throw new Error(`Missing env var: ${name}`);
  return value.trim();
}

function validateConfig() {
  ["REGION", "REFRESH_TOKEN", "CLIENT_ID", "CLIENT_SECRET", "MARKETPLACE_ID", "DATABASE_URL"]
    .forEach(requireEnv);
}

// ─────────────────────────────────────────────────────────────────────────────
// SP-API Fetch (with local TSV fallback)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchReport(reportType, fileName, start, end) {
  const localPath = path.join(process.cwd(), `${fileName}.tsv`);
  try {
    const report = await sp.callAPI({
      operation: "createReport",
      endpoint: "reports",
      body: { reportType, dataStartTime: start.toISOString(), dataEndTime: end.toISOString(), marketplaceIds: [MARKETPLACE_ID] },
    });
    console.log(`[INFO] Created report for ${reportType}, ID: ${report.reportId}`);

    let reportStatus;
    const startedAt = Date.now();
    // Poll for report completion with detailed logging and safety counter
let pollAttempts = 0;
const maxPollAttempts = 10; // safeguard to avoid infinite loops
while (true) {
  pollAttempts++;
  console.log(`[INFO] ${reportType} poll attempt ${pollAttempts}`);
  reportStatus = await sp.callAPI({
    operation: "getReport",
    endpoint: "reports",
    path: { reportId: report.reportId },
  });
  if (["DONE", "DONE_NO_DATA", "FATAL", "CANCELLED"].includes(reportStatus.processingStatus)) {
    console.log(`[INFO] ${reportType} final status: ${reportStatus.processingStatus}`);
    break;
  }
  if (Date.now() - startedAt >= 45000 || pollAttempts >= maxPollAttempts) {
    console.log(`[WARN] ${reportType} timed out or max attempts reached (${reportStatus.processingStatus})`);
    break;
  }
  await new Promise((r) => setTimeout(r, 15000));
}


    if (reportStatus.processingStatus !== "DONE") {
      console.log(`[WARN] ${reportType}: ${reportStatus.processingStatus}`);
      if (fs.existsSync(localPath)) { console.log(`[Fallback] ${fileName}.tsv`); return fs.readFileSync(localPath, "utf8"); }
      return null;
    }

    const doc = await sp.callAPI({ operation: "getReportDocument", endpoint: "reports", path: { reportDocumentId: reportStatus.reportDocumentId } });
    const data = await sp.download(doc);
    fs.writeFileSync(localPath, data);
    return data.toString();

  } catch (err) {
    console.error(`[ERROR] SP-API ${reportType}:`, err.response?.data || err.message || err);
    if (fs.existsSync(localPath)) { console.log(`[Fallback] ${fileName}.tsv`); return fs.readFileSync(localPath, "utf8"); }
    return null;
  }
}

function fetchChunk(reportType, fileName, daysBack) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  return fetchReport(reportType, fileName, start, end);
}

// ─────────────────────────────────────────────────────────────────────────────
// TSV Parser
// ─────────────────────────────────────────────────────────────────────────────

function parseTSV(tsv) {
  if (!tsv) return [];
  const lines = tsv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split("\t").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const obj = {};
    header.forEach((key, i) => { obj[key] = cols[i] !== undefined ? cols[i].trim() : null; });
    return obj;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pick(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function toInt(v, fallback = null) {
  const n = Number.parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toFloat(v) {
  const n = Number.parseFloat(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toDate(v, fallback = null) {
  if (!v) return fallback;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function normalizeRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]+/g, "_"), v])
  );
}

function getOrderId(row) {
  return pick(row.amazon_order_id, row.order_id, row.orderid, row.merchant_order_id);
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Staging: AMZRemovalOrder
// ─────────────────────────────────────────────────────────────────────────────

async function stageRemovalOrders(rows) {
  let count = 0;
  for (const raw of rows) {
    const orderId = pick(raw["order-id"]);
    if (!orderId) continue;
    const data = {
      requestDate:       toDate(pick(raw["request-date"])),
      orderSource:       pick(raw["order-source"]),
      orderType:         pick(raw["order-type"]),
      serviceSpeed:      pick(raw["service-speed"]),
      orderStatus:       pick(raw["order-status"]),
      lastUpdatedDate:   toDate(pick(raw["last-updated-date"])),
      sku:               pick(raw["sku"]),
      fnsku:             pick(raw["fnsku"]),
      disposition:       pick(raw["disposition"]),
      requestedQuantity: toInt(pick(raw["requested-quantity"])),
      cancelledQuantity: toInt(pick(raw["cancelled-quantity"])),
      disposedQuantity:  toInt(pick(raw["disposed-quantity"])),
      shippedQuantity:   toInt(pick(raw["shipped-quantity"])),
      inProcessQuantity: toInt(pick(raw["in-process-quantity"])),
      removalFee:        toFloat(pick(raw["removal-fee"])),
      currency:          pick(raw["currency"]),
    };
    try {
      const existing = await prisma.aMZRemovalOrder.findFirst({ where: { orderId, sku: data.sku } });
      if (existing) await prisma.aMZRemovalOrder.update({ where: { id: existing.id }, data });
      else await prisma.aMZRemovalOrder.create({ data: { orderId, ...data } });
      count++;
    } catch (e) { console.error(`[ERROR] AMZRemovalOrder ${orderId}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Staging: AMZRemovalShipment
// ─────────────────────────────────────────────────────────────────────────────

async function stageRemovalShipments(rows) {
  let count = 0;
  for (const raw of rows) {
    const orderId = pick(raw["order-id"]);
    const sku     = pick(raw["sku"]);
    if (!orderId && !sku) continue;
    const data = {
      requestDate:    toDate(pick(raw["request-date"])),
      orderId,
      shipmentDate:   toDate(pick(raw["shipment-date"])),
      sku,
      fnsku:          pick(raw["fnsku"]),
      disposition:    pick(raw["disposition"]),
      shippedQuantity:toInt(pick(raw["shipped-quantity"])),
      carrier:        pick(raw["carrier"]),
      trackingNumber: pick(raw["tracking-number"]),
      shipmentStatus: pick(raw["shipment-status"]),
    };
    try {
      const existing = await prisma.aMZRemovalShipment.findFirst({
        where: { orderId, sku, trackingNumber: data.trackingNumber },
      });
      if (existing) await prisma.aMZRemovalShipment.update({ where: { id: existing.id }, data });
      else await prisma.aMZRemovalShipment.create({ data });
      count++;
    } catch (e) { console.error(`[ERROR] AMZRemovalShipment order=${orderId} sku=${sku}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Staging: AMZReimbursement
// ─────────────────────────────────────────────────────────────────────────────

async function stageReimbursements(rows) {
  let count = 0;
  for (const raw of rows) {
    const reimbursementId = pick(raw["reimbursement-id"]);
    if (!reimbursementId) continue;
    const data = {
      approvalDate:               toDate(pick(raw["approval-date"])),
      caseId:                     pick(raw["case-id"]),
      amazonOrderId:              pick(raw["amazon-order-id"]),
      reason:                     pick(raw["reason"]),
      sku:                        pick(raw["sku"]),
      fnsku:                      pick(raw["fnsku"]),
      asin:                       pick(raw["asin"]),
      productName:                pick(raw["product-name"]),
      condition:                  pick(raw["condition"]),
      currencyUnit:               pick(raw["currency-unit"]),
      amountPerUnit:              toFloat(pick(raw["amount-per-unit"])),
      amountTotal:                toFloat(pick(raw["amount-total"])),
      quantityReimbursedCash:     toInt(pick(raw["quantity-reimbursed-cash"])),
      quantityReimbursedInventory:toInt(pick(raw["quantity-reimbursed-inventory"])),
      quantityReimbursedTotal:    toInt(pick(raw["quantity-reimbursed-total"])),
      originalReimbursementId:    pick(raw["original-reimbursement-id"]),
      originalReimbursementType:  pick(raw["original-reimbursement-type"]),
    };
    try {
      await prisma.aMZReimbursement.upsert({ where: { reimbursementId }, update: data, create: { reimbursementId, ...data } });
      count++;
    } catch (e) { console.error(`[ERROR] AMZReimbursement ${reimbursementId}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Staging: AMZCustomerReturn
// ─────────────────────────────────────────────────────────────────────────────

async function stageCustomerReturns(rows) {
  let count = 0;
  for (const raw of rows) {
    const lpn = pick(raw["license-plate-number"]);
    if (!lpn) continue;
    const data = {
      returnDate:          toDate(pick(raw["return-date"])),
      orderId:             pick(raw["order-id"]),
      sku:                 pick(raw["sku"]),
      asin:                pick(raw["asin"]),
      fnsku:               pick(raw["fnsku"]),
      productName:         pick(raw["product-name"]),
      quantity:            toInt(pick(raw["quantity"])),
      fulfillmentCenterId: pick(raw["fulfillment-center-id"]),
      detailedDisposition: pick(raw["detailed-disposition"]),
      reason:              pick(raw["reason"]),
      customerComments:    pick(raw["customer-comments"]),
      removalOrderType:    pick(raw["removal-order-type"]),
    };
    try {
      const existing = await prisma.aMZCustomerReturn.findFirst({ where: { lpn } });
      if (existing) await prisma.aMZCustomerReturn.update({ where: { id: existing.id }, data });
      else await prisma.aMZCustomerReturn.create({ data: { lpn, ...data } });
      count++;
    } catch (e) { console.error(`[ERROR] AMZCustomerReturn ${lpn}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Operational: Order (from AMZRemovalOrder rows)
// ─────────────────────────────────────────────────────────────────────────────

async function materializeOrders(rows) {
  let count = 0;
  for (const raw of rows) {
    const row = normalizeRow(raw);
    const orderId = getOrderId(row);
    if (!orderId) continue;
    try {
      await prisma.order.upsert({
        where: { platformOrderId: orderId },
        update: {
          marketplace: "AMAZON",
          requestDate: toDate(pick(row.request_date), new Date()),
          totalAmount: toFloat(pick(row.removal_fee)),
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
        create: {
          marketplace: "AMAZON",
          platformOrderId: orderId,
          requestDate: toDate(pick(row.request_date), new Date()),
          totalAmount: toFloat(pick(row.removal_fee)),
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
      });
      count++;
    } catch (e) { console.error(`[ERROR] Order ${orderId}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Operational: ReturnItem (from AMZCustomerReturn rows)
// ─────────────────────────────────────────────────────────────────────────────

function mapReturnRow(raw) {
  const row = normalizeRow(raw);
  const orderId = getOrderId(row);
  const lpn = pick(row.license_plate_number, row.license_plate, row.lpn, row.return_authorization_id);
  return {
    orderId,
    lpn,
    sku: pick(row.sku, row.merchant_sku, row.asin) || lpn || orderId,
    asin: pick(row.asin),
    fnsku: pick(row.fnsku),
    productName: pick(row.product_name, row.item_name, row.title),
    quantity: toInt(pick(row.quantity, row.qty), 1),
    reason: pick(row.return_reason, row.reason, row.customer_comment, row.customer_comments) || "Unknown",
    customerComments: pick(row.customer_comments, row.customer_comment),
    detailedDisposition: pick(row.detailed_disposition, row.disposition),
    itemPrice: toFloat(pick(row.item_price, row.price, row.item_amount)),
    returnDate: toDate(pick(row.return_date, row.purchase_date, row.order_date, row.created_date)),
    fulfillmentCenterId: pick(row.fulfillment_center_id, row.fulfillmentcenterid),
  };
}

async function materializeReturnItems(rows) {
  let count = 0;
  for (const group of chunkArray(rows, 10)) {
    const results = await Promise.all(group.map(async (raw) => {
      const mapped = mapReturnRow(raw);
      if (!mapped.orderId || !mapped.lpn) return 0;

      const lpns = typeof mapped.lpn === "string"
        ? mapped.lpn.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
        : [mapped.lpn];
      const qty = Math.max(mapped.quantity || 1, lpns.length);
      let saved = 0;

      for (let i = 0; i < qty; i++) {
        const lpnVal = lpns[i] || `${lpns[0] || "LPN"}-${i}`;
        try {
          await prisma.returnItem.upsert({
            where: { lpn: lpnVal },
            update: {
              orderId: mapped.orderId, sku: mapped.sku, asin: mapped.asin, fnsku: mapped.fnsku,
              productName: mapped.productName, returnDate: mapped.returnDate,
              fulfillmentCenterId: mapped.fulfillmentCenterId, reason: mapped.reason,
              customerComments: mapped.customerComments, detailedDisposition: mapped.detailedDisposition,
              itemPrice: mapped.itemPrice,
            },
            create: {
              lpn: lpnVal, orderId: mapped.orderId, sku: mapped.sku, asin: mapped.asin, fnsku: mapped.fnsku,
              productName: mapped.productName, returnDate: mapped.returnDate,
              fulfillmentCenterId: mapped.fulfillmentCenterId, reason: mapped.reason,
              customerComments: mapped.customerComments, detailedDisposition: mapped.detailedDisposition,
              itemPrice: mapped.itemPrice,
            },
          });
          saved++;
        } catch (e) { console.error(`[ERROR] ReturnItem lpn=${lpnVal}:`, e.message); }
      }
      return saved;
    }));
    count += results.reduce((a, b) => a + b, 0);
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Operational: Reimbursement (from AMZReimbursement rows)
// ─────────────────────────────────────────────────────────────────────────────

async function findOrCreateReturnItemForReimbursement(row) {
  const r = normalizeRow(row);
  const orderId = getOrderId(r);
  const sku = pick(r.sku, r.asin, r.fnsku);
  const lpn = pick(
    r.original_reimbursement_id,
    r.reimbursement_id,
    `reimbursement_${orderId || "unknown"}_${sku || "unknown"}`,
  );
  if (!sku) return null;

  const filters = [
    sku ? { sku } : null,
    pick(r.fnsku) ? { fnsku: pick(r.fnsku) } : null,
    pick(r.asin) ? { asin: pick(r.asin) } : null,
  ].filter(Boolean);

  const existing = filters.length > 0
    ? await prisma.returnItem.findFirst({ where: { OR: filters } })
    : null;
  if (existing) return existing;

  return prisma.returnItem.upsert({
    where: { lpn },
    update: {
      orderId, sku,
      reason: pick(r.reason, r.original_reimbursement_type) || "Reimbursement",
      productName: pick(r.product_name), fnsku: pick(r.fnsku), asin: pick(r.asin),
      itemPrice: toFloat(pick(r.amount_per_unit, r.amount_total)),
    },
    create: {
      lpn, orderId, sku,
      reason: pick(r.reason, r.original_reimbursement_type) || "Reimbursement",
      productName: pick(r.product_name), fnsku: pick(r.fnsku), asin: pick(r.asin),
      itemPrice: toFloat(pick(r.amount_per_unit, r.amount_total)),
    },
  });
}

async function materializeReimbursements(rows) {
  let count = 0;
  for (const raw of rows) {
    const row = normalizeRow(raw);
    const reimbursementId = pick(row.reimbursement_id);
    let orderId = getOrderId(row);
    if (!reimbursementId) continue;

    try {
      const returnItem = await findOrCreateReturnItemForReimbursement(raw);
      if (!returnItem) continue;

      orderId = orderId || returnItem.orderId;
      if (!orderId) continue;

      await prisma.order.upsert({
        where: { platformOrderId: orderId },
        update: { marketplace: "AMAZON" },
        create: { marketplace: "AMAZON", platformOrderId: orderId, requestDate: toDate(pick(row.approval_date), new Date()) },
      });

      const nonKeyData = {
        amountReimbursed: toFloat(pick(row.amount_total, row.amount_per_unit)) || 0,
        currency: pick(row.currency_unit) || "INR",
        reimbursementReason: pick(row.reason, row.original_reimbursement_type),
        status: pick(row.condition) || "DONE",
        filedAt: toDate(pick(row.approval_date)),
        resolvedAt: toDate(pick(row.approval_date)),
      };

      // Case 1: This platformReimbursementId already exists in the DB → just update amounts
      const byPlatformId = await prisma.reimbursement.findUnique({
        where: { platformReimbursementId: reimbursementId },
      });
      if (byPlatformId) {
        await prisma.reimbursement.update({ where: { id: byPlatformId.id }, data: nonKeyData });
        count++;
        continue;
      }

      // Case 2: No record for this platformReimbursementId yet
      const byReturnItem = await prisma.reimbursement.findUnique({
        where: { returnItemId: returnItem.lpn },
      });

      if (byReturnItem) {
        // ReturnItem already owned by another reimbursement — add platformId to it
        await prisma.reimbursement.update({
          where: { id: byReturnItem.id },
          data: { platformReimbursementId: reimbursementId, ...nonKeyData },
        });
      } else {
        // Neither key exists → create fresh record
        await prisma.reimbursement.create({
          data: { returnItemId: returnItem.lpn, platformReimbursementId: reimbursementId, ...nonKeyData },
        });
      }
      count++;
    } catch (e) { console.error(`[ERROR] Reimbursement ${reimbursementId}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main — Full pipeline in one run
// ─────────────────────────────────────────────────────────────────────────────

export async function main() {
  validateConfig();

  // Fetch all 4 reports in parallel
  console.log('[INFO] Starting fetch of Amazon reports');
  const [removalOrdersTSV, removalShipmentsTSV, reimbursementsTSV, customerReturnsTSV] = await Promise.all([
    (async () => { console.log('[INFO] Fetching Removal Orders'); return await fetchChunk(REMOVAL_ORDERS_REPORT_TYPE, "removal_orders_0_30", 30); })(),
    (async () => { console.log('[INFO] Fetching Removal Shipments'); return await fetchChunk(REMOVAL_SHIPMENTS_REPORT_TYPE, "removal_shipments_0_30", 30); })(),
    (async () => { console.log('[INFO] Fetching Reimbursements'); return await fetchChunk(REIMBURSEMENTS_REPORT_TYPE, "reimbursements_0_30", 30); })(),
    (async () => { console.log('[INFO] Fetching Customer Returns'); return await fetchChunk(RETURNS_REPORT_TYPE, "customer_returns_0_30", 30); })(),
  ]);
  console.log('[INFO] Finished fetching all reports');

  const removalOrderRows    = parseTSV(removalOrdersTSV);
  const removalShipmentRows = parseTSV(removalShipmentsTSV);
  const reimbursementRows   = parseTSV(reimbursementsTSV);
  const customerReturnRows  = parseTSV(customerReturnsTSV);

  // ── STEP 1: Write all rows to the 4 AMZ staging tables ──────────────────
  const [sOrders, sShipments, sReimb, sReturns] = await Promise.all([
    stageRemovalOrders(removalOrderRows),
    stageRemovalShipments(removalShipmentRows),
    stageReimbursements(reimbursementRows),
    stageCustomerReturns(customerReturnRows),
  ]);

  // ── STEP 2: Materialize from those same rows into operational tables ─────
  // (sequential — reimbursements depend on ReturnItems existing first)
  const mOrders  = await materializeOrders(removalOrderRows);
  const mReturns = await materializeReturnItems(customerReturnRows);
  const mReimb   = await materializeReimbursements(reimbursementRows);

  console.log("\n[Amazon Full Sync Summary]");
  console.log(`  Staging  — AMZRemovalOrder:    ${sOrders}`);
  console.log(`  Staging  — AMZRemovalShipment: ${sShipments}`);
  console.log(`  Staging  — AMZReimbursement:   ${sReimb}`);
  console.log(`  Staging  — AMZCustomerReturn:  ${sReturns}`);
  console.log(`  Operational — Order:           ${mOrders}`);
  console.log(`  Operational — ReturnItem:      ${mReturns}`);
  console.log(`  Operational — Reimbursement:   ${mReimb}`);
}

/**
 * Run only the fetch and staging steps without materialization.
 * Used by the separate fetch script.
 */
export async function runFetchAndStage() {
  validateConfig();

  console.log('[INFO] Starting fetch of Amazon reports');
  const [removalOrdersTSV, removalShipmentsTSV, reimbursementsTSV, customerReturnsTSV] = await Promise.all([
    (async () => { console.log('[INFO] Fetching Removal Orders'); return await fetchChunk(REMOVAL_ORDERS_REPORT_TYPE, "removal_orders_0_30", 30); })(),
    (async () => { console.log('[INFO] Fetching Removal Shipments'); return await fetchChunk(REMOVAL_SHIPMENTS_REPORT_TYPE, "removal_shipments_0_30", 30); })(),
    (async () => { console.log('[INFO] Fetching Reimbursements'); return await fetchChunk(REIMBURSEMENTS_REPORT_TYPE, "reimbursements_0_30", 30); })(),
    (async () => { console.log('[INFO] Fetching Customer Returns'); return await fetchChunk(RETURNS_REPORT_TYPE, "customer_returns_0_30", 30); })(),
  ]);
  console.log('[INFO] Finished fetching all reports');

  const removalOrderRows    = parseTSV(removalOrdersTSV);
  const removalShipmentRows = parseTSV(removalShipmentsTSV);
  const reimbursementRows   = parseTSV(reimbursementsTSV);
  const customerReturnRows  = parseTSV(customerReturnsTSV);

  const [sOrders, sShipments, sReimb, sReturns] = await Promise.all([
    stageRemovalOrders(removalOrderRows),
    stageRemovalShipments(removalShipmentRows),
    stageReimbursements(reimbursementRows),
    stageCustomerReturns(customerReturnRows),
  ]);

  console.log('✅ Fetch and staging completed.');
  console.log(`  Staging  — AMZRemovalOrder:    ${sOrders}`);
  console.log(`  Staging  — AMZRemovalShipment: ${sShipments}`);
  console.log(`  Staging  — AMZReimbursement:   ${sReimb}`);
  console.log(`  Staging  — AMZCustomerReturn:  ${sReturns}`);
}


const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main()
    .catch((e) => console.error(e))
    .finally(async () => { await prisma.$disconnect().catch(() => {}); });
}