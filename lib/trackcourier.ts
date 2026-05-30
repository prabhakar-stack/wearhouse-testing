import { chromium } from "playwright";

export type TrackingCheckpoint = {
  date: string;
  time: string | null;
  status: string;
  location: string | null;
};

export type TrackingSnapshot = {
  trackingNumber: string;
  courierName: string | null;
  courierSlug: string;
  trackingUrl: string;
  found: boolean;
  scheduledDelivery: string | null;
  latestStatus: string | null;
  latestLocation: string | null;
  checkpointCount: number;
  checkpoints: TrackingCheckpoint[];
  rawText: string;
  fetchedAt: string;
};

const COURIER_SLUG_ALIASES: Record<string, string> = {
  "blue dart courier": "blue-dart-courier",
  bluedart: "blue-dart-courier",
  "delhivery courier": "delhivery-courier",
  delhivery: "delhivery-courier",
  "amazon logistics": "amazon-logistics",
  dtdc: "dtdc",
  fedex: "fedex-courier",
  "fedex courier": "fedex-courier",
  "ekart logistics courier": "ekart-logistics-courier",
  shadowfax: "shadowfax",
  shiprocket: "shiprocket",
  "blue dart": "blue-dart-courier",
};

function slugifyCourierName(courierName: string | null | undefined) {
  const normalized = (courierName || "").trim().toLowerCase();
  if (!normalized) return "blue-dart-courier";

  // Check aliases first
  const alias = COURIER_SLUG_ALIASES[normalized];
  if (alias) return alias;

  // Smart prefix and fuzzy mapping for variations (e.g. bluedart_ground_std, delhivery_surface)
  if (normalized.startsWith("bluedart") || normalized.startsWith("blue-dart") || normalized.includes("blue dart")) {
    return "blue-dart-courier";
  }
  if (normalized.startsWith("delhivery")) {
    return "delhivery-courier";
  }
  if (normalized.startsWith("fedex")) {
    return "fedex-courier";
  }
  if (normalized.startsWith("ekart")) {
    return "ekart-logistics-courier";
  }

  return normalized
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseTrackingText(
  rawText: string,
): Pick<
  TrackingSnapshot,
  | "scheduledDelivery"
  | "latestStatus"
  | "latestLocation"
  | "checkpointCount"
  | "checkpoints"
  | "found"
> {
  const lines = normalizeLines(rawText);
  const checkpoints: TrackingCheckpoint[] = [];

  const scheduledLine = lines.find((line) =>
    /^Scheduled Delivery:/i.test(line),
  );
  const scheduledDelivery = scheduledLine
    ? scheduledLine.replace(/^Scheduled Delivery:\s*/i, "").trim()
    : null;

  for (let index = 0; index < lines.length; index++) {
    const dateLine = lines[index];
    const timeLine = lines[index + 1] || null;
    const maybeStatus = lines[index + 2] || null;
    const maybeLocation = lines[index + 3] || null;

    if (!/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(dateLine)) {
      continue;
    }

    if (!timeLine || !/^\d{1,2}:\d{2}$/.test(timeLine)) {
      continue;
    }

    if (
      !maybeStatus ||
      /^(Date & time are usually|Powered by|TRACKCOURIER\.IO)$/i.test(
        maybeStatus,
      )
    ) {
      continue;
    }

    checkpoints.push({
      date: dateLine,
      time: timeLine,
      status: maybeStatus,
      location:
        maybeLocation && !/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(maybeLocation)
          ? maybeLocation
          : null,
    });
  }

  const statusCandidates = lines.filter((line) =>
    /(Delivered|Out For Delivery|Arrived|Picked Up|Connected|Delay|Inscan|Pending|Shipment)/i.test(
      line,
    ),
  );
  const latestCheckpoint = checkpoints[0] || null;

  return {
    scheduledDelivery,
    latestStatus: latestCheckpoint?.status || statusCandidates[0] || null,
    latestLocation: latestCheckpoint?.location || null,
    checkpointCount: checkpoints.length,
    checkpoints,
    found: lines.some((line) =>
      /(Delivered|Out For Delivery|Arrived|Picked Up|Pending)/i.test(line),
    ),
  };
}

export async function fetchTrackingSnapshot(
  trackingNumber: string,
  courierName?: string | null,
) {
  const courierSlug = slugifyCourierName(courierName);
  const trackingUrl = `https://trackcourier.io/track-and-trace/${courierSlug}/${encodeURIComponent(trackingNumber)}`;
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    await page.goto(trackingUrl, { waitUntil: "networkidle", timeout: 90000 });

    // Wait 20 seconds strictly to ensure dynamic tracking status completely loads
    console.log(`[Playwright Browser] Navigation to track-and-trace complete. Waiting 20 seconds for page to update...`);
    await page.waitForTimeout(30000);

    const rawText = decodeHtmlEntities(
      await page.evaluate(() => document.body.innerText || ""),
    );
    const parsed = parseTrackingText(rawText);

    // If parsing the direct track-and-trace page found nothing useful,
    // try the homepage UI flow which triggers the `get_checkpoints_table` API.
    if (
      (!parsed.found || parsed.checkpointCount === 0) &&
      typeof page.getByRole === "function"
    ) {
      try {
        // Navigate to homepage and trigger the UI flow
        await page.goto("https://trackcourier.io/", {
          waitUntil: "networkidle",
          timeout: 90000,
        });

        let apiResponseJson: any = null;
        page.on("response", async (response: any) => {
          try {
            if (response.url().includes("get_checkpoints_table")) {
              apiResponseJson = await response.json();
            }
          } catch (err) {
            // ignore
          }
        });

        // Try to focus and fill the tracking input
        try {
          await page
            .getByRole("searchbox", { name: "Enter tracking number here." })
            .click({ timeout: 3000 });
        } catch (_) {
          await page
            .locator('input[placeholder="Enter tracking number here."]')
            .click({ timeout: 3000 })
            .catch(() => {});
        }

        await page.waitForTimeout(250);
        try {
          await page
            .getByRole("searchbox", { name: "Enter tracking number here." })
            .fill(trackingNumber);
        } catch (_) {
          await page
            .locator('input[placeholder="Enter tracking number here."]')
            .fill(trackingNumber)
            .catch(() => {});
        }

        // select courier if present
        try {
          await page.locator("#courierList").selectOption(courierSlug);
        } catch (_) {
          // ignore
        }

        // Click the track button
        try {
          await page.getByRole("button", { name: /Track/i }).click();
        } catch (_) {
          await page
            .locator('button:has-text("Track")')
            .click()
            .catch(() => {});
        }

        // wait for API response
        try {
          await page.waitForResponse(
            (r: any) => r.url().includes("get_checkpoints_table"),
            { timeout: 20000 },
          );
        } catch (_) {
          // ignore timeout
        }

        if (
          apiResponseJson &&
          apiResponseJson.Checkpoints &&
          apiResponseJson.Checkpoints.length > 0
        ) {
          const cps: TrackingCheckpoint[] = apiResponseJson.Checkpoints.map(
            (c: any) => ({
              date: c.Date || "",
              time: c.Time || null,
              status: c.Activity || c.CheckpointState || "",
              location: c.Location || null,
            }),
          );

          return {
            trackingNumber,
            courierName: courierName || null,
            courierSlug,
            trackingUrl,
            rawText: apiResponseJson
              ? JSON.stringify(apiResponseJson)
              : rawText,
            fetchedAt: new Date().toISOString(),
            scheduledDelivery:
              apiResponseJson?.AdditionalInfo?.replace(
                /^Scheduled Delivery:\s*/i,
                "",
              ) ||
              parsed.scheduledDelivery ||
              null,
            latestStatus:
              apiResponseJson?.MostRecentStatus || parsed.latestStatus,
            latestLocation:
              (cps[0] && cps[0].location) || parsed.latestLocation,
            checkpointCount: cps.length,
            checkpoints: cps,
            found: true,
          } satisfies TrackingSnapshot;
        }
      } catch (err) {
        // fall back to parsed result below
      }
    }

    return {
      trackingNumber,
      courierName: courierName || null,
      courierSlug,
      trackingUrl,
      rawText,
      fetchedAt: new Date().toISOString(),
      ...parsed,
    } satisfies TrackingSnapshot;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
