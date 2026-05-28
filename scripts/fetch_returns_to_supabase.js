require("dotenv").config();

const SellingPartnerAPI = require("amazon-sp-api");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

// Environment variables required:
// REGION, REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET, AWS_ACCESS_KEY, AWS_SECRET_KEY
// MARKETPLACE_ID
// DATABASE_URL (your Supabase Postgres connection string)

const sp = new SellingPartnerAPI({
  region: process.env.REGION,
  refresh_token: process.env.REFRESH_TOKEN,
  credentials: {
    SELLING_PARTNER_APP_CLIENT_ID: process.env.CLIENT_ID,
    SELLING_PARTNER_APP_CLIENT_SECRET: process.env.CLIENT_SECRET,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY1,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_KEY1,
  },
});

const MARKETPLACE_ID = process.env.MARKETPLACE_ID;
const prisma = new PrismaClient();

const ORDER_REPORT_TYPE = "GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL";
const RETURNS_REPORT_TYPE = "GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA";
const REIMBURSEMENTS_REPORT_TYPE = "GET_FBA_REIMBURSEMENTS_DATA";
const REMOVAL_ORDERS_REPORT_TYPE = "GET_FBA_FULFILLMENT_REMOVAL_ORDER_DETAIL_DATA";
const REMOVAL_SHIPMENTS_REPORT_TYPE = "GET_FBA_FULFILLMENT_REMOVAL_SHIPMENT_DETAIL_DATA";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function validateAmazonConfig() {
  [
    "REGION",
    "REFRESH_TOKEN",
    "CLIENT_ID",
    "CLIENT_SECRET",
    "AWS_ACCESS_KEY1",
    "AWS_SECRET_KEY1",
    "MARKETPLACE_ID",
    "DATABASE_URL",
  ].forEach(requireEnv);
}

async function generateReport(reportType, fileName, start, end) {
  try {
    console.log("\n====================");
    console.log("REPORT:", reportType);
    console.log("FROM:", start.toISOString());
    console.log("TO:", end.toISOString());

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

    console.log("REPORT ID:", report.reportId);

    let reportStatus;

    while (true) {
      reportStatus = await sp.callAPI({
        operation: "getReport",
        endpoint: "reports",
        path: { reportId: report.reportId },
      });

      console.log("STATUS:", reportStatus.processingStatus);

      if (
        reportStatus.processingStatus === "DONE" ||
        reportStatus.processingStatus === "DONE_NO_DATA" ||
        reportStatus.processingStatus === "FATAL" ||
        reportStatus.processingStatus === "CANCELLED"
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 15000));
    }

    if (reportStatus.processingStatus !== "DONE") {
      console.log(`${reportType} FAILED / EMPTY`);
      return null;
    }

    const document = await sp.callAPI({
      operation: "getReportDocument",
      endpoint: "reports",
      path: { reportDocumentId: reportStatus.reportDocumentId },
    });

    const reportData = await sp.download(document);

    fs.writeFileSync(`${fileName}.tsv`, reportData);
    console.log(`${fileName}.tsv SAVED`);
    return reportData;
  } catch (error) {
    console.error(error.response?.data || error.message || error);
    return null;
  }
}

