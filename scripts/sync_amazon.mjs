import "dotenv/config";
import SellingPartnerAPI from "amazon-sp-api";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);

// ─────────────────────────────────────────────────────────────────────────────
// SP-API client
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

const REPORT_TYPES = {
  REMOVAL_ORDERS:    "GET_FBA_FULFILLMENT_REMOVAL_ORDER_DETAIL_DATA",
  REMOVAL_SHIPMENTS: "GET_FBA_FULFILLMENT_REMOVAL_SHIPMENT_DETAIL_DATA",
  REIMBURSEMENTS:    "GET_FBA_REIMBURSEMENTS_DATA",
  CUSTOMER_RETURNS:  "GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA",
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

function validateConfig() {
  ["REGION", "REFRESH_TOKEN", "CLIENT_ID", "CLIENT_SECRET", "MARKETPLACE_ID", "DATABASE_URL"]
    .forEach((key) => {
      if (!process.env[key]?.trim()) throw new Error(`Missing env var: ${key}`);
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
// PART 1 — Fetch reports from Amazon SP-API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchReport(reportType, fileName, daysBack) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  const localPath = path.join(process.cwd(), `${fileName}.tsv`);

  try {
    const report = await sp.callAPI({
      operation: "createReport",
      endpoint: "reports",
      body: {
        reportType,
        dataStartTime: start.toISOString(),
        dataEndTime: end.toISOString(),
        marketplaceIds: [MARKETPLACE_ID],
      },
    });
    console.log(`  [INFO] Created report ${reportType}, ID: ${report.reportId}`);

    let reportStatus;
    const startedAt = Date.now();
    let attempt = 0;

    while (true) {
      attempt++;
      console.log(`  [INFO] ${reportType} poll #${attempt}`);
      reportStatus = await sp.callAPI({
        operation: "getReport",
        endpoint: "reports",
        path: { reportId: report.reportId },
      });

      const { processingStatus } = reportStatus;
      if (["DONE", "DONE_NO_DATA", "FATAL", "CANCELLED"].includes(processingStatus)) {
        console.log(`  [INFO] ${reportType} → ${processingStatus}`);
        break;
      }
      if (Date.now() - startedAt >= 300000 || attempt >= 20) {
        console.warn(`  [WARN] ${reportType} timed out (${processingStatus})`);
        break;
      }
      await new Promise((r) => setTimeout(r, 15000));
    }

    if (reportStatus.processingStatus !== "DONE") {
      if (fs.existsSync(localPath)) {
        console.log(`  [Fallback] Using cached ${fileName}.tsv`);
        return fs.readFileSync(localPath, "utf8");
      }
      return null;
    }

    const doc = await sp.callAPI({
      operation: "getReportDocument",
      endpoint: "reports",
      path: { reportDocumentId: reportStatus.reportDocumentId },
    });
    const data = await sp.download(doc);
    fs.writeFileSync(localPath, data);
    return data.toString();

  } catch (err) {
    console.error(`  [ERROR] SP-API ${reportType}:`, err.response?.data || err.message);
    if (fs.existsSync(localPath)) {
      console.log(`  [Fallback] Using cached ${fileName}.tsv`);
      return fs.readFileSync(localPath, "utf8");
    }
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — Stage into AMZ tables
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
    } catch (e) { console.error(`  [ERROR] AMZRemovalOrder ${orderId}:`, e.message); }
  }
  return count;
}

async function stageRemovalShipments(rows) {
  let count = 0;
  for (const raw of rows) {
    const orderId = pick(raw["order-id"]);
    const sku     = pick(raw["sku"]);
    if (!orderId && !sku) continue;
    const data = {
      requestDate:     toDate(pick(raw["request-date"])),
      orderId,
      shipmentDate:    toDate(pick(raw["shipment-date"])),
      sku,
      fnsku:           pick(raw["fnsku"]),
      disposition:     pick(raw["disposition"]),
      shippedQuantity: toInt(pick(raw["shipped-quantity"])),
      carrier:         pick(raw["carrier"]),
      trackingNumber:  pick(raw["tracking-number"]),
      shipmentStatus:  pick(raw["shipment-status"]),
    };
    try {
      const existing = await prisma.aMZRemovalShipment.findFirst({
        where: { orderId, sku, trackingNumber: data.trackingNumber },
      });
      if (existing) await prisma.aMZRemovalShipment.update({ where: { id: existing.id }, data });
      else await prisma.aMZRemovalShipment.create({ data });
      count++;
    } catch (e) { console.error(`  [ERROR] AMZRemovalShipment order=${orderId}:`, e.message); }
  }
  return count;
}

async function stageReimbursements(rows) {
  let count = 0;
  for (const raw of rows) {
    const reimbursementId = pick(raw["reimbursement-id"]);
    if (!reimbursementId) continue;
    const data = {
      approvalDate:                toDate(pick(raw["approval-date"])),
      caseId:                      pick(raw["case-id"]),
      amazonOrderId:               pick(raw["amazon-order-id"]),
      reason:                      pick(raw["reason"]),
      sku:                         pick(raw["sku"]),
      fnsku:                       pick(raw["fnsku"]),
      asin:                        pick(raw["asin"]),
      productName:                 pick(raw["product-name"]),
      condition:                   pick(raw["condition"]),
      currencyUnit:                pick(raw["currency-unit"]),
      amountPerUnit:               toFloat(pick(raw["amount-per-unit"])),
      amountTotal:                 toFloat(pick(raw["amount-total"])),
      quantityReimbursedCash:      toInt(pick(raw["quantity-reimbursed-cash"])),
      quantityReimbursedInventory: toInt(pick(raw["quantity-reimbursed-inventory"])),
      quantityReimbursedTotal:     toInt(pick(raw["quantity-reimbursed-total"])),
      originalReimbursementId:     pick(raw["original-reimbursement-id"]),
      originalReimbursementType:   pick(raw["original-reimbursement-type"]),
    };
    try {
      await prisma.aMZReimbursement.upsert({
        where:  { reimbursementId },
        update: data,
        create: { reimbursementId, ...data },
      });
      count++;
    } catch (e) { console.error(`  [ERROR] AMZReimbursement ${reimbursementId}:`, e.message); }
  }
  return count;
}

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
    } catch (e) { console.error(`  [ERROR] AMZCustomerReturn ${lpn}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3 — Materialize operational tables from staged AMZ data
// ─────────────────────────────────────────────────────────────────────────────

async function materializeOrders() {
  const shipments = await prisma.aMZRemovalShipment.findMany();

  // Group by orderId
  const groups = new Map();
  for (const row of shipments) {
    if (!row.orderId) continue;
    if (!groups.has(row.orderId)) groups.set(row.orderId, []);
    groups.get(row.orderId).push(row);
  }

  let count = 0;
  for (const [orderId, rows] of groups) {
    const totalQuantity  = rows.reduce((sum, r) => sum + (r.shippedQuantity ?? 0), 0);
    const requestDate    = rows.find((r) => r.requestDate)?.requestDate ?? null;
    const trackingNumber = rows.map((r) => r.trackingNumber).find(Boolean) ?? null;

    try {
      await prisma.order.upsert({
        where:  { platformOrderId: orderId },
        update: { marketplace: "AMAZON", requestDate, totalQuantity, trackingNumber, totalAmount: null, fulfillmentChannel: null },
        create: { platformOrderId: orderId, marketplace: "AMAZON", requestDate, totalQuantity, trackingNumber, totalAmount: null, fulfillmentChannel: null },
      });
      count++;
    } catch (e) { console.error(`  [ERROR] Order ${orderId}:`, e.message); }
  }
  return count;
}

async function materializeManifests() {
  const orders = await prisma.order.findMany({
    where: { marketplace: "AMAZON", trackingNumber: { not: null } },
  });

  let count = 0;
  for (const order of orders) {
    const { platformOrderId, trackingNumber, requestDate } = order;
    const shipment = await prisma.aMZRemovalShipment.findFirst({
      where:  { orderId: platformOrderId, trackingNumber },
      select: { shipmentDate: true },
    });
    const expectedDate = shipment?.shipmentDate ?? null;

    try {
      const manifest = await prisma.manifest.upsert({
        where:  { trackingId: trackingNumber },
        update: { orderId: platformOrderId, removalOrderId: platformOrderId, marketplace: "AMAZON", expectedDate },
        create: { trackingId: trackingNumber, orderId: platformOrderId, removalOrderId: platformOrderId, marketplace: "AMAZON", status: "IN_TRANSIT", expectedDate },
      });
      await prisma.order.update({
        where: { platformOrderId },
        data:  { manifestId: manifest.id },
      });
      count++;
    } catch (e) { console.error(`  [ERROR] Manifest for order ${platformOrderId}:`, e.message); }
  }
  return count;
}

async function materializeReturnItems() {
  const returns = await prisma.aMZCustomerReturn.findMany();

  let count = 0;
  for (const row of returns) {
    const lpn = row.lpn;
    if (!lpn) continue;
    const data = {
      orderId:             row.orderId,
      sku:                 row.sku,
      asin:                row.asin,
      fnsku:               row.fnsku,
      productName:         row.productName,
      quantity:            row.quantity,
      fulfillmentCenterId: row.fulfillmentCenterId,
      detailedDisposition: row.detailedDisposition,
      reason:              row.reason,
      customerComments:    row.customerComments,
      removalOrderType:    row.removalOrderType,
      returnDate:          row.returnDate,
      marketplace:         "amazon",
    };
    try {
      await prisma.returnItem.upsert({
        where:  { lpn },
        update: data,
        create: { lpn, ...data },
      });
      count++;
    } catch (e) { console.error(`  [ERROR] ReturnItem lpn=${lpn}:`, e.message); }
  }
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  validateConfig();
  console.log("🚀 Starting Amazon sync…\n");

  // ── Part 1: Fetch from SP-API ──────────────────────────────────────────────
  console.log("📥 Fetching reports from Amazon SP-API (last 30 days)…");
  const [removalOrdersTSV, removalShipmentsTSV, reimbursementsTSV, customerReturnsTSV] = await Promise.all([
    fetchReport(REPORT_TYPES.REMOVAL_ORDERS,    "removal_orders_0_30",    30),
    fetchReport(REPORT_TYPES.REMOVAL_SHIPMENTS, "removal_shipments_0_30", 30),
    fetchReport(REPORT_TYPES.REIMBURSEMENTS,    "reimbursements_0_30",    30),
    fetchReport(REPORT_TYPES.CUSTOMER_RETURNS,  "customer_returns_0_30",  30),
  ]);

  const removalOrderRows    = parseTSV(removalOrdersTSV);
  const removalShipmentRows = parseTSV(removalShipmentsTSV);
  const reimbursementRows   = parseTSV(reimbursementsTSV);
  const customerReturnRows  = parseTSV(customerReturnsTSV);

  // ── Part 2: Stage into AMZ tables ─────────────────────────────────────────
  console.log("\n📦 Staging into AMZ tables…");
  const [sOrders, sShipments, sReimb, sReturns] = await Promise.all([
    stageRemovalOrders(removalOrderRows),
    stageRemovalShipments(removalShipmentRows),
    stageReimbursements(reimbursementRows),
    stageCustomerReturns(customerReturnRows),
  ]);
  console.log(`  AMZRemovalOrder:    ${sOrders}`);
  console.log(`  AMZRemovalShipment: ${sShipments}`);
  console.log(`  AMZReimbursement:   ${sReimb}`);
  console.log(`  AMZCustomerReturn:  ${sReturns}`);

  // ── Part 3: Materialize operational tables ─────────────────────────────────
  console.log("\n🔄 Materializing operational tables…");
  const mOrders    = await materializeOrders();
  const mManifests = await materializeManifests();
  const mReturns   = await materializeReturnItems();
  console.log(`  Orders:      ${mOrders}`);
  console.log(`  Manifests:   ${mManifests}`);
  console.log(`  ReturnItems: ${mReturns}`);

  console.log("\n✅ Amazon sync complete.");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => { await prisma.$disconnect().catch(() => {}); });
