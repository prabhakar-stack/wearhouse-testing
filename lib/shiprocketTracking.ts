import type { TrackingSnapshot } from "@/lib/trackcourier";
import { setTimeout } from "timers/promises";

const SHIPROCKET_BASE_URL = (
  process.env.SHIPROCKET_API_BASE_URL ||
  process.env.API_BASE_SHIPROCKET ||
  "https://apiv2.shiprocket.in"
).replace(/\/$/, "");

let cachedToken: string | null = process.env.SHIPROCKET_TOKEN || null;
let cachedTokenSource: "env" | "login" | null = cachedToken ? "env" : null;

function pick(...values: Array<unknown>) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return null;
}

type ShiprocketCheckpoint = {
  date: string;
  time: string | null;
  status: string;
  location: string | null;
};

function toDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCheckpoint(checkpoint: any): ShiprocketCheckpoint {
  return {
    date:
      pick(checkpoint?.date, checkpoint?.datetime, checkpoint?.timestamp) || "",
    time: pick(checkpoint?.time),
    status:
      pick(
        checkpoint?.activity,
        checkpoint?.status,
        checkpoint?.current_status,
      ) || "Unknown",
    location: pick(checkpoint?.location),
  };
}

function parseTrackingData(trackingData: any, trackingNumber: string) {
  const shipmentTrack = Array.isArray(trackingData?.shipment_track)
    ? trackingData.shipment_track
    : [];
  const shipmentTrackActivities = Array.isArray(
    trackingData?.shipment_track_activities,
  )
    ? trackingData.shipment_track_activities
    : [];

  const checkpoints = shipmentTrackActivities
    .map(normalizeCheckpoint)
    .filter((item: ShiprocketCheckpoint) => item.status);
  const latestCheckpoint = checkpoints[0] || null;
  const latestShipment = shipmentTrack[0] || {};

  const latestStatus = pick(
    latestShipment?.current_status,
    latestShipment?.status,
    latestCheckpoint?.status,
  );

  const latestLocation = pick(
    latestCheckpoint?.location,
    latestShipment?.current_location,
    latestShipment?.location,
  );

  const scheduledDelivery = toDate(
    pick(
      latestShipment?.etd,
      trackingData?.track_url ? trackingData?.shipment_track?.[0]?.etd : null,
      trackingData?.scheduled_delivery,
    ),
  );

  const courierName = pick(
    latestShipment?.courier_name,
    latestShipment?.courier,
    trackingData?.courier_name,
  );

  const trackUrl =
    pick(trackingData?.track_url, trackingData?.tracking_url) ||
    `${SHIPROCKET_BASE_URL}/v1/external/courier/track/awb/${encodeURIComponent(trackingNumber)}?medium=shiprocketMCP`;

  return {
    trackingUrl: trackUrl,
    courierName,
    courierSlug: courierName
      ? courierName
          .trim()
          .toLowerCase()
          .replace(/&/g, " and ")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "shiprocket",
    found: Boolean(latestStatus || latestLocation || checkpoints.length > 0),
    scheduledDelivery: scheduledDelivery
      ? scheduledDelivery.toISOString()
      : null,
    latestStatus: latestStatus || null,
    latestLocation: latestLocation || null,
    checkpointCount: checkpoints.length,
    checkpoints,
  };
}

async function getShiprocketBearerToken() {
  if (cachedToken) {
    return cachedToken;
  }

  const email = process.env.SHIPROCKET_EMAIL || process.env.SELLER_EMAIL;
  const password =
    process.env.SHIPROCKET_PASSWORD || process.env.SELLER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing Shiprocket auth credentials. Set SHIPROCKET_TOKEN or SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD.",
    );
  }

  const response = await fetch(
    `${SHIPROCKET_BASE_URL}/v1/external/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Shiprocket auth request failed with ${response.status} ${response.statusText}`,
    );
  }

  const responseData = await response.json();
  const token = responseData?.token;
  if (!token) {
    throw new Error("Shiprocket auth response did not include a token");
  }

  cachedToken = token;
  cachedTokenSource = "login";
  return token;
}

