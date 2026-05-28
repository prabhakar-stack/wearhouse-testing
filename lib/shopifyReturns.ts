import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { fetchShiprocketTrackingSnapshot } from "@/lib/shiprocketTracking";

const TRACKING_REFRESH_MS = 60 * 60 * 1000;

const SHIPROCKET_BASE_URL = (
  process.env.SHIPROCKET_API_BASE_URL ||
  process.env.API_BASE_SHIPROCKET ||
  "https://apiv2.shiprocket.in"
).replace(/\/$/, "");

type JsonRecord = Record<string, any>;

type ShopifyReturnTrackingInput = {
  awbCode?: string | null;
  shipmentId?: string | null;
  orderId?: string | null;
  channelId?: string | null;
  sourceType: string;
  sourceId: string;
  courierName?: string | null;
};

const AWB_KEY_SET = new Set([
  "awb",
  "awbcode",
  "tracking",
  "trackingnumber",
  "shipmentawb",
  "courierawb",
  "laneawb",
]);
const SHIPMENT_KEY_SET = new Set([
  "shipmentid",
  "shipment",
  "shipmentno",
  "shipmentnumber",
]);
const ORDER_KEY_SET = new Set(["orderid", "order_id"]);
const CHANNEL_KEY_SET = new Set(["channelid", "channel_id"]);
const COURIER_KEY_SET = new Set([
  "couriername",
  "courier",
  "shippingprovider",
  "deliverypartner",
  "logisticspartner",
  "carrier",
]);

function normalizeKeyName(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findFirstValue(value: unknown, keySet: Set<string>): string | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findFirstValue(entry, keySet);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, any>)) {
      const normalizedKey = normalizeKeyName(key);
      if (keySet.has(normalizedKey)) {
        if (entry !== null && entry !== undefined && entry !== "") {
          return String(entry);
        }
      }

      const found = findFirstValue(entry, keySet);
      if (found) return found;
    }
  }

  return null;
}

function extractTrackingLookup(record: JsonRecord) {
  return {
    awbCode: findFirstValue(record, AWB_KEY_SET),
    shipmentId: findFirstValue(record, SHIPMENT_KEY_SET),
    orderId: findFirstValue(record, ORDER_KEY_SET),
    channelId: findFirstValue(record, CHANNEL_KEY_SET),
    courierName: findFirstValue(record, COURIER_KEY_SET),
  };
}

function findArray(value: any): any[] | null {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const result = findArray(value[key]);
      if (result) {
        return result;
      }
    }
  }

  return null;
}


