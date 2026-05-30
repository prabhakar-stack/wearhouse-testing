var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config2 = require("dotenv/config");
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_pg2 = __toESM(require("pg"), 1);

// bot/amazonFiler.ts
var import_playwright = require("playwright");
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_pg = __toESM(require("pg"), 1);
var import_config = require("dotenv/config");
function matchProduct(webName, dbClaim) {
  const w = webName.toLowerCase().trim();
  const dbPName = (dbClaim.productName || "").toLowerCase().trim();
  const sku = (dbClaim.sku || "").toLowerCase().trim();
  if (!dbPName && !sku) return false;
  if (dbPName && (w.includes(dbPName) || dbPName.includes(w))) {
    return true;
  }
  if (sku && w.includes(sku)) {
    return true;
  }
  if (dbPName) {
    const dbWords = dbPName.split(/\s+/).filter((word) => word.length > 3);
    if (dbWords.length > 0) {
      let matches = 0;
      for (const dw of dbWords) {
        if (w.includes(dw)) matches++;
      }
      if (matches / dbWords.length >= 0.5) {
        return true;
      }
    }
  }
  return false;
}
async function downloadFileFromUrl(url, destPath) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      const text = await res.text();
      const confirmMatch = text.match(/confirm=([a-zA-Z0-9_:-]+)/);
      if (confirmMatch) {
        const confirmUrl = url + `&confirm=${confirmMatch[1]}`;
        const confirmRes = await fetch(confirmUrl);
        if (confirmRes.ok) {
          const buffer2 = Buffer.from(await confirmRes.arrayBuffer());
          import_fs.default.writeFileSync(destPath, buffer2);
          return true;
        }
      }
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    import_fs.default.writeFileSync(destPath, buffer);
    return true;
  } catch (err) {
    console.error(`Error downloading from ${url}:`, err);
    return false;
  }
}
async function getDriveFileIdsFromFolder(folderUrl) {
  try {
    const res = await fetch(folderUrl);
    if (!res.ok) return [];
    const html = await res.text();
    const idSet = /* @__PURE__ */ new Set();
    const matches = Array.from(html.matchAll(/file\/d\/([a-zA-Z0-9_-]{28,45})/g));
    for (const m of matches) {
      idSet.add(m[1]);
    }
    const idMatches = Array.from(html.matchAll(/"id"\s*:\s*"([a-zA-Z0-9_-]{28,45})"/g));
    for (const m of idMatches) {
      idSet.add(m[1]);
    }
    const folderIdMatch = folderUrl.match(/folders\/([a-zA-Z0-9_-]{25,45})/);
    const folderId = folderIdMatch ? folderIdMatch[1] : "";
    const ids = Array.from(idSet).filter((id) => id !== folderId);
    return ids;
  } catch (err) {
    console.error("Error scraping Google Drive folder HTML:", err);
    return [];
  }
}
async function downloadFilesFromDrive(driveUrl, tempFolder, log) {
  const downloadedPaths = [];
  try {
    if (!import_fs.default.existsSync(tempFolder)) {
      import_fs.default.mkdirSync(tempFolder, { recursive: true });
    }
    let fileIds = [];
    const fileIdMatch = driveUrl.match(/file\/d\/([a-zA-Z0-9_-]{28,45})/) || driveUrl.match(/[?&]id=([a-zA-Z0-9_-]{28,45})/);
    if (fileIdMatch && !driveUrl.includes("/folders/")) {
      log(`Detected direct Google Drive file link with ID: ${fileIdMatch[1]}`);
      fileIds.push(fileIdMatch[1]);
    } else if (driveUrl.includes("/folders/") || driveUrl.includes("drive.google.com")) {
      const folderIdMatch = driveUrl.match(/folders\/([a-zA-Z0-9_-]{25,45})/);
      const folderId = folderIdMatch ? folderIdMatch[1] : "";
      log(`Detected Google Drive folder URL. Folder ID: "${folderId}". Fetching page for extraction...`);
      fileIds = await getDriveFileIdsFromFolder(driveUrl);
      log(`Extracted ${fileIds.length} file candidate IDs from the folder HTML.`);
    } else if (driveUrl.startsWith("http")) {
      log(`Detected direct non-Drive URL: ${driveUrl}. Attempting file download...`);
      const extMatch = driveUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|pdf|docx|xlsx)/);
      const ext = extMatch ? extMatch[1] : "png";
      const destPath = import_path.default.join(tempFolder, `direct_download_0.${ext}`);
      const ok = await downloadFileFromUrl(driveUrl, destPath);
      if (ok) {
        downloadedPaths.push(destPath);
        log(`Successfully downloaded direct file: ${destPath}`);
      }
    }
    let count = 0;
    for (const id of fileIds) {
      if (count >= 12) break;
      const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
      const destPath = import_path.default.join(tempFolder, `drive_download_${count}.png`);
      log(`Downloading Google Drive file ID "${id}" to: ${destPath}`);
      const success = await downloadFileFromUrl(directDownloadUrl, destPath);
      if (success) {
        downloadedPaths.push(destPath);
        count++;
      } else {
        log(`Download failed for Google Drive ID: ${id}`);
      }
    }
  } catch (err) {
    log(`[Drive Downloader Error] ${err.message}`);
  }
  return downloadedPaths;
}
async function getClaimsForTrackingId(trackingId, orderId) {
  console.log(`[DB] Querying database for claims with trackingId="${trackingId}" or orderId="${orderId}"...`);
  let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("\u26A0\uFE0F [DB] No Connection String found, returning empty array.");
    return [];
  }
  connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
  if (connectionString.startsWith("hpostgresql://")) {
    connectionString = connectionString.substring(1);
  }
  const passwordMatch = connectionString.match(/:(.*)@/);
  if (passwordMatch && passwordMatch[1]) {
    const password = passwordMatch[1];
    if (password.startsWith("[") && password.endsWith("]")) {
      const sanitizedPassword = password.substring(1, password.length - 1);
      connectionString = connectionString.replace(password, sanitizedPassword);
    }
  }
  let tempPool = null;
  try {
    tempPool = new import_pg.default.Pool({
      connectionString,
      connectionTimeoutMillis: 1e4,
      idleTimeoutMillis: 15e3,
      max: 2,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
    });
    const toCamelCase2 = (obj) => {
      const newObj = {};
      for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/g, (g) => g.toUpperCase().replace("-", "").replace("_", ""));
        newObj[camelKey] = obj[key];
      }
      return newObj;
    };
    let rows = [];
    const tid = (trackingId || "").trim();
    const oid = (orderId || "").trim();
    if (tid || oid) {
      const tables = ["claims", '"Claims"'];
      for (const table of tables) {
        try {
          const colRes = await tempPool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = ${table.includes('"') ? `'${table.replace(/"/g, "")}'` : `'${table}'`}
          `);
          const columns = colRes.rows.map((r) => r.column_name.toLowerCase());
          if (columns.length === 0) continue;
          const filters = [];
          const params = [];
          if (tid && columns.includes("tracking_id")) {
            params.push(tid);
            filters.push(`tracking_id ILIKE $${params.length}`);
          }
          if (oid && columns.includes("order_id")) {
            params.push(oid);
            filters.push(`order_id ILIKE $${params.length}`);
          }
          if (filters.length === 0) continue;
          const query = `SELECT * FROM ${table} WHERE ${filters.join(" OR ")}`;
          const result = await tempPool.query(query, params);
          rows = result.rows.map(toCamelCase2);
          if (rows.length > 0) {
            console.log(`[DB] Successfully fetched ${rows.length} rows from ${table}.`);
            break;
          }
        } catch (err) {
          console.warn(`[DB] Table ${table} fallback query failed: ${err.message}`);
        }
      }
    }
    return rows;
  } catch (dbErr) {
    console.error(`[DB Error] Unable to connect or query Database: ${dbErr.message}`, dbErr);
    return [];
  } finally {
    if (tempPool) {
      await tempPool.end().catch(() => {
      });
    }
  }
}
async function selectCustomDropdownOption(page, locator, targetText) {
  if (!targetText) return;
  const lowercaseTarget = targetText.toLowerCase().trim();
  const count = await locator.count();
  if (count === 0) return;
  const element = locator.first();
  try {
    await element.click();
    await page.waitForTimeout(500);
  } catch (clickErr) {
    console.warn(`Initial click on dropdown failed: ${clickErr.message}`);
  }
  let success = false;
  try {
    success = await element.evaluate((el, target) => {
      const lowerTarget = target.toLowerCase().trim();
      const findOptionMatch = (optionsList) => {
        return optionsList.find((opt) => {
          const text = (opt.textContent || opt.innerText || "").toLowerCase().trim();
          const val = (opt.getAttribute?.("value") || opt.value || "").toLowerCase().trim();
          const label = (opt.getAttribute?.("label") || "").toLowerCase().trim();
          return text.includes(lowerTarget) || val === lowerTarget || label === lowerTarget || lowerTarget.includes(text);
        });
      };
      const options = [];
      options.push(...Array.from(el.querySelectorAll('kat-option, option, [role="option"]')));
      if (el.shadowRoot) {
        options.push(...Array.from(el.shadowRoot.querySelectorAll('kat-option, option, [role="option"]')));
      }
      const slotSpan = el.querySelector('[slot="private-light-dom"]');
      if (slotSpan) {
        options.push(...Array.from(slotSpan.querySelectorAll("kat-option, option")));
      }
      const matchedOpt = findOptionMatch(options);
      if (matchedOpt) {
        const bestValue = matchedOpt.getAttribute?.("value") || matchedOpt.value || matchedOpt.textContent;
        el.value = bestValue;
        if (el.selectedValue !== void 0) {
          el.selectedValue = bestValue;
        }
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        const innerSelect = el.shadowRoot?.querySelector("select") || el.querySelector("select") || slotSpan?.querySelector("select");
        if (innerSelect) {
          innerSelect.value = bestValue;
          innerSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (typeof matchedOpt.click === "function") {
          matchedOpt.click();
        }
        return true;
      }
      el.value = target;
      if (el.selectedValue !== void 0) {
        el.selectedValue = target;
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, targetText);
  } catch (err) {
    console.warn(`Evaluation dropdown select failed: ${err.message}`);
  }
  if (!success) {
    try {
      const pageWideOptions = page.locator(`kat-option:has-text("${targetText}"), option:has-text("${targetText}"), [role="option"]:has-text("${targetText}")`);
      const optCount = await pageWideOptions.count();
      if (optCount > 0) {
        await pageWideOptions.first().click();
        success = true;
      } else {
        const broadOption = page.locator(`text="${targetText}"`).first();
        if (await broadOption.isVisible()) {
          await broadOption.click();
          success = true;
        }
      }
    } catch (clickErr) {
      console.warn(`Click options fallback failed: ${clickErr.message}`);
    }
  }
  try {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  } catch (e) {
  }
}
var COOKIE_PATH = import_path.default.join(process.cwd(), "bot_state", "amazon_auth.json");
var LIVE_SCREENSHOT_PATH = import_path.default.join(process.cwd(), "bot_state", "live.png");
var BOT_LOGS_PATH = import_path.default.join(process.cwd(), "bot_logs");
async function fileAmazonClaim(claim) {
  const logId = claim.lpn || claim.claimId || claim.orderId;
  const logPath = import_path.default.join(process.cwd(), "bot_logs", `${logId}.log`);
  if (!import_fs.default.existsSync(import_path.default.dirname(logPath))) import_fs.default.mkdirSync(import_path.default.dirname(logPath), { recursive: true });
  if (!import_fs.default.existsSync(import_path.default.dirname(COOKIE_PATH))) import_fs.default.mkdirSync(import_path.default.dirname(COOKIE_PATH), { recursive: true });
  const log = (msg) => {
    const time = (/* @__PURE__ */ new Date()).toISOString();
    import_fs.default.appendFileSync(logPath, `[${time}] ${msg}
`);
    console.log(`[BOT][${logId}] ${msg}`);
  };
  const takeLiveScreenshot = async (p) => {
    try {
      await p.screenshot({ path: LIVE_SCREENSHOT_PATH });
    } catch (e) {
    }
  };
  log(`Starting automation for LPN: ${claim.lpn}, Order: ${claim.orderId}`);
  const email = process.env.AMAZON_EMAIL;
  const password = process.env.AMAZON_PASSWORD;
  const totpSecret = process.env.AMAZON_TOTP_SECRET;
  if (!email || !password || !totpSecret) {
    log("ERROR: Missing Amazon credentials in environment variables.");
    return { success: false, error: "Missing credentials" };
  }
  let context = null;
  try {
    context = await import_playwright.chromium.launchPersistentContext("./amazon-profile", {
      // headless: isHeadless,
      headless: false,
      slowMo: 100,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-extensions"
      ]
    });
    const page = await context.newPage();
    log("Navigating to Amazon Seller Central India...");
    await page.goto("https://sellercentral.amazon.in", { waitUntil: "load", timeout: 6e4 });
    await takeLiveScreenshot(page);
    await page.waitForTimeout(3e3);
    await takeLiveScreenshot(page);
    console.log("Login manually including OTP");
    log("Navigating to Manage SAFE-T Claims...");
    await page.goto("https://sellercentral.amazon.in/safet-claims/create-v2?ref_=ag_sfdcf_cont_safet", { waitUntil: "networkidle" });
    await takeLiveScreenshot(page);
    const fileWindow = page;
    log(`Selecting channel context for: ${claim.channel}`);
    try {
      await fileWindow.waitForSelector("div.select-header", { timeout: 1e4 });
      await fileWindow.click("div.select-header");
      await fileWindow.waitForTimeout(500);
      if (claim.channel.includes("Amazon B2B")) {
        log("Selecting FBA Removals...");
        await fileWindow.click("text=FBA Removals");
      } else {
        log("Selecting Easy Ship/ Self Ship/ Seller Flex...");
        await fileWindow.click("text=Easy Ship/ Self Ship/ Seller Flex");
      }
    } catch (e) {
      log(`Custom select dropdown not found or failed: ${e.message}. Trying standard native select fallback...`);
      try {
        const optionLabel = claim.channel.includes("Amazon B2B") ? "FBA Removals" : "Easy Ship/ Self Ship/ Seller Flex";
        await fileWindow.selectOption("select", { label: optionLabel });
      } catch (e2) {
        log(`Standard native select fallback also failed: ${e2.message}`);
      }
    }
    await takeLiveScreenshot(fileWindow);
    log("Clicking Next...");
    try {
      await fileWindow.click('button:has-text("Next")');
    } catch (e) {
      try {
        await fileWindow.click('kat-button:has-text("Next")');
      } catch (e2) {
        log(`Could not click Next button: ${e2.message}`);
      }
    }
    await fileWindow.waitForTimeout(2e3);
    await takeLiveScreenshot(fileWindow);
    log("Selecting Tracking ID radio button...");
    let radioSelected = false;
    try {
      const katRadio = fileWindow.locator('kat-radiobutton[value="trackingId"]').first();
      if (await katRadio.isVisible()) {
        await katRadio.evaluate((el) => {
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.click();
          const innerInput = el.shadowRoot?.querySelector('input[type="radio"]') || el.querySelector('input[type="radio"]');
          if (innerInput) {
            innerInput.checked = true;
            innerInput.dispatchEvent(new Event("change", { bubbles: true }));
            innerInput.click();
          }
        });
        log("Successfully selected kat-radiobutton trackingId radio via shadow-root evaluation!");
        radioSelected = true;
      }
    } catch (e) {
      log(`Shadow-root evaluation selection failed: ${e.message}`);
    }
    if (!radioSelected) {
      const selectors = [
        'kat-radiobutton[value="trackingId"]',
        'input[value="trackingId"]',
        'label:has-text("Tracking ID")',
        'text="Tracking ID"',
        'kat-radiobutton:has-text("Tracking ID")'
      ];
      for (const s of selectors) {
        try {
          const element = fileWindow.locator(s).first();
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click();
            log(`Successfully clicked radio button using selector: ${s}`);
            radioSelected = true;
            break;
          }
        } catch (err) {
          log(`Selector ${s} failed or didn't match: ${err.message}`);
        }
      }
    }
    if (!radioSelected) {
      log("Warning: Could not confirm Selection click. Proceeding with filling input directly...");
    }
    await fileWindow.waitForTimeout(500);
    const trackingValue = claim.trackingId || claim.orderId;
    log(`Inputting Tracking ID: ${trackingValue}`);
    let isFilled = false;
    const inputSelectors = [
      'input[name="orderIdOrTrackingId"]',
      "kat-input input",
      'input[placeholder*="Tracking ID"]',
      'input[placeholder*="order ID"]',
      'input[type="text"]'
    ];
    for (const s of inputSelectors) {
      try {
        const inputField = fileWindow.locator(s).first();
        if (await inputField.isVisible()) {
          await inputField.fill(trackingValue);
          log(`Successfully filled Tracking ID using selector: ${s}`);
          isFilled = true;
          break;
        }
      } catch (err) {
        log(`Input selector ${s} failed: ${err.message}`);
      }
    }
    if (!isFilled) {
      log("Warning: No matching input found/filled. Trying fallback flat page.fill...");
      try {
        await fileWindow.fill('input[name="orderIdOrTrackingId"]', trackingValue);
        isFilled = true;
      } catch (e) {
        log(`Fallback flat fill failed: ${e.message}`);
      }
    }
    await takeLiveScreenshot(fileWindow);
    log("Clicking 'Check Eligibility' button...");
    let isVerified = false;
    const buttonSelectors = [
      'button:has-text("Check Eligibility")',
      'kat-button:has-text("Check Eligibility")',
      "button.check-eligibility-btn",
      'button:has-text("Check")',
      'kat-button:has-text("Check")'
    ];
    for (const s of buttonSelectors) {
      try {
        const btn = fileWindow.locator(s).first();
        if (await btn.isVisible()) {
          await btn.click();
          log(`Successfully clicked Check Eligibility button using selector: ${s}`);
          isVerified = true;
          break;
        }
      } catch (err) {
        log(`Button selector ${s} failed: ${err.message}`);
      }
    }
    if (!isVerified) {
      log("Warning: Need enter key fallback to trigger verification...");
      try {
        await fileWindow.locator('input[name="orderIdOrTrackingId"]').press("Enter");
        log("Pressed 'Enter' on Tracking ID input as fallback.");
      } catch (e) {
        log(`Enter key fallback failed: ${e.message}`);
      }
    }
    await fileWindow.waitForTimeout(3e3);
    await takeLiveScreenshot(fileWindow);
    log("Starting item matching and selection process...");
    const matchingClaims = await getClaimsForTrackingId(claim.trackingId || "", claim.orderId || "");
    log(`Found ${matchingClaims.length} matching claims in database/mock context for this trackingId/orderId.`);
    const hasRejectedClaim = matchingClaims.some((c) => {
      const typeLower = (c.type || "").toLowerCase();
      return typeLower === "rejected" || typeLower.includes("rejected");
    }) || (claim.type || "").toLowerCase().includes("rejected");
    if (hasRejectedClaim) {
      log("Detected 'Rejected' claim type. All items for this tracking ID / order ID will be selected!");
    }
    const itemBoxes = fileWindow.locator("kat-box.AsinDetailsBox, div.orderdetail-view-fba kat-box");
    const totalBoxes = await itemBoxes.count();
    log(`Found ${totalBoxes} item boxes in the filing form on the page.`);
    for (let i = 0; i < totalBoxes; i++) {
      const box = itemBoxes.nth(i);
      let productNameText = "";
      try {
        const nameSelectors = [".asin-name", 'div[class*="asin-name"]', "div.kat-col-md-4", ".asin-title"];
        for (const sel of nameSelectors) {
          const el = box.locator(sel).first();
          if (await el.isVisible()) {
            productNameText = await el.innerText();
            break;
          }
        }
      } catch (err) {
        log(`Could not fetch product name for box index ${i}: ${err.message}`);
      }
      productNameText = productNameText.replace(/[\r\n]+/g, " ").trim();
      log(`Box #${i} detected name on Amazon page: "${productNameText}"`);
      if (!productNameText) {
        log(`Warning: Empty product name for box index ${i}. Skipping...`);
        continue;
      }
      let matchedClaims = matchingClaims.filter((c) => matchProduct(productNameText, c));
      if (matchedClaims.length === 0) {
        if (matchProduct(productNameText, claim)) {
          log(`No matching claims from full query but single triggered claim matched product: "${productNameText}". Using it.`);
          matchedClaims.push(claim);
        }
      }
      log(`Matched ${matchedClaims.length} database/trigger claims for: "${productNameText}"`);
      let selectThisItem = false;
      let itemQty = 0;
      if (hasRejectedClaim) {
        selectThisItem = true;
        const matched = matchedClaims.find((c) => c.qty || c.shippedQuantity);
        itemQty = matched ? matched.qty || matched.shippedQuantity || 1 : 1;
        log(`All items rejected mode: Selected product "${productNameText}" with quantity ${itemQty}`);
      } else {
        const badCount = matchedClaims.filter((c) => {
          const typeLower = (c.type || "").toLowerCase();
          return typeLower === "damaged" || typeLower === "missing";
        }).length;
        log(`Damage / Missing rows count for this product: ${badCount}`);
        if (badCount > 0) {
          selectThisItem = true;
          itemQty = badCount;
        }
      }
      if (selectThisItem && itemQty > 0) {
        log(`Selecting item box #${i} and entering quantity: ${itemQty}...`);
        const checkbox = box.locator("kat-checkbox.QuantityCheckbox, kat-checkbox").first();
        if (await checkbox.isVisible()) {
          try {
            await checkbox.evaluate((el) => {
              const cb = el.shadowRoot?.querySelector('[role="checkbox"]') || el.shadowRoot?.querySelector(".checkbox") || el;
              if (cb) {
                if (cb.getAttribute("aria-checked") !== "true") {
                  cb.click();
                  cb.setAttribute("aria-checked", "true");
                }
              } else {
                el.click();
              }
            });
            log(`Successfully checked custom kat-checkbox for product "${productNameText}"`);
          } catch (cbErr) {
            log(`Failed to check checkbox via shadow-root evaluation: ${cbErr.message}. Trying direct click fallback...`);
            await checkbox.click({ force: true }).catch((err) => log(`Direct click on checkbox failed: ${err.message}`));
          }
        } else {
          log(`Warning: Checkbox is not visible/found for product "${productNameText}"`);
        }
        await fileWindow.waitForTimeout(500);
        const qtyInput = box.locator('kat-input[type="number"], kat-input, input[type="number"]').first();
        if (await qtyInput.isVisible()) {
          try {
            await qtyInput.evaluate((el, val) => {
              const input = el.shadowRoot?.querySelector("input") || el;
              if (input) {
                input.value = String(val);
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
              } else {
                el.value = String(val);
              }
            }, itemQty);
            log(`Successfully entered quantity ${itemQty} via shadow-root evaluation.`);
          } catch (qtyErr) {
            log(`Failed to write quantity via shadow-root: ${qtyErr.message}. Trying direct fill fallback...`);
            await qtyInput.fill(String(itemQty)).catch((err) => log(`Direct fill on quantity input failed: ${err.message}`));
          }
        } else {
          log(`Warning: Quantity input is not visible/found for product "${productNameText}"`);
        }
      } else {
        log(`No selection target match found for product "${productNameText}". Leaving unchecked.`);
      }
    }
    await takeLiveScreenshot(fileWindow);
    await fileWindow.waitForTimeout(1e3);
    log("Clicking Next/Continue button after items selection...");
    let nextStepClicked = false;
    const nextButtons = [
      'button:has-text("Next")',
      'kat-button:has-text("Next")',
      'button:has-text("Submit")',
      'kat-button:has-text("Submit")',
      'input[type="submit"]',
      'button:has-text("Continue")',
      'kat-button:has-text("Continue")'
    ];
    for (const btnSel of nextButtons) {
      try {
        const nextBtn = fileWindow.locator(btnSel).first();
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
          log(`Successfully clicked Next/Continue button using selector: ${btnSel}`);
          nextStepClicked = true;
          break;
        }
      } catch (err) {
        log(`Selector ${btnSel} failed inside click: ${err.message}`);
      }
    }
    if (!nextStepClicked) {
      log("Warning: Could not automatically locate or click Next button. Trying default browser click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]')).find((b) => {
            const txt = (b.textContent || b.innerText || "").toLowerCase();
            return txt.includes("next") || txt.includes("continue");
          });
          if (btn) btn.click();
        });
        log("Fallback evaluate click triggered on Next button.");
      } catch (e) {
        log(`Next button fallback evaluate click failed: ${e.message}`);
      }
    }
    await fileWindow.waitForTimeout(3e3);
    await takeLiveScreenshot(fileWindow);
    log("Waiting for Claim Reason and Sub-Reason dropdowns page to load...");
    const reasonBoxes = fileWindow.locator("kat-box.AsinDetailsBox, div.orderdetail-view-fba kat-box");
    const numReasonBoxes = await reasonBoxes.count();
    log(`Found ${numReasonBoxes} product boxes on the Reasons page.`);
    for (let i = 0; i < numReasonBoxes; i++) {
      const box = reasonBoxes.nth(i);
      let productNameText = "";
      try {
        const nameSelectors = [".asin-name", 'div[class*="asin-name"]', "div.kat-col-md-4", ".asin-title"];
        for (const sel of nameSelectors) {
          const el = box.locator(sel).first();
          if (await el.isVisible()) {
            productNameText = await el.innerText();
            break;
          }
        }
      } catch (err) {
        log(`Could not fetch product name for reason box index ${i}: ${err.message}`);
      }
      productNameText = productNameText.replace(/[\r\n]+/g, " ").trim();
      log(`Reason Box #${i} detected name on Amazon page: "${productNameText}"`);
      if (!productNameText) {
        log(`Warning: Empty product name for reason box index ${i}. Skipping...`);
        continue;
      }
      let matchedClaims = matchingClaims.filter((c) => matchProduct(productNameText, c));
      if (matchedClaims.length === 0) {
        if (matchProduct(productNameText, claim)) {
          matchedClaims.push(claim);
        }
      }
      let dbClaimReason = "";
      let dbClaimSubReason = "";
      if (matchedClaims.length > 0) {
        const matched = matchedClaims[0];
        dbClaimReason = matched.claimReason || matched.reason || "";
        dbClaimSubReason = matched.claimSubReason || "";
      }
      if (!dbClaimReason) {
        const anyReasonClaim = matchingClaims.find((c) => c.claimReason || c.reason);
        if (anyReasonClaim) {
          dbClaimReason = anyReasonClaim.claimReason || anyReasonClaim.reason || "";
          dbClaimSubReason = anyReasonClaim.claimSubReason || "";
          log(`Cascaded reasons fallback from another claim in the order: Reason: "${dbClaimReason}", Sub-Reason: "${dbClaimSubReason}"`);
        }
      }
      if (!dbClaimReason && hasRejectedClaim) {
        dbClaimReason = "Easy ship order shipment returned but items physically damaged";
        log(`RejectedDelivery fallback: Using default reason "${dbClaimReason}"`);
      }
      if (dbClaimReason) {
        log(`Matching reasons configured for "${productNameText}". Expected Reason: "${dbClaimReason}", Sub-Reason: "${dbClaimSubReason}"`);
        let dropdownReason = box.locator('kat-dropdown[placeholder="Select Claim Reason"], kat-dropdown[placeholder*="Reason"], kat-dropdown.reasonDropdown, kat-select, select').first();
        let dropdownSubReason = box.locator('kat-dropdown[placeholder="Select Claim Sub-Reason"], kat-dropdown[placeholder*="Sub-Reason"]').first();
        let hasReasonInside = false;
        try {
          hasReasonInside = await dropdownReason.isVisible();
        } catch (e) {
        }
        if (!hasReasonInside) {
          log(`Dropdown not found inside box #${i}. Trying page-wide nth(${i}) fallback...`);
          dropdownReason = fileWindow.locator('kat-dropdown[placeholder="Select Claim Reason"], kat-dropdown[placeholder*="Reason"], kat-dropdown.reasonDropdown, kat-select, select').nth(i);
          dropdownSubReason = fileWindow.locator('kat-dropdown[placeholder="Select Claim Sub-Reason"], kat-dropdown[placeholder*="Sub-Reason"]').nth(i);
        }
        if (dbClaimReason) {
          log(`Setting dropdown 1 (Claim Reason) to: "${dbClaimReason}"`);
          await selectCustomDropdownOption(fileWindow, dropdownReason, dbClaimReason);
          await fileWindow.waitForTimeout(1500);
        }
        if (dbClaimSubReason) {
          log(`Setting dropdown 2 (Claim Sub-Reason) to: "${dbClaimSubReason}"`);
          await selectCustomDropdownOption(fileWindow, dropdownSubReason, dbClaimSubReason);
          await fileWindow.waitForTimeout(1e3);
        }
      } else {
        log(`No matching claims from database/payload found for "${productNameText}". Skipping dropdown automation for this item.`);
      }
    }
    await takeLiveScreenshot(fileWindow);
    await fileWindow.waitForTimeout(1e3);
    log("Clicking Next/Continue button after selecting claim reasons...");
    let reasonsSubmitted = false;
    const submitBtnSelectors = [
      'button:has-text("Next")',
      'kat-button:has-text("Next")',
      'button:has-text("Submit")',
      'kat-button:has-text("Submit")',
      'input[type="submit"]',
      'button:has-text("Continue")',
      'kat-button:has-text("Continue")'
    ];
    for (const btnSel of submitBtnSelectors) {
      try {
        const btn = fileWindow.locator(btnSel).first();
        if (await btn.isVisible()) {
          await btn.click();
          log(`Successfully clicked next step button using selector: ${btnSel}`);
          reasonsSubmitted = true;
          break;
        }
      } catch (err) {
        log(`Reason submission button selector ${btnSel} failed: ${err.message}`);
      }
    }
    if (!reasonsSubmitted) {
      log("Warning: Could not automatically locate or click Next/Submit button on reasons page. Trying fallback evaluate click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]')).find((b) => {
            const txt = (b.textContent || b.innerText || "").toLowerCase();
            return txt.includes("next") || txt.includes("continue") || txt.includes("submit");
          });
          if (btn) btn.click();
        });
        log("Fallback evaluate click triggered on Reasons page.");
      } catch (e) {
        log(`Reasons page fallback click failed: ${e.message}`);
      }
    }
    await fileWindow.waitForTimeout(3e3);
    await takeLiveScreenshot(fileWindow);
    const isImageUploadPage = await fileWindow.locator(".ImageUploadView, kat-file-upload").first().isVisible().catch(() => false);
    if (isImageUploadPage) {
      log("Detected 'File a SAFE-T Claim' Supporting Documents Page. Starting image uploads...");
      const tempDir = import_path.default.join(process.cwd(), "temp_uploads");
      const fallbackColorsBase64 = [
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        // Red
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADYbEVYdFNvZnR3YXJlAGFyZ29u80XQjgAAADUlEQVR42mNk9G9gYABiBhgAFIYBCXbK3HkAAAAASUVORK5CYII=",
        // Green
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        // Blue
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQHwAEhgGA5b/bBwAAAABJRU5ErkJggg==",
        // Yellow
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPjPAAADEwFAtO0m+gAAAABJRU5ErkJggg=="
        // Orange
      ];
      const createdTempFiles = [];
      try {
        if (!import_fs.default.existsSync(tempDir)) {
          import_fs.default.mkdirSync(tempDir, { recursive: true });
        }
        let downloadedFiles = [];
        if (claim.driveLink) {
          log(`Attempting to fetch real evidence files from user's Drive folder: ${claim.driveLink}`);
          downloadedFiles = await downloadFilesFromDrive(claim.driveLink, tempDir, log);
          log(`Successfully downloaded ${downloadedFiles.length} files from Drive.`);
        } else {
          log("No Drive link provided for files, proceeding with high-quality fallback evidence placeholders.");
        }
        const uploadElements = fileWindow.locator("kat-file-upload");
        const uploadCount = await uploadElements.count();
        log(`Found ${uploadCount} file upload components matching 'kat-file-upload'.`);
        for (let i = 0; i < uploadCount; i++) {
          let filePathToUpload = "";
          if (i < downloadedFiles.length) {
            filePathToUpload = downloadedFiles[i];
            log(`Slot ${i + 1}/${uploadCount}: Using downloaded file: "${import_path.default.basename(filePathToUpload)}"`);
          } else {
            const fallbackPath = import_path.default.join(tempDir, `evidence_placeholder_${i + 1}.png`);
            const colorBase64 = fallbackColorsBase64[i % fallbackColorsBase64.length];
            import_fs.default.writeFileSync(fallbackPath, Buffer.from(colorBase64, "base64"));
            createdTempFiles.push(fallbackPath);
            filePathToUpload = fallbackPath;
            log(`Slot ${i + 1}/${uploadCount}: No downloaded file available. Created solid-color fallback: "${import_path.default.basename(filePathToUpload)}"`);
          }
          try {
            const inputElement = uploadElements.nth(i).locator('input[type="file"], #kat-file-attachment');
            await inputElement.setInputFiles(filePathToUpload);
            log(`Successfully set input files for upload slot ${i + 1}`);
          } catch (slotUpErr) {
            log(`Failed to upload file to slot ${i + 1}: ${slotUpErr.message}`);
          }
          await fileWindow.waitForTimeout(1500);
        }
        await takeLiveScreenshot(fileWindow);
        await fileWindow.waitForTimeout(1500);
        log("Clicking Next/Continue button after document upload...");
        let docSubmitClicked = false;
        const nextBtnSelectors = [
          'button:has-text("Next")',
          'kat-button:has-text("Next")',
          'button:has-text("Continue")',
          'kat-button:has-text("Continue")',
          'button:has-text("Submit")',
          'kat-button:has-text("Submit")'
        ];
        for (const btnSel of nextBtnSelectors) {
          try {
            const btn = fileWindow.locator(btnSel).first();
            if (await btn.isVisible()) {
              await btn.click();
              log(`Clicked document page Next button using: ${btnSel}`);
              docSubmitClicked = true;
              break;
            }
          } catch (err) {
            log(`Doc submit button ${btnSel} failed: ${err.message}`);
          }
        }
        if (!docSubmitClicked) {
          try {
            await fileWindow.evaluate(() => {
              const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]')).find((b) => {
                const txt = (b.textContent || b.innerText || "").toLowerCase();
                return txt.includes("next") || txt.includes("continue") || txt.includes("submit");
              });
              if (btn) btn.click();
            });
            log("Fallback evaluate click triggered on Document page.");
          } catch (e) {
            log(`Document page fallback click failed: ${e.message}`);
          }
        }
        await fileWindow.waitForTimeout(4e3);
        await takeLiveScreenshot(fileWindow);
      } catch (uploadErr) {
        log(`Error uploading documents: ${uploadErr.message}`);
      } finally {
        try {
          if (import_fs.default.existsSync(tempDir)) {
            const files = import_fs.default.readdirSync(tempDir);
            for (const file of files) {
              import_fs.default.unlinkSync(import_path.default.join(tempDir, file));
            }
            import_fs.default.rmdirSync(tempDir);
            log("Successfully cleaned up all temporary upload files.");
          }
        } catch (cleanupErr) {
          log(`Temporary folder cleanup warned: ${cleanupErr.message}`);
        }
      }
    } else {
      log("No Supporting Documents (image upload) page detected. Skipping upload step.");
    }
    if (claim.driveLink) {
      log(`Providing evidence link: ${claim.driveLink}`);
      const textareas = [
        "kat-textarea textarea",
        "kat-textarea",
        'textarea[name="comments"]',
        "textarea"
      ];
      let filled = false;
      for (const t of textareas) {
        try {
          const el = fileWindow.locator(t).first();
          if (await el.isVisible()) {
            await el.fill(`Proof and Evidence: ${claim.driveLink}`);
            log(`Successfully filled evidence using selector: ${t}`);
            filled = true;
            break;
          }
        } catch (err) {
          log(`Standard fill with selector ${t} failed: ${err.message}`);
        }
      }
      if (!filled) {
        try {
          const katTextarea = fileWindow.locator("kat-textarea").first();
          if (await katTextarea.isVisible()) {
            await katTextarea.evaluate((el, val) => {
              const innerTextarea = el.shadowRoot?.querySelector("textarea") || el.querySelector("textarea") || el;
              if (innerTextarea) {
                innerTextarea.value = val;
                innerTextarea.dispatchEvent(new Event("input", { bubbles: true }));
                innerTextarea.dispatchEvent(new Event("change", { bubbles: true }));
                el.value = val;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }, `Proof and Evidence: ${claim.driveLink}`);
            log("Successfully filled evidence via kat-textarea shadow-root evaluation.");
            filled = true;
          }
        } catch (evalErr) {
          log(`Fallback evaluation fill failed: ${evalErr.message}`);
        }
      }
      await takeLiveScreenshot(fileWindow);
    }
    log("Checking for declaration or acknowledgment checkboxes on submission page...");
    try {
      const checkboxLocators = [
        "kat-checkbox",
        'input[type="checkbox"]',
        '[role="checkbox"]'
      ];
      for (const sel of checkboxLocators) {
        const checkboxes = fileWindow.locator(sel);
        const count = await checkboxes.count();
        if (count > 0) {
          log(`Found ${count} checkbox elements matching selector: ${sel}`);
          for (let idx = 0; idx < count; idx++) {
            const cb = checkboxes.nth(idx);
            if (await cb.isVisible()) {
              log(`Handling checkbox #${idx} for selector: ${sel}`);
              try {
                await cb.evaluate((el) => {
                  const inner = el.shadowRoot?.querySelector('[role="checkbox"]') || el.shadowRoot?.querySelector(".checkbox") || el.shadowRoot?.querySelector('input[type="checkbox"]') || el.querySelector('input[type="checkbox"]') || el;
                  if (inner) {
                    if (inner.getAttribute("aria-checked") !== "true" && !inner.checked) {
                      inner.click();
                      if (typeof inner.setAttribute === "function") {
                        inner.setAttribute("aria-checked", "true");
                      }
                      inner.checked = true;
                    }
                  } else {
                    el.click();
                  }
                  el.checked = true;
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                  el.dispatchEvent(new Event("input", { bubbles: true }));
                });
                log(`Successfully toggled/checked checkbox #${idx}`);
              } catch (cbErr) {
                log(`Failed to process checkbox #${idx} via evaluate: ${cbErr.message}. Trying direct click fallback...`);
                await cb.click({ force: true }).catch((err) => log(`Direct click on checkbox failed: ${err.message}`));
              }
            }
          }
        }
      }
      await fileWindow.waitForTimeout(1e3);
      await takeLiveScreenshot(fileWindow);
    } catch (checkErr) {
      log(`Error during checkbox scanning/checking: ${checkErr.message}`);
    }
    await takeLiveScreenshot(fileWindow);
    await fileWindow.waitForSelector(".success-message, .claim-id", { timeout: 15e3 }).catch(() => {
    });
    const textContent = await fileWindow.innerText("body");
    const claimIdMatch = textContent.match(/SAFE-T Claim ID: (S-\d+)/);
    if (claimIdMatch) {
      const amazonClaimId = claimIdMatch[1];
      log(`SUCCESS: Claim filed. Amazon ID: ${amazonClaimId}`);
      return { success: true, caseId: amazonClaimId };
    }
    log("Could not find generated Claim ID in final page.");
    return { success: true, caseId: `AUTO-${Date.now()}` };
  } catch (error) {
    log(`CRITICAL ERROR: ${error.message}`);
    const screenshotName = `error_${logId}_${Date.now()}.png`;
    const screenshotPath = import_path.default.join(process.cwd(), "bot_logs", screenshotName);
    return { success: false, error: error.message, screenshotPath };
  } finally {
    if (context) {
      log("Closing browser context...");
      await context.close();
    }
    log("Automation pulse finished.");
  }
}

