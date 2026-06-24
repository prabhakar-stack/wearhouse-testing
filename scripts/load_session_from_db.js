/**
 * load_session_from_db.js
 *
 * Loads the SmartHub Playwright storageState from the Supabase SystemConfig
 * table and writes it to the local filesystem (scripts/bot_state/smarthub_auth.json).
 *
 * Run this before download_smarthub_csv.js to ensure a fresh session is on disk.
 * Usage: node scripts/load_session_from_db.js
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const COOKIE_PATH = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');

async function main() {
  console.log('📦 Loading SmartHub session from database...');

  const record = await prisma.systemConfig.findUnique({
    where: { key: 'smarthub_session' },
  });

  if (!record) {
    console.error('❌ No SmartHub session found in database (key: smarthub_session).');
    console.error('   Please capture a session from the Super Admin → Settings → B2C SmartHub card.');
    process.exit(1);
  }

  // Decode base64 JSON
  let decoded;
  try {
    decoded = Buffer.from(record.value, 'base64').toString('utf8');
    JSON.parse(decoded); // Validate it's valid JSON
  } catch (e) {
    console.error('❌ Session data in database is corrupted. Please re-capture the session.');
    process.exit(1);
  }

  // Write to disk
  const dir = path.dirname(COOKIE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(COOKIE_PATH, decoded, 'utf8');

  // Check age of session
  const updatedAt = record.updatedAt;
  const ageDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  const ageStr = ageDays < 1
    ? `${Math.round(ageDays * 24)}h ago`
    : `${ageDays.toFixed(1)} days ago`;

  console.log(`✅ Session written to ${COOKIE_PATH}`);
  console.log(`   Session was captured: ${ageStr}`);

  if (ageDays > 6) {
    console.warn('⚠️  Session is older than 6 days — SmartHub sessions typically last ~7 days.');
    console.warn('   Consider refreshing the session from the dashboard before syncing.');
  }
}

main()
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
