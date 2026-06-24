import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// RFC-4180 compliant CSV parser to handle quotes, commas within quotes, and multi-line values
function parseCSV(content) {
  const rows = [];
  let row = [];
  let insideQuote = false;
  let entry = '';
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        // Escaped quote (double quote inside quote)
        entry += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push(entry);
      entry = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(entry);
      rows.push(row);
      row = [];
      entry = '';
    } else {
      entry += char;
    }
  }
  
  if (entry || row.length > 0) {
    row.push(entry);
    rows.push(row);
  }
  
  return rows;
}

// Helpers for data parsing and cleaning
function cleanString(val) {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

function cleanInt(val) {
  if (!val) return null;
  const n = parseInt(String(val).trim(), 10);
  return isNaN(n) ? null : n;
}

function cleanDate(val) {
  if (!val) return null;
  const d = new Date(String(val).trim());
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log('🚀 Starting Amazon SmartHub B2C returns sync to Supabase...');
  
  // 1. Locate the latest Returns CSV file in the uploads directory
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`❌ Uploads directory not found: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(UPLOADS_DIR)
    .filter(file => file.includes('Returns') && file.endsWith('.csv'))
    .map(file => ({
      name: file,
      path: path.join(UPLOADS_DIR, file),
      time: fs.statSync(path.join(UPLOADS_DIR, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) {
    console.error('❌ No Returns CSV files found in the uploads directory.');
    process.exit(1);
  }

  const latestFile = files[0];
  console.log(`Loading data from latest CSV: ${latestFile.name} (${new Date(latestFile.time).toLocaleString()})`);

  // 2. Read and parse the CSV content
  const content = fs.readFileSync(latestFile.path, 'utf8');
  const rows = parseCSV(content);

  if (rows.length < 2) {
    console.warn('⚠️ CSV file is empty or contains only headers.');
    process.exit(0);
  }

  const headers = rows[0].map(h => h.trim());
  const dataRows = rows.slice(1).filter(r => r.length > 0 && r.some(cell => cell.trim() !== ''));

  console.log(`Parsed ${dataRows.length} returns entries from CSV.`);

  // 3. Process and upsert rows
  let successCount = 0;
  let errorCount = 0;

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    
    // Map CSV columns by index
    // Headers list for reference:
    // 0: Return Tracking ID, 1: RMA ID, 2: Return Type, 3: Customer Order ID, 4: Forward Leg Shipment ID,
    // 5: Forward Leg Tracking ID, 6: Channel SKU, 7: Units, 8: Sales Channel, 9: Return Status,
    // 10: Carrier, 11: Return Creation Date, 12: Pick-up date, 13: Last Updated On, 14: Days In-transit,
    // 15: Return Reason, 16: Exchange Order ID
    const returnTrackingId = cleanString(row[0]);
    const rmaId = cleanString(row[1]);
    const returnType = cleanString(row[2]);
    const customerOrderId = cleanString(row[3]);
    const forwardLegShipmentId = cleanString(row[4]);
    const forwardLegTrackingId = cleanString(row[5]);
    const channelSku = cleanString(row[6]);
    const units = cleanInt(row[7]);
    const salesChannel = cleanString(row[8]);
    const returnStatus = cleanString(row[9]);
    const carrier = cleanString(row[10]);
    const returnCreationDate = cleanDate(row[11]);
    const pickUpDate = cleanDate(row[12]);
    const lastUpdatedOn = cleanDate(row[13]);
    const daysInTransit = cleanInt(row[14]);
    const returnReason = row[15] ? String(row[15]).trim() : null;
    const exchangeOrderId = cleanString(row[16]);

    // Skip row if essential unique identifier components are all empty
    if (!returnTrackingId && !rmaId && !customerOrderId && !channelSku) {
      console.warn(`[Row ${idx + 2}] Skipping empty row or row missing all unique identifiers.`);
      continue;
    }

    const payload = {
      returnType,
      forwardLegShipmentId,
      forwardLegTrackingId,
      units,
      salesChannel,
      returnStatus,
      carrier,
      returnCreationDate,
      pickUpDate,
      lastUpdatedOn,
      daysInTransit,
      returnReason,
      exchangeOrderId
    };

    try {
      await prisma.aMAZON_B2C_SMARTHUB.upsert({
        where: {
          unique_returns: {
            returnTrackingId,
            rmaId,
            customerOrderId,
            channelSku
          }
        },
        update: payload,
        create: {
          returnTrackingId,
          rmaId,
          customerOrderId,
          channelSku,
          ...payload
        }
      });
      successCount++;
    } catch (err) {
      errorCount++;
      console.error(`[Row ${idx + 2}] Failed to upsert return (Order ID: ${customerOrderId}, SKU: ${channelSku}):`, err.message);
    }
  }

  // 4. Sync OTP if available
  const otpPath = path.join(UPLOADS_DIR, 'latest_otp.json');
  let otpSuccessCount = 0;
  let hasOtp = false;
  let otpValue = null;

  if (fs.existsSync(otpPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(otpPath, 'utf8'));
      otpValue = parsed.otp;
      if (otpValue) {
        hasOtp = true;
        console.log(`🔑 Found local OTP: ${otpValue}. Syncing to DeliveryOtp table...`);
        const source = 'smarthub';

        const trackingIds = new Set();
        for (const row of dataRows) {
          const tid = cleanString(row[0]);
          if (tid) trackingIds.add(tid);
        }

        // Add null trackingId for general fallback
        trackingIds.add(null);

        for (const tid of trackingIds) {
          let existing;
          if (tid === null) {
            existing = await prisma.$queryRaw`
              SELECT "id" FROM "DeliveryOtp"
              WHERE "otp" = ${otpValue} AND "trackingId" IS NULL AND "consumedAt" IS NULL
              LIMIT 1
            `;
          } else {
            existing = await prisma.$queryRaw`
              SELECT "id" FROM "DeliveryOtp"
              WHERE "otp" = ${otpValue} AND "trackingId" = ${tid} AND "consumedAt" IS NULL
              LIMIT 1
            `;
          }

          if (existing.length === 0) {
            const uuid = crypto.randomUUID();
            await prisma.$executeRaw`
              INSERT INTO "DeliveryOtp" ("id", "trackingId", "otp", "source", "consumedAt", "createdAt")
              VALUES (${uuid}, ${tid}, ${otpValue}, ${source}, NULL, NOW())
            `;
            otpSuccessCount++;
          }
        }
      }
    } catch (otpErr) {
      console.error('❌ Failed to sync OTP to database:', otpErr.message);
    }
  }

  console.log('\n==================================================');
  console.log('SYNC SUMMARY:');
  console.log(`- Total CSV rows evaluated: ${dataRows.length}`);
  console.log(`- Successfully loaded/upserted returns: ${successCount}`);
  console.log(`- Errors encountered: ${errorCount}`);
  if (hasOtp) {
    console.log(`- OTP loaded: ${otpValue}`);
    console.log(`- Created DeliveryOtp records: ${otpSuccessCount}`);
  }
  console.log('==================================================\n');
}

main()
  .catch(e => console.error('❌ Sync script failed:', e))
  .finally(async () => {
    await prisma.$disconnect();
  });