function parseTSV(tsv) {
  if (!tsv) return [];
  const lines = tsv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split("\t").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length === 0) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j] ? header[j].toLowerCase().replace(/\s+/g, "_") : `col_${j}`;
      obj[key] = cols[j] !== undefined ? cols[j] : null;
    }
    rows.push(obj);
  }
  return rows;
}

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
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value, fallback = null) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function mapReturnRow(row) {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      value,
    ]),
  );

  const orderId = pick(
    normalized.order_id,
    normalized.orderid,
    normalized.amazon_order_id,
    normalized.merchant_order_id,
  );

  const lpn = pick(
    normalized.license_plate_number,
    normalized.license_plate,
    normalized.lpn,
    normalized.return_authorization_id,
  );

  return {
    orderId,
    lpn,
    sku: pick(normalized.sku, normalized.merchant_sku, normalized.asin) || lpn || orderId,
    asin: pick(normalized.asin),
    fnsku: pick(normalized.fnsku),
    productName: pick(normalized.product_name, normalized.item_name, normalized.title),
    quantity: toInt(pick(normalized.quantity, normalized.qty), 1),
    returnReason:
      pick(normalized.return_reason, normalized.reason, normalized.customer_comment, normalized.customer_comments) ||
      "Unknown",
    customerComments: pick(normalized.customer_comments, normalized.customer_comment),
    amazonDisposition: pick(normalized.detailed_disposition, normalized.disposition),
    itemPrice: toFloat(pick(normalized.item_price, normalized.price, normalized.item_amount)),
    purchaseDate: toDate(pick(normalized.purchase_date, normalized.order_date, normalized.created_date, normalized.return_date)),
  };
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

function getTotalAmount(row) {
  const base = toFloat(pick(row.item_price, row.amount_total, row.amount_per_unit, row.actual_amount));
  const itemTax = toFloat(pick(row.item_tax));
  const shippingPrice = toFloat(pick(row.shipping_price));
  const shippingTax = toFloat(pick(row.shipping_tax));
  const giftWrapPrice = toFloat(pick(row.gift_wrap_price));
  const giftWrapTax = toFloat(pick(row.gift_wrap_tax));
  const itemDiscount = toFloat(pick(row.item_promotion_discount));
  const shipDiscount = toFloat(pick(row.ship_promotion_discount));

  const parts = [base, itemTax, shippingPrice, shippingTax, giftWrapPrice, giftWrapTax]
    .filter((value) => typeof value === "number");

  const total = parts.reduce((sum, value) => sum + value, 0) - (itemDiscount || 0) - (shipDiscount || 0);
  return Number.isFinite(total) ? total : base;
}

function getRemovalShipmentKey(row) {
  const tracking = pick(row.tracking_number, row.tracking);
  if (tracking) {
    return tracking;
  }

  return pick(
    row.removal_order_id ? `removal_${row.removal_order_id}` : null,
    row.order_id ? `removal_${row.order_id}` : null,
  );
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildOrderPayload(rows) {
  const first = rows[0] || {};
  const totalAmount = rows.reduce((sum, row) => {
    const amount = getTotalAmount(row);
    return sum + (typeof amount === "number" && Number.isFinite(amount) ? amount : 0);
  }, 0);

  return {
    marketplace: "AMAZON",
    platformOrderId: getOrderId(first),
    purchaseDate: toDate(pick(first.purchase_date, first.order_created_at, first.delivery_date, first.last_updated_date), new Date()),
    customerName: pick(first.buyer_name, first.ship_to_name, first.customer_name, first.recipient_name),
    totalAmount: Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : null,
    fulfillmentChannel: pick(first.fulfillment_channel, first.fulfilled_by),
  };
}

async function upsertOrders(rows) {
  const grouped = new Map();

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    const orderId = getOrderId(row);
    if (!orderId) continue;

    if (!grouped.has(orderId)) grouped.set(orderId, []);
    grouped.get(orderId).push(row);
  }

  const payloads = [];

  for (const orderRows of grouped.values()) {
    const payload = buildOrderPayload(orderRows);
    if (payload.platformOrderId) {
      payloads.push(payload);
    }
  }

  const saved = [];
  for (const batch of chunkArray(payloads, 250)) {
    await prisma.order.createMany({
      data: batch,
      skipDuplicates: true,
    });

    saved.push(...batch);
  }

  return saved;
}