type ShiprocketTrackingLookup = {
  awbCode?: string | null;
  shipmentId?: string | null;
  orderId?: string | null;
  channelId?: string | null;
  courierName?: string | null;
};

type TrackingCandidate = {
  id: string;
  url: string;
};

function buildTrackingCandidates(lookup: ShiprocketTrackingLookup) {
  const candidates: TrackingCandidate[] = [];

  if (lookup.awbCode) {
    candidates.push({
      id: lookup.awbCode,
      url: `${SHIPROCKET_BASE_URL}/v1/external/courier/track/awb/${encodeURIComponent(lookup.awbCode)}?medium=shiprocketMCP`,
    });
  }

  if (lookup.shipmentId) {
    candidates.push({
      id: lookup.shipmentId,
      url: `${SHIPROCKET_BASE_URL}/v1/external/courier/track/shipment/${encodeURIComponent(lookup.shipmentId)}?medium=shiprocketMCP`,
    });
  }

  if (lookup.orderId && lookup.channelId) {
    candidates.push({
      id: `${lookup.orderId}:${lookup.channelId}`,
      url: `${SHIPROCKET_BASE_URL}/v1/external/courier/track?order_id=${encodeURIComponent(lookup.orderId)}&channel_id=${encodeURIComponent(lookup.channelId)}`,
    });
  }

  return candidates;
}

async function requestTrackingSnapshot(
  token: string,
  candidate: TrackingCandidate,
  courierName?: string | null,
): Promise<TrackingSnapshot> {
  const response = await fetch(candidate.url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // 8‑second timeout per request
    signal: AbortSignal.timeout(8000),
  });

    // If response is not OK, attempt to parse the error body to see if it's a cancelled AWB.
  if (!response.ok) {
    const errText = await response.text();
    // Try to parse JSON – Shiprocket returns JSON even for 500 errors.
    let parsedErr: any = null;
    try {
      parsedErr = JSON.parse(errText);
    } catch (_) {
      // Not JSON – fall through to generic error.
    }
    const isCancelled =
      parsedErr &&
      typeof parsedErr.message === "string" &&
      parsedErr.message.toLowerCase().includes("cancelled");

    if (isCancelled) {
      // Return a minimal snapshot indicating the shipment was cancelled.
      return {
        trackingNumber: candidate.id,
        courierName: null,
        courierSlug: null,
        trackingUrl: null,
        found: false,
        scheduledDelivery: null,
        latestStatus: "Cancelled",
        latestLocation: null,
        checkpointCount: 0,
        checkpoints: [],
        rawText: errText,
        fetchedAt: new Date().toISOString(),
      } as any; // cast to any to satisfy TypeScript
    }

    // Otherwise, re‑throw the generic error.
    throw new Error(
      `Shiprocket tracking request failed with ${response.status} ${response.statusText}: ${errText}`,
    );
  }


  const responseData = await response.json();
  const trackingData = responseData?.tracking_data ?? responseData ?? {};
  const parsed = parseTrackingData(trackingData, candidate.id);

  return {
    trackingNumber: candidate.id,
    courierName: parsed.courierName || courierName || null,
    courierSlug: parsed.courierSlug,
    trackingUrl: parsed.trackingUrl,
    found: parsed.found,
    scheduledDelivery: parsed.scheduledDelivery,
    latestStatus: parsed.latestStatus,
    latestLocation: parsed.latestLocation,
    checkpointCount: parsed.checkpointCount,
    checkpoints: parsed.checkpoints,
    rawText: JSON.stringify(
      {
        tokenSource: cachedTokenSource,
        trackingData,
      },
      null,
      2,
    ),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchShiprocketTrackingSnapshot(
  lookup: ShiprocketTrackingLookup,
): Promise<TrackingSnapshot> {
  const candidates = buildTrackingCandidates(lookup);
  if (candidates.length === 0) {
    throw new Error("Missing Shiprocket tracking identifiers.");
  }

  const token = await getShiprocketBearerToken();
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return await requestTrackingSnapshot(
        token,
        candidate,
        lookup.courierName,
      );
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error("Shiprocket tracking request failed.");
}
