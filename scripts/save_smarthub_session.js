import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');
const DEFAULT_URL = process.env.AMAZON_SMARTHUB_URL || 'https://smartcommerce.amazon.in/smarthub';

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  console.log('🚀 Starting Amazon SmartHub Session Saver...');
  console.log(`URL: ${DEFAULT_URL}`);
  console.log(`Saving cookies to: ${COOKIE_PATH}`);

  // Create directory if it doesn't exist
  const dir = path.dirname(COOKIE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Launch headed browser so the user can log in and solve OTP/CAPTCHA
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security'
    ]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  console.log('Navigating to Amazon SmartHub login page...');
  await page.goto(DEFAULT_URL, { waitUntil: 'load', timeout: 60000 });

  console.log('\n==================================================================');
  console.log('👉 INSTRUCTIONS:');
  console.log('1. Log in manually in the browser window.');
  console.log('2. Complete any CAPTCHA, password submission, and OTP/MFA steps.');
  console.log('3. Once you reach the dashboard page (logged in successfully),');
  console.log('   return to this terminal and press ENTER to save the session.');
  console.log('==================================================================\n');

  await askQuestion('Press [ENTER] here once you have successfully logged in and are on the dashboard: ');

  console.log('Saving session state...');
  await context.storageState({ path: COOKIE_PATH });
  console.log(`✅ Session state successfully saved to ${COOKIE_PATH}!`);

  console.log('Closing browser...');
  await browser.close();
  console.log('Done.');
}

main().catch((err) => {
  console.error('❌ Error saving session:', err);
});
