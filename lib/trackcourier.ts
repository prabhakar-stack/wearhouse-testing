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
  "delhivery ground": "delhivery-courier",
  dlv: "delhivery-courier",
  "dlv ground b2b std": "delhivery-courier",
  "dlv_ground_b2b_std": "delhivery-courier",
  "amazon logistics": "amazon-logistics",
  dtdc: "dtdc",
  fedex: "fedex-courier",
  "fedex courier": "fedex-courier",
  "ekart logistics courier": "ekart-logistics-courier",
  shadowfax: "shadowfax",
  shiprocket: "shiprocket",
  "blue dart": "blue-dart-courier",
  dhl: "dhl-courier",
  ups: "ups-courier",
  gati: "gati-courier",
  xpressbees: "xpressbees-courier",
  "india post": "india-post",
  aramex: "aramex-courier",
};

function slugifyCourierName(courierName: string | null | undefined) {
  const normalized = (courierName || "").trim().toLowerCase();
  if (!normalized) return "blue-dart-courier";

  const alias = COURIER_SLUG_ALIASES[normalized];
  if (alias) return alias;

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

function formatToCourierDate(rawInfo: string | null | undefined): string | null {
  if (!rawInfo) return null;

  const firstDigitIdx = rawInfo.search(/\d/);
  if (firstDigitIdx === -1) return null;
  const strippedLeading = rawInfo.slice(firstDigitIdx).trim();

  const coreDateStr = strippedLeading.split(",")[0].trim();

  const standardForm = coreDateStr.replace(/-/g, " ");
  const parsedDate = new Date(standardForm);

  if (Number.isNaN(parsedDate.getTime())) return null;

  const day = String(parsedDate.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[parsedDate.getMonth()];
  const year = parsedDate.getFullYear();

  return `${day}-${month}-${year}`;
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

  // ✅ FIX 1: Flexible line finder to scan for any form of delivery status headers
  const scheduledLine = lines.find((line) =>
    /(Scheduled|Expected|Estimated|Delivery)\s*Delivery/i.test(line)
  );
  const scheduledDelivery = scheduledLine ? formatToCourierDate(scheduledLine) : null;

  // ✅ FIX 2: Flexible pattern allowing spaces or hyphens for checkpoint logs
  const flexibleDateRegex = /^\d{1,2}[- ][A-Za-z]{3,9}[- ]\d{4}$/;

  for (let index = 0; index < lines.length; index++) {
    const dateLine = lines[index];
    const timeLine = lines[index + 1] || null;
    const maybeStatus = lines[index + 2] || null;
    const maybeLocation = lines[index + 3] || null;

    if (!flexibleDateRegex.test(dateLine)) {
      continue;
    }

    if (!timeLine || !/^\d{1,2}:\d{2}/.test(timeLine)) {
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
      date: formatToCourierDate(dateLine) || dateLine, // Standardize to DD-MMM-YYYY format
      time: timeLine,
      status: maybeStatus,
      location:
        maybeLocation && !flexibleDateRegex.test(maybeLocation)
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
      /(Delivered|Out For Delivery|Arrived|Picked Up|Pending|Shipment)/i.test(line),
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

    console.log(`[Playwright Browser] Navigating to URL: ${trackingUrl}`);
    await page.goto(trackingUrl, { waitUntil: "domcontentloaded", timeout: 90000 });

    // Dynamic polling helper checking every 5 seconds for success
    const pollForData = async (maxSeconds: number): Promise<boolean> => {
      const startTime = Date.now();
      while (Date.now() - startTime < maxSeconds * 1000) {
        if (apiResponseJson && apiResponseJson.Checkpoints && apiResponseJson.Checkpoints.length > 0) {
          return true;
        }

        const rawText = decodeHtmlEntities(await page.evaluate(() => document.body.innerText || ""));
        const parsed = parseTrackingText(rawText);

        if (parsed.found && parsed.checkpointCount > 0) {
          return true;
        }

        await page.waitForTimeout(5000);
      }
      return false;
    };

    console.log(`[Playwright Browser] Beginning dynamic status polling (up to 60 seconds)...`);
    let success = await pollForData(60);

    // If first round failed to get a good status, trigger single page reload as fallback
    if (!success) {
      console.log(`[Playwright Browser] First polling round failed. Triggering single page reload to bypass glitches...`);
      await page.reload({ waitUntil: "domcontentloaded" });
      console.log(`[Playwright Browser] Reload complete. Polling again for up to 30 seconds...`);
      success = await pollForData(30);
    }

    // Mark as unable to track if polling still unsuccessful after 2nd round
    if (!success) {
      console.log(`[Playwright Browser] Final result: Unable to track this shipment.`);
      return {
        trackingNumber,
        courierName: courierName || null,
        courierSlug,
        trackingUrl,
        rawText: "Unable to track this",
        fetchedAt: new Date().toISOString(),
        scheduledDelivery: null,
        latestStatus: "Unable to track this",
        latestLocation: null,
        checkpointCount: 0,
        checkpoints: [],
        found: false,
      } satisfies TrackingSnapshot;
    }

    // If clean JSON API response was intercepted during direct page load, use it immediately!
    if (
      apiResponseJson &&
      apiResponseJson.Checkpoints &&
      apiResponseJson.Checkpoints.length > 0
    ) {
      console.log("[Playwright Browser] Intercepted clean JSON from direct page load!");
      const cps: TrackingCheckpoint[] = apiResponseJson.Checkpoints.map(
        (c: any) => ({
          date: formatToCourierDate(c.Date) || c.Date,
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
        rawText: JSON.stringify(apiResponseJson),
        fetchedAt: new Date().toISOString(),
        scheduledDelivery: formatToCourierDate(apiResponseJson?.AdditionalInfo) || null,
        latestStatus: (apiResponseJson?.MostRecentStatus)?.split('-')[0].trim() || null,
        latestLocation: (cps[0] && cps[0].location) || null,
        checkpointCount: cps.length,
        checkpoints: cps,
        found: true,
      } satisfies TrackingSnapshot;
    }

    const rawText = decodeHtmlEntities(
      await page.evaluate(() => document.body.innerText || ""),
    );

    const parsed = parseTrackingText(rawText);

    if (
      (!parsed.found || parsed.checkpointCount === 0) &&
      typeof page.getByRole === "function"
    ) {
      try {
        await page.goto("https://trackcourier.io/", {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        });

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

        try {
          await page.locator("#courierList").selectOption(courierSlug);
        } catch (_) {
          // ignore
        }

        try {
          await page.getByRole("button", { name: /Track/i }).click();
        } catch (_) {
          await page
            .locator('button:has-text("Track")')
            .click()
            .catch(() => {});
        }

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
              date: formatToCourierDate(c.Date) || c.Date,
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
            rawText: apiResponseJson ? JSON.stringify(apiResponseJson) : rawText,
            fetchedAt: new Date().toISOString(),
            scheduledDelivery: formatToCourierDate(apiResponseJson?.AdditionalInfo) || parsed.scheduledDelivery || null,
            latestStatus: (apiResponseJson?.MostRecentStatus || parsed.latestStatus)?.split('-')[0].trim(),
            latestLocation: (cps[0] && cps[0].location) || parsed.latestLocation,
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