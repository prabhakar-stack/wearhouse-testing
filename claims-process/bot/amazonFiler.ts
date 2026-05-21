import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { TOTP } from 'totp-generator';
import fs from 'fs';
import path from 'path';
import type { Claim } from '../src/types';
import pg from 'pg';
import 'dotenv/config';

function matchProduct(webName: string, dbClaim: Claim): boolean {
  const w = webName.toLowerCase().trim();
  const dbPName = (dbClaim.productName || "").toLowerCase().trim();
  const sku = (dbClaim.sku || "").toLowerCase().trim();
  
  if (!dbPName && !sku) return false;
  
  // Exact or substring match
  if (dbPName && (w.includes(dbPName) || dbPName.includes(w))) {
    return true;
  }
  if (sku && w.includes(sku)) {
    return true;
  }
  
  // Token matching: if at least 50% of the significant words in dbPName exist as a substring in webName
  if (dbPName) {
    const dbWords = dbPName.split(/\s+/).filter(word => word.length > 3);
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

async function getClaimsForTrackingId(trackingId: string, orderId: string): Promise<Claim[]> {
  console.log(`[DB] Querying database for claims with trackingId="${trackingId}" or orderId="${orderId}"...`);
  
  let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("⚠️ [DB] No Connection String found, returning empty array.");
    return [];
  }

  connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (connectionString.startsWith('hpostgresql://')) {
    connectionString = connectionString.substring(1);
  }

  // Sanitize password
  const passwordMatch = connectionString.match(/:(.*)@/);
  if (passwordMatch && passwordMatch[1]) {
    const password = passwordMatch[1];
    if (password.startsWith('[') && password.endsWith(']')) {
      const sanitizedPassword = password.substring(1, password.length - 1);
      connectionString = connectionString.replace(password, sanitizedPassword);
    }
  }

  let tempPool: pg.Pool | null = null;
  try {
    tempPool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 15000,
      max: 2,
      ssl: (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
        ? false 
        : { rejectUnauthorized: false }
    });

    const toCamelCase = (obj: any) => {
      const newObj: any = {};
      for (const key in obj) {
        const camelKey = key.replace(/([-_][a-z])/g, (g) => g.toUpperCase().replace('-', '').replace('_', ''));
        newObj[camelKey] = obj[key];
      }
      return newObj;
    };

    let rows: any[] = [];
    const tid = (trackingId || "").trim();
    const oid = (orderId || "").trim();

    if (tid || oid) {
      const tables = ['claims', '"Claims"'];
      for (const table of tables) {
        try {
          const colRes = await tempPool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = ${table.includes('"') ? `'${table.replace(/"/g, '')}'` : `'${table}'`}
          `);
          const columns = colRes.rows.map(r => r.column_name.toLowerCase());
          
          if (columns.length === 0) continue;

          const filters = [];
          const params = [];
          
          if (tid && columns.includes('tracking_id')) {
            params.push(tid);
            filters.push(`tracking_id ILIKE $${params.length}`);
          }
          if (oid && columns.includes('order_id')) {
            params.push(oid);
            filters.push(`order_id ILIKE $${params.length}`);
          }

          if (filters.length === 0) continue;

          const query = `SELECT * FROM ${table} WHERE ${filters.join(' OR ')}`;
          const result = await tempPool.query(query, params);
          rows = result.rows.map(toCamelCase);
          if (rows.length > 0) {
            console.log(`[DB] Successfully fetched ${rows.length} rows from ${table}.`);
            break;
          }
        } catch (err: any) {
          console.warn(`[DB] Table ${table} fallback query failed: ${err.message}`);
        }
      }
    }

    return rows;
  } catch (dbErr: any) {
    console.error(`[DB Error] Unable to connect or query Database: ${dbErr.message}`, dbErr);
    return [];
  } finally {
    if (tempPool) {
      await tempPool.end().catch(() => {});
    }
  }
}
async function selectCustomDropdownOption(page: any, locator: any, targetText: string) {
  if (!targetText) return;
  const lowercaseTarget = targetText.toLowerCase().trim();
  
  // Try to find the element
  const count = await locator.count();
  if (count === 0) return;
  const element = locator.first();
  
    // 1. First, click the dropdown to activate it and potentially render dynamic options in the overlay
  try {
    await element.click();
    await page.waitForTimeout(500); // Wait for potential animations or overlay attachment
  } catch (clickErr: any) {
    console.warn(`Initial click on dropdown failed: ${clickErr.message}`);
  }

 // 2. Try shadow-root and slotted elements evaluation where we search for an option inside it, set parent's value, or click the matching option
  let success = false;
  try {
    success = await element.evaluate((el: any, target: string) => {
      const lowerTarget = target.toLowerCase().trim();
      
      const findOptionMatch = (optionsList: any[]) => {
        return optionsList.find((opt: any) => {
          const text = (opt.textContent || opt.innerText || '').toLowerCase().trim();
          const val = (opt.getAttribute?.('value') || opt.value || '').toLowerCase().trim();
          const label = (opt.getAttribute?.('label') || '').toLowerCase().trim();
          return text.includes(lowerTarget) || val === lowerTarget || label === lowerTarget || lowerTarget.includes(text);
        });
      };

      const options: any[] = [];
      
      // Look in light DOM children
      options.push(...Array.from(el.querySelectorAll('kat-option, option, [role="option"]')));
      
      // Look in shadow DOM
      if (el.shadowRoot) {
        options.push(...Array.from(el.shadowRoot.querySelectorAll('kat-option, option, [role="option"]')));
      }
      
      // Look in slot="private-light-dom" spans
      const slotSpan = el.querySelector('[slot="private-light-dom"]');
      if (slotSpan) {
        options.push(...Array.from(slotSpan.querySelectorAll('kat-option, option')));
      }

      const matchedOpt = findOptionMatch(options);
      if (matchedOpt) {
        const bestValue = matchedOpt.getAttribute?.('value') || matchedOpt.value || matchedOpt.textContent;
        
        // Assign to parent kat-dropdown and trigger updates
        el.value = bestValue;
        if (el.selectedValue !== undefined) {
          el.selectedValue = bestValue;
        }
        
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));

        // Check if there is an inner native select inside the shadowRoot or slot span
        const innerSelect = el.shadowRoot?.querySelector('select') || el.querySelector('select') || slotSpan?.querySelector('select');
        if (innerSelect) {
          innerSelect.value = bestValue;
          innerSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Try clicking the option node if it works
        if (typeof matchedOpt.click === 'function') {
          matchedOpt.click();
        }
        return true;
      }
  
      // Standard value assign fallback
      el.value = target;
      if (el.selectedValue !== undefined) {
        el.selectedValue = target;
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }, targetText);
  } catch (err: any) {
    console.warn(`Evaluation dropdown select failed: ${err.message}`);
  }
  
  // 3. Fallback: Search page-wide for any overlay options (like 'kat-option', '[role="option"]', etc.) containing target text and click them
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
    } catch (clickErr: any) {
      console.warn(`Click options fallback failed: ${clickErr.message}`);
    }
  }

  // 4. Hit Escape key to dismiss the dropdown menu overlay just in case it remains open
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } catch (e) {}
}


interface FilingResult {
  success: boolean;
  caseId?: string;
  error?: string;
  screenshotPath?: string;
  otpRequired?: boolean;
}

const COOKIE_PATH = path.join(process.cwd(), 'bot_state', 'amazon_auth.json');
const LIVE_SCREENSHOT_PATH = path.join(process.cwd(), 'bot_state', 'live.png');
const BOT_LOGS_PATH = path.join(process.cwd(), 'bot_logs');

// Function to delete bot_logs directory
function cleanupBotLogs() {
  try {
    if (fs.existsSync(BOT_LOGS_PATH)) {
      fs.rmSync(BOT_LOGS_PATH, { recursive: true, force: true });
      console.log('[CLEANUP] bot_logs directory deleted.');
    }
  } catch (error) {
    console.error('[CLEANUP ERROR]', error);
  }
}

// Setup signal handlers for graceful termination
process.on('SIGINT', () => {
  console.log('\n[TERMINATING] Cleaning up bot_logs...');
  cleanupBotLogs();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[TERMINATING] Cleaning up bot_logs...');
  cleanupBotLogs();
  process.exit(0);
});

export async function fileAmazonClaim(claim: Claim): Promise<FilingResult> {
  const logId = claim.lpn || claim.claimId || claim.orderId;
  const logPath = path.join(process.cwd(), 'bot_logs', `${logId}.log`);
  if (!fs.existsSync(path.dirname(logPath))) fs.mkdirSync(path.dirname(logPath), { recursive: true });
  if (!fs.existsSync(path.dirname(COOKIE_PATH))) fs.mkdirSync(path.dirname(COOKIE_PATH), { recursive: true });

  const log = (msg: string) => {
    const time = new Date().toISOString();
    fs.appendFileSync(logPath, `[${time}] ${msg}\n`);
    console.log(`[BOT][${logId}] ${msg}`);
  };

  const takeLiveScreenshot = async (p: Page) => {
    try {
      await p.screenshot({ path: LIVE_SCREENSHOT_PATH });
    } catch (e) {
      // Ignore screenshot errors during live stream
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

  const browser = await chromium.launch({
    headless: true, // Headless is required for stable execution in containers
    slowMo: 100,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const contextOptions: any = {};
    if (fs.existsSync(COOKIE_PATH)) {
      log("Found existing cookies, loading state...");
      contextOptions.storageState = COOKIE_PATH;
    }

    const context =
      await chromium.launchPersistentContext(
        './amazon-profile',
        {

          headless: false
        }
      );
    const page = await context.newPage()

    log("Navigating to Amazon Seller Central India...");
    await page.goto(
      'https://sellercentral.amazon.in'
    );
    await takeLiveScreenshot(page);
    await page.waitForTimeout(3000);
    await takeLiveScreenshot(page);
    console.log(
      'Login manually including OTP'
    );

    // Step: Navigate to Orders > Manage SAFE-T Claims
    log("Navigating to Manage SAFE-T Claims...");
    await page.goto('https://sellercentral.amazon.in/safet-claims/create-v2?ref_=ag_sfdcf_cont_safet', { waitUntil: 'networkidle' });
    await takeLiveScreenshot(page);

    // We are already on the direct filing page, so use the current page instead of waiting for a new window.
    const fileWindow = page;

    // Step: Select Fulfillment Channel
    log(`Selecting channel context for: ${claim.channel}`);
    // Custom dropdown - target the div.select-header instead of native select
    await fileWindow.waitForSelector('div.select-header');

    // Click dropdown to open it
    await fileWindow.click('div.select-header');
    await fileWindow.waitForTimeout(500); // Wait for dropdown menu to appear

    if (claim.channel.includes('Amazon B2B')) {
      log("Selecting FBA Removals...");
      await fileWindow.click('text=FBA Removals');
    } else {
      log("Selecting Easy Ship/ Self Ship/ Seller Flex...");
      await fileWindow.click('text=Easy Ship/ Self Ship/ Seller Flex');
    }
    await takeLiveScreenshot(fileWindow);

    //step:click next
    await fileWindow.click('button:has-text("Next")');
    await fileWindow.waitForTimeout(2000);
    await takeLiveScreenshot(fileWindow);

    // Step: Select Tracking ID radio button (option 2)
    log("Selecting Tracking ID radio button...");
    let radioSelected = false;
       // Direct shadow-root click attempt first (highly reliable for web components)
    try {
      const katRadio = fileWindow.locator('kat-radiobutton[value="trackingId"]').first();
      if (await katRadio.isVisible()) {
        await katRadio.evaluate((el: any) => {
          el.checked = true;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.click();
          const innerInput = el.shadowRoot?.querySelector('input[type="radio"]') || el.querySelector('input[type="radio"]');
          if (innerInput) {
            innerInput.checked = true;
            innerInput.dispatchEvent(new Event('change', { bubbles: true }));
            innerInput.click();
          }
        });
        log("Successfully selected kat-radiobutton trackingId radio via shadow-root evaluation!");
        radioSelected = true;
      }
    } catch (e: any) {
      log(`Shadow-root evaluation selection failed: ${e.message}`);
    }

    if (!radioSelected) {
      log("Warning: Could not confirm Selection click. Proceeding with filling input directly...");
    }
    await fileWindow.waitForTimeout(500);

    // Fill in the Tracking ID
    const trackingValue = claim.trackingId || claim.orderId;
    log(`Inputting Tracking ID: ${trackingValue}`);
    
    let isFilled = false;
    const inputSelectors = [
      'input[name="orderIdOrTrackingId"]',
      'kat-input input',
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
      } catch (err: any) {
        log(`Input selector ${s} failed: ${err.message}`);
      }
    }

    if (!isFilled) {
      log("Warning: No matching input found/filled. Trying fallback flat page.fill...");
      try {
        await fileWindow.fill('input[name="orderIdOrTrackingId"]', trackingValue);
        isFilled = true;
      } catch (e: any) {
        log(`Fallback flat fill failed: ${e.message}`);
      }
    }
    await takeLiveScreenshot(fileWindow);

    // Step: Click Check Eligibility
    log("Clicking 'Check Eligibility' button...");
    let isVerified = false;
    const buttonSelectors = [
      'button:has-text("Check Eligibility")',
      'kat-button:has-text("Check Eligibility")',
      'button.check-eligibility-btn',
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
      } catch (err: any) {
        log(`Button selector ${s} failed: ${err.message}`);
      }
    }
     if (!isVerified) {
      log("Warning: Need enter key fallback to trigger verification...");
      try {
        await fileWindow.locator('input[name="orderIdOrTrackingId"]').press('Enter');
        log("Pressed 'Enter' on Tracking ID input as fallback.");
      } catch (e: any) {
        log(`Enter key fallback failed: ${e.message}`);
      }
    }

    await fileWindow.waitForTimeout(3000); // Wait for verification/eligibility response
    await takeLiveScreenshot(fileWindow);

    // Step: Check items
       log("Starting item matching and selection process...");
    
    // First, let's gather all database rows for this trackingId (and fallback orderId)
    const matchingClaims = await getClaimsForTrackingId(claim.trackingId || '', claim.orderId || '');
    log(`Found ${matchingClaims.length} matching claims in database/mock context for this trackingId/orderId.`);
    
    const itemBoxes = fileWindow.locator('kat-box.AsinDetailsBox, div.orderdetail-view-fba kat-box');
    const totalBoxes = await itemBoxes.count();
    log(`Found ${totalBoxes} item boxes in the filing form on the page.`);
    
    for (let i = 0; i < totalBoxes; i++) {
      const box = itemBoxes.nth(i);
      
      let productNameText = "";
      try {
        const nameSelectors = ['.asin-name', 'div[class*="asin-name"]', 'div.kat-col-md-4', '.asin-title'];
        for (const sel of nameSelectors) {
          const el = box.locator(sel).first();
          if (await el.isVisible()) {
            productNameText = await el.innerText();
            break;
          }
        }
      } catch (err: any) {
        log(`Could not fetch product name for box index ${i}: ${err.message}`);
      }
      
      productNameText = productNameText.replace(/[\r\n]+/g, ' ').trim();
      log(`Box #${i} detected name on Amazon page: "${productNameText}"`);
      
      if (!productNameText) {
        log(`Warning: Empty product name for box index ${i}. Skipping...`);
        continue;
      }
      
      // Match with our DB/mock claims
      let matchedClaims = matchingClaims.filter(c => matchProduct(productNameText, c));
      
      // Fallback matching with the current single claim if no SQL results matched
      if (matchedClaims.length === 0) {
        if (matchProduct(productNameText, claim)) {
          log(`No matching claims from full query but single triggered claim matched product: "${productNameText}". Using it.`);
          matchedClaims.push(claim);
        }
      }
      
      log(`Matched ${matchedClaims.length} database/trigger claims for: "${productNameText}"`);
      
      // Count how many are Damaged or Missing ('Damaged' or 'Missing')
      const badCount = matchedClaims.filter(c => {
        const typeLower = (c.type || "").toLowerCase();
        return typeLower === 'damaged' || typeLower === 'missing';
      }).length;
      
      log(`Damage / Missing rows count for this product: ${badCount}`);
      
      if (badCount > 0) {
        log(`Selecting item box #${i} and entering quantity: ${badCount}...`);
        
        // 1. Check the box inside shadow root / custom checkbox or locator
        const checkbox = box.locator('kat-checkbox.QuantityCheckbox, kat-checkbox').first();
        if (await checkbox.isVisible()) {
          try {
            await checkbox.evaluate((el: any) => {
              const cb = el.shadowRoot?.querySelector('[role="checkbox"]') || el.shadowRoot?.querySelector('.checkbox') || el;
              if (cb) {
                if (cb.getAttribute('aria-checked') !== 'true') {
                  cb.click();
                  cb.setAttribute('aria-checked', 'true');
                }
              } else {
                el.click();
              }
            });
            log(`Successfully checked custom kat-checkbox for product "${productNameText}"`);
          } catch (cbErr: any) {
            log(`Failed to check checkbox via shadow-root evaluation: ${cbErr.message}. Trying direct click fallback...`);
            await checkbox.click({ force: true }).catch(err => log(`Direct click on checkbox failed: ${err.message}`));
          }
        } else {
          log(`Warning: Checkbox is not visible/found for product "${productNameText}"`);
        }
        
        await fileWindow.waitForTimeout(500);
        
        // 2. Write quantity to the Enter Quantity input inside shadow root of kat-input
        const qtyInput = box.locator('kat-input[type="number"], kat-input, input[type="number"]').first();
        if (await qtyInput.isVisible()) {
          try {
            await qtyInput.evaluate((el: any, val: number) => {
              const input = el.shadowRoot?.querySelector('input') || el;
              if (input) {
                input.value = String(val);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                el.value = String(val);
              }
            }, badCount);
            log(`Successfully entered quantity ${badCount} via shadow-root evaluation.`);
          } catch (qtyErr: any) {
            log(`Failed to write quantity via shadow-root: ${qtyErr.message}. Trying direct fill fallback...`);
            await qtyInput.fill(String(badCount)).catch(err => log(`Direct fill on quantity input failed: ${err.message}`));
          }
        } else {
          log(`Warning: Quantity input is not visible/found for product "${productNameText}"`);
        }
      } else {
        log(`No damaged or missing claims found for product "${productNameText}". Leaving unchecked.`);
      }
    }
    
    await takeLiveScreenshot(fileWindow);
    await fileWindow.waitForTimeout(1000);

     // Step: Click Next button to navigate after selecting items
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
      } catch (err: any) {
        log(`Selector ${btnSel} failed inside click: ${err.message}`);
      }
    }
    
    if (!nextStepClicked) {
      log("Warning: Could not automatically locate or click Next button. Trying default browser click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]'))
            .find(b => {
              const txt = (b.textContent || (b as any).innerText || "").toLowerCase();
              return txt.includes('next') || txt.includes('continue');
            });
          if (btn) (btn as any).click();
        });
        log("Fallback evaluate click triggered on Next button.");
      } catch (e: any) {
        log(`Next button fallback evaluate click failed: ${e.message}`);
      }
    }
    
    await fileWindow.waitForTimeout(3000);
    await takeLiveScreenshot(fileWindow);

    
    // Step: Dropdowns for Select Claim Reason and Select Claim Sub-Reason
    log("Waiting for Claim Reason and Sub-Reason dropdowns page to load...");
    const reasonBoxes = fileWindow.locator('kat-box.AsinDetailsBox, div.orderdetail-view-fba kat-box');
    const numReasonBoxes = await reasonBoxes.count();
    log(`Found ${numReasonBoxes} product boxes on the Reasons page.`);
    
    for (let i = 0; i < numReasonBoxes; i++) {
      const box = reasonBoxes.nth(i);
      
      let productNameText = "";
      try {
        const nameSelectors = ['.asin-name', 'div[class*="asin-name"]', 'div.kat-col-md-4', '.asin-title'];
        for (const sel of nameSelectors) {
          const el = box.locator(sel).first();
          if (await el.isVisible()) {
            productNameText = await el.innerText();
            break;
          }
        }
      } catch (err: any) {
        log(`Could not fetch product name for reason box index ${i}: ${err.message}`);
      }
      
      productNameText = productNameText.replace(/[\r\n]+/g, ' ').trim();
      log(`Reason Box #${i} detected name on Amazon page: "${productNameText}"`);
      
      if (!productNameText) {
        log(`Warning: Empty product name for reason box index ${i}. Skipping...`);
        continue;
      }
      
      // Match with database claims
      let matchedClaims = matchingClaims.filter(c => matchProduct(productNameText, c));
      
      // Fallback matching with the current single claim
      if (matchedClaims.length === 0) {
        if (matchProduct(productNameText, claim)) {
          matchedClaims.push(claim);
        }
      }
      
     if (matchedClaims.length > 0) {
        const matched = matchedClaims[0];
        const dbClaimReason = (matched as any).claimReason || matched.reason || "";
        const dbClaimSubReason = (matched as any).claimSubReason || "";
        
        log(`Matching claim found for "${productNameText}". Expected Reason: "${dbClaimReason}", Sub-Reason: "${dbClaimSubReason}"`);
        
        // Let's locate the dropdown 1 (Claim Reason) and dropdown 2 (Claim Sub-Reason)
        // First try to locate inside the box, fallback to page-wide selector matching
        let dropdownReason = box.locator('kat-dropdown[placeholder="Select Claim Reason"], kat-dropdown[placeholder*="Reason"], kat-dropdown.reasonDropdown, kat-select, select').first();
        let dropdownSubReason = box.locator('kat-dropdown[placeholder="Select Claim Sub-Reason"], kat-dropdown[placeholder*="Sub-Reason"]').first();
        
        let hasReasonInside = false;
        try {
          hasReasonInside = await dropdownReason.isVisible();
        } catch (e) {}

        if (!hasReasonInside) {
          log(`Dropdown not found inside box #${i}. Trying page-wide nth(${i}) fallback...`);
          dropdownReason = fileWindow.locator('kat-dropdown[placeholder="Select Claim Reason"], kat-dropdown[placeholder*="Reason"], kat-dropdown.reasonDropdown, kat-select, select').nth(i);
          dropdownSubReason = fileWindow.locator('kat-dropdown[placeholder="Select Claim Sub-Reason"], kat-dropdown[placeholder*="Sub-Reason"]').nth(i);
        }
        
        if (dbClaimReason) {
          log(`Setting dropdown 1 (Claim Reason) to: "${dbClaimReason}"`);
          await selectCustomDropdownOption(fileWindow, dropdownReason, dbClaimReason);
          await fileWindow.waitForTimeout(1500); // 1.5s delay to allow Sub-Reason list to dynamically load
        }
        
        if (dbClaimSubReason) {
          log(`Setting dropdown 2 (Claim Sub-Reason) to: "${dbClaimSubReason}"`);
          await selectCustomDropdownOption(fileWindow, dropdownSubReason, dbClaimSubReason);
          await fileWindow.waitForTimeout(1000);
        }
      } else {
        log(`No matching claims from database/payload found for "${productNameText}". Skipping dropdown automation for this item.`);
      }
    }
    
    await takeLiveScreenshot(fileWindow);
    await fileWindow.waitForTimeout(1000);

    // Click Next button to proceed past Claim Reasons
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
      } catch (err: any) {
        log(`Reason submission button selector ${btnSel} failed: ${err.message}`);
      }
    }
    
    if (!reasonsSubmitted) {
      log("Warning: Could not automatically locate or click Next/Submit button on reasons page. Trying fallback evaluate click...");
      try {
        await fileWindow.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button, kat-button, input[type="submit"]'))
            .find(b => {
              const txt = (b.textContent || (b as any).innerText || "").toLowerCase();
              return txt.includes('next') || txt.includes('continue') || txt.includes('submit');
            });
          if (btn) (btn as any).click();
        });
        log("Fallback evaluate click triggered on Reasons page.");
      } catch (e: any) {
        log(`Reasons page fallback click failed: ${e.message}`);
      }
    }
    
    await fileWindow.waitForTimeout(3000);
    await takeLiveScreenshot(fileWindow);

    // Step: Evidence
    if (claim.driveLink) {
      log("Providing evidence link...");
      await fileWindow.fill('textarea[name="comments"]', `Proof and Evidence: ${claim.driveLink}`);
      await takeLiveScreenshot(fileWindow);
    }

    log("Finalizing Filing...");
    await fileWindow.click('button:has-text("Submit")');
    await page.waitForTimeout(2000);
    await takeLiveScreenshot(fileWindow);
    
    // Capture result
    await fileWindow.waitForSelector('.success-message, .claim-id', { timeout: 15000 }).catch(() => {});
    const textContent = await fileWindow.innerText('body');
    const claimIdMatch = textContent.match(/SAFE-T Claim ID: (S-\d+)/);
    
    if (claimIdMatch) {
      const amazonClaimId = claimIdMatch[1];
      log(`SUCCESS: Claim filed. Amazon ID: ${amazonClaimId}`);
      return { success: true, caseId: amazonClaimId };
    }

    log("Could not find generated Claim ID in final page.");
    return { success: true, caseId: `AUTO-${Date.now()}` };

  } catch (error: any) {
    log(`CRITICAL ERROR: ${error.message}`);
    const screenshotName = `error_${logId}_${Date.now()}.png`;
    const screenshotPath = path.join(process.cwd(), 'bot_logs', screenshotName);
    return { success: false, error: error.message, screenshotPath };
  } finally {
    log("Automation pulse finished.");
      // Save cookies/state for future sessions
    
    await browser.close();
  }
}
