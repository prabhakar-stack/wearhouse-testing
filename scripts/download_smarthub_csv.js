import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');
const TARGET_URL = process.env.AMAZON_SMARTHUB_URL || 'https://smarthub.amazon.in/returns';
const DOWNLOAD_DIR = process.env.AMAZON_SMARTHUB_DOWNLOAD_DIR || './uploads';

async function saveErrorScreenshot(page, errorMsg) {
  try {
    console.log('Uploading error screenshot to database...');
    const buffer = await page.screenshot({ type: 'png' });
    const base64 = buffer.toString('base64');
    
    await prisma.systemConfig.upsert({
      where: { key: 'smarthub_error_screenshot' },
      update: { value: JSON.stringify({ image: base64, timestamp: new Date().toISOString(), error: errorMsg }) },
      create: { key: 'smarthub_error_screenshot', value: JSON.stringify({ image: base64, timestamp: new Date().toISOString(), error: errorMsg }) },
    });
    console.log('✅ Error screenshot uploaded to database successfully.');
  } catch (dbErr) {
    console.error('❌ Failed to upload screenshot to database:', dbErr.message);
  }
}

async function main() {
  const headed = process.argv.includes('--headed');
  console.log('🚀 Starting Amazon SmartHub CSV Downloader...');
  console.log(`Target URL: ${TARGET_URL}`);
  
  if (!fs.existsSync(COOKIE_PATH)) {
    console.error(`❌ Session state not found at ${COOKIE_PATH}.`);
    console.error('Please run the session-saver script first:');
    console.error('  node scripts/save_smarthub_session.js');
    process.exit(1);
  }

  // Create download directory if it doesn't exist
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }

  console.log(`Launching browser (headed: ${headed})...`);
  let browser;
  try {
    browser = await chromium.launch({
      headless: !headed,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security'
      ]
    });
  } catch (launchErr) {
    if (launchErr.message.includes("Executable doesn't exist") || launchErr.message.includes("install")) {
      console.log('⚠️ Playwright Chromium browser executable is missing. Attempting dynamic installation...');
      try {
        const { execSync } = await import('child_process');
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        console.log('✅ Playwright Chromium installed dynamically. Re-attempting browser launch...');
        browser = await chromium.launch({
          headless: !headed,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security'
          ]
        });
      } catch (installErr) {
        console.error('❌ Dynamic Playwright Chromium installation failed:', installErr.message);
        throw launchErr; // rethrow the original launch error
      }
    } else {
      throw launchErr;
    }
  }

  // Load the saved session state (cookies & localStorage)
  const context = await browser.newContext({
    storageState: COOKIE_PATH,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log('Navigating to target page...');
  await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });

  // Wait 6 seconds for client-side routing / redirects (e.g. to Downloads) to settle
  console.log('Waiting for page state and redirects to settle...');
  await page.waitForTimeout(6000);

  // Check if we were redirected to a login page
  let currentUrl = page.url();
  if (currentUrl.includes('signin') || currentUrl.includes('login') || currentUrl.includes('accounts.google.com')) {
    console.error('❌ Session has expired or is invalid. Redirected to login.');
    console.error('Please run the session-saver script again to refresh your session:');
    console.error('  node scripts/save_smarthub_session.js');
    await browser.close();
    process.exit(1);
  }

  console.log('Successfully loaded page with active session!');

  // Navigation: Expand the collapsible "Returns" menu and click "All Returns"
  try {
    console.log('Expanding collapsible "Returns" menu...');
    await page.getByRole('button', { name: 'Returns' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(5000); // Wait 5s
    
    console.log('Clicking "All Returns" link...');
    await page.getByRole('link', { name: 'All Returns' }).click({ timeout: 5000 });
    console.log('Waiting 5s for the Returns Dashboard page to load...');
    await page.waitForTimeout(5000); // Wait 5s

  } catch (navErr) {
    console.warn(`⚠️ Sidebar navigation failed: ${navErr.message}. Proceeding...`);
  }

  // Scrape OTP from the page
  console.log('Extracting the OTP from the page...');
  try {
    const otp = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('*'));
      for (const el of els) {
        const text = (el.innerText || el.textContent || '').trim();
        const match = text.match(/^OTP:\s*(\d{6})$/i) || text.match(/^OTP:\n*(\d{6})$/i);
        if (match) return match[1];
      }
      
      const ps = Array.from(document.querySelectorAll('p'));
      for (const p of ps) {
        if (p.textContent.trim() === 'OTP:') {
          const parentText = p.parentElement ? p.parentElement.textContent.trim() : '';
          const parentMatch = parentText.match(/OTP:\s*(\d{6})/i);
          if (parentMatch) return parentMatch[1];
          
          const sibling = p.nextElementSibling;
          if (sibling) {
            const sibText = sibling.textContent.trim();
            if (/^\d{6}$/.test(sibText)) return sibText;
          }
        }
      }
      
      const bodyText = document.body.innerText || '';
      const bodyMatch = bodyText.match(/OTP:\s*(\d{6})/i) || bodyText.match(/OTP:\n*(\d{6})/i);
      if (bodyMatch) return bodyMatch[1];
      
      return null;
    });

    if (otp) {
      console.log(`🔑 OTP found on page: ${otp}`);
      const otpPath = path.join(DOWNLOAD_DIR, 'latest_otp.json');
      fs.writeFileSync(otpPath, JSON.stringify({ otp, timestamp: new Date().toISOString() }, null, 2));
      console.log(`Saved OTP to ${otpPath}`);
    } else {
      console.warn('⚠️ Could not find OTP on the page.');
    }
  } catch (otpErr) {
    console.error('⚠️ Failed to extract OTP:', otpErr.message);
  }

  let downloadPromise = page.waitForEvent('download');
  let clicked = false;
  const iframeLocator = page.locator('iframe[name*="DASHBOARD-asspl-returns-dashboard"], iframe[name$="-DASHBOARD-asspl-returns-dashboard"]').first();

  try {
    console.log('Locating the Returns Dashboard iframe...');
    await iframeLocator.waitFor({ state: 'attached', timeout: 35000 });
    const frame = iframeLocator.contentFrame();

    // Click general element if present (e.g. css focus helper)
    try {
      await page.locator('.css-i5khe3').click({ timeout: 5000 });
      await page.waitForTimeout(5000); // Wait 5s
    } catch (e) {}

    // QuickSight requirement: Click on the Table visual to activate the header controls/Menu Options button
    try {
      console.log('Activating table visual inside the iframe...');
      const tableVisual = frame.getByRole('button', { name: 'Table, Returns' });
      await tableVisual.waitFor({ state: 'visible', timeout: 15000 });
      await tableVisual.click();
      await page.waitForTimeout(5000); // Wait 5s
    } catch (tableErr) {
      console.warn(`Could not click "Table, Returns" directly: ${tableErr.message}. Trying generic click...`);
      try {
        await frame.locator('div:nth-child(44)').first().click({ timeout: 5000 });
        await page.waitForTimeout(5000); // Wait 5s
      } catch (e) {}
    }

    console.log('Waiting for "Menu options" button inside the returns dashboard iframe...');
    const menuButton = frame.getByRole('button', { name: 'Menu options, Returns, Table' });
    await menuButton.waitFor({ state: 'visible', timeout: 20000 });
    
    console.log('Clicking the "Menu options" button...');
    await menuButton.click();
    await page.waitForTimeout(5000); // Wait 5s

    console.log('Waiting for "Export to CSV" menu item...');
    const exportMenuItem = frame.getByRole('menuitem', { name: 'Export to CSV' });
    await exportMenuItem.waitFor({ state: 'visible', timeout: 15000 });

    console.log('Clicking the "Export to CSV" menu item...');
    await exportMenuItem.click();
    await page.waitForTimeout(5000); // Wait 5s
    clicked = true;
  } catch (err) {
    console.error(`❌ Dashboard iframe automation failed: ${err.message}`);
    console.log('Taking a screenshot for troubleshooting: scripts/bot_state/error_screenshot.png');
    await page.screenshot({ path: path.join(process.cwd(), 'scripts', 'bot_state', 'error_screenshot.png') });
    await saveErrorScreenshot(page, `Dashboard iframe automation failed: ${err.message}`);
    await browser.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('Waiting for download to complete...');
  try {
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    const savePath = path.join(DOWNLOAD_DIR, filename);
    
    await download.saveAs(savePath);
    console.log(`\n✅ Success! CSV downloaded and saved to: ${savePath}`);
  } catch (downloadErr) {
    console.error('❌ Error during file download:', downloadErr.message);
    console.log('Taking a screenshot for troubleshooting: scripts/bot_state/error_screenshot.png');
    await page.screenshot({ path: path.join(process.cwd(), 'scripts', 'bot_state', 'error_screenshot.png') });
    await saveErrorScreenshot(page, `Error during file download: ${downloadErr.message}`);
  }

  console.log('Closing browser...');
  await browser.close();
  await prisma.$disconnect();
  console.log('Finished.');
}

main().catch(async (err) => {
  console.error('❌ Fatal error in script:', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
