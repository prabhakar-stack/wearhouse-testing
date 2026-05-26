import { chromium } from "playwright";

function normalizeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseTrackingText(rawText) {
  const lines = normalizeLines(rawText);
  const checkpoints = [];

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

    if (!/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(dateLine)) continue;
    if (!timeLine || !/^\d{1,2}:\d{2}$/.test(timeLine)) continue;
    if (
      !maybeStatus ||
      /^(Date & time are usually|Powered by|TRACKCOURIER\.IO)$/i.test(
        maybeStatus,
      )
    )
      continue;

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
    /(Delivered|Out For Delivery|Arrived|Picked Up|Delay|Inscan|Pending|Shipment)/i.test(
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

async function runTest() {
  const trackingNumber = process.argv[2] || "52102114116";
  const url = "https://trackcourier.io/";

  console.log("Testing tracking fetch via UI flow for:", trackingNumber);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
    });
    const page = await context.newPage();

    let trackingData = null;
    page.on("response", async (response) => {
      try {
        const rurl = response.url();
        if (rurl.includes("get_checkpoints_table")) {
          try {
            trackingData = await response.json();
            console.log("\nTRACKING DATA RECEIVED (from API)\n");
            console.log(JSON.stringify(trackingData, null, 2));
            // also dump to file for inspection
            const fs = await import("fs");
            fs.writeFileSync(
              "tracking-data.json",
              JSON.stringify(trackingData, null, 2),
            );
          } catch (err) {
            console.log(
              "Failed to parse JSON from response:",
              err?.message || err,
            );
          }
        }
      } catch (err) {
        // ignore
      }
    });

    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });

    // Wait a bit for the page to initialize
    await page.waitForTimeout(2000);

    // Click the search box (role=searchbox) and fill the tracking number
    try {
      await page
        .getByRole("searchbox", { name: "Enter tracking number here." })
        .click({ timeout: 5000 });
    } catch (_) {
      // fallback: focus a common input selector
      await page
        .locator('input[placeholder="Enter tracking number here."]')
        .click({ timeout: 5000 })
        .catch(() => {});
    }

    await page.waitForTimeout(300);
    await page
      .getByRole("searchbox", { name: "Enter tracking number here." })
      .fill(trackingNumber);

    // select courier if select exists
    try {
      await page.locator("#courierList").selectOption("blue-dart-courier");
    } catch (_) {
      // ignore if not present
    }

    // Click the Track button
    try {
      await page.getByRole("button", { name: /Track/i }).click();
    } catch (_) {
      // fallback click by selector
      await page
        .locator('button:has-text("Track")')
        .click()
        .catch(() => {});
    }

    // Wait for the API response that contains checkpoints
    try {
      await page.waitForResponse(
        (r) => r.url().includes("get_checkpoints_table"),
        { timeout: 20000 },
      );
    } catch (err) {
      console.log("Timed out waiting for get_checkpoints_table response");
    }

    // If trackingData not set, try to read page text for status
    if (!trackingData) {
      const rawText = await page.evaluate(() => document.body.innerText || "");
      console.log("Raw text length:", rawText.length);
      console.log("Raw text snippet:\n", rawText.slice(0, 1200));
      const parsed = parseTrackingText(rawText);
      console.log(
        "Parsed snapshot:",
        JSON.stringify(
          {
            latestStatus: parsed.latestStatus,
            checkpointCount: parsed.checkpointCount,
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        "\nFinal status (MostRecentStatus):",
        trackingData.MostRecentStatus ||
          trackingData.mostRecentStatus ||
          trackingData.status ||
          "unknown",
      );
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