async function fetchPagedRecords({
  url,
  headers,
  pageParam = "page",
  pageStart = 1,
  maxPages = 100,
}: {
  url: string;
  headers?: Record<string, string>;
  pageParam?: string;
  pageStart?: number;
  maxPages?: number;
}) {
  const records: JsonRecord[] = [];
  let page = pageStart;

  while (page <= maxPages) {
    const requestUrl = new URL(url);
    requestUrl.searchParams.set(pageParam, String(page));

    const response = await fetch(requestUrl.toString(), {
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch paged records from ${requestUrl.toString()}: ${response.status} ${response.statusText}`,
      );
    }

    const rawData = await response.json();
    const pageRecords = (findArray(rawData) || []) as JsonRecord[];

    if (pageRecords.length === 0) {
      break;
    }

    records.push(...pageRecords);

    const hasNextPage = Boolean(
      rawData?.hasNextPage ??
      rawData?.data?.hasNextPage ??
      rawData?.nextPage ??
      rawData?.pagination?.hasNextPage ??
      rawData?.paging?.has_next_page,
    );

    if (!hasNextPage) {
      break;
    }

    page += 1;
  }

  return records;
}

async function fetchReturnPrimeReturns() {
  const token = process.env.RP_TOKEN || process.env.RETURNPRIME_TOKEN;
  const url =
    process.env.RETURNPRIME_RETURNS_URL ||
    "https://admin.returnprime.com/return-exchange/v2/";

  if (!token) {
    throw new Error(
      "Missing RP_TOKEN or RETURNPRIME_TOKEN for ReturnPrime sync",
    );
  }

  return fetchPagedRecords({
    url,
    headers: {
      "x-rp-token": token,
    },
    pageParam: "page",
  });
}

async function fetchShiprocketReturns() {
  const url =
    process.env.SHIPROCKET_RETURNS_URL ||
    `${SHIPROCKET_BASE_URL}/v1/external/orders/processing/return`;

  const token = process.env.SHIPROCKET_TOKEN;
  const tokenHeader = process.env.SHIPROCKET_TOKEN_HEADER || "Authorization";
  const tokenPrefix = process.env.SHIPROCKET_TOKEN_PREFIX || "Bearer ";

  const headers: Record<string, string> = {};
  if (token) {
    headers[tokenHeader] = `${tokenPrefix}${token}`;
  }

  return fetchPagedRecords({
    url,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    pageParam: process.env.SHIPROCKET_PAGE_PARAM || "page",
  });
}

async function upsertReturnTracking(input: ShopifyReturnTrackingInput) {
  const trackingKey =
    input.shipmentId ||
    input.awbCode ||
    (input.orderId && input.channelId
      ? `${input.orderId}:${input.channelId}`
      : null);

  if (!trackingKey) {
    return { skipped: true, trackingNumber: null };
  }

  const existing = await prisma.shopifyReturnTracking.findUnique({
    where: { trackingNumber: trackingKey },
  });

  const shouldRefresh =
    !existing ||
    Date.now() - new Date(existing.fetchedAt).getTime() >= TRACKING_REFRESH_MS;

  if (!shouldRefresh) {
    return { skipped: true, trackingNumber: trackingKey };
  }

  const snapshot = await fetchShiprocketTrackingSnapshot({
    awbCode: input.awbCode,
    shipmentId: input.shipmentId,
    orderId: input.orderId,
    channelId: input.channelId,
    courierName: input.courierName || undefined,
  });

  const tracking = await prisma.shopifyReturnTracking.upsert({
    where: { trackingNumber: snapshot.trackingNumber },
    update: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      courierName: input.courierName || null,
      courierSlug: snapshot.courierSlug,
      latestStatus: snapshot.latestStatus,
      latestLocation: snapshot.latestLocation,
      scheduledDelivery: snapshot.scheduledDelivery
        ? new Date(snapshot.scheduledDelivery)
        : null,
      checkpointCount: snapshot.checkpointCount,
      checkpoints: snapshot.checkpoints,
      rawText: snapshot.rawText,
      fetchedAt: new Date(snapshot.fetchedAt),
    },
    create: {
      trackingNumber: snapshot.trackingNumber,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      courierName: input.courierName || null,
      courierSlug: snapshot.courierSlug,
      latestStatus: snapshot.latestStatus,
      latestLocation: snapshot.latestLocation,
      scheduledDelivery: snapshot.scheduledDelivery
        ? new Date(snapshot.scheduledDelivery)
        : null,
      checkpointCount: snapshot.checkpointCount,
      checkpoints: snapshot.checkpoints,
      rawText: snapshot.rawText,
      fetchedAt: new Date(snapshot.fetchedAt),
    },
  });

  return { skipped: false, tracking };
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function mapReturnPrimeReturn(record: JsonRecord, item: JsonRecord) {
  const trackingLookup = extractTrackingLookup(record);
  const refund = item.refund;
  const shopMoneyAmount = refund?.refunded_amount?.shop_money?.amount;
  const refundedAmount = shopMoneyAmount ? parseFloat(shopMoneyAmount) : 0;

  return {
    id: String(item.id),
    requestNumber: record.request_number !== undefined && record.request_number !== null ? String(record.request_number) : null,
    requestType: record.request_type !== undefined && record.request_type !== null ? String(record.request_type) : null,
    status: record.status !== undefined && record.status !== null ? String(record.status) : null,
    channel: record.channel !== undefined && record.channel !== null ? String(record.channel) : null,
    orderId: record.order?.id !== undefined && record.order?.id !== null ? String(record.order.id) : null,
    orderName: record.order?.name !== undefined && record.order?.name !== null ? String(record.order.name) : null,
    orderCreatedAt: parseDate(record.order?.created_at),
    fulfillmentId: record.order?.fulfillments?.[0]?.id !== undefined && record.order?.fulfillments?.[0]?.id !== null ? String(record.order.fulfillments[0].id) : null,
    deliveryStatus: record.order?.fulfillments?.[0]?.delivery_status !== undefined && record.order?.fulfillments?.[0]?.delivery_status !== null ? String(record.order.fulfillments[0].delivery_status) : null,
    deliveryDate: parseDate(record.order?.fulfillments?.[0]?.delivery_date),
    customerEmail: record.customer?.email !== undefined && record.customer?.email !== null ? String(record.customer.email) : null,
    postalCode: record.customer?.address?.postal_code !== undefined && record.customer?.address?.postal_code !== null ? String(record.customer.address.postal_code) : null,
    receivedStatus: record.received?.status || false,
    inspectedStatus: record.inspected?.status || false,
    rejectedStatus: record.rejected?.status || false,
    archivedStatus: record.archived?.status || false,
    refundStatus: refund?.status || null,
    eligibleRefundStatus: refund ? true : false,
    refundedAmount: refundedAmount,
    originalProductId: item.original_product?.product_id !== undefined && item.original_product?.product_id !== null ? String(item.original_product.product_id) : null,
    sku: item.original_product?.sku !== undefined && item.original_product?.sku !== null ? String(item.original_product.sku) : null,
    trackingNumber: trackingLookup.awbCode || trackingLookup.shipmentId || null,
    quantity: item.quantity !== undefined && item.quantity !== null ? parseInt(String(item.quantity), 10) : 1,
    actualAmount: item.shop_price?.actual_amount !== undefined && item.shop_price?.actual_amount !== null ? parseFloat(String(item.shop_price.actual_amount)) : null,
    imageSrc: item.original_product?.image?.src !== undefined && item.original_product?.image?.src !== null ? String(item.original_product.image.src) : null,
    rawPayload: record,
  };
}

function mapShiprocketReturn(record: JsonRecord, product: JsonRecord) {
  const trackingLookup = extractTrackingLookup(record);

  return {
    id: product.id ? String(product.id) : randomUUID(),
    requestNumber: record.channel_order_id !== undefined && record.channel_order_id !== null ? String(record.channel_order_id) : null,
    requestType: record.purpose_of_shipment !== undefined && record.purpose_of_shipment !== null ? String(record.purpose_of_shipment) : null,
    status: record.status !== undefined && record.status !== null ? String(record.status) : null,
    channel: record.channel_name !== undefined && record.channel_name !== null ? String(record.channel_name) : null,
    orderId: record.order_id !== undefined && record.order_id !== null ? String(record.order_id) : null,
    orderName: record.channel_order_id !== undefined && record.channel_order_id !== null ? String(record.channel_order_id) : null,
    orderCreatedAt: parseDate(record.channel_created_at),
    fulfillmentId: record.fulfillment_id !== undefined && record.fulfillment_id !== null ? String(record.fulfillment_id) : null,
    deliveryStatus: record.delivery_status !== undefined && record.delivery_status !== null ? String(record.delivery_status) : null,
    deliveryDate: parseDate(record.delivery_date),
    customerEmail: record.customer_email !== undefined && record.customer_email !== null ? String(record.customer_email) : null,
    postalCode: record.customer_pincode !== undefined && record.customer_pincode !== null ? String(record.customer_pincode) : null,
    courierName: record.courier_name !== undefined && record.courier_name !== null ? String(record.courier_name) : null,
    courierSlug: record.courier_slug !== undefined && record.courier_slug !== null ? String(record.courier_slug) : null,
    shipmentId: record.shipment_id !== undefined && record.shipment_id !== null ? String(record.shipment_id) : null,
    trackingNumber: record.tracking_number || trackingLookup.awbCode || null,
    sku: product.sku !== undefined && product.sku !== null ? String(product.sku) : null,
    productName: product.name !== undefined && product.name !== null ? String(product.name) : null,
    quantity: product.quantity !== undefined && product.quantity !== null ? parseInt(String(product.quantity), 10) : null,
    amount: record.total !== undefined && record.total !== null ? parseFloat(String(record.total)) : null,
    rawPayload: record,
  };
}

async function syncB2CReturns(records: JsonRecord[]) {
  const saved = [];
  const trackingSeeds: ShopifyReturnTrackingInput[] = [];

  for (const record of records) {
    if (!record.id) {
      console.warn("Skipping ReturnPrime record with no id:", record);
      continue;
    }

    const items = Array.isArray(record.line_items) ? record.line_items : [];
    if (items.length === 0) {
      console.warn("ReturnPrime record has no line items:", record.id);
      continue;
    }

    for (const item of items) {
      if (!item.id) {
        console.warn("Skipping line item with no id under record:", record.id);
        continue;
      }

      const mapped = mapReturnPrimeReturn(record, item);
      const returnRecord = await prisma.returnPrimeReturn.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: mapped,
      });

      saved.push(returnRecord);
    }

    const trackingLookup = extractTrackingLookup(record);
    if (
      trackingLookup.shipmentId ||
      trackingLookup.awbCode ||
      (trackingLookup.orderId && trackingLookup.channelId)
    ) {
      const firstItem = items.find(i => i.id);
      if (firstItem) {
        trackingSeeds.push({
          ...trackingLookup,
          sourceType: "RETURNPRIME",
          sourceId: String(firstItem.id),
          courierName: trackingLookup.courierName || "shiprocket",
        });
      }
    }
  }

  return { saved, trackingSeeds };
}

async function syncB2BReturns(records: JsonRecord[]) {
  const saved = [];
  const trackingSeeds: ShopifyReturnTrackingInput[] = [];

  for (const record of records) {
    if (!record.id) {
      console.warn("Skipping Shiprocket record with no id:", record);
      continue;
    }

    const products = Array.isArray(record.products) ? record.products : [];
    if (products.length === 0) {
      console.warn("Shiprocket record has no products:", record.id);
      continue;
    }

    for (const product of products) {
      if (!product.id) {
        console.warn("Skipping product with no id under record:", record.id);
        continue;
      }

      const mapped = mapShiprocketReturn(record, product);
      const returnRecord = await prisma.shiprocketReturn.upsert({
        where: { id: mapped.id },
        update: mapped,
        create: mapped,
      });

      saved.push(returnRecord);
    }

    const trackingLookup = extractTrackingLookup(record);
    if (
      trackingLookup.shipmentId ||
      trackingLookup.awbCode ||
      (trackingLookup.orderId && trackingLookup.channelId)
    ) {
      const firstProduct = products.find(p => p.id);
      if (firstProduct) {
        trackingSeeds.push({
          ...trackingLookup,
          sourceType: "SHIPROCKET",
          sourceId: String(firstProduct.id),
          courierName: trackingLookup.courierName || "shiprocket",
        });
      }
    }
  }

  return { saved, trackingSeeds };
}

export async function runShopifyReturnsJob() {
  const results = {
    b2cFetched: 0,
    b2cSaved: 0,
    b2bFetched: 0,
    b2bSaved: 0,
    trackingUpdated: 0,
    trackingSkipped: 0,
    trackingErrors: 0,
  };

  const [b2cRecords, b2bRecords] = await Promise.all([
    fetchReturnPrimeReturns(),
    fetchShiprocketReturns(),
  ]);

  results.b2cFetched = b2cRecords.length;
  results.b2bFetched = b2bRecords.length;

  const b2cResult = await syncB2CReturns(b2cRecords);
  const b2bResult = await syncB2BReturns(b2bRecords);

  results.b2cSaved = b2cResult.saved.length;
  results.b2bSaved = b2bResult.saved.length;

  const trackingJobs = [
    ...b2cResult.trackingSeeds,
    ...b2bResult.trackingSeeds,
  ] as ShopifyReturnTrackingInput[];

  const uniqueTrackingJobs = new Map<string, ShopifyReturnTrackingInput>();
  for (const job of trackingJobs) {
    const jobKey =
      job.shipmentId ||
      job.awbCode ||
      (job.orderId && job.channelId
        ? `${job.orderId}:${job.channelId}`
        : job.sourceId);
    uniqueTrackingJobs.set(jobKey, job);
  }

  for (const job of uniqueTrackingJobs.values()) {
    try {
      const result = await upsertReturnTracking(job);
      if (result.skipped) {
        results.trackingSkipped += 1;
      } else {
        results.trackingUpdated += 1;
      }
    } catch (error) {
      results.trackingErrors += 1;
      console.error(
        "[Shopify Returns] Tracking sync failed:",
        job.shipmentId || job.awbCode || (job.orderId && job.channelId ? `${job.orderId}:${job.channelId}` : job.sourceId),
        error,
      );
    }
  }

  return results;
}

export async function fetchShopifyReturnSources() {
  const [b2cRecords, b2bRecords] = await Promise.all([
    fetchReturnPrimeReturns(),
    fetchShiprocketReturns(),
  ]);

  return { b2cRecords, b2bRecords };
}

export {
  fetchReturnPrimeReturns,
  fetchShiprocketReturns,
};
