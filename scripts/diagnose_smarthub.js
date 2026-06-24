import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function main() {
  console.log('=== DB DIAGNOSTIC ===');
  console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
  console.log('DIRECT_URL set:', !!process.env.DIRECT_URL);
  console.log('URL being used:', (process.env.DIRECT_URL || process.env.DATABASE_URL || '').replace(/:([^:@]+)@/, ':***@'));

  // 1. Test DB connection
  try {
    const count = await prisma.aMAZON_B2C_SMARTHUB.count();
    console.log('\n✅ DB Connected. AMAZON_B2C_SMARTHUB row count:', count);
  } catch (e) {
    console.error('\n❌ DB connection error:', e.message);
    console.error('Prisma error code:', e.code);
    return;
  }

  // 2. Check uploads directory
  console.log('\n=== UPLOADS DIR ===');
  console.log('Path:', UPLOADS_DIR);
  console.log('Exists:', fs.existsSync(UPLOADS_DIR));
  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR);
    console.log('Files:', files.length === 0 ? '(empty)' : files.join(', '));
    const csvFiles = files.filter(f => f.includes('Returns') && f.endsWith('.csv'));
    console.log('Returns CSVs found:', csvFiles.length === 0 ? 'NONE' : csvFiles.join(', '));
  }

  // 3. Check session file
  console.log('\n=== SESSION FILE ===');
  const sessionPath = path.join(process.cwd(), 'scripts', 'bot_state', 'smarthub_auth.json');
  console.log('Path:', sessionPath);
  console.log('Exists:', fs.existsSync(sessionPath));
  if (fs.existsSync(sessionPath)) {
    const stat = fs.statSync(sessionPath);
    const ageDays = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
    console.log('Age:', ageDays.toFixed(1), 'days');
    console.log('Valid (< 6 days):', ageDays < 6 ? 'YES' : 'NO — EXPIRED');
    try {
      const state = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      console.log('Cookie count:', state.cookies?.length ?? 0);
      console.log('localStorage entries:', state.origins?.[0]?.localStorage?.length ?? 0);
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  }

  // 4. Check SystemConfig for DB session
  console.log('\n=== SUPABASE SESSION (SystemConfig) ===');
  try {
    const rec = await prisma.systemConfig.findUnique({ where: { key: 'smarthub_session' } });
    if (rec) {
      const ageDays = (Date.now() - new Date(rec.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      console.log('DB session found. Age:', ageDays.toFixed(1), 'days');
      const decoded = Buffer.from(rec.value, 'base64').toString('utf8');
      const state = JSON.parse(decoded);
      console.log('Cookie count:', state.cookies?.length ?? 0);
      console.log('localStorage entries:', state.origins?.[0]?.localStorage?.length ?? 0);
    } else {
      console.log('No DB session found (key: smarthub_session)');
    }
  } catch (e) {
    console.error('SystemConfig query error:', e.message);
  }
}

main()
  .catch(e => console.error('Fatal:', e))
  .finally(() => prisma.$disconnect());
