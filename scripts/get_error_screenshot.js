import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

async function main() {
  console.log('Fetching error screenshot from database...');
  const record = await prisma.systemConfig.findUnique({
    where: { key: 'smarthub_error_screenshot' },
  });

  if (!record) {
    console.log('❌ No error screenshot found in database.');
    return;
  }

  const { image, timestamp, error } = JSON.parse(record.value);
  console.log(`\n==================================================`);
  console.log(`Screenshot Details:`);
  console.log(`- Timestamp: ${new Date(timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log(`- Error: ${error}`);
  console.log(`==================================================\n`);

  const buffer = Buffer.from(image, 'base64');
  const outputPath = path.join(process.cwd(), 'scripts', 'bot_state', 'error_screenshot.png');
  
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Saved screenshot to: ${outputPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