async function upsertReturns(rows) {
  if (!rows || rows.length === 0) {
    console.log("No rows to upsert");
    return [];
  }

  const saved = [];

  for (const group of chunkArray(rows, 100)) {
    const groupSaved = await Promise.all(
      group.map(async (rawRow) => {
        const mapped = mapReturnRow(rawRow);

        if (!mapped.orderId || !mapped.lpn) {
          console.log("Skipping row without orderId or lpn", rawRow);
          return null;
        }

        // Parse LPNs: split by commas or spaces if multiple exist
        const rawLpns = mapped.lpn;
        const lpns = typeof rawLpns === 'string'
          ? rawLpns.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
          : [mapped.lpn];

        const qty = Math.max(mapped.quantity || 1, lpns.length);
        const returnItems = [];

        try {
          for (let i = 0; i < qty; i++) {
            const lpnVal = lpns[i] || `${lpns[0] || 'LPN'}-${i}`;

            const returnItem = await prisma.returnItem.upsert({
              where: { lpn: lpnVal },
              update: {
                orderId: mapped.orderId,
                sku: mapped.sku,
                asin: mapped.asin,
                fnsku: mapped.fnsku,
                productName: mapped.productName,
                returnDate: mapped.purchaseDate,
                fulfillmentCenterId: pick(rawRow.fulfillment_center_id, rawRow.fulfillmentcenterid),
                returnReason: mapped.returnReason,
                customerComments: mapped.customerComments,
                amazonDisposition: mapped.amazonDisposition,
                itemPrice: mapped.itemPrice,
              },
              create: {
                orderId: mapped.orderId,
                sku: mapped.sku,
                lpn: lpnVal,
                asin: mapped.asin,
                fnsku: mapped.fnsku,
                productName: mapped.productName,
                returnDate: mapped.purchaseDate,
                fulfillmentCenterId: pick(rawRow.fulfillment_center_id, rawRow.fulfillmentcenterid),
                returnReason: mapped.returnReason,
                customerComments: mapped.customerComments,
                amazonDisposition: mapped.amazonDisposition,
                itemPrice: mapped.itemPrice,
              },
            });
            returnItems.push(returnItem);
          }
          return returnItems[0];
        } catch (e) {
          console.error(`[ERROR] Failed to upsert ReturnItem orderId=${mapped.orderId} lpn=${mapped.lpn}:`, e.message);
          return null;
        }
      }),
    );

    saved.push(...groupSaved.filter(Boolean));
  }

  return saved;
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

  const existing = identityFilters.length > 0
    ? await prisma.returnItem.findFirst({
        where: {
          ...(orderId ? { orderId } : {}),
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
      returnReason: pick(normalized.reason, normalized.original_reimbursement_type) || "Reimbursement",
      productName: pick(normalized.product_name),
      fnsku: pick(normalized.fnsku),
      asin: pick(normalized.asin),
      itemPrice: toFloat(pick(normalized.amount_per_unit, normalized.amount_total)),
    },
    create: {
      orderId,
      sku,
      lpn,
      returnReason: pick(normalized.reason, normalized.original_reimbursement_type) || "Reimbursement",
      productName: pick(normalized.product_name),
      fnsku: pick(normalized.fnsku),
      asin: pick(normalized.asin),
      itemPrice: toFloat(pick(normalized.amount_per_unit, normalized.amount_total)),
    },
  });
}

