import { prisma } from "@/lib/prisma";
import { fetchShiprocketTrackingSnapshot } from "@/lib/shiprocketTracking";

const TRACKING_REFRESH_MS = 60 * 60 * 1000;

type JsonRecord = Record<string, any>;

type ShopifyReturnTrackingInput = {
  trackingNumber: string;
  sourceType: string;
  sourceId: string;
  courierName?: string | null;
};

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

function pick(...values: Array<unknown>) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return null;
}

function getSourceId(record: JsonRecord) {
  return pick(
    record.id,
    record.request_number,
    record.request_id,
    record.return_id,
    record.order_id,
    record.order_name,
    record.tracking,
    record.tracking_number,
    record.shipment_id,
    record.shipment_number,
  );
}

function getReturnPrimeTrackingNumber(record: JsonRecord) {
  return pick(
    record.tracking,
    record.tracking_number,
    record.awb,
    record.awb_number,
    record.shipment_awb,
    record.courier_awb,
    record.lane_awb,
  );
}

function getShiprocketShipmentId(record: JsonRecord) {
  return pick(
    record.shipment_id,
    record.shipmentid,
    record.shipment,
    record.shipment_no,
    record.shipment_number,
  );
}

function getShiprocketTrackingNumber(record: JsonRecord) {
  return pick(
    record.tracking,
    record.tracking_number,
    record.awb,
    record.awb_number,
    record.shipment_awb,
    record.courier_awb,
    record.lane_awb,
  );
}

function getCourierName(record: JsonRecord) {
  return pick(
    record.courier_name,
    record.courier,
    record.shipping_provider,
    record.delivery_partner,
    record.logistics_partner,
    record.carrier,
  );
}

function mapReturnPrimeReturn(record: JsonRecord) {
  return {
    id: getSourceId(record),
    trackingNumber: getReturnPrimeTrackingNumber(record),
    rawPayload: record,
  };
}

function mapShiprocketReturn(record: JsonRecord) {
  return {
    id: getSourceId(record),
    shipmentId: getShiprocketShipmentId(record),
    trackingNumber: getShiprocketTrackingNumber(record),
    courierName: getCourierName(record),
    rawPayload: record,
  };
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
  const url = process.env.SHIPROCKET_RETURNS_URL;

  if (!url) {
    return [];
  }

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
  const existing = await prisma.shopifyReturnTracking.findUnique({
    where: { trackingNumber: input.trackingNumber },
  });

  const shouldRefresh =
    !existing ||
    Date.now() - new Date(existing.fetchedAt).getTime() >= TRACKING_REFRESH_MS;

  if (!shouldRefresh) {
    return { skipped: true, trackingNumber: input.trackingNumber };
  }

  const snapshot = await fetchShiprocketTrackingSnapshot(
    input.trackingNumber,
    input.courierName || undefined,
  );

  const tracking = await prisma.shopifyReturnTracking.upsert({
    where: { trackingNumber: input.trackingNumber },
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
      trackingNumber: input.trackingNumber,
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

async function syncB2CReturns(records: JsonRecord[]) {
  const saved = [];
  const trackingSeeds: ShopifyReturnTrackingInput[] = [];

  for (const record of records) {
    const mapped = mapReturnPrimeReturn(record);

    const id = mapped.id;
    if (!id) {
      continue;
    }

    const returnRecord = await prisma.returnPrimeReturn.upsert({
      where: { id },
      update: {
        trackingNumber: mapped.trackingNumber,
        rawPayload: mapped.rawPayload,
      },
      create: {
        id,
        trackingNumber: mapped.trackingNumber,
        rawPayload: mapped.rawPayload,
      },
    });

    saved.push(returnRecord);

    if (mapped.trackingNumber) {
      trackingSeeds.push({
        trackingNumber: mapped.trackingNumber,
        sourceType: "RETURNPRIME",
        sourceId: id,
        courierName: "shiprocket",
      });
    }
  }

  return { saved, trackingSeeds };
}

async function syncB2BReturns(records: JsonRecord[]) {
  const saved = [];
  const trackingSeeds: ShopifyReturnTrackingInput[] = [];

  for (const record of records) {
    const mapped = mapShiprocketReturn(record);

    const id = mapped.id;
    if (!id) {
      continue;
    }

    const returnRecord = await prisma.shiprocketReturn.upsert({
      where: { id },
      update: {
        shipmentId: mapped.shipmentId,
        trackingNumber: mapped.trackingNumber,
        courierName: mapped.courierName,
        rawPayload: mapped.rawPayload,
      },
      create: {
        id,
        shipmentId: mapped.shipmentId,
        trackingNumber: mapped.trackingNumber,
        courierName: mapped.courierName,
        rawPayload: mapped.rawPayload,
      },
    });

    saved.push(returnRecord);

    const shiprocketTrackingNumber = mapped.shipmentId || mapped.trackingNumber;
    if (shiprocketTrackingNumber) {
      trackingSeeds.push({
        trackingNumber: shiprocketTrackingNumber,
        sourceType: "SHIPROCKET",
        sourceId: id,
        courierName: mapped.courierName || "shiprocket",
      });
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
    uniqueTrackingJobs.set(job.trackingNumber, job);
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
        job.trackingNumber,
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
  mapReturnPrimeReturn,
  mapShiprocketReturn,
};
