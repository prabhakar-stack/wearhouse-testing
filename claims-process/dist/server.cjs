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
var import_express = __toESM(require("express"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_pg3 = __toESM(require("pg"), 1);

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
    let driveFileId = "";
    const idMatch = url.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]{25,55})/);
    if (url.includes("drive.google.com") && idMatch) {
      driveFileId = idMatch[1];
    }
    const res = await fetch(url);
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        const text = await res.text();
        const confirmMatch = text.match(/confirm=([a-zA-Z0-9_:-]+)/);
        if (confirmMatch) {
          const confirmUrl = url + `&confirm=${confirmMatch[1]}`;
          const confirmRes = await fetch(confirmUrl);
          if (confirmRes.ok) {
            const buffer = Buffer.from(await confirmRes.arrayBuffer());
            import_fs.default.writeFileSync(destPath, buffer);
            return true;
          }
        }
      } else {
        const buffer = Buffer.from(await res.arrayBuffer());
        import_fs.default.writeFileSync(destPath, buffer);
        return true;
      }
    }
    if (driveFileId) {
      const lhUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;
      try {
        const lhRes = await fetch(lhUrl);
        if (lhRes.ok) {
          const buffer = Buffer.from(await lhRes.arrayBuffer());
          const cType = lhRes.headers.get("content-type") || "";
          if (!cType.includes("text/html") && buffer.length > 100) {
            import_fs.default.writeFileSync(destPath, buffer);
            return true;
          }
        }
      } catch (lhErr) {
      }
    }
    return false;
  } catch (err) {
    console.error(`Error downloading from ${url}:`, err);
    return false;
  }
}
async function getDriveFolderEntries(folderUrl, log) {
  let files = [];
  const folders = [];
  let detectedFolderId = "";
  const folderIdMatch = folderUrl.match(/(?:folders\/|id=)([a-zA-Z0-9_-]{25,55})/);
  detectedFolderId = folderIdMatch ? folderIdMatch[1] : "";
  if (log && detectedFolderId) {
    log(`Detected Google Drive Folder ID: "${detectedFolderId}"`);
  }
  const urlsToTry = [];
  if (detectedFolderId) {
    urlsToTry.push(`https://drive.google.com/embeddedfolderview?id=${detectedFolderId}`);
  }
  urlsToTry.push(folderUrl);
  const foundIds = /* @__PURE__ */ new Set();
  const extractItemsFromHtml = (htmlContent) => {
    let addedCount = 0;
    const anchorRegex = /<a[^>]+href="[^"]*(?:file\/d\/|id=)([a-zA-Z0-9_-]{25,55})[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = anchorRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      let name = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        if (match[0].toLowerCase().includes("folder") || match[0].includes("folders/")) {
          folders.push({ id, name: name || `folder_${folders.length}` });
        } else {
          files.push({ id, name: name || `file_${files.length}` });
        }
        addedCount++;
      }
    }
    const folderAnchorRegex = /<a[^>]+href="[^"]*(?:folders\/|id=)([a-zA-Z0-9_-]{25,55})[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = folderAnchorRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      let name = match[2].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        folders.push({ id, name: name || `folder_${folders.length}` });
        addedCount++;
      }
    }
    const arrayRegex = /\["([a-zA-Z0-9_-]{25,55})"\s*,\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"([^"\\,]+)"/g;
    while ((match = arrayRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      const name = match[2].replace(/\\u([0-9a-fA-F]{4})/g, (m, grp) => String.fromCharCode(parseInt(grp, 16)));
      const mime = match[3];
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        if (mime.includes("folder")) {
          folders.push({ id, name });
        } else {
          files.push({ id, name });
        }
        addedCount++;
      }
    }
    const objRegex = /"id"\s*:\s*"([a-zA-Z0-9_-]{25,55})"[^}]*?"name"\s*:\s*"([^"]+)"[^}]*?"mimeType"\s*:\s*"([^"]+)"/g;
    while ((match = objRegex.exec(htmlContent)) !== null) {
      const id = match[1];
      const name = match[2];
      const mime = match[3];
      if (id && id !== detectedFolderId && !foundIds.has(id)) {
        foundIds.add(id);
        if (mime.includes("folder")) {
          folders.push({ id, name });
        } else {
          files.push({ id, name });
        }
        addedCount++;
      }
    }
    return addedCount;
  };
  for (const urlToFetch of urlsToTry) {
    try {
      if (log) log(`Executing fetch for Google Drive url: ${urlToFetch}`);
      const res = await fetch(urlToFetch, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });
      if (res.ok) {
        const text = await res.text();
        const added = extractItemsFromHtml(text);
        if (log) log(`Fetch completed successfully. Extracted ${added} item(s) from "${urlToFetch}"`);
        if (files.length > 0) {
          break;
        }
      } else {
        if (log) log(`Fetch responded with status: ${res.status} for ${urlToFetch}`);
      }
    } catch (fetchErr) {
      if (log) log(`Fetch attempt encountered error: ${fetchErr.message}`);
    }
  }
  if (files.length === 0) {
    if (log) log(`\u26A0\uFE0F Direct fetch was blocked or returned 0 entries. Initiating Playwright fallback solver...`);
    let browser;
    try {
      browser = await import_playwright.chromium.launch({
        headless: false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--disable-stealth-mode"
        ]
      });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      });
      const page = await context.newPage();
      for (const urlToNavigate of urlsToTry) {
        if (log) log(`Playwright navigating to: ${urlToNavigate}`);
        try {
          await page.goto(urlToNavigate, { waitUntil: "domcontentloaded", timeout: 35e3 });
          await page.waitForTimeout(6e3);
          const currentUrl = page.url();
          if (currentUrl.includes("accounts.google.com") || currentUrl.includes("ServiceLogin")) {
            if (log) log(`\u26A0\uFE0F Playwright redirected to Google Login page for url: ${urlToNavigate}`);
            continue;
          }
          const pageHtml = await page.content();
          const added = extractItemsFromHtml(pageHtml);
          if (log) log(`Playwright extracted ${added} items from html string for ${urlToNavigate}`);
          const domEntries = await page.evaluate(() => {
            const results = [];
            const anchors = document.querySelectorAll("a");
            anchors.forEach((a) => {
              const href = a.getAttribute("href") || "";
              const text = a.innerText || a.textContent || "";
              const ariaLabel = a.getAttribute("aria-label") || a.getAttribute("title") || "";
              let cleanName = (ariaLabel || text || "").replace(/\r?\n|\r/g, " ").trim();
              cleanName = cleanName.replace(/\s*-\s*Google\s*Drive/gi, "").trim();
              const fileMatch = href.match(/(?:file\/d\/|id=)([a-zA-Z0-9_-]{25,55})/);
              if (fileMatch && !href.includes("folders/")) {
                results.push({ id: fileMatch[1], name: cleanName, isFolder: false });
              }
              const folderMatch = href.match(/(?:folders\/|id=)([a-zA-Z0-9_-]{25,55})/);
              if (folderMatch) {
                results.push({ id: folderMatch[1], name: cleanName, isFolder: true });
              }
            });
            return results;
          });
          for (const entry of domEntries) {
            if (entry.id === detectedFolderId || foundIds.has(entry.id)) continue;
            foundIds.add(entry.id);
            const name = entry.name || (entry.isFolder ? `folder_${folders.length}` : `file_${files.length}`);
            if (entry.isFolder) {
              folders.push({ id: entry.id, name });
            } else {
              files.push({ id: entry.id, name });
            }
          }
          if (files.length > 0) {
            break;
          }
        } catch (pageErr) {
          if (log) log(`Playwright page navigation failed for ${urlToNavigate}: ${pageErr.message}`);
        }
      }
    } catch (pwErr) {
      if (log) log(`\u26A0\uFE0F Playwright solve attempt encountered error: ${pwErr.message}`);
    } finally {
      if (browser) {
        await browser.close().catch(() => {
        });
      }
    }
  }
  if (files.length === 0 && folders.length === 0) {
    if (log) log("\u26A0\uFE0F Scrapers found 0 files. Attempting loose regex fallback on the raw pages...");
    if (detectedFolderId) {
      try {
        const fallbackRes = await fetch(`https://drive.google.com/embeddedfolderview?id=${detectedFolderId}`);
        if (fallbackRes.ok) {
          const rawText = await fallbackRes.text();
          const looseIds = /* @__PURE__ */ new Set();
          const fileMatches = Array.from(rawText.matchAll(/file\/d\/([a-zA-Z0-9_-]{25,55})/g));
          for (const m of fileMatches) looseIds.add(m[1]);
          const queryIds = Array.from(rawText.matchAll(/id=([a-zA-Z0-9_-]{25,55})/g));
          for (const m of queryIds) {
            if (!rawText.includes(`folders/${m[1]}`)) {
              looseIds.add(m[1]);
            }
          }
          let fileIndex = 0;
          for (const id of looseIds) {
            if (id !== detectedFolderId && !foundIds.has(id)) {
              foundIds.add(id);
              files.push({ id, name: `file_${fileIndex++}` });
            }
          }
        }
      } catch (e) {
      }
    }
  }
  const finalFilesMap = /* @__PURE__ */ new Map();
  for (const f of files) {
    if (!finalFilesMap.has(f.id)) {
      let cleanName = f.name.trim();
      if (cleanName.includes("/") || cleanName.includes("\\")) {
        cleanName = cleanName.split(/[/\\]/).pop() || cleanName;
      }
      finalFilesMap.set(f.id, { id: f.id, name: cleanName });
    }
  }
  files = Array.from(finalFilesMap.values());
  files.sort((a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" }));
  folders.sort((a, b) => a.name.localeCompare(b.name, void 0, { numeric: true, sensitivity: "base" }));
  if (log) {
    log(`Scraped Google Drive Folder results: Found ${files.length} sorted files and ${folders.length} sorted folders.`);
    if (files.length > 0) log(`First files: ${files.map((f) => `"${f.name}" (${f.id})`).slice(0, 5).join(", ")}`);
    if (folders.length > 0) log(`First folders: ${folders.map((f) => `"${f.name}" (${f.id})`).slice(0, 5).join(", ")}`);
  }
  return { files, folders };
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
      const tables = ['"claims_all"'];
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
          if (tid && columns.includes("trackingid")) {
            params.push(tid);
            filters.push(`"trackingId" ILIKE $${params.length}`);
          }
          if (oid && columns.includes("orderid")) {
            params.push(oid);
            filters.push(`"orderId" ILIKE $${params.length}`);
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
  const logId = claim.orderId || claim.lpn || claim.claimId;
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
    const isHeadless = false;
    log(`Launching persistent browser context (headless: ${isHeadless})...`);
    context = await import_playwright.chromium.launchPersistentContext("./amazon-profile", {
      headless: isHeadless,
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
      const createdTempFiles = [];
      try {
        if (!import_fs.default.existsSync(tempDir)) {
          import_fs.default.mkdirSync(tempDir, { recursive: true });
        }
        const slotFiles = {
          0: [],
          // Slot 1: 8th image of parent folder
          1: [],
          // Slot 2: 7th image of parent folder
          2: [],
          // Slot 3: first 6 images of parent folder
          3: [],
          // Slot 4: 2nd till 5th images of matched LPN subfolder
          4: []
          // Slot 5: 1st image of matched LPN subfolder
        };
        const orderUrl = claim.orderDriveLink;
        const lpnUrl = claim.driveLink;
        if (!orderUrl) {
          throw new Error("No Order Google Drive link (order_drive_link) is provided in the claim database record. Cannot verify or upload supporting images.");
        }
        if (!lpnUrl) {
          throw new Error("No LPN Google Drive link (drive_link) is provided in the claim database record. Cannot verify or upload supporting images.");
        }
        log(`Step 1: Scraping parent Google Drive order folder: ${orderUrl}`);
        const orderFolder = await getDriveFolderEntries(orderUrl, log);
        const isImageFile = (f) => {
          const lower = f.name.toLowerCase();
          return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.includes(".jpg.") || lower.includes(".jpeg.") || lower.includes(".png.");
        };
        let orderFiles = orderFolder.files.filter(isImageFile);
        if (orderFiles.length === 0 && orderFolder.files.length > 0) {
          log("No files with explicit .jpg, .jpeg, or .png extensions found in Order folder. Defaulting to all raw folder files.");
          orderFiles = orderFolder.files;
        } else {
          log(`Filtered Order folder to include only image files (.jpg, .jpeg, .png). Found ${orderFiles.length} images out of ${orderFolder.files.length} total files.`);
        }
        if (orderFiles.length < 8) {
          throw new Error(`Order folder lacks required images: expected at least 8 files/images in order folder, but only found ${orderFiles.length}. (Section 1 requires the 8th image)`);
        }
        log(`Slot 1: Selecting 8th image: "${orderFiles[7].name}"`);
        slotFiles[0].push(orderFiles[7]);
        if (orderFiles.length < 7) {
          throw new Error(`Order folder lacks required images: expected at least 7 files/images in order folder, but only found ${orderFiles.length}. (Section 2 requires the 7th image)`);
        }
        log(`Slot 2: Selecting 7th image: "${orderFiles[6].name}"`);
        slotFiles[1].push(orderFiles[6]);
        if (orderFiles.length === 0) {
          throw new Error("Order folder has 0 files. Section 3 requires the first 6 images from the folder.");
        }
        const sliceFiles = orderFiles.slice(0, 6);
        log(`Slot 3: Selecting first ${sliceFiles.length} files from order folder: ${sliceFiles.map((f) => f.name).join(", ")}`);
        slotFiles[2].push(...sliceFiles);
        log(`Step 2: Scraping direct LPN Google Drive folder: ${lpnUrl}`);
        const subFolderContents = await getDriveFolderEntries(lpnUrl, log);
        let subfiles = subFolderContents.files.filter(isImageFile);
        if (subfiles.length === 0 && subFolderContents.files.length > 0) {
          log("No files with explicit .jpg, .jpeg, or .png extensions found in LPN folder. Defaulting to all raw folder files.");
          subfiles = subFolderContents.files;
        } else {
          log(`Filtered LPN folder to include only image files (.jpg, .jpeg, .png). Found ${subfiles.length} images out of ${subFolderContents.files.length} total files.`);
        }
        if (subfiles.length < 2) {
          throw new Error(`LPN folder has only ${subfiles.length} images. Cannot upload 1st/2nd images because there is no 2nd image (requires at least 2 images to select index 1-4).`);
        }
        const sliceSubfiles = subfiles.slice(1, 5);
        log(`Slot 4: Selecting files index 1 to 4 from LPN folder. Selected: ${sliceSubfiles.map((f) => f.name).join(", ")}`);
        slotFiles[3].push(...sliceSubfiles);
        if (subfiles.length < 1) {
          throw new Error(`LPN folder is empty. Section 5 requires the 1st image from the LPN folder.`);
        }
        log(`Slot 5: Selecting 1st image from LPN folder: "${subfiles[0].name}"`);
        slotFiles[4].push(subfiles[0]);
        const slotLocalPaths = {
          0: [],
          1: [],
          2: [],
          3: [],
          4: []
        };
        for (let i = 0; i < 5; i++) {
          const items = slotFiles[i] || [];
          for (let j = 0; j < items.length; j++) {
            const item = items[j];
            const directDownloadUrl = `https://drive.google.com/uc?export=download&id=${item.id}`;
            let fileExt = "png";
            try {
              const extMatch = item.name.match(/\.([a-zA-Z0-9]{3,4})$/);
              if (extMatch) fileExt = extMatch[1];
            } catch (e) {
            }
            const destPath = import_path.default.join(tempDir, `slot_${i + 1}_file_${j}_${item.id}.${fileExt}`);
            log(`Downloading file index ${j} for slot ${i + 1}: name="${item.name}", id="${item.id}"...`);
            const ok = await downloadFileFromUrl(directDownloadUrl, destPath);
            if (ok) {
              slotLocalPaths[i].push(destPath);
              createdTempFiles.push(destPath);
            } else {
              throw new Error(`Failed to download required image "${item.name}" (Drive ID: ${item.id}) for slot ${i + 1}. stopping execution.`);
            }
          }
        }
        const uploadElements = fileWindow.locator("kat-file-upload");
        const uploadCount = await uploadElements.count();
        log(`Found ${uploadCount} file upload components matching 'kat-file-upload'.`);
        for (let i = 0; i < uploadCount; i++) {
          const filesToUpload = slotLocalPaths[i];
          if (!filesToUpload || filesToUpload.length === 0) {
            log(`Slot ${i + 1}/${uploadCount}: No files assigned. Skipping.`);
            continue;
          }
          log(`Slot ${i + 1}/${uploadCount}: Uploading ${filesToUpload.length} files: [${filesToUpload.map((p) => import_path.default.basename(p)).join(", ")}]`);
          try {
            const inputElement = uploadElements.nth(i).locator('input[type="file"], #kat-file-attachment');
            if (filesToUpload.length === 1) {
              await inputElement.setInputFiles(filesToUpload[0]);
            } else {
              await inputElement.setInputFiles(filesToUpload);
            }
            log(`Successfully set input files for upload slot ${i + 1}`);
          } catch (slotUpErr) {
            log(`Failed to upload file to slot ${i + 1}: ${slotUpErr.message}`);
            throw new Error(`Failed to upload file to slot ${i + 1}: ${slotUpErr.message}`);
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
        throw uploadErr;
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
    const evidenceLink = claim.driveLink || claim.orderDriveLink;
    if (evidenceLink) {
      log(`Providing evidence link: ${evidenceLink}`);
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
            await el.fill(`Proof and Evidence: ${evidenceLink}`);
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
            }, `Proof and Evidence: ${evidenceLink}`);
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
    log("Finalizing Filing...");
    let submitClicked = false;
    const finalSubmitBtnSelectors = [
      'button:has-text("Submit")',
      'kat-button:has-text("Submit")',
      'button:has-text("Submit SAFE-T Claim")',
      'kat-button:has-text("Submit SAFE-T Claim")',
      'button:has-text("Submit SAFE-T claim")',
      'kat-button:has-text("Submit SAFE-T claim")',
      'kat-button[variant="primary"]',
      'button[type="submit"]',
      'input[type="submit"]'
    ];
    for (const finalBtnSel of finalSubmitBtnSelectors) {
      try {
        const btn = fileWindow.locator(finalBtnSel).first();
        if (await btn.isVisible()) {
          await btn.click();
          log(`Successfully clicked final submit button using selector: ${finalBtnSel}`);
          submitClicked = true;
          break;
        }
      } catch (err) {
        log(`Submit button selector ${finalBtnSel} failed: ${err.message}`);
      }
    }
    if (!submitClicked) {
      log("Warning: Could not automatically locate or click Submit button. Trying fallback evaluate click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]')).find((b) => {
            const txt = (b.textContent || b.innerText || "").toLowerCase();
            return txt.includes("submit");
          });
          if (btn) btn.click();
        });
        log("Fallback evaluate click triggered on Submit button.");
      } catch (e) {
        log(`Submit fallback click failed: ${e.message}`);
      }
    }
    await page.waitForTimeout(5e3);
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
var import_config3 = require("dotenv/config");

// scripts/update_claims_status.ts
var import_pg2 = __toESM(require("pg"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_config2 = require("dotenv/config");
function parseLogContent(content) {
  const lines = content.split("\n");
  let hasError = false;
  let exceptionSnippet = null;
  let capturedClaimId = null;
  const errorKeywords = ["error", "failed", "exception", "timeout", "fail", "crash", "critical"];
  const claimIdRegex = /SAFE-T Claim ID:\s*(S-[A-Z0-9\-_]+|S-\d+|\d+)/i;
  const fallbackClaimIdRegex = /\s(S-\d{5,15})\b/i;
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    const match = line.match(claimIdRegex);
    if (match && match[1]) {
      capturedClaimId = match[1].trim();
    } else {
      const fallbackMatch = line.match(fallbackClaimIdRegex);
      if (fallbackMatch && fallbackMatch[1]) {
        capturedClaimId = fallbackMatch[1].trim();
      }
    }
    const isErrorLine = errorKeywords.some((keyword) => lowerLine.includes(keyword));
    if (isErrorLine) {
      hasError = true;
      let cleanLine = line.trim();
      cleanLine = cleanLine.replace(/^\[[^\]]+\]\s*/, "");
      if (!exceptionSnippet || exceptionSnippet.length < cleanLine.length) {
        exceptionSnippet = cleanLine;
      }
    }
  }
  if (hasError) {
    return {
      status: "Failed",
      claimId: capturedClaimId || "",
      botLogReason: exceptionSnippet ? exceptionSnippet.substring(0, 255) : "Unknown automation error execution exception"
    };
  }
  if (capturedClaimId) {
    return {
      status: "complete",
      claimId: capturedClaimId,
      botLogReason: null
    };
  }
  return {
    status: "unclaimed",
    claimId: "",
    botLogReason: null
  };
}
async function updateClaimsStatus() {
  console.log("[CRON] Executing automated claims_status synchronization step...");
  let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("[CRON Mock] No database pool connection found. Skipping SQL sync.");
    return;
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
  let pool2 = null;
  try {
    pool2 = new import_pg2.default.Pool({
      connectionString,
      connectionTimeoutMillis: 15e3,
      max: 1,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
    });
    await pool2.query(`
      CREATE TABLE IF NOT EXISTS "claims_status" (
        id SERIAL PRIMARY KEY,
        "orderId" text UNIQUE NOT NULL,
        "trackingId" text,
        "claimId" text DEFAULT '',
        status text DEFAULT 'unclaimed',
        bot_log_reason text,
        created_at timestamp with time zone DEFAULT now()
      );
    `);
    try {
      await pool2.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "trackingId" text;`);
      await pool2.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();`);
    } catch (e) {
      console.warn("[CRON] Column check on claims_status warning:", e.message);
    }
    const evidenceTableCheck = await pool2.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND LOWER(table_name) = 'evidence'
    `);
    const hasEvidenceTable = evidenceTableCheck.rows.length > 0;
    const evidenceTableName = hasEvidenceTable ? evidenceTableCheck.rows[0].table_name : "Evidence";
    if (hasEvidenceTable) {
      const pruneRes = await pool2.query(`
        DELETE FROM "claims_status"
        WHERE "orderId" NOT IN (
          SELECT DISTINCT "orderId" 
          FROM "${evidenceTableName}"
          WHERE "orderId" IS NOT NULL AND "orderId" != 'N/A'
        )
      `);
      if (pruneRes.rowCount && pruneRes.rowCount > 0) {
        console.log(`[CRON] Pruned ${pruneRes.rowCount} orphan records from claims_status not found in "${evidenceTableName}" table.`);
      }
    }
    const viewCheck = await pool2.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' AND LOWER(table_name) = 'claims_all'
    `);
    const tableCheck = await pool2.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND LOWER(table_name) = 'claims_all'
    `);
    const hasClaimsAll = viewCheck.rows.length > 0 || tableCheck.rows.length > 0;
    if (hasClaimsAll) {
      let queryStr = 'SELECT DISTINCT "orderId", "trackingId" FROM "claims_all"';
      if (hasEvidenceTable) {
        queryStr = `
          SELECT DISTINCT "orderId", "trackingId" 
          FROM "claims_all" 
          WHERE "orderId" IN (
            SELECT DISTINCT "orderId" FROM "${evidenceTableName}" WHERE "orderId" IS NOT NULL AND "orderId" != 'N/A'
          )
        `;
      }
      const allClaimsRes = await pool2.query(queryStr);
      for (const row of allClaimsRes.rows) {
        const oId = row.orderId || row.orderId;
        const tId = row.trackingId || null;
        if (oId && oId !== "N/A" && oId.trim() !== "") {
          await pool2.query(`
            INSERT INTO "claims_status" ("orderId", "trackingId", status)
            VALUES ($1, $2, 'unclaimed')
            ON CONFLICT ("orderId") DO UPDATE SET
              "trackingId" = COALESCE("claims_status"."trackingId", EXCLUDED."trackingId")
          `, [oId.trim(), tId ? tId.trim() : null]);
        }
      }
    }
    const logDir = import_path2.default.join(process.cwd(), "bot_logs");
    if (import_fs2.default.existsSync(logDir)) {
      const files = import_fs2.default.readdirSync(logDir);
      for (const file of files) {
        if (file.endsWith(".log")) {
          const id = import_path2.default.basename(file, ".log").trim();
          if (!id) continue;
          const filePath = import_path2.default.join(logDir, file);
          const logContent = import_fs2.default.readFileSync(filePath, "utf-8");
          const parseResult = parseLogContent(logContent);
          const stats = import_fs2.default.statSync(filePath);
          const createdAt = stats.birthtime || stats.mtime || /* @__PURE__ */ new Date();
          let targetPairs = [];
          if (hasClaimsAll) {
            try {
              const matchRes = await pool2.query(
                `SELECT DISTINCT "orderId", "trackingId" FROM "claims_all" WHERE LOWER("orderId") = LOWER($1) OR LOWER(lpn) = LOWER($1)`,
                [id]
              );
              for (const mRow of matchRes.rows) {
                if (mRow.orderId && mRow.orderId !== "N/A") {
                  targetPairs.push({
                    orderId: mRow.orderId.trim(),
                    trackingId: mRow.trackingId ? mRow.trackingId.trim() : null
                  });
                }
              }
            } catch (err) {
              console.warn(`[WARN] Finding orderId/trackingId matching ${id} failed:`, err.message);
            }
          }
          if (targetPairs.length === 0) {
            targetPairs.push({ orderId: id, trackingId: null });
          }
          for (const pair of targetPairs) {
            if (!pair.orderId || pair.orderId.trim() === "" || pair.orderId === "N/A") continue;
            if (hasEvidenceTable) {
              const checkEvidence = await pool2.query(`SELECT 1 FROM "${evidenceTableName}" WHERE "orderId" = $1 LIMIT 1`, [pair.orderId]);
              if (checkEvidence.rows.length === 0) {
                console.log(`[CRON LOG SYNC] Skipped Order ID: ${pair.orderId} since it is NOT present in "${evidenceTableName}" table.`);
                continue;
              }
            }
            await pool2.query(`
              INSERT INTO "claims_status" ("orderId", "trackingId", "claimId", status, bot_log_reason, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT ("orderId")
              DO UPDATE SET
                status = EXCLUDED.status,
                "claimId" = COALESCE(NULLIF(EXCLUDED."claimId", ''), "claims_status"."claimId", ''),
                "trackingId" = COALESCE("claims_status"."trackingId", EXCLUDED."trackingId"),
                bot_log_reason = EXCLUDED.bot_log_reason,
                created_at = EXCLUDED.created_at
            `, [
              pair.orderId,
              pair.trackingId,
              parseResult.claimId,
              parseResult.status,
              parseResult.botLogReason,
              createdAt
            ]);
            console.log(`[CRON LOG SYNC] Synchronized logs for Order ID: ${pair.orderId} (Status: ${parseResult.status}, CreatedAt: ${createdAt})`);
          }
        }
      }
    } else {
      console.log("[CRON] No execution logs directory found at `./bot_logs` yet.");
    }
    if (hasEvidenceTable) {
      await pool2.query(`
        DELETE FROM "claims_status"
        WHERE "orderId" NOT IN (
          SELECT DISTINCT "orderId" 
          FROM "${evidenceTableName}"
          WHERE "orderId" IS NOT NULL AND "orderId" != 'N/A'
        )
      `);
    }
  } catch (err) {
    console.error("[CRON ERROR] Syncing automated status metrics failed:", err.message);
  } finally {
    if (pool2) {
      await pool2.end().catch(() => {
      });
    }
  }
}

// server.ts
var pool = null;
var mockQcStatus = [];
var mockSampleRecovery = [];
var mockItemStatus = [
  { lpn: "LPN001", status: "recovery", recoveryType: "Barcode Damaged" },
  { lpn: "LPN002", status: "recovery", recoveryType: "Packaging Damaged" },
  { lpn: "LPN003", status: "recovery", recoveryType: "Barcode Damaged" },
  { lpn: "LPN004", status: "recovery", recoveryType: "Packaging Damaged" },
  { lpn: "LPN005", status: "recovery", recoveryType: "Packaging Damaged" }
];
var mockReturnItems = [
  { lpn: "LPN001", sku: "1120100" },
  { lpn: "LPN002", sku: "1120200" },
  { lpn: "LPN003", sku: "4829102" },
  { lpn: "LPN004", sku: "1092837" },
  { lpn: "LPN005", sku: "SKU-REP-990" },
  { lpn: "LPN101", sku: "SKU-NEW-101" },
  { lpn: "LPN102", sku: "SKU-NEW-102" }
];
async function setupDatabaseSchema(db) {
  try {
    console.log("Dropping deprecated AMZ_filed_claims table...");
    await db.query(`DROP VIEW IF EXISTS "claims_amz" CASCADE; DROP TABLE IF EXISTS "claims_amz" CASCADE; DROP VIEW IF EXISTS "claims_all" CASCADE; DROP TABLE IF EXISTS "claims_all" CASCADE;`);
    await db.query(`DROP TABLE IF EXISTS "AMZ_filed_claims" CASCADE;`);
    console.log("Checking and setting up sample_recovery table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS "sample_recovery" (
        lpn text PRIMARY KEY,
        sku text NOT NULL,
        damage_type text NOT NULL,
        "isRefurbished" boolean DEFAULT false,
        status text DEFAULT 'pending'
      );
    `);
    console.log("Checking and setting up ItemStatus and ReturnItem tables...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS "claims_status" (
        id SERIAL PRIMARY KEY,
        "orderId" text UNIQUE NOT NULL,
        "trackingId" text,
        "claimId" text DEFAULT '',
        status text DEFAULT 'unclaimed',
        bot_log_reason text,
        created_at timestamp with time zone DEFAULT now()
      );
    `);
    try {
      await db.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "trackingId" text;`);
      await db.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();`);
    } catch (e) {
      console.warn("Backwards compatibility Alter check on claims_status warning:", e.message);
    }
    await db.query(`
      CREATE TABLE IF NOT EXISTS "ItemStatus" (
        lpn text PRIMARY KEY,
        status text NOT NULL,
        "recoveryType" text,
        "createdAt" timestamp with time zone DEFAULT now()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS "ReturnItem" (
        lpn text PRIMARY KEY,
        sku text NOT NULL
      );
    `);
    try {
      const returnItemCols = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ReturnItem'
      `);
      const colMap = new Set(returnItemCols.rows.map((row) => row.column_name.toLowerCase()));
      console.log(`[Schema Match] "ReturnItem" table columns:`, Array.from(colMap));
      if (returnItemCols.rows.length > 0 && !colMap.has("lpn")) {
        if (colMap.has("license-plate-number")) {
          console.log(`[Schema Match] Normalizing "ReturnItem" column "license-plate-number" to "lpn"`);
          await db.query(`ALTER TABLE "ReturnItem" RENAME COLUMN "license-plate-number" TO lpn`);
        } else if (colMap.has("license_plate_number")) {
          console.log(`[Schema Match] Normalizing "ReturnItem" column "license_plate_number" to "lpn"`);
          await db.query(`ALTER TABLE "ReturnItem" RENAME COLUMN "license_plate_number" TO lpn`);
        } else {
          console.log(`[Schema Match] Re-creating "ReturnItem" table to ensure clean columns...`);
          await db.query(`DROP TABLE IF EXISTS "ReturnItem" CASCADE;`);
          await db.query(`
            CREATE TABLE "ReturnItem" (
              lpn text PRIMARY KEY,
              sku text NOT NULL
            );
          `);
        }
      }
    } catch (colErr) {
      console.warn(`[Schema Match] Error checking schema for "ReturnItem":`, colErr.message);
    }
    try {
      const itemStatusCols = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ItemStatus'
      `);
      const colMap = new Set(itemStatusCols.rows.map((row) => row.column_name.toLowerCase()));
      if (itemStatusCols.rows.length > 0 && !colMap.has("lpn")) {
        if (colMap.has("license-plate-number")) {
          console.log(`[Schema Match] Normalizing "ItemStatus" column "license-plate-number" to "lpn"`);
          await db.query(`ALTER TABLE "ItemStatus" RENAME COLUMN "license-plate-number" TO lpn`);
        } else if (colMap.has("license_plate_number")) {
          console.log(`[Schema Match] Normalizing "ItemStatus" column "license_plate_number" to "lpn"`);
          await db.query(`ALTER TABLE "ItemStatus" RENAME COLUMN "license_plate_number" TO lpn`);
        } else {
          console.log(`[Schema Match] Re-creating "ItemStatus" table...`);
          await db.query(`DROP TABLE IF EXISTS "ItemStatus" CASCADE;`);
          await db.query(`
            CREATE TABLE "ItemStatus" (
              lpn text PRIMARY KEY,
              status text NOT NULL,
              "recoveryType" text,
              "createdAt" timestamp with time zone DEFAULT now()
            );
          `);
        }
      }
    } catch (colErr) {
      console.warn(`[Schema Match] Error checking schema for "ItemStatus":`, colErr.message);
    }
    console.log("Checking and setting up qc_status table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS "qc_status" (
        sku text PRIMARY KEY,
        target_count integer NOT NULL DEFAULT 0,
        quantity_count integer NOT NULL DEFAULT 0,
        status text
      );
    `);
    try {
      await db.query(`ALTER TABLE "qc_status" ADD COLUMN IF NOT EXISTS "target_count" integer NOT NULL DEFAULT 0;`);
    } catch (e) {
      console.warn("Backwards compatibility Alter check on qc_status warning:", e.message);
    }
    const countReturnItems = await db.query('SELECT COUNT(*) FROM "ReturnItem"');
    if (parseInt(countReturnItems.rows[0].count) === 0) {
      console.log("Seeding ReturnItem with default records...");
      await db.query(`
        INSERT INTO "ReturnItem" (lpn, sku) VALUES
        ('LPN001', '1120100'),
        ('LPN002', '1120200'),
        ('LPN003', '4829102'),
        ('LPN004', '1092837'),
        ('LPN005', 'SKU-REP-990'),
        ('LPN101', 'SKU-NEW-101'),
        ('LPN102', 'SKU-NEW-102')
        ON CONFLICT (lpn) DO NOTHING;
      `);
    }
    const countItemStatus = await db.query('SELECT COUNT(*) FROM "ItemStatus"');
    if (parseInt(countItemStatus.rows[0].count) === 0) {
      console.log("Seeding ItemStatus with default records...");
      await db.query(`
        INSERT INTO "ItemStatus" (lpn, status, "recoveryType") VALUES
        ('LPN001', 'recovery', 'Barcode Damaged'),
        ('LPN002', 'recovery', 'Packaging Damaged'),
        ('LPN003', 'recovery', 'Barcode Damaged'),
        ('LPN004', 'recovery', 'Packaging Damaged'),
        ('LPN005', 'recovery', 'Packaging Damaged')
        ON CONFLICT (lpn) DO NOTHING;
      `);
    }
    console.log("Setting up sync trigger on ItemStatus table...");
    await db.query(`
      CREATE OR REPLACE FUNCTION sync_item_status_to_recovery()
      RETURNS TRIGGER AS $$
      DECLARE
        found_sku text;
        mapped_damage_type text;
     BEGIN
        IF NEW.status = 'RECOVERY' THEN
          SELECT sku INTO found_sku FROM "ReturnItem" WHERE lpn = NEW.lpn;
          
          IF found_sku IS NULL THEN
            RAISE WARNING 'Relational mapping failed: SKU not found for LPN %', NEW.lpn;
          ELSE
            -- Map physical damage types to standard codes
            IF NEW."recoveryType" = 'Barcode Damaged' OR NEW."recoveryType" = 'barcode_damage' THEN
              mapped_damage_type := 'barcode_damage';
            ELSIF NEW."recoveryType" = 'Packaging Damaged' OR NEW."recoveryType" = 'box_damage' THEN
              mapped_damage_type := 'box_damage';
            ELSE
              mapped_damage_type := COALESCE(NEW."recoveryType", 'box_damage');
            END IF;

             INSERT INTO "sample_recovery" (lpn, sku, damage_type, "isRefurbished", status)
             VALUES (NEW.lpn, found_sku, mapped_damage_type, false, 'inspected')
            ON CONFLICT (lpn) DO UPDATE SET
              sku = EXCLUDED.sku,
              damage_type = EXCLUDED.damage_type,
              status = 'inspected';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await db.query(`
      DROP TRIGGER IF EXISTS trg_sync_item_status ON "ItemStatus";
      CREATE TRIGGER trg_sync_item_status
      AFTER INSERT OR UPDATE ON "ItemStatus"
      FOR EACH ROW
      EXECUTE FUNCTION sync_item_status_to_recovery();
    `);
    const countRes = await db.query('SELECT COUNT(*) FROM "sample_recovery"');
    console.log("Checking and setting up claims_all physical table...");
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name.toLowerCase()));
    console.log("Existing tables in database:", Array.from(existingTables));
    let returnsTable = "AMZ_customer_returns";
    if (!existingTables.has("amz_customer_returns") && existingTables.has("amz_customer_return")) {
      returnsTable = "AMZ_customer_return";
    }
    if (existingTables.has(returnsTable.toLowerCase())) {
      console.log(`Table "${returnsTable}" found. Proceeding with database-backed "claims_all" table setup...`);
      try {
        await db.query(`ALTER TABLE "shopify_return_tracking" ADD COLUMN IF NOT EXISTS "orderId" text;`);
        console.log(`[Schema Match] Added "orderId" column to "shopify_return_tracking" table successfully.`);
      } catch (colErr) {
        console.warn(`[Schema Match] "shopify_return_tracking" Column check/alter warning:`, colErr.message);
      }
      await db.query(`DROP VIEW IF EXISTS "claims_AMZ" CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS "claims_AMZ" CASCADE;`);
      await db.query(`DROP VIEW IF EXISTS claims_amz CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS claims_amz CASCADE;`);
      await db.query(`DROP VIEW IF EXISTS "claims_all" CASCADE;`);
      const hasRemovalShipments = existingTables.has("amz_removal_shipments");
      const hasRemovalOrders = existingTables.has("amz_removal_orders");
      const hasEvidence = existingTables.has("evidence");
      const hasManifest = existingTables.has("manifest");
      const hasReimbursements = existingTables.has("amz_reimbursements");
      await db.query(`
        CREATE TABLE IF NOT EXISTS "claims_all" (
          lpn text PRIMARY KEY,
          "orderId" text,
          "trackingId" text,
          sku text,
          fnsku text,
          "productName" text,
          channel text,
          status text DEFAULT 'unclaimed',
          type text,
          "driveLink" text,
          "orderDriveLink" text,
          "createdAt" timestamp with time zone,
          qty integer
        );
      `);
      const syncSql = `
        TRUNCATE TABLE "claims_all";
        INSERT INTO "claims_all" (
          lpn, "orderId", "trackingId", sku, fnsku, "productName", channel, status, type, "driveLink", "orderDriveLink", "createdAt", qty
        )
        WITH base_returns AS (
          SELECT 
            "license-plate-number" AS lpn,
            sku,
            fnsku,
            "product-name" AS product_name,
            "order-id" AS raw_order_id,
            "detailed-disposition",
            reason AS return_reason
          FROM "${returnsTable}"
        ),
        evidences AS (
          ${hasEvidence ? `
          SELECT DISTINCT ON (lpn)
            lpn,
            "orderId",
            "manifestId"
          FROM "Evidence"
          ` : `
          SELECT 
            NULL::text AS lpn,
            NULL::text AS "orderId",
            NULL::text AS "manifestId"
          LIMIT 0
          `}
        ),
        mapped_claims_raw AS (
          -- Part 1: Amazon Returns Base Queue
          SELECT 
            br.lpn,
            
            -- orderId mapping
            COALESCE(
              ev."orderId",
              ${hasRemovalShipments ? `(
                SELECT rs."order-id" 
                FROM "AMZ_removal_shipments" rs 
                WHERE rs.sku = br.sku OR rs.fnsku = br.fnsku 
                LIMIT 1
              )` : "NULL::text"},
              ${hasReimbursements ? `(
                SELECT re."case-id" 
                FROM "AMZ_reimbursements" re 
                WHERE re.sku = br.sku OR re.fnsku = br.fnsku 
                LIMIT 1
              )` : "NULL::text"}
            ) AS "orderId",
            
            -- trackingId mapping
            COALESCE(
              ${hasManifest ? `(
                SELECT m."trackingId" 
                FROM "Manifest" m 
                WHERE m.id = ev."manifestId" 
                LIMIT 1
              )` : "NULL::text"},
              ${hasRemovalShipments ? `(
                SELECT rs."tracking-number" 
                FROM "AMZ_removal_shipments" rs 
                WHERE rs."order-id" = COALESCE(
                  ev."orderId", 
                  (SELECT rs2."order-id" FROM "AMZ_removal_shipments" rs2 WHERE rs2.sku = br.sku OR rs2.fnsku = br.fnsku LIMIT 1)
                )
                LIMIT 1
              )` : "NULL::text"}
            ) AS "trackingId",
            
            br.sku,
            br.fnsku,
            br.product_name AS "productName",
            
            -- channel mapping
            CASE
              WHEN ${hasRemovalOrders ? `EXISTS (
                SELECT 1 
                FROM "AMZ_removal_orders" ro 
                WHERE ro."order-id" = COALESCE(
                  ev."orderId",
                  (SELECT rs."order-id" FROM "AMZ_removal_shipments" rs WHERE rs.sku = br.sku OR rs.fnsku = br.fnsku LIMIT 1)
                )
              )` : "FALSE"} THEN 'Amazon B2B'
              
              WHEN br."detailed-disposition" != 'SELLABLE' AND NOT ${hasRemovalOrders ? `EXISTS (
                SELECT 1 
                FROM "AMZ_removal_orders" ro 
                WHERE ro."order-id" = COALESCE(
                  ev."orderId",
                  (SELECT rs."order-id" FROM "AMZ_removal_shipments" rs WHERE rs.sku = br.sku OR rs.fnsku = br.fnsku LIMIT 1)
                )
              )` : "FALSE"} THEN 'AMZ B2C'
              
              ELSE 'AMZ B2C'
            END AS channel,
            
            -- type mapping
            CASE
              WHEN ev.lpn IS NOT NULL THEN 'Damaged'
              ELSE 'Missing'
            END AS type,

            -- evidence drive links
            COALESCE(ev."lpnDriveLink", ev."orderDriveLink") AS "driveLink",
            ev."orderDriveLink" AS "orderDriveLink",
            NULL::timestamp with time zone AS "createdAt",
            1::integer AS qty
            
          FROM base_returns br
          LEFT JOIN evidences ev ON br.lpn = ev.lpn
        )
        SELECT 
          mcr.lpn,
          mcr."orderId",
          mcr."trackingId",
          mcr.sku,
          mcr.fnsku,
          mcr."productName",
          mcr.channel,
          COALESCE(cs.status, 'unclaimed') AS status,
          mcr.type,
          mcr."driveLink",
          mcr."orderDriveLink",
          mcr."createdAt",
          mcr.qty
        FROM mapped_claims_raw mcr
        LEFT JOIN "claims_status" cs ON mcr."orderId" = cs."orderId";
      `;
      await db.query(syncSql);
      console.log('\u2705 Physical "claims_all" table successfully populated from base tables.');
    } else {
      console.warn(`\u26A0\uFE0F Base table "${returnsTable}" was not found! Ensuring "claims_all" physical table exists...`);
      await db.query(`DROP VIEW IF EXISTS "claims_amz" CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS "claims_amz" CASCADE;`);
      await db.query(`DROP VIEW IF EXISTS "claims_all" CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS "claims_all" CASCADE;`);
      await db.query(`
        CREATE TABLE IF NOT EXISTS "claims_all" (
          lpn text PRIMARY KEY,
          "orderId" text,
          "trackingId" text,
          sku text,
          fnsku text,
          "productName" text,
          channel text,
          status text DEFAULT 'unclaimed',
          type text,
          "driveLink" text,
          "orderDriveLink" text,
          "createdAt" timestamp with time zone,
          qty integer
        );
      `);
      console.log('\u2705 Fallback physical table "claims_all" created.');
    }
  } catch (err) {
    console.error("\u274C setupDatabaseSchema error:", err.message);
  }
}
function getDbPool() {
  if (!pool) {
    let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.warn("\n\u26A0\uFE0F   DATABASE CONNECTION ERROR");
      console.warn("No connection string found. Please:");
      console.warn("1. Verify you have a file named '.env' (NOT .env.example) in the root folder.");
      console.warn("2. Ensure it contains: SUPABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres");
      console.warn("3. Restart the server.\n");
      return null;
    }
    if (connectionString.trim().startsWith("http")) {
      console.error("\n\u274C INVALID CONNECTION STRING");
      console.error("The variable SUPABASE_URL seems to be a URL (https://...).");
      console.error("Please use the 'Connection String' URI from Supabase Dashboard > Settings > Database.");
      console.error("It should start with 'postgresql://' or 'postgres://'\n");
      return null;
    }
    connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
    if (connectionString.startsWith("hpostgresql://")) {
      connectionString = connectionString.substring(1);
    }
    const passwordMatch = connectionString.match(/:(.*)@/);
    if (passwordMatch && passwordMatch[1]) {
      let password = passwordMatch[1];
      if (password.startsWith("[") && password.endsWith("]")) {
        const sanitizedPassword = password.substring(1, password.length - 1);
        connectionString = connectionString.replace(password, sanitizedPassword);
        console.log("Self-correction: Removed brackets from password.");
      }
    }
    console.log(`Initializing PostgreSQL Pool...`);
    pool = new import_pg3.default.Pool({
      connectionString,
      connectionTimeoutMillis: 15e3,
      idleTimeoutMillis: 3e4,
      max: 10,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
    });
    (async () => {
      try {
        const client = await pool.connect();
        console.log("\u2705 Successfully connected to Supabase PostgreSQL");
        client.release();
        if (pool) {
          await setupDatabaseSchema(pool);
        }
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
  const PORT = Number(process.env.PORT) || 3e3;
  updateClaimsStatus().catch((err) => console.error("[CRON ERROR] Initial startup sync failed:", err.message));
  setInterval(() => {
    updateClaimsStatus().catch((err) => console.error("[CRON ERROR] Failed to update claims status:", err.message));
  }, 60 * 1e3 * 10);
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
    },
    {
      claimId: "C-112825",
      lpn: "LPN002",
      trackingId: "52102112825",
      orderId: "Xq588pX611T",
      source: "Amazon",
      channel: "Amazon B2C",
      sku: "1120200",
      fnsku: "X0018CDFL4",
      shippedQuantity: 1,
      deliveryStatus: "Rejected",
      condition: "good",
      type: "Rejected",
      // Supabase 'Rejected' column value
      status: "New",
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3).toISOString(),
      slaDaysElapsed: 3,
      reason: "Customer Rejected Delivery",
      reasonDescription: "The customer rejected the shipment directly upon delivery attempt due to late arrival.",
      driveLink: "https://drive.google.com/drive/folders/3KPMil0jNl8h_GjVlqXt91iKJenoiNzbM"
    },
    {
      claimId: "C-112826",
      lpn: "LPN201",
      trackingId: "TRACK_SHOPIFY_RTO_123",
      orderId: "SHPFY-1001",
      source: "Shopify",
      channel: "Shopify RTO",
      sku: "SHOPIFY-SKU-999",
      fnsku: "",
      shippedQuantity: 2,
      qty: 2,
      deliveryStatus: "ReturnedToOrigin",
      condition: "good",
      type: "Rejected",
      status: "New",
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1e3).toISOString(),
      slaDaysElapsed: 4,
      reason: "Undelivered RTO",
      reasonDescription: "Delivery failed multiple times, package returned to warehouse.",
      driveLink: "https://drive.google.com/drive/folders/3KPMil0jNl8h_GjVlqXt91iKJenoiNzbN"
    },
    {
      claimId: "C-112827",
      lpn: "LPN202",
      trackingId: "TRACK_SHOPIFY_RTV_456",
      orderId: "SHPFY-1002",
      source: "Shopify",
      channel: "Shopify RTV",
      sku: "SHOPIFY-SKU-888",
      fnsku: "",
      shippedQuantity: 1,
      qty: 1,
      deliveryStatus: "Returned",
      condition: "damaged",
      type: "Damaged",
      status: "New",
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1e3).toISOString(),
      slaDaysElapsed: 6,
      reason: "Customer Damaged Return",
      reasonDescription: "Item returned by customer in bad packaging.",
      driveLink: "https://drive.google.com/drive/folders/3KPMil0jNl8h_GjVlqXt91iKJenoiNzbM"
    }
  ];
  let isBotRunning = false;
  let isOtpRequired = false;
  let lastBotRunFinishedAt = null;
  const COOLING_PERIOD_MS = 1 * 60 * 1e3;
  async function syncItemStatusToRecoveryFlow(lpn, status, recoveryType) {
    const cleanLpn = (lpn || "").trim();
    const cleanStatus = (status || "").trim();
    const cleanRecoveryType = (recoveryType || "").trim() || "box_damage";
    console.log(`[Sync Flow] Initiating sync flow for LPN: "${cleanLpn}", Status: "${cleanStatus}", RecoveryType: "${cleanRecoveryType}"`);
    if (!cleanLpn) {
      return { success: false, message: "Missing LPN identifier", errorType: "ValidationError" };
    }
    let mappedDamageType = "box_damage";
    if (cleanRecoveryType === "Barcode Damaged" || cleanRecoveryType === "barcode_damage") {
      mappedDamageType = "barcode_damage";
    } else if (cleanRecoveryType === "Packaging Damaged" || cleanRecoveryType === "box_damage") {
      mappedDamageType = "box_damage";
    } else {
      mappedDamageType = cleanRecoveryType;
    }
    const pool2 = getDbPool();
    if (pool2) {
      try {
        const client = await pool2.connect();
        try {
          await client.query("BEGIN");
          await client.query(`
            INSERT INTO "ItemStatus" (lpn, status, "recoveryType", "createdAt")
            VALUES ($1, $2, $3, now())
            ON CONFLICT (lpn) DO UPDATE SET
              status = $2,
              "recoveryType" = $3,
              "createdAt" = now()
          `, [cleanLpn, cleanStatus, cleanRecoveryType]);
          if (cleanStatus === "RECOVERY") {
            const returnItemRes = await client.query('SELECT sku FROM "ReturnItem" WHERE LOWER(lpn) = LOWER($1)', [cleanLpn]);
            if (returnItemRes.rows.length === 0) {
              const errorMsg = `Relational mapping failed: SKU not found for LPN ${cleanLpn}`;
              console.error(`\u274C [Sync Flow] ${errorMsg}`);
              await client.query("ROLLBACK");
              return { success: false, message: errorMsg, errorType: "RelationalMappingFailed" };
            }
            const sku = returnItemRes.rows[0].sku;
            await client.query(`
              INSERT INTO "sample_recovery" (lpn, sku, damage_type, "isRefurbished", status)
              VALUES ($1, $2, $3, false, 'inspected')
              ON CONFLICT (lpn) DO UPDATE SET
                sku = EXCLUDED.sku,
                damage_type = EXCLUDED.damage_type,
                status = 'inspected'
            `, [cleanLpn, sku, mappedDamageType]);
            console.log(`[Sync Flow] Successfully synchronized LPN ${cleanLpn} to sample_recovery with SKU ${sku}`);
          }
          await client.query("COMMIT");
          return { success: true, message: `Successfully synchronized and stored ItemStatus config for LPN ${cleanLpn}.` };
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(`[Sync Flow] Transaction rollback for ${cleanLpn}:`, err);
          throw err;
        } finally {
          client.release();
        }
      } catch (err) {
        return { success: false, message: `Database synchronization handler failed: ${err.message}` };
      }
    } else {
      const existingIdx = mockItemStatus.findIndex((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
      if (existingIdx !== -1) {
        mockItemStatus[existingIdx].status = cleanStatus;
        mockItemStatus[existingIdx].recoveryType = cleanRecoveryType;
      } else {
        mockItemStatus.push({
          lpn: cleanLpn,
          status: cleanStatus,
          recoveryType: cleanRecoveryType,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      if (cleanStatus === "RECOVERY") {
        const foundReturnItem = mockReturnItems.find((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
        if (!foundReturnItem) {
          const errorMsg = `Relational mapping failed: SKU not found for LPN ${cleanLpn}`;
          console.error(`\u274C [Sync Flow Mock] ${errorMsg}`);
          return { success: false, message: errorMsg, errorType: "RelationalMappingFailed" };
        }
        const sku = foundReturnItem.sku;
        const existingRecoveryIdx = mockSampleRecovery.findIndex((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
        const recoveryRecord = {
          lpn: cleanLpn,
          sku,
          damage_type: mappedDamageType,
          is_refurbished: false,
          status: "inspected"
        };
        if (existingRecoveryIdx !== -1) {
          mockSampleRecovery[existingRecoveryIdx] = recoveryRecord;
        } else {
          mockSampleRecovery.push(recoveryRecord);
        }
        console.log(`[Sync Flow Mock] Successfully synchronized LPN ${cleanLpn} to mock sample_recovery with SKU ${sku}`);
      }
      return { success: true, message: "Successfully executed mock sync flow." };
    }
  }
  async function handleEvidenceTypeClaimedUpdate(db, orderId, status) {
    if (!db || !orderId || !status) return;
    if (status.toLowerCase() === "claimed") {
      try {
        const claimCheck = await db.query(
          `SELECT "type" FROM "claims_all" WHERE "orderId" = $1 LIMIT 1`,
          [orderId]
        );
        if (claimCheck.rows.length > 0 && claimCheck.rows[0].type === "Rejected") {
          try {
            await db.query(`UPDATE "Evidence" SET "status" = 'Claimed' WHERE "orderId" = $1`, [orderId]);
            console.log(`[Evidence Update] Updated Evidence.status to 'Claimed' for Order ID: ${orderId}`);
          } catch (evErr) {
            try {
              await db.query(`UPDATE "evidence" SET "status" = 'Claimed' WHERE "orderId" = $1`, [orderId]);
              console.log(`[Evidence Update fallback] Updated evidence.type to 'Claimed' for Order ID: ${orderId}`);
            } catch (innerEvErr) {
              console.error(`[Evidence Update] Failed both Evidence and evidence table updates: ${innerEvErr.message}`);
            }
          }
        }
      } catch (e) {
        console.error(`[Evidence Update Check] Lookup failed: ${e.message}`);
      }
    }
  }
  app.get("/api/item-status", async (req, res, next) => {
    try {
      const pool2 = getDbPool();
      if (pool2) {
        const result = await pool2.query('SELECT * FROM "ItemStatus" ORDER BY "createdAt" DESC');
        return res.json(result.rows);
      } else {
        return res.json(mockItemStatus);
      }
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/item-status", async (req, res, next) => {
    try {
      const { lpn, status, recoveryType } = req.body;
      const result = await syncItemStatusToRecoveryFlow(lpn, status, recoveryType);
      if (!result.success) {
        if (result.errorType === "RelationalMappingFailed") {
          return res.status(404).json({ status: "Error", message: result.message });
        }
        return res.status(400).json({ status: "Error", message: result.message });
      }
      return res.json({ status: "Success", message: result.message });
    } catch (err) {
      next(err);
    }
  });
  app.get("/api/return-item", async (req, res, next) => {
    try {
      const pool2 = getDbPool();
      if (pool2) {
        const result = await pool2.query('SELECT * FROM "ReturnItem"');
        return res.json(result.rows);
      } else {
        return res.json(mockReturnItems);
      }
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/return-item", async (req, res, next) => {
    try {
      const { lpn, sku } = req.body;
      if (!lpn || !sku) {
        return res.status(400).json({ status: "Error", message: "Missing lpn or sku" });
      }
      const pool2 = getDbPool();
      if (pool2) {
        await pool2.query('INSERT INTO "ReturnItem" (lpn, sku) VALUES ($1, $2) ON CONFLICT (lpn) DO UPDATE SET sku = EXCLUDED.sku', [lpn.trim(), sku.trim()]);
      } else {
        const idx = mockReturnItems.findIndex((item) => item.lpn.toLowerCase() === lpn.trim().toLowerCase());
        if (idx !== -1) {
          mockReturnItems[idx].sku = sku.trim();
        } else {
          mockReturnItems.push({ lpn: lpn.trim(), sku: sku.trim() });
        }
      }
      return res.json({ status: "Success", message: "Successfully added ReturnItem lookup record." });
    } catch (err) {
      next(err);
    }
  });
  app.get("/api/recovery/query", async (req, res, next) => {
    try {
      const search = (req.query.search || "").trim();
      if (!search) {
        return res.status(400).json({ status: "Error", message: "Missing search identifier" });
      }
      const pool2 = getDbPool();
      let foundItem = null;
      if (pool2) {
        let activeReturnsTable = "AMZ_customer_returns";
        try {
          const tableCheck = await pool2.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND LOWER(table_name) IN ('amz_customer_returns', 'amz_customer_return')
            LIMIT 1
          `);
          if (tableCheck.rows.length > 0) {
            activeReturnsTable = tableCheck.rows[0].table_name;
          }
        } catch (e) {
          console.warn("Table schema check failed:", e.message);
        }
        const candidateLpns = /* @__PURE__ */ new Set();
        candidateLpns.add(search.toLowerCase());
        try {
          const retItemRes = await pool2.query('SELECT lpn FROM "ReturnItem" WHERE LOWER(sku) = LOWER($1)', [search]);
          for (const r of retItemRes.rows) {
            if (r.lpn) candidateLpns.add(r.lpn.toLowerCase());
          }
        } catch (e) {
        }
        try {
          const returnsCheck = await pool2.query(`
            SELECT "license-plate-number" AS lpn FROM "${activeReturnsTable}" 
            WHERE LOWER(sku) = LOWER($1)
          `, [search]);
          for (const r of returnsCheck.rows) {
            if (r.lpn) candidateLpns.add(r.lpn.toLowerCase());
          }
        } catch (e) {
        }
        try {
          const viewCheck = await pool2.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'claims_all'
            UNION ALL
            SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'claims_all'
          `);
          if (viewCheck.rows.length > 0) {
            const claimsRes = await pool2.query('SELECT lpn FROM "claims_all" WHERE LOWER(sku) = LOWER($1)', [search]);
            for (const r of claimsRes.rows) {
              if (r.lpn) candidateLpns.add(r.lpn.toLowerCase());
            }
          }
        } catch (e) {
        }
        const candidateList = Array.from(candidateLpns);
        const lookupRes = await pool2.query(`
          SELECT i.lpn, i.status, i."recoveryType"
          FROM "ItemStatus" i
          WHERE LOWER(i.lpn) = ANY($1) AND LOWER(i.status) = 'recovery'
          LIMIT 1
        `, [candidateList]);
        if (lookupRes.rows.length > 0) {
          const itemStatusRow = lookupRes.rows[0];
          const lpn = itemStatusRow.lpn;
          let rawRecoveryType = itemStatusRow.recoveryType || "Barcode Damaged";
          if (rawRecoveryType.toLowerCase().includes("barcode")) {
            rawRecoveryType = "Barcode Damaged";
          } else if (rawRecoveryType.toLowerCase().includes("box") || rawRecoveryType.toLowerCase().includes("packaging")) {
            rawRecoveryType = "Packaging Damaged";
          }
          let sku = "";
          try {
            const returnsCheck = await pool2.query(`
              SELECT sku FROM "${activeReturnsTable}" 
              WHERE LOWER("license-plate-number") = LOWER($1) 
              LIMIT 1
            `, [lpn]);
            if (returnsCheck.rows.length > 0) {
              sku = returnsCheck.rows[0].sku;
            }
          } catch (e) {
            console.log(`Could not query ${activeReturnsTable} directly:`, e.message);
          }
          if (!sku) {
            try {
              const retItemRes = await pool2.query('SELECT sku FROM "ReturnItem" WHERE LOWER(lpn) = LOWER($1) LIMIT 1', [lpn]);
              if (retItemRes.rows.length > 0) {
                sku = retItemRes.rows[0].sku;
              }
            } catch (e) {
            }
          }
          if (!sku) {
            try {
              const viewCheck = await pool2.query(`
                SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'claims_all'
                UNION ALL
                SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'claims_all'
              `);
              if (viewCheck.rows.length > 0) {
                const claimsRes = await pool2.query('SELECT sku FROM "claims_all" WHERE LOWER(lpn) = LOWER($1) LIMIT 1', [lpn]);
                if (claimsRes.rows.length > 0) {
                  sku = claimsRes.rows[0].sku;
                }
              }
            } catch (e) {
            }
          }
          if (!sku) {
            sku = "UNKNOWN";
          }
          await pool2.query(`
            INSERT INTO "sample_recovery" (lpn, sku, damage_type, "isRefurbished", status)
            VALUES ($1, $2, $3, false, 'recovery')
            ON CONFLICT (lpn) 
            DO UPDATE SET 
              sku = EXCLUDED.sku,
              damage_type = EXCLUDED.damage_type,
              status = 'recovery'
          `, [lpn, sku, rawRecoveryType]);
          const syncedRes = await pool2.query('SELECT * FROM "sample_recovery" WHERE LOWER(lpn) = LOWER($1) LIMIT 1', [lpn]);
          if (syncedRes.rows.length > 0) {
            foundItem = toCamelCase(syncedRes.rows[0]);
          }
        } else {
          const fallbackRes = await pool2.query('SELECT * FROM "sample_recovery" WHERE LOWER(lpn) = LOWER($1) OR LOWER(sku) = LOWER($1) LIMIT 1', [search]);
          if (fallbackRes.rows.length > 0) {
            foundItem = toCamelCase(fallbackRes.rows[0]);
          }
        }
      } else {
        const mockIs = mockItemStatus.find(
          (i) => (i.lpn.toLowerCase() === search.toLowerCase() || mockReturnItems.find((r) => r.lpn === i.lpn && r.sku.toLowerCase() === search.toLowerCase())) && i.status.toLowerCase() === "recovery"
        );
        if (mockIs) {
          const lpn = mockIs.lpn;
          let rawRecoveryType = mockIs.recoveryType || "Barcode Damaged";
          if (rawRecoveryType.toLowerCase().includes("barcode")) {
            rawRecoveryType = "Barcode Damaged";
          } else if (rawRecoveryType.toLowerCase().includes("box") || rawRecoveryType.toLowerCase().includes("packaging")) {
            rawRecoveryType = "Packaging Damaged";
          }
          const returnItem = mockReturnItems.find((r) => r.lpn.toLowerCase() === lpn.toLowerCase());
          const sku = returnItem ? returnItem.sku : "UNKNOWN";
          const existingIdx = mockSampleRecovery.findIndex((s) => s.lpn.toLowerCase() === lpn.toLowerCase());
          const syncedRecord = {
            lpn,
            sku,
            damage_type: rawRecoveryType,
            is_refurbished: false,
            status: "recovery"
          };
          if (existingIdx !== -1) {
            mockSampleRecovery[existingIdx] = syncedRecord;
          } else {
            mockSampleRecovery.push(syncedRecord);
          }
          foundItem = {
            lpn: syncedRecord.lpn,
            sku: syncedRecord.sku,
            damageType: syncedRecord.damage_type,
            isRefurbished: syncedRecord.is_refurbished,
            status: syncedRecord.status
          };
        } else {
          const existingRecord = mockSampleRecovery.find((s) => s.lpn.toLowerCase() === search.toLowerCase() || s.sku.toLowerCase() === search.toLowerCase());
          if (existingRecord) {
            foundItem = {
              lpn: existingRecord.lpn,
              sku: existingRecord.sku,
              damageType: existingRecord.damage_type,
              isRefurbished: existingRecord.is_refurbished,
              status: existingRecord.status
            };
          }
        }
      }
      if (foundItem) {
        return res.json(foundItem);
      }
      return res.status(404).json({ status: "Error", message: "Item not found or status is not 'recovery' inside tracking inventory." });
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/recovery/update", async (req, res, next) => {
    try {
      const { lpn, sku, damageType, isRefurbished, status } = req.body;
      if (!lpn) {
        return res.status(400).json({ status: "Error", message: "Missing LPN identifier" });
      }
      const damage_type = damageType || "Barcode Damaged";
      const is_refurbished = !!isRefurbished;
      const recordStatus = status || "recovered";
      const pool2 = getDbPool();
      if (pool2) {
        await pool2.query(`
          UPDATE "sample_recovery"
          SET "isRefurbished" = $2, status = $3
          WHERE LOWER(lpn) = LOWER($1)
        `, [lpn, is_refurbished, recordStatus]);
        await pool2.query(`
          UPDATE "ItemStatus"
          SET status = $2
          WHERE LOWER(lpn) = LOWER($1)
        `, [lpn, recordStatus]);
        console.log(`[DB] Two-way status update synced successfully to 'sample_recovery' and 'ItemStatus' for ${lpn}`);
      } else {
        const idx = mockSampleRecovery.findIndex((item) => item.lpn.toLowerCase() === lpn.toLowerCase());
        if (idx !== -1) {
          mockSampleRecovery[idx].is_refurbished = is_refurbished;
          mockSampleRecovery[idx].status = recordStatus;
        } else {
          mockSampleRecovery.push({
            lpn,
            sku: sku || "UNKNOWN",
            damage_type,
            is_refurbished,
            status: recordStatus
          });
        }
        const isIdx = mockItemStatus.findIndex((item) => item.lpn.toLowerCase() === lpn.toLowerCase());
        if (isIdx !== -1) {
          mockItemStatus[isIdx].status = recordStatus;
        } else {
          mockItemStatus.push({ lpn, status: recordStatus });
        }
      }
      return res.json({ status: "Success", message: "Item successfully updated with two-way status sync." });
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/recovery/reconcile-check", async (req, res, next) => {
    try {
      const { scannedLpns } = req.body;
      const activeLpns = (scannedLpns || []).map((l) => l.toLowerCase());
      const pool2 = getDbPool();
      let expectedItems = [];
      if (pool2) {
        const result = await pool2.query(`SELECT lpn FROM "ItemStatus" WHERE LOWER(status) = 'recovery'`);
        expectedItems = result.rows.map((r) => r.lpn);
      } else {
        expectedItems = mockItemStatus.filter((i) => i.status.toLowerCase() === "recovery").map((i) => i.lpn);
      }
      const unscannedItems = expectedItems.filter((lpn) => !activeLpns.includes(lpn.toLowerCase()));
      return res.json({
        unscannedCount: unscannedItems.length,
        unscannedLpns: unscannedItems
      });
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/recovery/reconcile-finalize", async (req, res, next) => {
    try {
      const { scannedLpns } = req.body;
      const activeLpns = (scannedLpns || []).map((l) => l.toLowerCase());
      const pool2 = getDbPool();
      let updatedCount = 0;
      if (pool2) {
        const result = await pool2.query(`SELECT lpn FROM "ItemStatus" WHERE LOWER(status) = 'recovery'`);
        const expectedItems = result.rows.map((r) => r.lpn);
        const unscanned = expectedItems.filter((lpn) => !activeLpns.includes(lpn.toLowerCase()));
        if (unscanned.length > 0) {
          await pool2.query(
            `UPDATE "ItemStatus" SET status = 'missing at recovery' WHERE LOWER(lpn) = ANY($1)`,
            [unscanned.map((l) => l.toLowerCase())]
          );
          updatedCount = unscanned.length;
        }
      } else {
        const expectedItems = mockItemStatus.filter((i) => i.status.toLowerCase() === "recovery").map((i) => i.lpn);
        const unscanned = expectedItems.filter((lpn) => !activeLpns.includes(lpn.toLowerCase()));
        unscanned.forEach((lpn) => {
          const idx = mockItemStatus.findIndex((i) => i.lpn.toLowerCase() === lpn.toLowerCase());
          if (idx !== -1) {
            mockItemStatus[idx].status = "missing at recovery";
          }
        });
        updatedCount = unscanned.length;
      }
      return res.json({
        status: "Success",
        message: `Successfully set ${updatedCount} unscanned items to 'missing at recovery'.`,
        updatedCount
      });
    } catch (err) {
      next(err);
    }
  });
  app.get("/api/claims", async (req, res, next) => {
    try {
      const pool2 = getDbPool();
      let rawRows = [];
      if (pool2) {
        let evidenceOrderIds = /* @__PURE__ */ new Set();
        let evidenceLpns = /* @__PURE__ */ new Set();
        try {
          const evidenceRes = await pool2.query('SELECT DISTINCT "orderId", "lpn" FROM "Evidence"');
          evidenceRes.rows.forEach((r) => {
            if (r.orderId) evidenceOrderIds.add(String(r.orderId).trim().toLowerCase());
            if (r.lpn) evidenceLpns.add(String(r.lpn).trim().toLowerCase());
          });
        } catch (e) {
          console.warn('[DB WARNING] Could not query "Evidence" table matching identifiers:', e.message);
        }
        try {
          const result = await pool2.query(`
            SELECT c.*, s.status AS db_status, s."claimId" AS db_claim_id, s.bot_log_reason 
            FROM "claims_all" c 
            LEFT JOIN "claims_status" s ON c."orderId" = s."orderId"
          `);
          rawRows = result.rows;
        } catch (error) {
          console.log(`SQL error with "claims_all" table: ${error.message}. Retrying with fallback tables...`);
          try {
            const fallbackResult = await pool2.query("SELECT * FROM claims");
            rawRows = fallbackResult.rows;
          } catch (innerError) {
            try {
              const innerFallbackResult = await pool2.query('SELECT * FROM "Claims"');
              rawRows = innerFallbackResult.rows;
            } catch (deepError) {
              console.error("Database fetch failure - using mock data fallback.");
              rawRows = [...mockClaims];
            }
          }
        }
        rawRows = rawRows.filter((row) => {
          const oId = (row.orderId || row.orderid || "").trim().toLowerCase();
          const lpn = (row.lpn || "").trim().toLowerCase();
          return oId && evidenceOrderIds.has(oId) || lpn && evidenceLpns.has(lpn);
        });
      } else {
        rawRows = [...mockClaims];
      }
      const now = Date.now();
      const processedMap = {};
      rawRows.forEach((row) => {
        const data = toCamelCase(row);
        if (data.dbStatus) {
          data.status = data.dbStatus;
        }
        if (data.dbClaimId) {
          data.claimId = data.dbClaimId;
        }
        if (row.bot_log_reason) {
          data.botLogReason = row.bot_log_reason;
        }
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
        const rowQty = typeof data.qty === "number" ? data.qty : 1;
        if (!processedMap[key]) {
          processedMap[key] = {
            ...data,
            qty: rowQty,
            items: [data]
          };
        } else {
          processedMap[key].qty += rowQty;
          processedMap[key].items.push(data);
        }
      });
      res.json(Object.values(processedMap));
    } catch (err) {
      next(err);
    }
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
  app.get("/api/bot/logs/:id", (req, res) => {
    const { id } = req.params;
    const logPath = import_path3.default.join(process.cwd(), "bot_logs", `${id}.log`);
    if (import_fs3.default.existsSync(logPath)) {
      const logs = import_fs3.default.readFileSync(logPath, "utf-8").split("\n").filter(Boolean);
      res.json({ logs });
    } else {
      res.json({ logs: ["No logs found for this task."] });
    }
  });
  app.get("/api/bot/live-view", (req, res) => {
    const screenshotPath = import_path3.default.join(process.cwd(), "bot_state", "live.png");
    if (import_fs3.default.existsSync(screenshotPath)) {
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
        const tables = ['"claims_all"'];
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
          if (columns.includes("claimid")) searchTerms.push('"claimId" ILIKE $1');
          if (columns.includes("orderid")) searchTerms.push('"orderId" ILIKE $1');
          if (columns.includes("trackingid")) searchTerms.push('"trackingId" ILIKE $1');
          if (columns.includes("claim_id")) searchTerms.push("claim_id ILIKE $1");
          if (columns.includes("order_id")) searchTerms.push("order_id ILIKE $1");
          if (columns.includes("tracking_id")) searchTerms.push("tracking_id ILIKE $1");
          if (searchTerms.length === 0) continue;
          const query = `
            SELECT * FROM ${table} 
            WHERE (${searchTerms.join(" OR ")})
              AND (LOWER(channel) IN ('amazon b2b', 'amz b2c', 'amazon b2c'))
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
    if (claimData && claimData.channel) {
      const channelLower = claimData.channel.toLowerCase();
      const allowedChannels = ["amazon b2b", "amz b2c", "amazon b2c"];
      if (!allowedChannels.includes(channelLower)) {
        return res.status(400).json({
          status: "Error",
          message: `The background automated bot cannot process Shopify channels. Automation is restricted strictly to Amazon channels ('Amazon B2B', 'AMZ/B2c', or 'amazon b2c').`
        });
      }
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
      if (result.success) {
        const db = getDbPool();
        if (db) {
          db.query(
            `INSERT INTO "claims_status" ("orderId", "trackingId", "claimId", status)
             VALUES ($1, $2, $3, 'Claimed')
             ON CONFLICT ("orderId") 
             DO UPDATE SET 
               status = 'Claimed', 
               "claimId" = COALESCE(NULLIF(EXCLUDED."claimId", ''), "claims_status"."claimId", ''), 
               "trackingId" = COALESCE("claims_status"."trackingId", EXCLUDED."trackingId")`,
            [claimData.orderId || "", claimData.trackingId || "", result.caseId || ""]
          ).then(() => {
            console.log(`[DB SUCCESS] Recorded claimed status in claims_status for Order ID: ${claimData.orderId}`);
          }).catch((dbErr) => {
            console.error(`[DB ERROR] Failed to record status in claims_status:`, dbErr);
          });
          db.query(
            `UPDATE "claims_all" SET status = 'Claimed' WHERE lpn = $1 OR "orderId" = $2`,
            [claimData.lpn || "", claimData.orderId || ""]
          ).catch(() => {
          });
          handleEvidenceTypeClaimedUpdate(db, claimData.orderId, "Claimed");
        }
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
  app.get("/api/qc/sku-status", async (req, res, next) => {
    try {
      const db = getDbPool();
      let rows = [];
      if (db) {
        const targetsRes = await db.query(`
          WITH expected_items AS (
            -- ItemStatus 'good' or 'recovered'
            SELECT r.sku, i.lpn AS item_id
            FROM "ItemStatus" i
            JOIN "ReturnItem" r ON i.lpn = r.lpn
            WHERE i.status = 'good' OR i.status = 'recovered'
            
            UNION ALL
            
            -- claims_status 'rejected'
            SELECT c.sku, s."orderId" AS item_id
            FROM "claims_status" s
            JOIN "claims_all" c ON s."orderId" = c."orderId"
            WHERE s.status = 'rejected'
          )
          SELECT sku, COUNT(*)::int as target_count
          FROM expected_items
          GROUP BY sku
        `);
        await db.query(`UPDATE "qc_status" SET target_count = 0`);
        for (const row of targetsRes.rows) {
          await db.query(`
            INSERT INTO "qc_status" (sku, target_count, quantity_count, status)
            VALUES ($1, $2, 0, 'unscanned')
            ON CONFLICT (sku) 
            DO UPDATE SET target_count = EXCLUDED.target_count
          `, [row.sku, row.target_count]);
        }
        const query = `
          SELECT 
            sku,
            target_count as expected_count,
            target_count,
            quantity_count,
            COALESCE(status, 'unscanned') as status,
            EXISTS (
              SELECT 1 
              FROM "ItemStatus" i 
              JOIN "ReturnItem" r2 ON i.lpn = r2.lpn
              WHERE r2.sku = "qc_status".sku AND LOWER(i.status) = 'damaged'
            ) as has_hidden_damaged
          FROM "qc_status"
          WHERE target_count > 0
        `;
        const result = await db.query(query);
        rows = result.rows;
      } else {
        const computedTargets = {};
        mockItemStatus.forEach((i) => {
          if (i.status === "good" || i.status === "recovered") {
            const rit = mockReturnItems.find((r) => r.lpn === i.lpn);
            const sku = rit ? rit.sku : "UNKNOWN";
            if (sku && sku !== "UNKNOWN") {
              computedTargets[sku] = (computedTargets[sku] || 0) + 1;
            }
          }
        });
        mockClaims.forEach((c) => {
          if (c.status === "rejected" || c.status?.toLowerCase() === "rejected") {
            const sku = c.sku;
            if (sku) {
              computedTargets[sku] = (computedTargets[sku] || 0) + 1;
            }
          }
        });
        Object.entries(computedTargets).forEach(([sku, targetCount]) => {
          let item = mockQcStatus.find((q) => q.sku === sku);
          if (!item) {
            item = { sku, quantity_count: 0, status: "unscanned", target_count: targetCount };
            mockQcStatus.push(item);
          } else {
            item.target_count = targetCount;
          }
        });
        mockQcStatus.forEach((item) => {
          if (!computedTargets[item.sku]) {
            item.target_count = 0;
          }
        });
        rows = mockQcStatus.filter((q) => (q.target_count || 0) > 0).map((q) => {
          const matchingLpns = mockReturnItems.filter((r) => r.sku === q.sku).map((r) => r.lpn);
          const has_hidden_damaged = mockItemStatus.some((i) => matchingLpns.includes(i.lpn) && i.status.toLowerCase() === "damaged");
          return {
            sku: q.sku,
            quantity_count: q.quantity_count || 0,
            status: q.status || "unscanned",
            expected_count: q.target_count,
            target_count: q.target_count,
            has_hidden_damaged
          };
        });
      }
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/qc/scan", async (req, res, next) => {
    try {
      const { sku } = req.body;
      const db = getDbPool();
      let quantityCount = 1;
      let dbStatus = "ok";
      let expectedCount = 1;
      let hasHiddenDamaged = false;
      if (db) {
        const poolCheckRes = await db.query(`
          SELECT target_count, quantity_count, status FROM "qc_status" WHERE sku = $1
        `, [sku]);
        if (poolCheckRes.rows.length === 0 || poolCheckRes.rows[0].target_count === 0) {
          return res.status(404).json({
            message: `SKU ${sku} is not part of the active expected QC audit pool.`
          });
        }
        expectedCount = poolCheckRes.rows[0].target_count;
        quantityCount = poolCheckRes.rows[0].quantity_count + 1;
        if (quantityCount < expectedCount) {
          dbStatus = "quantity missing";
        } else {
          dbStatus = "ok";
        }
        await db.query(`
          UPDATE "qc_status" 
          SET quantity_count = $1, status = $2 
          WHERE sku = $3
        `, [quantityCount, dbStatus, sku]);
        const damagedRes = await db.query(`
          SELECT EXISTS (
            SELECT 1 
            FROM "ItemStatus" i 
            JOIN "ReturnItem" r ON i.lpn = r.lpn 
            WHERE r.sku = $1 AND LOWER(i.status) = 'damaged'
          ) as has_damaged
        `, [sku]);
        hasHiddenDamaged = damagedRes.rows[0].has_damaged;
      } else {
        let item = mockQcStatus.find((q) => q.sku === sku);
        if (!item || (item.target_count || 0) === 0) {
          return res.status(404).json({
            message: `SKU ${sku} is not part of the active expected QC audit pool.`
          });
        }
        item.quantity_count = (item.quantity_count || 0) + 1;
        quantityCount = item.quantity_count;
        expectedCount = item.target_count;
        if (quantityCount < expectedCount) {
          item.status = "quantity missing";
        } else {
          item.status = "ok";
        }
        dbStatus = item.status;
        const matchingLpns = mockReturnItems.filter((r) => r.sku === sku).map((r) => r.lpn);
        hasHiddenDamaged = mockItemStatus.some((i) => matchingLpns.includes(i.lpn) && i.status.toLowerCase() === "damaged");
      }
      res.json({
        status: "Success",
        sku,
        quantity_count: quantityCount,
        expected_count: expectedCount,
        target_count: expectedCount,
        qc_status: dbStatus,
        has_hidden_damaged: hasHiddenDamaged
      });
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/qc/sku-damaged", async (req, res, next) => {
    try {
      const { sku } = req.body;
      const db = getDbPool();
      if (db) {
        await db.query(`
          INSERT INTO "qc_status" (sku, target_count, quantity_count, status)
          VALUES ($1, 0, 0, 'requires review at qc')
          ON CONFLICT (sku)
          DO UPDATE SET status = 'requires review at qc'
        `, [sku]);
        const lpnsRes = await db.query(`SELECT lpn FROM "ReturnItem" WHERE sku = $1`, [sku]);
        for (const row of lpnsRes.rows) {
          await db.query(`
            INSERT INTO "ItemStatus" (lpn, status)
            VALUES ($1, 'requires review at qc')
            ON CONFLICT (lpn)
            DO UPDATE SET status = 'requires review at qc'
          `, [row.lpn]);
        }
      } else {
        let item = mockQcStatus.find((q) => q.sku === sku);
        if (!item) {
          item = { sku, quantity_count: 0, target_count: 0, status: "requires review at qc" };
          mockQcStatus.push(item);
        } else {
          item.status = "requires review at qc";
        }
        const matchingLpns = mockReturnItems.filter((r) => r.sku === sku).map((r) => r.lpn);
        matchingLpns.forEach((lpn) => {
          let statusItem = mockItemStatus.find((i) => i.lpn === lpn);
          if (statusItem) {
            statusItem.status = "requires review at qc";
          } else {
            mockItemStatus.push({ lpn, status: "requires review at qc" });
          }
        });
      }
      res.json({ status: "Success", message: `SKU ${sku} marked as damaged (requires review at QC)` });
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/qc/handover-complete", async (req, res, next) => {
    try {
      const { bypassWarning } = req.body;
      const db = getDbPool();
      let poolItems = [];
      if (db) {
        const skuRes = await db.query(`
          SELECT sku, target_count, quantity_count FROM "qc_status" WHERE target_count > 0
        `);
        poolItems = skuRes.rows;
      } else {
        poolItems = mockQcStatus.filter((q) => (q.target_count || 0) > 0);
      }
      let totalMissing = 0;
      poolItems.forEach((item) => {
        const diff = item.target_count - item.quantity_count;
        if (diff > 0) {
          totalMissing += diff;
        }
      });
      if (totalMissing > 0 && !bypassWarning) {
        return res.json({
          status: "Warning",
          totalMissing,
          message: `There are ${totalMissing} products left missing compared to the expected target. Are you sure you want to proceed?`
        });
      }
      if (db) {
        for (const item of poolItems) {
          if (item.quantity_count < item.target_count) {
            await db.query(`
              UPDATE "qc_status" SET status = 'missing at qc' WHERE sku = $1
            `, [item.sku]);
            const lpnsRes = await db.query(`
              SELECT i.lpn 
              FROM "ItemStatus" i
              JOIN "ReturnItem" r ON i.lpn = r.lpn
              WHERE r.sku = $1 AND (i.status = 'good' OR i.status = 'recovered')
            `, [item.sku]);
            for (const row of lpnsRes.rows) {
              await db.query(`
                UPDATE "ItemStatus" SET status = 'missing at qc' WHERE lpn = $1
              `, [row.lpn]);
            }
          } else {
            await db.query(`
              UPDATE "qc_status" SET status = 'ready for Inventory' WHERE sku = $1
            `, [item.sku]);
            const lpnsRes = await db.query(`
              SELECT i.lpn 
              FROM "ItemStatus" i
              JOIN "ReturnItem" r ON i.lpn = r.lpn
              WHERE r.sku = $1 AND (i.status = 'good' OR i.status = 'recovered')
            `, [item.sku]);
            for (const row of lpnsRes.rows) {
              await db.query(`
                UPDATE "ItemStatus" SET status = 'ready for Inventory' WHERE lpn = $1
              `, [row.lpn]);
            }
          }
        }
      } else {
        poolItems.forEach((item) => {
          let mockQc = mockQcStatus.find((q) => q.sku === item.sku);
          if (item.quantity_count < item.target_count) {
            if (mockQc) mockQc.status = "missing at qc";
            mockReturnItems.forEach((ri) => {
              if (ri.sku === item.sku) {
                let statusItem = mockItemStatus.find((ms) => ms.lpn === ri.lpn);
                if (statusItem && (statusItem.status === "good" || statusItem.status === "recovered")) {
                  statusItem.status = "missing at qc";
                }
              }
            });
          } else {
            if (mockQc) mockQc.status = "ready for Inventory";
            mockReturnItems.forEach((ri) => {
              if (ri.sku === item.sku) {
                let statusItem = mockItemStatus.find((ms) => ms.lpn === ri.lpn);
                if (statusItem && (statusItem.status === "good" || statusItem.status === "recovered")) {
                  statusItem.status = "ready for Inventory";
                }
              }
            });
          }
        });
      }
      res.json({
        status: "Success",
        message: "Handover successfully reconciled and completed."
      });
    } catch (err) {
      next(err);
    }
  });
  app.get("/api/qc/recovered-items", async (req, res, next) => {
    try {
      const db = getDbPool();
      let rows = [];
      if (db) {
        const query = `
          SELECT 
            i.lpn, 
            COALESCE(r.sku, 'UNKNOWN') as sku, 
            i.status as item_status, 
            COALESCE(s."isRefurbished", false) as is_refurbished,
            COALESCE(s.damage_type, 'Repackaging Check') as damage_type
          FROM "ItemStatus" i
          LEFT JOIN "ReturnItem" r ON i.lpn = r.lpn
          LEFT JOIN "sample_recovery" s ON i.lpn = s.lpn
          WHERE i.status = 'recovered' OR i.status = 'requires recovery review'
        `;
        const result = await db.query(query);
        rows = result.rows;
      } else {
        rows = mockItemStatus.filter((i) => i.status === "recovered" || i.status === "requires recovery review").map((i) => {
          const returnItem = mockReturnItems.find((r) => r.lpn === i.lpn);
          const sampleRec = mockSampleRecovery.find((s) => s.lpn === i.lpn);
          return {
            lpn: i.lpn,
            sku: returnItem ? returnItem.sku : "UNKNOWN",
            item_status: i.status,
            is_refurbished: sampleRec ? sampleRec.is_refurbished : true,
            damage_type: sampleRec ? sampleRec.damage_type : "DENTED BOX"
          };
        });
      }
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/qc/recovery-review", async (req, res, next) => {
    try {
      const { lpn } = req.body;
      const db = getDbPool();
      let sku = "UNKNOWN";
      if (db) {
        const skuRes = await db.query(`SELECT sku FROM "ReturnItem" WHERE lpn = $1`, [lpn]);
        if (skuRes.rows.length > 0) {
          sku = skuRes.rows[0].sku;
        }
        await db.query(`
          INSERT INTO "ItemStatus" (lpn, status)
          VALUES ($1, 'requires recovery review')
          ON CONFLICT (lpn)
          DO UPDATE SET status = 'requires recovery review'
        `, [lpn]);
        if (sku && sku !== "UNKNOWN") {
          await db.query(`
            INSERT INTO "qc_status" (sku, quantity_count, status)
            VALUES ($1, 1, 'requires recovery review')
            ON CONFLICT (sku)
            DO UPDATE SET status = 'requires recovery review'
          `, [sku]);
        }
      } else {
        const item = mockItemStatus.find((i) => i.lpn === lpn);
        if (item) {
          item.status = "requires recovery review";
        } else {
          mockItemStatus.push({ lpn, status: "requires recovery review" });
        }
        const returnItem = mockReturnItems.find((r) => r.lpn === lpn);
        sku = returnItem ? returnItem.sku : "UNKNOWN";
        if (sku && sku !== "UNKNOWN") {
          let qcs = mockQcStatus.find((q) => q.sku === sku);
          if (!qcs) {
            mockQcStatus.push({ sku, quantity_count: 1, status: "requires recovery review" });
          } else {
            qcs.status = "requires recovery review";
          }
        }
      }
      res.json({ status: "Success", sku, lpn, message: "Successfully updated to requires recovery review" });
    } catch (err) {
      next(err);
    }
  });
  app.get("/api/qc/rejected-claims", async (req, res, next) => {
    try {
      const db = getDbPool();
      let rows = [];
      if (db) {
        const query = `
          SELECT 
            c.*, 
            s.status AS claims_status_status, 
            s.bot_log_reason,
            COALESCE(c."driveLink", 'https://drive.google.com/embeddedfolderview?id=1xyz') as "driveLink"
          FROM "claims_all" c
          JOIN "claims_status" s ON c."orderId" = s."orderId"
          WHERE s.status = 'rejected' OR c.status = 'rejected'
        `;
        const result = await db.query(query);
        rows = result.rows.map(toCamelCase);
      } else {
        const rejectedClaimsFromMock = mockClaims.filter((c) => c.status === "rejected" || c.status?.toLowerCase() === "rejected");
        if (rejectedClaimsFromMock.length === 0) {
          rows = [
            {
              orderId: "114-1234567-1234567",
              trackingId: "1Z999AA10123456784",
              sku: "1120200",
              fnsku: "X0018CDFL4",
              productName: "Premium Wireless Keyboard K950",
              channel: "AMZ B2C",
              status: "rejected",
              type: "RejectedDelivery",
              driveLink: "https://www.wikipedia.org",
              botLogReason: "Amazon Rejected: Package returned but LPN was damaged. Verification required."
            },
            {
              orderId: "702-9876543-9876543",
              trackingId: "3Z999AA10123450000",
              sku: "4829102",
              fnsku: "X0018CDF88",
              productName: "Mechanical Gaming Mouse G502",
              channel: "Amazon B2B",
              status: "rejected",
              type: "Damaged",
              driveLink: "https://www.wikipedia.org",
              botLogReason: "Evidence photos uploaded but Safe-T claim was denied. Reason: inadequate retail box pictures."
            }
          ];
        } else {
          rows = rejectedClaimsFromMock.map((c) => ({
            ...c,
            driveLink: c.driveLink || "https://www.wikipedia.org",
            botLogReason: c.botLogReason || "Rejected: Evidence photos mismatch"
          }));
        }
      }
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/qc/claims/update-status", async (req, res, next) => {
    try {
      const { orderId, status } = req.body;
      const db = getDbPool();
      if (db) {
        await db.query(`
          INSERT INTO "claims_status" ("orderId", status)
          VALUES ($1, $2)
          ON CONFLICT ("orderId")
          DO UPDATE SET status = $2
        `, [orderId, status]);
        try {
          await db.query(`UPDATE "claims_all" SET status = $1 WHERE "orderId" = $2`, [status, orderId]);
        } catch (e) {
        }
        await handleEvidenceTypeClaimedUpdate(db, orderId, status);
      } else {
        const item = mockClaims.find((c) => c.orderId === orderId);
        if (item) {
          item.status = status;
        }
      }
      res.json({ status: "Success", message: `Status updated to ${status}` });
    } catch (err) {
      next(err);
    }
  });
  app.use("/api/*", (req, res) => {
    res.status(404).json({
      status: "Error",
      message: `API Route not found: ${req.originalUrl}`
    });
  });
  app.use((err, req, res, next) => {
    if (req.path.startsWith("/api")) {
      console.error("API Error:", err);
      return res.status(500).json({
        status: "Error",
        message: err.message || "Internal Server Error"
      });
    }
    next(err);
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