async function upsertReimbursements(rows) {
  if (!rows || rows.length === 0) return [];

  const saved = [];
  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    const reimbursementId = pick(row.reimbursement_id);
    let orderId = getOrderId(row);

    if (!reimbursementId) {
      console.log("Skipping reimbursement row without reimbursementId or orderId", rawRow);
      continue;
    }

    const returnItem = await findOrCreateReturnItemForReimbursement(row);
    if (!returnItem) {
      console.log("Skipping reimbursement row without a matching return item", rawRow);
      continue;
    }

    orderId = orderId || returnItem.orderId;
    const order = await prisma.order.upsert({
      where: { platformOrderId: orderId },
      update: {
        marketplace: "AMAZON",
      },
      create: {
        marketplace: "AMAZON",
        platformOrderId: orderId,
        purchaseDate: toDate(pick(row.approval_date), new Date()),
      },
    });

    const reimbursementData = {
      returnItemId: returnItem.lpn,
      platformReimbursementId: reimbursementId,
      amountReimbursed: toFloat(pick(row.amount_total, row.amount_per_unit)) || 0,
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
        "Skipping reimbursement row with conflicting platformReimbursementId and returnItemId",
        rawRow,
      );
      continue;
    }

    const existingReimbursement = reimbursementByPlatformId || reimbursementByReturnItem;

    const reimbursement = existingReimbursement
      ? await prisma.reimbursement.update({
          where: { id: existingReimbursement.id },
          data: reimbursementData,
        })
      : await prisma.reimbursement.create({
          data: reimbursementData,
        });

    saved.push({ reimbursement, order, returnItem });
  }

  return saved;
}

function mapRemovalShipmentRow(rawRow) {
  const row = normalizeRow(rawRow);
  const removalOrderId = pick(row.order_id, row.removal_order_id);
  const trackingNumber = getRemovalShipmentKey(row);

  return {
    removalOrderId,
    trackingNumber,
    shipmentDate: toDate(pick(row.shipment_date, row.request_date, row.last_updated_date), new Date()),
    sku: pick(row.sku) || trackingNumber,
    shippedQuantity: toInt(pick(row.shipped_quantity, row.requested_quantity), 1),
    disposition: pick(row.disposition) || "Unknown",
    manifestId: null,
  };
}

async function upsertRemovalShipments(rows) {
  if (!rows || rows.length === 0) return [];

  const saved = [];
  for (const group of chunkArray(rows, 100)) {
    const groupSaved = await Promise.all(group.map(async (rawRow) => {
      const mapped = mapRemovalShipmentRow(rawRow);

        if (!mapped.removalOrderId || !mapped.sku) {
          console.log("Skipping removal shipment row without removalOrderId or sku", rawRow);
          return null;
        }

        if (!mapped.trackingNumber || String(mapped.trackingNumber).startsWith("removal_")) {
          console.log("Skipping removal shipment row without real tracking number", rawRow);
          return null;
        }

      const existing = await prisma.removalShipment.findUnique({
        where: {
          trackingNumber_sku: {
            trackingNumber: mapped.trackingNumber,
            sku: mapped.sku,
          },
        },
      });

      if (existing) {
        const updated = await prisma.removalShipment.update({
          where: { id: existing.id },
          data: {
            shipmentDate: mapped.shipmentDate,
            shippedQuantity: mapped.shippedQuantity,
            disposition: mapped.disposition,
          },
        });
        return updated;
      }

      const created = await prisma.removalShipment.create({
        data: mapped,
      });
      return created;
    }));

    saved.push(...groupSaved.filter(Boolean));
  }

  return saved;
}

async function upsertCoreRemovalOrdersToOrders(rows) {
  if (!rows || rows.length === 0) return [];

  const saved = [];
  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    const orderId = getOrderId(row);
    if (!orderId) continue;

    const requestDate = toDate(pick(row.request_date), new Date());
    const removalFee = toFloat(pick(row.removal_fee));

    try {
      const order = await prisma.order.upsert({
        where: { platformOrderId: orderId },
        update: {
          marketplace: "AMAZON",
          purchaseDate: requestDate,
          totalAmount: removalFee,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
        create: {
          marketplace: "AMAZON",
          platformOrderId: orderId,
          purchaseDate: requestDate,
          totalAmount: removalFee,
          fulfillmentChannel: "AMAZON_REMOVAL",
        },
      });
      saved.push(order);
    } catch (e) {
      console.error(`[ERROR] Failed to sync operational Order for Removal Order ${orderId}:`, e.message);
    }
  }
  return saved;
}

