import { execSync } from 'child_process';

console.log('Prisma client generated successfully.');

// Only install Playwright browsers if we are on Render
if (process.env.RENDER === 'true' || process.env.RENDER === '1') {
  console.log('🚀 Render environment detected! Installing Playwright Chromium...');
  try {
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    console.log('✅ Playwright Chromium installed successfully.');
  } catch (err) {
    console.error('❌ Failed to install Playwright Chromium:', err.message);
    process.exit(1);
  }
} else {
  console.log('Skipping Playwright Chromium installation (not on Render).');
}