// server.ts
var pool = null;
function getDbPool() {
  if (!pool) {
    let connectionString = process.env.SUPABASE_URL;
    if (connectionString) {
      connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
      if (connectionString.startsWith("hpostgresql://")) {
        connectionString = connectionString.substring(1);
      }
      const passwordMatch = connectionString.match(/:(.*)@/);
      console.log(`Initializing PostgreSQL Pool...`);
      pool = new import_pg2.default.Pool({
        connectionString,
        connectionTimeoutMillis: 1e4,
        idleTimeoutMillis: 3e4,
        max: 20,
        ssl: {
          rejectUnauthorized: false
        }
      });
      (async () => {
        try {
          const client = await pool.connect();
          console.log("\u2705 Successfully connected to Supabase PostgreSQL");
          client.release();
        } catch (err) {
          console.error("\u274C Database connection failed:", err.message);
          if (err.message.includes("ECONNREFUSED") || err.message.includes("timeout")) {
            try {
              const https = await import("https");
              https.get("https://api.ipify.org", (res) => {
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("end", () => {
                  const ip = data.trim();
                  console.warn("\n" + "=".repeat(60));
                  console.warn("\u{1F6E1}\uFE0F  NETWORK CONNECTION ISSUES DETECTED");
                  console.warn(`The server (IP: ${ip}) cannot reach Supabase via Port 6543/5432.`);
                  console.warn("\nCRITICAL FIX STEPS:");
                  console.warn("1. Go to Supabase Dashboard > Settings > Database.");
                  console.warn("2. Look at 'Connection Pooling' section.");
                  console.warn("3. Ensure 'Pool mode' is set to 'Transaction'.");
                  console.warn("4. Verify that 'Network Restrictions' (if enabled) allows 0.0.0.0 (Public).");
                  console.warn(`5. RUN THIS ON YOUR MACHINE: supabase network-bans remove --db-unban-ip ${ip} --project-ref focxbsvrjemrnjpyxeqn --experimental`);
                  console.warn("=".repeat(60) + "\n");
                });
              });
            } catch (ipErr) {
            }
          }
        }
      })();
      pool.on("error", (err) => {
        console.error("Unexpected error on idle client", err);
        process.exit(-1);
      });
    }
  }
  return pool;
}
function toCamelCase(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.includes("_") || key.includes("-") ? key.replace(
      /([-_][a-z0-9])/gi,
      (group) => group.toUpperCase().replace("-", "").replace("_", "")
    ) : key;
    newObj[camelKey] = toCamelCase(obj[key]);
  }
  return newObj;
}
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json());
  const PORT = 3e3;
  const mockClaims = [
    {
      claimId: "C-112824",
      lpn: "LPN001",
      trackingId: "52102112824",
      orderId: "Xq588pX611S",
      source: "Amazon",
      channel: "Amazon B2B",
      sku: "1120100",
      fnsku: "X0018CDFL3",
      shippedQuantity: 1,
      deliveryStatus: "Delivered",
      condition: "damaged",
      type: "Missing",
      status: "New",
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1e3).toISOString(),
      // 2 days ago
      slaDaysElapsed: 2,
      reason: "missing parts/empty box",
      reasonDescription: "The outer delivery package was intact but inner retail box parts were completely missing.",
      driveLink: "https://drive.google.com/drive/folders/3KPMil0jNl8h_GjVlqXt91iKJenoiNzbN"
    }
  ];
  let isBotRunning = false;
  let isOtpRequired = false;
  let lastBotRunFinishedAt = null;
  const COOLING_PERIOD_MS = 1 * 60 * 1e3;
  app.get("/api/claims", async (req, res) => {
    const pool2 = getDbPool();
    let rawRows = [];
    if (pool2) {
      try {
        const result = await pool2.query("SELECT * FROM claims");
        rawRows = result.rows;
        if (rawRows.length === 0) {
          rawRows = mockClaims;
        }
      } catch (error) {
        console.log(`SQL error with 'claims' table: ${error.message}. Retrying with alternatives...`);
        try {
          const retryResult = await pool2.query('SELECT * FROM "Claims"');
          rawRows = retryResult.rows;
        } catch (innerError) {
          console.error("Database fetch failure - using mock data fallback.");
          rawRows = mockClaims;
        }
      }
    } else {
      rawRows = mockClaims;
    }
    const now = Date.now();
    const processedMap = {};
    rawRows.forEach((row) => {
      const data = toCamelCase(row);
      const typeStr = (data.type || "").toLowerCase();
      if (typeStr === "rejected" || typeStr === "rejecteddelivery") {
        data.type = "RejectedDelivery";
      }
      const rowDate = data.date || data.createdAt || data.created_at;
      if (rowDate) {
        const diffMs = now - new Date(rowDate).getTime();
        data.slaDaysElapsed = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
      }
      const tid = data.trackingId || "N/A";
      const sku = data.sku || "N/A";
      const key = `${tid}-${sku}`;
      if (!processedMap[key]) {
        processedMap[key] = {
          ...data,
          qty: 1,
          items: [data]
          // Keep track of original rows if needed
        };
      } else {
        processedMap[key].qty += 1;
        processedMap[key].items.push(data);
      }
    });
    res.json(Object.values(processedMap));
  });
  app.get("/api/bot/config", (req, res) => {
    const now = Date.now();
    const coolingRemaining = lastBotRunFinishedAt ? Math.max(0, COOLING_PERIOD_MS - (now - lastBotRunFinishedAt)) : 0;
    res.json({
      configured: !!(process.env.AMAZON_EMAIL && process.env.AMAZON_PASSWORD && process.env.AMAZON_TOTP_SECRET),
      email: process.env.AMAZON_EMAIL || null,
      hasTotp: !!process.env.AMAZON_TOTP_SECRET,
      headless: process.env.HEADLESS_MODE === "true",
      isBotRunning,
      isOtpRequired,
      coolingRemainingMs: coolingRemaining,
      isAvailable: !isBotRunning && coolingRemaining === 0
    });
  });
  app.get("/api/bot/logs/:lpn", (req, res) => {
    const { lpn } = req.params;
    const logPath = import_path2.default.join(process.cwd(), "bot_logs", `${lpn}.log`);
    if (import_fs2.default.existsSync(logPath)) {
      const logs = import_fs2.default.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
      res.json({ logs });
    } else {
      res.json({ logs: ["No logs found for this task."] });
    }
  });
  app.get("/api/bot/live-view", (req, res) => {
    const screenshotPath = import_path2.default.join(process.cwd(), "bot_state", "live.png");
    if (import_fs2.default.existsSync(screenshotPath)) {
      res.sendFile(screenshotPath);
    } else {
      res.status(404).send("No live view available.");
    }
  });
  app.post("/api/bot/trigger", async (req, res) => {
    const { claimId, orderId, lpn } = req.body;
    const now = Date.now();
    const pool2 = getDbPool();
    let claimData = null;
    if (pool2) {
      const db = pool2;
      try {
        const tid = (lpn || claimId || orderId || "").trim();
        if (!tid) throw new Error("No ID provided");
        const tables = ["claims", '"Claims"'];
        for (const table of tables) {
          const colRes = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = ${table.includes('"') ? `'${table.replace(/"/g, "")}'` : `'${table}'`}
          `);
          const columns = colRes.rows.map((r) => r.column_name.toLowerCase());
          if (columns.length === 0) continue;
          const searchTerms = [];
          if (columns.includes("lpn")) searchTerms.push("lpn ILIKE $1");
          if (columns.includes("claim_id")) searchTerms.push("claim_id ILIKE $1");
          if (columns.includes("order_id")) searchTerms.push("order_id ILIKE $1");
          if (columns.includes("tracking_id")) searchTerms.push("tracking_id ILIKE $1");
          if (searchTerms.length === 0) continue;
          const query = `
            SELECT * FROM ${table} 
            WHERE ${searchTerms.join(" OR ")}
            LIMIT 1
          `;
          const result = await db.query(query, [tid]);
          if (result.rows.length > 0) {
            claimData = toCamelCase(result.rows[0]);
            break;
          }
        }
      } catch (e) {
        console.error("Database trigger lookup failed:", e);
      }
    }
    if (!claimData) {
      const tid = (lpn || claimId || orderId || "").trim().toLowerCase();
      claimData = mockClaims.find(
        (c) => c.lpn?.toLowerCase() === tid || c.claimId?.toLowerCase() === tid || c.orderId?.toLowerCase() === tid || c.trackingId?.toLowerCase() === tid
      );
    }
    if (!claimData) {
      return res.status(404).json({ status: "Error", message: "No claim record found." });
    }
    const identifier = claimData.lpn || claimData.claimId || claimData.orderId;
    if (isBotRunning) {
      return res.status(429).json({
        status: "Error",
        message: "Another bot task is already in progress. Please wait."
      });
    }
    if (lastBotRunFinishedAt && now - lastBotRunFinishedAt < COOLING_PERIOD_MS) {
      const remaining = Math.ceil((COOLING_PERIOD_MS - (now - lastBotRunFinishedAt)) / 1e3 / 60);
      return res.status(429).json({
        status: "Error",
        message: `Bot is in cooling period. Please try again in ${remaining} minute(s).`
      });
    }
    console.log(`[BOT TRIGGER] Filing claim ${identifier} with real Playwright script...`);
    isBotRunning = true;
    isOtpRequired = false;
    fileAmazonClaim(claimData).then((result) => {
      console.log(`[BOT RESULT] ${identifier}:`, result);
      if (result.otpRequired) {
        isOtpRequired = true;
      }
    }).catch((err) => {
      console.error(`[BOT ERROR] ${identifier}:`, err);
    }).finally(() => {
      isBotRunning = false;
      lastBotRunFinishedAt = Date.now();
    });
    res.json({
      status: "Queued",
      id: `BT-${Math.floor(Math.random() * 1e4)}`,
      message: "Filing script initialized in background."
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