async function readReturnsFromDatabase(limit = 25) {
  return prisma.returnItem.findMany({
    orderBy: [{ returnDate: "desc" }, { lpn: "desc" }],
    take: limit,
  });
}

async function fetchAndStoreReport(reportType, fileName, startDaysAgo, endDaysAgo) {
  const reportData = await fetchChunk(reportType, fileName, startDaysAgo, endDaysAgo);

  if (!reportData) return [];

  const rows = parseTSV(reportData.toString());
  console.log(`Parsed ${rows.length} rows from ${reportType}`);
  return upsertReturns(rows);
}

async function fetchAndStoreOrders() {
  console.log("\nFETCHING ORDERS REPORT\n");
  const reportData = await fetchChunk(ORDER_REPORT_TYPE, "orders_0_30", 30, 0);
  if (!reportData) return [];
  const rows = parseTSV(reportData.toString());
  console.log(`Parsed ${rows.length} order rows`);
  return upsertOrders(rows);
}

async function fetchAndStoreReimbursements() {
  console.log("\nFETCHING REIMBURSEMENTS REPORT\n");
  const reportData = await fetchChunk(REIMBURSEMENTS_REPORT_TYPE, "reimbursements_0_30", 30, 0);
  if (!reportData) return [];
  const rows = parseTSV(reportData.toString());
  console.log(`Parsed ${rows.length} reimbursement rows`);
  return upsertReimbursements(rows);
}

async function fetchAndStoreRemovalOrders() {
  console.log("\nFETCHING REMOVAL ORDERS REPORT\n");
  const reportData = await fetchChunk(REMOVAL_ORDERS_REPORT_TYPE, "removal_orders_0_30", 30, 0);
  if (!reportData) return [];
  const rows = parseTSV(reportData.toString());
  console.log(`Parsed ${rows.length} removal order rows`);
  return upsertCoreRemovalOrdersToOrders(rows);
}

async function fetchAndStoreRemovalShipments() {
  console.log("\nFETCHING REMOVAL SHIPMENTS REPORT\n");
  const reportData = await fetchChunk(REMOVAL_SHIPMENTS_REPORT_TYPE, "removal_shipments_0_30", 30, 0);
  if (!reportData) return [];
  const rows = parseTSV(reportData.toString());
  console.log(`Parsed ${rows.length} removal shipment rows`);
  return upsertRemovalShipments(rows);
}

async function fetchChunk(reportType, fileName, startDaysAgo, endDaysAgo) {
  const end = new Date();
  end.setDate(end.getDate() - endDaysAgo);
  const start = new Date();
  start.setDate(start.getDate() - startDaysAgo);
  return await generateReport(reportType, fileName, start, end);
}

async function main() {
  validateAmazonConfig();

  console.log("\nSYNCING AMAZON REPORTS\n");

  const savedOrders = await fetchAndStoreOrders();
  const savedReturns = await fetchAndStoreReport(RETURNS_REPORT_TYPE, "customer_returns_0_30", 30, 0);
  const savedReimbursements = await fetchAndStoreReimbursements();
  const savedRemovalOrders = await fetchAndStoreRemovalOrders();
  const savedRemovalShipments = await fetchAndStoreRemovalShipments();

  console.log(`Upserted ${savedOrders.length} orders into the database`);
  console.log(`Upserted ${savedReturns.length} return items into the database`);
  console.log(`Upserted ${savedReimbursements.length} reimbursements into the database`);
  console.log(`Upserted ${savedRemovalOrders.length} removal orders into the database`);
  console.log(`Upserted ${savedRemovalShipments.length} removal shipments into the database`);

  const latestReturns = await readReturnsFromDatabase(10);
  console.log("\nLATEST RETURN ITEMS FROM DATABASE\n");
  for (const item of latestReturns) {
    console.log(`${item.lpn} | order=${item.orderId} | sku=${item.sku} | reason=${item.returnReason}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
