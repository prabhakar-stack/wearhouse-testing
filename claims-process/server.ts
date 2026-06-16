import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import { fileAmazonClaim } from "./bot/amazonFiler";
import "dotenv/config";

// Lazy initialization for PostgreSQL Pool
let pool: pg.Pool | null = null;

let mockQcStatus: any[] = [];

let mockSampleRecovery: any[] = [];


let mockItemStatus: any[] = [
  { lpn: "LPN001", status: "inspected", recoveryType: "Barcode Damaged" },
  { lpn: "LPN002", status: "inspected", recoveryType: "Packaging Damaged" },
  { lpn: "LPN003", status: "inspected", recoveryType: "Barcode Damaged" },
  { lpn: "LPN004", status: "inspected", recoveryType: "Packaging Damaged" },
  { lpn: "LPN005", status: "inspected", recoveryType: "Packaging Damaged" }
];
let mockReturnItems: any[] = [
  { lpn: "LPN001", sku: "1120100" },
  { lpn: "LPN002", sku: "1120200" },
  { lpn: "LPN003", sku: "4829102" },
  { lpn: "LPN004", sku: "1092837" },
  { lpn: "LPN005", sku: "SKU-REP-990" },
  { lpn: "LPN101", sku: "SKU-NEW-101" },
  { lpn: "LPN102", sku: "SKU-NEW-102" }
];

async function setupDatabaseSchema(db: pg.Pool) {
  try {
        console.log("Checking and setting up sample_recovery table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS "sample_recovery" (
        lpn text PRIMARY KEY,
        sku text NOT NULL,
        damage_type text NOT NULL,
        is_refurbished boolean DEFAULT false,
        status text DEFAULT 'pending'
      );
    `);

    // Backwards compatibility column check for scannedAt
    try {
      await db.query(`ALTER TABLE "sample_recovery" ADD COLUMN IF NOT EXISTS "scannedAt" timestamp with time zone;`);
    } catch (e: any) {
      console.warn("Backwards compatibility Alter check on sample_recovery scannedAt warning:", e.message);
    }
    
    console.log("Checking and setting up ItemStatus and ReturnItem tables...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS "claims_status" (
        id SERIAL PRIMARY KEY,
        "orderId" text,
        "trackingId" text,
        "claimId" text DEFAULT '',
        status text DEFAULT 'unclaimed',
        bot_log_reason text,
        created_at timestamp with time zone DEFAULT now()
      );
    `);

    // Backwards compatibility column checks
    try {
      await db.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "trackingId" text;`);
      await db.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();`);
      await db.query(`ALTER TABLE "claims_status" ALTER COLUMN "orderId" DROP NOT NULL;`);
      
      // Drop key constraint if any
      await db.query(`ALTER TABLE "claims_status" DROP CONSTRAINT IF EXISTS "claims_status_orderId_key" CASCADE;`);
      await db.query(`DROP INDEX IF EXISTS "claims_status_orderId_key";`);
      
      // Add filtered unique index on trackingId (ignoring null and empty strings to prevent conflicts)
      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "claims_status_trackingId_unique_idx" 
        ON "claims_status" ("trackingId") 
        WHERE "trackingId" IS NOT NULL AND "trackingId" != '';
      `);
    } catch (e: any) {
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

    // Ensure "ReturnItem" has an 'lpn' column and isn't misaligned
    try {
      const returnItemCols = await db.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ReturnItem'
      `);
      const colMap = new Set(returnItemCols.rows.map((row: any) => row.column_name.toLowerCase()));
      console.log(`[Schema Match] "ReturnItem" table columns:`, Array.from(colMap));

      if (returnItemCols.rows.length > 0 && !colMap.has('lpn')) {
        if (colMap.has('license-plate-number')) {
          console.log(`[Schema Match] Normalizing "ReturnItem" column "license-plate-number" to "lpn"`);
          await db.query(`ALTER TABLE "ReturnItem" RENAME COLUMN "license-plate-number" TO lpn`);
        } else if (colMap.has('license_plate_number')) {
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
    } catch (colErr: any) {
      console.warn(`[Schema Match] Error checking schema for "ReturnItem":`, colErr.message);
    }

    // Ensure "ItemStatus" has an 'lpn' column
    try {
      const itemStatusCols = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'ItemStatus'
      `);
      const colMap = new Set(itemStatusCols.rows.map((row: any) => row.column_name.toLowerCase()));
      if (itemStatusCols.rows.length > 0 && !colMap.has('lpn')) {
        if (colMap.has('license-plate-number')) {
          console.log(`[Schema Match] Normalizing "ItemStatus" column "license-plate-number" to "lpn"`);
          await db.query(`ALTER TABLE "ItemStatus" RENAME COLUMN "license-plate-number" TO lpn`);
        } else if (colMap.has('license_plate_number')) {
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
    } catch (colErr: any) {
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

    // Backwards compatibility alter column checks
    try {
      await db.query(`ALTER TABLE "qc_status" ADD COLUMN IF NOT EXISTS "target_count" integer NOT NULL DEFAULT 0;`);
    } catch (e: any) {
      console.warn("Backwards compatibility Alter check on qc_status warning:", e.message);
    }

    try {
      await db.query(`ALTER TABLE "qc_status" ADD COLUMN IF NOT EXISTS "scannedAt" timestamp with time zone;`);
    } catch (e: any) {
      console.warn("Backwards compatibility Alter check on qc_status scannedAt warning:", e.message);
    }

    // Seed ReturnItem
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

    // Seed ItemStatus with recovery records
    const countItemStatus = await db.query('SELECT COUNT(*) FROM "ItemStatus"');
    if (parseInt(countItemStatus.rows[0].count) === 0) {
      console.log("Seeding ItemStatus with default records...");
      await db.query(`
        INSERT INTO "ItemStatus" (lpn, status, "recoveryType") VALUES
        ('LPN001', 'inspected', 'Barcode Damaged'),
        ('LPN002', 'inspected', 'Packaging Damaged'),
        ('LPN003', 'inspected', 'Barcode Damaged'),
        ('LPN004', 'inspected', 'Packaging Damaged'),
        ('LPN005', 'inspected', 'Packaging Damaged')
        ON CONFLICT (lpn) DO NOTHING;
      `);
    }

    // Database trigger to sync ItemStatus to sample_recovery
    console.log("Setting up sync trigger on ItemStatus table...");
    await db.query(`
      CREATE OR REPLACE FUNCTION sync_item_status_to_recovery()
      RETURNS TRIGGER AS $$
      DECLARE
        found_sku text;
        mapped_damage_type text;
     BEGIN
        IF LOWER(NEW.status) = 'inspected' THEN
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

            INSERT INTO "sample_recovery" (lpn, sku, damage_type, is_refurbished, status)
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


    await syncClaimsAllTable(db);
  } catch (err: any) {
    console.error('❌ setupDatabaseSchema error:', err.message);
  }
}export async function syncClaimsAllTable(db: pg.Pool): Promise<void> {
  try {
    console.log("Checking and setting up claims_all physical table...");

    // First check existing tables in the database
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = new Set(tablesRes.rows.map(r => r.table_name.toLowerCase()));
    console.log("Existing tables in database:", Array.from(existingTables));

    // Determine candidate table name for customer returns
    let returnsTable = 'AMZ_customer_returns';
    if (!existingTables.has('amz_customer_returns') && existingTables.has('amz_customer_return')) {
      returnsTable = 'AMZ_customer_return';
    }

    // Ensure physical table exists matching the required schema exactly
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

    if (existingTables.has('evidence') || existingTables.has('Evidence')) {
      console.log(`Table "Evidence" found. Building "claims_all" dataset with Evidence as absolute primary source of truth...`);

      // Ensure "shopify_return_tracking" has "orderId" column for correct Shopify integration
      try {
        await db.query(`ALTER TABLE "shopify_return_tracking" ADD COLUMN IF NOT EXISTS "orderId" text;`);
        console.log(`[Schema Match] Added "orderId" column to "shopify_return_tracking" table successfully.`);
      } catch (colErr: any) {
        console.warn(`[Schema Match] "shopify_return_tracking" Column check/alter warning:`, colErr.message);
      }

      const syncSql = `
        TRUNCATE TABLE "claims_all";
        INSERT INTO "claims_all" (
          lpn, "orderId", "trackingId", sku, fnsku, "productName", channel, status, type, "driveLink", "orderDriveLink", "createdAt", qty
        )
        SELECT
          ev.lpn AS lpn,
          ev."orderId" AS "orderId",
          
          -- TERTIARY LOGISTICS ENRICHMENT VIA ORDERID JOIN (AMZ_removal_shipments)
          -- Pull tracking ID tracking-number from AMZ_removal_shipments based on orderId
          COALESCE(
            (
              SELECT sub_ars."tracking-number"
              FROM "AMZ_removal_shipments" sub_ars
              WHERE LOWER(sub_ars."order-id") = LOWER(ev."orderId")
                AND sub_ars."tracking-number" IS NOT NULL AND sub_ars."tracking-number" != ''
                AND (sub_ars.sku = COALESCE(ar.sku, srr.sku, rpr.sku, '') OR sub_ars.fnsku = COALESCE(ar.fnsku, ''))
              LIMIT 1
            ),
            ars."tracking-number",
            (SELECT m."trackingId" FROM "Manifest" m WHERE m.id = ev."manifestId" LIMIT 1),
            (SELECT srt."trackingNumber" FROM "shopify_return_tracking" srt WHERE srt."orderId" = ev."orderId" OR srt."trackingNumber" = (SELECT sr."trackingNumber" FROM "shiprocket_returns" sr WHERE sr.id = ev.lpn LIMIT 1) LIMIT 1),
            ''
          ) AS "trackingId",
          
          -- SECONDARY DATA ENRICHMENT VIA LPN JOIN (AMZ_customer_returns)
          -- Extract and map sku, fnsku, productname, and quantity, defaulting to empty string or fallback tables gracefully
          COALESCE(ar.sku, srr.sku, rpr.sku, '') AS sku,
          COALESCE(ar.fnsku, '') AS fnsku,
          COALESCE(ar."product-name", srr."productName", '') AS "productName",
          
          -- Channel Classification Rule: Retain the exact same legacy logic for checking the channel type to perform lookup actions against the AMZ_removal_order sheet.
          CASE
            WHEN srr.id IS NOT NULL THEN 'Shopify RTO'
            WHEN rpr.id IS NOT NULL THEN 'Shopify RTV'
            WHEN EXISTS (
              SELECT 1 
              FROM "AMZ_removal_orders" ro 
              WHERE ro."order-id" = COALESCE(
                ev."orderId",
                (SELECT rs."order-id" FROM "AMZ_removal_shipments" rs WHERE rs.sku = ar.sku OR rs.fnsku = ar.fnsku LIMIT 1)
              )
            ) THEN 'Amazon B2B'
            ELSE 'AMZ B2C'
          END AS channel,
          
          -- PRIMARY LEVEL LOOKUP: Extract status from Evidence
          COALESCE(ev.status, 'unclaimed') AS status,
          
          -- Evidence.EvidenceType -> Map to claims_all.type
          CASE
            WHEN ev.type::text IN ('PRODUCT_DAMAGE_TYPE', 'PRODUCT_DAMAGE_PHOTO', 'INSPECTOR_REJECTION') THEN 'Damaged'
            WHEN ev.type::text IN ('REJECTED_INSPECTION', 'RECEIVER_REJECTION') THEN 'Rejected'
            ELSE 'Damaged'
          END AS type,
          
          ev."lpnDriveLink" AS "driveLink",
          ev."orderDriveLink" AS "orderDriveLink",
          ev."createdAt" AS "createdAt",
          COALESCE(ar.quantity, srr.quantity, rpr.quantity, 1) AS qty

        FROM "Evidence" ev
        LEFT JOIN "${returnsTable}" ar ON LOWER(ev.lpn) = LOWER(ar."license-plate-number")
        LEFT JOIN (
          SELECT DISTINCT ON (LOWER("order-id")) LOWER("order-id") AS "clean_order_id", "tracking-number"
          FROM "AMZ_removal_shipments"
          WHERE "tracking-number" IS NOT NULL AND "tracking-number" != ''
        ) ars ON LOWER(ev."orderId") = ars."clean_order_id"
        LEFT JOIN "shiprocket_returns" srr ON LOWER(ev.lpn) = LOWER(srr.id)
        LEFT JOIN "return_prime_returns" rpr ON LOWER(ev.lpn) = LOWER(rpr.id);
      `;
      
      await db.query(syncSql);
      console.log('✅ Physical "claims_all" table successfully populated from primary Evidence source of truth.');
    } else {
      console.log('⚠️ Evidence table not found during syncClaimsAllTable. Retaining fallback claims_all structural table.');
    }
  } catch (err: any) {
    console.error('❌ syncClaimsAllTable error:', err.message);
  }
}

function getDbPool() {
  if (!pool) {
    let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
      console.warn("\n⚠️   DATABASE CONNECTION ERROR");
      console.warn("No connection string found. Please:");
      console.warn("1. Verify you have a file named '.env' (NOT .env.example) in the root folder.");
      console.warn("2. Ensure it contains: SUPABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres");
      console.warn("3. Restart the server.\n");
      return null;
    }
    
    // Check if it's an HTTP URL instead of a Postgres URI
    if (connectionString.trim().startsWith('http')) {
      console.error("\n❌ INVALID CONNECTION STRING");
      console.error("The variable SUPABASE_URL seems to be a URL (https://...).");
      console.error("Please use the 'Connection String' URI from Supabase Dashboard > Settings > Database.");
      console.error("It should start with 'postgresql://' or 'postgres://'\n");
      return null;
    }

    // Fix potential typos and hidden characters
    connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');

    if (connectionString.startsWith('hpostgresql://')) {
      connectionString = connectionString.substring(1);
    }
    
    // Sanitize password if it contains common placeholder brackets [PASSWORD]
    const passwordMatch = connectionString.match(/:(.*)@/);
    if (passwordMatch && passwordMatch[1]) {
      let password = passwordMatch[1];
      if (password.startsWith('[') && password.endsWith(']')) {
        const sanitizedPassword = password.substring(1, password.length - 1);
        connectionString = connectionString.replace(password, sanitizedPassword);
        console.log("Self-correction: Removed brackets from password.");
      }
    }

    console.log(`Initializing PostgreSQL Pool...`);
    pool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 10,
      ssl: (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
        ? false 
        : { rejectUnauthorized: false }
    });

      // Test connection and log instructions
      (async () => {
        try {
          const client = await pool.connect();
          console.log("✅ Successfully connected to Supabase PostgreSQL");
          client.release();
          
          if (pool) {
            await setupDatabaseSchema(pool);
          }
        } catch (err: any) {
          console.error("❌ Database connection failed:", err.message);
          
          // If 6543 failed, maybe try 5432 as a last-resort fallback or vice versa
          if (err.message.includes('ECONNREFUSED') || err.message.includes('timeout')) {
            try {
              const https = await import('https');
              https.get('https://api.ipify.org', (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                  const ip = data.trim();
                  console.warn("\n" + "=".repeat(60));
                  console.warn("🛡️  NETWORK CONNECTION ISSUES DETECTED");
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
            } catch (ipErr) { }
          }
        }
      })();

      pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
        process.exit(-1);
      });
    }
    return pool;
}

// Helper to convert snake_case or mixed_case object to camelCase
function toCamelCase(obj: any) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  const newObj: any = {};
  for (const key in obj) {
    // Avoid re-converting if already camelCase (doesn't contain _ or -)
    const camelKey = key.includes('_') || key.includes('-') 
      ? key.replace(/([-_][a-z0-9])/gi, group =>
          group.toUpperCase().replace('-', '').replace('_', '')
        )
      : key;
    newObj[camelKey] = toCamelCase(obj[key]);
  }
  return newObj;
}

import { updateClaimsStatus } from "./scripts/update_claims_status.js";

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = Number(process.env.PORT) || 3000;

  // Start periodic status updates
  updateClaimsStatus().catch(err => console.error("[CRON ERROR] Initial startup sync failed:", err.message));
  setInterval(() => {
    updateClaimsStatus().catch(err => console.error("[CRON ERROR] Failed to update claims status:", err.message));
  }, 60 * 1000 * 10); // Check every 10 minute


  // Mock Claims Database (Fallback)
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
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
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
      type: "Rejected", // Supabase 'Rejected' column value
      status: "New",
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
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
      date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
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
      date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      slaDaysElapsed: 6,
      reason: "Customer Damaged Return",
      reasonDescription: "Item returned by customer in bad packaging.",
      driveLink: "https://drive.google.com/drive/folders/3KPMil0jNl8h_GjVlqXt91iKJenoiNzbM"
    }
  ];

  // Bot state tracking
  let isBotRunning = false;
  let isOtpRequired = false;
  let lastBotRunFinishedAt: number | null = null;
  const COOLING_PERIOD_MS = 1 * 60 * 1000; // 1 minute for testability
  
  // Active/locked Image Generation workspace sessions to prevent concurrent edits
  const lockedSessions = new Set<string>();

  /**
   * Backend database synchronization flow handler for ItemStatus -> sample_recovery.
   * Ties together three tables: "ItemStatus", "ReturnItem", and "sample_recovery".
   */
  async function syncItemStatusToRecoveryFlow(
    lpn: string,
    status: string,
    recoveryType: string
  ): Promise<{ success: boolean; message: string; errorType?: string }> {
    const cleanLpn = (lpn || "").trim();
    const cleanStatus = (status || "").trim();
    const cleanRecoveryType = (recoveryType || "").trim() || "box_damage";

    console.log(`[Sync Flow] Initiating sync flow for LPN: "${cleanLpn}", Status: "${cleanStatus}", RecoveryType: "${cleanRecoveryType}"`);

    if (!cleanLpn) {
      return { success: false, message: "Missing LPN identifier", errorType: "ValidationError" };
    }
    
    // Map according to exact mapping convention:
    // 'Barcode Damaged' -> 'barcode_damage'
    // 'Packaging Damaged' -> 'box_damage'
    let mappedDamageType = "box_damage";
    if (cleanRecoveryType === "Barcode Damaged" || cleanRecoveryType === "barcode_damage") {
      mappedDamageType = "barcode_damage";
    } else if (cleanRecoveryType === "Packaging Damaged" || cleanRecoveryType === "box_damage") {
      mappedDamageType = "box_damage";
    } else {
      mappedDamageType = cleanRecoveryType;
    }

    const pool = getDbPool();
    if (pool) {
      try {
        // Begin transaction
        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Insert or update ItemStatus table
          await client.query(`
            INSERT INTO "ItemStatus" (lpn, status, "recoveryType", "createdAt")
            VALUES ($1, $2, $3, now())
            ON CONFLICT (lpn) DO UPDATE SET
              status = $2,
              "recoveryType" = $3,
              "createdAt" = now()
          `, [cleanLpn, cleanStatus, cleanRecoveryType]);

          // Listen to changes on ItemStatus: only when status = 'inspected'
          if (cleanStatus.toLowerCase() === "inspected") {
            // Relational SKU lookup in ReturnItem table where ReturnItem.lpn === ItemStatus.lpn
            const returnItemRes = await client.query('SELECT sku FROM "ReturnItem" WHERE LOWER(lpn) = LOWER($1)', [cleanLpn]);
            if (returnItemRes.rows.length === 0) {
              const errorMsg = `Relational mapping failed: SKU not found for LPN ${cleanLpn}`;
              // Log the specific error as instructed
              console.error(`❌ [Sync Flow] ${errorMsg}`);
              await client.query("ROLLBACK");
              return { success: false, message: errorMsg, errorType: "RelationalMappingFailed" };
            }

            const sku = returnItemRes.rows[0].sku;

            // gracefull insertions handling edge cases (ON CONFLICT)
            const scannedAt = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            await client.query(`
              INSERT INTO "sample_recovery" (lpn, sku, damage_type, is_refurbished, status, "scannedAt")
              VALUES ($1, $2, $3, false, 'inspected', $4)
              ON CONFLICT (lpn) DO UPDATE SET
                sku = EXCLUDED.sku,
                damage_type = EXCLUDED.damage_type,
                status = 'inspected',
                "scannedAt" = COALESCE("sample_recovery"."scannedAt", EXCLUDED."scannedAt")
            `, [cleanLpn, sku, mappedDamageType, scannedAt]);

            console.log(`[Sync Flow] Successfully synchronized LPN ${cleanLpn} to sample_recovery with SKU ${sku}`);
          }

          await client.query("COMMIT");
          return { success: true, message: `Successfully synchronized and stored ItemStatus config for LPN ${cleanLpn}.` };
        } catch (err: any) {
          await client.query("ROLLBACK");
          console.error(`[Sync Flow] Transaction rollback for ${cleanLpn}:`, err);
          throw err;
        } finally {
          client.release();
        }
      } catch (err: any) {
        return { success: false, message: `Database synchronization handler failed: ${err.message}` };
      }
    } else {
      // Mock Fallback Model
      const existingIdx = mockItemStatus.findIndex((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
      if (existingIdx !== -1) {
        mockItemStatus[existingIdx].status = cleanStatus;
        mockItemStatus[existingIdx].recoveryType = cleanRecoveryType;
      } else {
        mockItemStatus.push({
          lpn: cleanLpn,
          status: cleanStatus,
          recoveryType: cleanRecoveryType,
          createdAt: new Date().toISOString()
        });
      }

      if (cleanStatus.toLowerCase() === "inspected") {
        const foundReturnItem = mockReturnItems.find((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
        if (!foundReturnItem) {
          const errorMsg = `Relational mapping failed: SKU not found for LPN ${cleanLpn}`;
          console.error(`❌ [Sync Flow Mock] ${errorMsg}`);
          return { success: false, message: errorMsg, errorType: "RelationalMappingFailed" };
        }

        const sku = foundReturnItem.sku;

        // Sync into mockSampleRecovery
        const existingRecoveryIdx = mockSampleRecovery.findIndex((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
        const scannedAt = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const recoveryRecord = {
          lpn: cleanLpn,
          sku,
          damage_type: mappedDamageType,
          is_refurbished: false,
          status: "inspected" as any,
          scannedAt: existingRecoveryIdx !== -1 ? (mockSampleRecovery[existingRecoveryIdx].scannedAt || scannedAt) : scannedAt
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

  async function handleEvidenceTypeClaimedUpdate(db: any, orderId: string | undefined, status: string | undefined) {
    if (!db || !orderId || !status) return;
    if (status.toLowerCase() === 'claimed') {
      try {
        const claimCheck = await db.query(
          `SELECT "type" FROM "claims_all" WHERE "orderId" = $1 LIMIT 1`,
          [orderId]
        );
        if (claimCheck.rows.length > 0 && claimCheck.rows[0].type === 'Rejected') {
          try {
            await db.query(`UPDATE "Evidence" SET "status" = 'Claimed' WHERE "orderId" = $1`, [orderId]);
            console.log(`[Evidence Update] Updated Evidence.status to 'Claimed' for Order ID: ${orderId}`);
          } catch (evErr) {
            try {
              await db.query(`UPDATE "evidence" SET "status" = 'Claimed' WHERE "orderId" = $1`, [orderId]);
              console.log(`[Evidence Update fallback] Updated evidence.type to 'Claimed' for Order ID: ${orderId}`);
            } catch (innerEvErr: any) {
              console.error(`[Evidence Update] Failed both Evidence and evidence table updates: ${innerEvErr.message}`);
            }
          }
        }
      } catch (e: any) {
        console.error(`[Evidence Update Check] Lookup failed: ${e.message}`);
      }
    }
  }

  // API Routes
  app.get("/api/item-status", async (req, res, next) => {
    try {
      const pool = getDbPool();
      if (pool) {
        const result = await pool.query('SELECT * FROM "ItemStatus" ORDER BY "createdAt" DESC');
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
      const pool = getDbPool();
      if (pool) {
        const result = await pool.query('SELECT * FROM "ReturnItem"');
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
      const pool = getDbPool();
      if (pool) {
        await pool.query('INSERT INTO "ReturnItem" (lpn, sku) VALUES ($1, $2) ON CONFLICT (lpn) DO UPDATE SET sku = EXCLUDED.sku', [lpn.trim(), sku.trim()]);
      } else {
        const idx = mockReturnItems.findIndex(item => item.lpn.toLowerCase() === lpn.trim().toLowerCase());
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
      const search = (req.query.search as string || "").trim();
      if (!search) {
        return res.status(400).json({ status: "Error", message: "Missing search identifier" });
      }

      const pool = getDbPool();
      let foundItem: any = null;

      if (pool) {
        // Determine active returns table
        let activeReturnsTable = 'AMZ_customer_returns';
        try {
          const tableCheck = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND LOWER(table_name) IN ('amz_customer_returns', 'amz_customer_return')
            LIMIT 1
          `);
          if (tableCheck.rows.length > 0) {
            activeReturnsTable = tableCheck.rows[0].table_name;
          }
        } catch (e: any) {
          console.warn("Table schema check failed:", e.message);
        }

        // Dynamically build a set of candidate LPNs
        const candidateLpns = new Set<string>();
        candidateLpns.add(search.toLowerCase());

        // 1. Resolve potential LPNS via ReturnItem
        try {
          const retItemRes = await pool.query('SELECT lpn FROM "ReturnItem" WHERE LOWER(sku) = LOWER($1)', [search]);
          for (const r of retItemRes.rows) {
            if (r.lpn) candidateLpns.add(r.lpn.toLowerCase());
          }
        } catch (e) {}

        // 2. Resolve potential LPNS via AMZ_customer_returns
        try {
          const returnsCheck = await pool.query(`
            SELECT "license-plate-number" AS lpn FROM "${activeReturnsTable}" 
            WHERE LOWER(sku) = LOWER($1)
          `, [search]);
          for (const r of returnsCheck.rows) {
            if (r.lpn) candidateLpns.add(r.lpn.toLowerCase());
          }
        } catch (e) {}

        // 3. Resolve potential LPNS via optional claims_amz if it exists
        try {
          const viewCheck = await pool.query(`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'claims_all'
            UNION ALL
            SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'claims_all'
          `);
          if (viewCheck.rows.length > 0) {
            const claimsRes = await pool.query('SELECT lpn FROM "claims_all" WHERE LOWER(sku) = LOWER($1)', [search]);
            for (const r of claimsRes.rows) {
              if (r.lpn) candidateLpns.add(r.lpn.toLowerCase());
            }
          }
        } catch (e) {}

        const candidateList = Array.from(candidateLpns);

        // Look up item in ItemStatus with status === 'inspected' or 'review declined' (case insensitive) among the solved LPNS
        const lookupRes = await pool.query(`
          SELECT i.lpn, i.status, i."recoveryType"
          FROM "ItemStatus" i
          WHERE LOWER(i.lpn) = ANY($1) AND (LOWER(i.status) = 'inspected' OR LOWER(i.status) = 'review declined' OR LOWER(i.status) = 'missing at recovery')
          LIMIT 1
        `, [candidateList]);

        if (lookupRes.rows.length > 0) {
          const itemStatusRow = lookupRes.rows[0];
          const lpn = itemStatusRow.lpn;
          let rawRecoveryType = itemStatusRow.recoveryType || 'Barcode Damaged';
          
          if (rawRecoveryType.toLowerCase().includes('barcode')) {
            rawRecoveryType = 'Barcode Damaged';
          } else if (rawRecoveryType.toLowerCase().includes('box') || rawRecoveryType.toLowerCase().includes('packaging')) {
            rawRecoveryType = 'Packaging Damaged';
          }

          // Fetch correct sku string from AMZ_customer_returns (or fallbacks)
          let sku = '';
          try {
            const returnsCheck = await pool.query(`
              SELECT sku FROM "${activeReturnsTable}" 
              WHERE LOWER("license-plate-number") = LOWER($1) 
              LIMIT 1
            `, [lpn]);
            if (returnsCheck.rows.length > 0) {
              sku = returnsCheck.rows[0].sku;
            }
          } catch (e: any) {
            console.log(`Could not query ${activeReturnsTable} directly:`, e.message);
          }

          if (!sku) {
            try {
              const retItemRes = await pool.query('SELECT sku FROM "ReturnItem" WHERE LOWER(lpn) = LOWER($1) LIMIT 1', [lpn]);
              if (retItemRes.rows.length > 0) {
                sku = retItemRes.rows[0].sku;
              }
            } catch (e) {}
          }
          if (!sku) {
            try {
              const viewCheck = await pool.query(`
                SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'claims_all'
                UNION ALL
                SELECT table_name FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'claims_all'
              `);
              if (viewCheck.rows.length > 0) {
                const claimsRes = await pool.query('SELECT sku FROM "claims_all" WHERE LOWER(lpn) = LOWER($1) LIMIT 1', [lpn]);
                if (claimsRes.rows.length > 0) {
                  sku = claimsRes.rows[0].sku;
                }
              }
            } catch (e) {}
          }
          if (!sku) {
            sku = "UNKNOWN";
          }

          // Upsert directly into sample_recovery
          const scannedAt = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
          await pool.query(`
            INSERT INTO "sample_recovery" (lpn, sku, damage_type, is_refurbished, status, "scannedAt")
            VALUES ($1, $2, $3, false, 'inspected', $4)
            ON CONFLICT (lpn) 
            DO UPDATE SET 
              sku = EXCLUDED.sku,
              damage_type = EXCLUDED.damage_type,
              status = 'inspected',
              "scannedAt" = COALESCE("sample_recovery"."scannedAt", EXCLUDED."scannedAt")
          `, [lpn, sku, rawRecoveryType, scannedAt]);

          const syncedRes = await pool.query('SELECT * FROM "sample_recovery" WHERE LOWER(lpn) = LOWER($1) LIMIT 1', [lpn]);
          if (syncedRes.rows.length > 0) {
            foundItem = toCamelCase(syncedRes.rows[0]);
          }
        } else {
          // resilient search direct inside sample_recovery
          const fallbackRes = await pool.query('SELECT * FROM "sample_recovery" WHERE LOWER(lpn) = LOWER($1) OR LOWER(sku) = LOWER($1) LIMIT 1', [search]);
          if (fallbackRes.rows.length > 0) {
            foundItem = toCamelCase(fallbackRes.rows[0]);
          }
        }
      } else {
        // Mock fallback logic
        const mockIs = mockItemStatus.find(i => 
          (i.lpn.toLowerCase() === search.toLowerCase() || 
           (mockReturnItems.find(r => r.lpn === i.lpn && r.sku.toLowerCase() === search.toLowerCase()))) &&
          (i.status.toLowerCase() === 'inspected' || i.status.toLowerCase() === 'review declined' || i.status.toLowerCase() === 'missing at recovery')
        );

        if (mockIs) {
          const lpn = mockIs.lpn;
          let rawRecoveryType = mockIs.recoveryType || 'Barcode Damaged';
          if (rawRecoveryType.toLowerCase().includes('barcode')) {
            rawRecoveryType = 'Barcode Damaged';
          } else if (rawRecoveryType.toLowerCase().includes('box') || rawRecoveryType.toLowerCase().includes('packaging')) {
            rawRecoveryType = 'Packaging Damaged';
          }

          const returnItem = mockReturnItems.find(r => r.lpn.toLowerCase() === lpn.toLowerCase());
          const sku = returnItem ? returnItem.sku : 'UNKNOWN';

          const existingIdx = mockSampleRecovery.findIndex(s => s.lpn.toLowerCase() === lpn.toLowerCase());
          const scannedAt = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
          const syncedRecord = {
            lpn,
            sku,
            damage_type: rawRecoveryType,
            is_refurbished: false,
            status: 'inspected',
            scannedAt: existingIdx !== -1 ? (mockSampleRecovery[existingIdx].scannedAt || scannedAt) : scannedAt
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
            status: syncedRecord.status,
            scannedAt: syncedRecord.scannedAt
          };
        } else {
          const existingRecord = mockSampleRecovery.find(s => s.lpn.toLowerCase() === search.toLowerCase() || s.sku.toLowerCase() === search.toLowerCase());
          if (existingRecord) {
            foundItem = {
              lpn: existingRecord.lpn,
              sku: existingRecord.sku,
              damageType: existingRecord.damage_type,
              isRefurbished: existingRecord.is_refurbished,
              status: existingRecord.status,
              scannedAt: existingRecord.scannedAt || null
            };
          }
        }
      }

      if (foundItem) {
        return res.json(foundItem);
      }
      return res.status(404).json({ status: "Error", message: "Item not found or status is not 'inspected' or 'review declined' inside tracking inventory." });
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

      const pool = getDbPool();
      const currentTimestamp = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

      if (pool) {
        await pool.query(`
          UPDATE "sample_recovery"
          SET is_refurbished = $2, status = $3, "scannedAt" = COALESCE("scannedAt", $4)
          WHERE LOWER(lpn) = LOWER($1)
        `, [lpn, is_refurbished, recordStatus, currentTimestamp]);

        await pool.query(`
          UPDATE "ItemStatus"
          SET status = $2
          WHERE LOWER(lpn) = LOWER($1)
        `, [lpn, recordStatus]);

        console.log(`[DB] Two-way status update synced successfully to 'sample_recovery' and 'ItemStatus' for ${lpn}`);
      } else {
        const idx = mockSampleRecovery.findIndex(item => item.lpn.toLowerCase() === lpn.toLowerCase());
        if (idx !== -1) {
          mockSampleRecovery[idx].is_refurbished = is_refurbished;
          mockSampleRecovery[idx].status = recordStatus;
          if (!mockSampleRecovery[idx].scannedAt) {
            mockSampleRecovery[idx].scannedAt = currentTimestamp;
          }
        } else {
          mockSampleRecovery.push({
            lpn,
            sku: sku || "UNKNOWN",
            damage_type,
            is_refurbished,
            status: recordStatus,
            scannedAt: currentTimestamp
          });
        }

        const isIdx = mockItemStatus.findIndex(item => item.lpn.toLowerCase() === lpn.toLowerCase());
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
      const activeLpns = (scannedLpns || []).map((l: string) => l.toLowerCase());
      
      const pool = getDbPool();
      let expectedItems: string[] = [];

      if (pool) {
        const result = await pool.query('SELECT lpn FROM "ItemStatus" WHERE LOWER(status) = \'inspected\'');
        expectedItems = result.rows.map(r => r.lpn);
      } else {
        expectedItems = mockItemStatus.filter(i => i.status.toLowerCase() === 'inspected').map(i => i.lpn);
      }

      const unscannedItems = expectedItems.filter(lpn => !activeLpns.includes(lpn.toLowerCase()));

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
      const activeLpns = (scannedLpns || []).map((l: string) => l.toLowerCase());

      const pool = getDbPool();
      let updatedCount = 0;

      if (pool) {
        const result = await pool.query('SELECT lpn FROM "ItemStatus" WHERE LOWER(status) = \'inspected\'');
        const expectedItems = result.rows.map(r => r.lpn);
        const unscanned = expectedItems.filter(lpn => !activeLpns.includes(lpn.toLowerCase()));

        if (unscanned.length > 0) {
          await pool.query(
            'UPDATE "ItemStatus" SET status = \'missing at recovery\' WHERE LOWER(lpn) = ANY($1)',
            [unscanned.map(l => l.toLowerCase())]
          );
          updatedCount = unscanned.length;
        }
      } else {
        const expectedItems = mockItemStatus.filter(i => i.status.toLowerCase() === 'inspected').map(i => i.lpn);
        const unscanned = expectedItems.filter(lpn => !activeLpns.includes(lpn.toLowerCase()));

        unscanned.forEach(lpn => {
          const idx = mockItemStatus.findIndex(i => i.lpn.toLowerCase() === lpn.toLowerCase());
          if (idx !== -1) {
            mockItemStatus[idx].status = 'missing at recovery';
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
      const pool = getDbPool();
      let rawRows = [];

      if (pool) {
        // Dynamic real-time incremental synchronizer from Amazon & Shopify sources
        try {
          await syncClaimsAllTable(pool);
        } catch (syncErr: any) {
          console.warn('[Real-time Sync WARNING] Failed to dynamically sync claims_all table:', syncErr.message);
        }

         // Query Evidence table to find valid identifiers
        let evidenceOrderIds = new Set<string>();
        let evidenceLpns = new Set<string>();
        try {
          const evidenceRes = await pool.query('SELECT DISTINCT "orderId", "lpn" FROM "Evidence"');
          evidenceRes.rows.forEach(r => {
            if (r.orderId) evidenceOrderIds.add(String(r.orderId).trim().toLowerCase());
            if (r.lpn) evidenceLpns.add(String(r.lpn).trim().toLowerCase());
          });
        } catch (e: any) {
          console.warn('[DB WARNING] Could not query "Evidence" table matching identifiers:', e.message);
        }

        
        try {
          const result = await pool.query(`
            SELECT c.*, s.status AS db_status, s."claimId" AS db_claim_id, s.bot_log_reason 
            FROM "claims_all" c 
            LEFT JOIN "claims_status" s ON (c."trackingId" IS NOT NULL AND c."trackingId" != '' AND c."trackingId" = s."trackingId") OR ((c."trackingId" IS NULL OR c."trackingId" = '') AND c."orderId" = s."orderId")
          `);
          rawRows = result.rows;
        } catch (error: any) {
          console.log(`SQL error with "claims_all" table: ${error.message}. Retrying with fallback tables...`);
          try {
            const fallbackResult = await pool.query('SELECT * FROM claims');
            rawRows = fallbackResult.rows;
          } catch (innerError: any) {
            try {
              const innerFallbackResult = await pool.query('SELECT * FROM "Claims"');
              rawRows = innerFallbackResult.rows;
            } catch (deepError: any) {
              console.error("Database fetch failure - using mock data fallback.");
              rawRows = [...mockClaims];
            }
          }
        }
        
        // Apply robust Evidence existence filtering: do not fetch/show entry if it has no record in the Evidence table
        rawRows = rawRows.filter((row: any) => {
          const oId = (row.orderId || row.orderid || "").trim().toLowerCase();
          const lpn = (row.lpn || "").trim().toLowerCase();
          return (oId && evidenceOrderIds.has(oId)) || (lpn && evidenceLpns.has(lpn));
        });

      } else {
        rawRows = [...mockClaims];
      }

      // Process and Group Rows
      const now = Date.now();
      const processedMap: Record<string, any> = {};

      rawRows.forEach((row: any) => {
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

        // Normalize 'Rejected' type which means 'RejectedDelivery'
        const typeStr = (data.type || "").toLowerCase();
        if (typeStr === 'rejected' || typeStr === 'rejecteddelivery') {
          data.type = 'RejectedDelivery';
        }

        // Calculate SLA Days Elapsed
        const rowDate = data.date || data.createdAt || data.created_at;
        if (rowDate) {
          const diffMs = now - new Date(rowDate).getTime();
          data.slaDaysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        // Grouping key: Tracking ID
        const tid = data.trackingId || data.orderId || data.lpn || 'N/A';
        const key = tid;

        const rowQty = typeof data.qty === 'number' ? data.qty : 1;
        if (!processedMap[key]) {
          processedMap[key] = {
            ...data,
            qty: rowQty,
            uniqueSkus: [{
              sku: data.sku || '',
              fnsku: data.fnsku || '',
              productName: data.productName || ''
            }],
            items: [data]
          };
        } else {
          processedMap[key].qty += rowQty;
          processedMap[key].items.push(data);
          if (data.sku && !processedMap[key].uniqueSkus.some((s: any) => s.sku === data.sku)) {
            processedMap[key].uniqueSkus.push({
              sku: data.sku || '',
              fnsku: data.fnsku || '',
              productName: data.productName || ''
            });
          }
        }
      });

      res.json(Object.values(processedMap));
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/bot/config", (req, res) => {
    const now = Date.now();
    const coolingRemaining = lastBotRunFinishedAt 
      ? Math.max(0, COOLING_PERIOD_MS - (now - lastBotRunFinishedAt)) 
      : 0;

    res.json({
      configured: !!(process.env.AMAZON_EMAIL && process.env.AMAZON_PASSWORD && process.env.AMAZON_TOTP_SECRET),
      email: process.env.AMAZON_EMAIL || null,
      hasTotp: !!process.env.AMAZON_TOTP_SECRET,
      headless: process.env.HEADLESS_MODE === 'true',
      isBotRunning,
      isOtpRequired,
      coolingRemainingMs: coolingRemaining,
      isAvailable: !isBotRunning && coolingRemaining === 0
    });
  });

  app.get("/api/bot/logs/:id", (req, res) => {
    const { id } = req.params;
    const logPath = path.join(process.cwd(), 'bot_logs', `${id}.log`);
    
    if (fs.existsSync(logPath)) {
      const logs = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
      res.json({ logs });
    } else {
      res.json({ logs: ["No logs found for this task."] });
    }
  });

  app.get("/api/bot/live-view", (req, res) => {
    const screenshotPath = path.join(process.cwd(), 'bot_state', 'live.png');
    if (fs.existsSync(screenshotPath)) {
      res.sendFile(screenshotPath);
    } else {
      res.status(404).send("No live view available.");
    }
  });



  app.post("/api/bot/trigger", async (req, res) => {
    const { claimId, orderId, lpn } = req.body;
    const now = Date.now();

    // Find the claim record to pass full context
    const pool = getDbPool();
    let claimData: any = null;
    
    if (pool) {
      const db = pool;
      try {
        const tid = (lpn || claimId || orderId || "").trim();
        if (!tid) throw new Error("No ID provided");

        // Try table names: quoted '"claims_all"', lowercase 'claims', etc.
        const tables = ['"claims_all"'];
        for (const table of tables) {
          // Get column names for this table to avoid "column does not exist" errors
          const colRes = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = ${table.includes('"') ? `'${table.replace(/"/g, '')}'` : `'${table}'`}
          `);
          const columns = colRes.rows.map(r => r.column_name.toLowerCase());
          
          if (columns.length === 0) continue;

          const searchTerms = [];
          if (columns.includes('lpn')) searchTerms.push('lpn ILIKE $1');
          if (columns.includes('claimid')) searchTerms.push('"claimId" ILIKE $1');
          if (columns.includes('orderid')) searchTerms.push('"orderId" ILIKE $1');
          if (columns.includes('trackingid')) searchTerms.push('"trackingId" ILIKE $1');
          if (columns.includes('claim_id')) searchTerms.push('claim_id ILIKE $1');
          if (columns.includes('order_id')) searchTerms.push('order_id ILIKE $1');
          if (columns.includes('tracking_id')) searchTerms.push('tracking_id ILIKE $1');

          if (searchTerms.length === 0) continue;

          const query = `
            SELECT * FROM ${table} 
            WHERE (${searchTerms.join(' OR ')})
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
      claimData = mockClaims.find(c => 
        (c.lpn?.toLowerCase() === tid) || 
        (c.claimId?.toLowerCase() === tid) || 
        (c.orderId?.toLowerCase() === tid) || 
        (c.trackingId?.toLowerCase() === tid)
      );
    }

    if (!claimData) {
      return res.status(404).json({ status: "Error", message: "No claim record found." });
    }

    // Strict bot automation exclusion for Shopify channels
    if (claimData && claimData.channel) {
      const channelLower = claimData.channel.toLowerCase();
      const allowedChannels = ['amazon b2b', 'amz b2c', 'amazon b2c'];
      if (!allowedChannels.includes(channelLower)) {
        return res.status(400).json({
          status: "Error",
          message: `The background automated bot cannot process Shopify channels. Automation is restricted strictly to Amazon channels ('Amazon B2B', 'AMZ/B2c', or 'amazon b2c').`
        });
      }
    }

    // Refactored bot pipeline: enforce 'Ready for claim' status constraint
    if (claimData) {
      const statusLower = (claimData.status || "").trim().toLowerCase();
      if (statusLower !== "ready for claim") {
        return res.status(400).json({
          status: "Error",
          message: `This claim cannot be processed by the automated filing bots. Bots execute strictly upon receiving the 'Ready for claim' status signature. Current status is: '${claimData.status || "unclaimed"}'.`
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

    if (lastBotRunFinishedAt && (now - lastBotRunFinishedAt < COOLING_PERIOD_MS)) {
      const remaining = Math.ceil((COOLING_PERIOD_MS - (now - lastBotRunFinishedAt)) / 1000 / 60);
      return res.status(429).json({ 
        status: "Error", 
        message: `Bot is in cooling period. Please try again in ${remaining} minute(s).` 
      });
    }

    console.log(`[BOT TRIGGER] Filing claim ${identifier} with real Playwright script...`);
    isBotRunning = true;
    isOtpRequired = false; // Reset on new run
    
    // Non-blocking execution
    fileAmazonClaim(claimData).then(result => {
      console.log(`[BOT RESULT] ${identifier}:`, result);
      // @ts-ignore
      if (result.otpRequired) {
        isOtpRequired = true;
      }
      if (result.success) {
        const db = getDbPool();
        if (db) {
          const tid = claimData.trackingId || '';
          const oid = claimData.orderId || '';
          
          if (tid) {
            // 1. Insert or update claims_status to reflect 'Claimed' strictly by trackingId
            db.query(
              `INSERT INTO "claims_status" ("orderId", "trackingId", "claimId", status)
               VALUES ($1, $2, $3, 'Claimed')
               ON CONFLICT ("trackingId") 
               DO UPDATE SET 
                 status = 'Claimed', 
                 "claimId" = COALESCE(NULLIF(EXCLUDED."claimId", ''), "claims_status"."claimId", ''), 
                 "orderId" = COALESCE("claims_status"."orderId", EXCLUDED."orderId")`,
              [oid, tid, result.caseId || '']
            ).then(() => {
              console.log(`[DB SUCCESS] Recorded claimed status in claims_status for Tracking ID: ${tid}`);
            }).catch(dbErr => {
              console.error(`[DB ERROR] Failed to record status in claims_status:`, dbErr);
            });
            
            // 2. Update status in claims_all strictly by trackingId
            db.query(
              `UPDATE "claims_all" SET status = 'Claimed' WHERE "trackingId" = $1`,
              [tid]
            ).catch(() => {});
          } else {
            // Fallback to orderId if trackingId is missing (backwards compatibility)
            db.query(
              `INSERT INTO "claims_status" ("orderId", "claimId", status)
               VALUES ($1, $2, 'Claimed')
               ON CONFLICT ("orderId") 
               DO UPDATE SET 
                 status = 'Claimed', 
                 "claimId" = COALESCE(NULLIF(EXCLUDED."claimId", ''), "claims_status"."claimId", '')`,
              [oid, result.caseId || '']
            ).then(() => {
              console.log(`[DB SUCCESS] Recorded claimed status in claims_status for Order ID: ${oid}`);
            }).catch(dbErr => {
              console.error(`[DB ERROR] Failed to record status in claims_statusFallback:`, dbErr);
            });
            
            db.query(
              `UPDATE "claims_all" SET status = 'Claimed' WHERE lpn = $1 OR "orderId" = $2`,
              [claimData.lpn || '', oid]
            ).catch(() => {});
          }

          // 3. Conditional Evidence table type update
          handleEvidenceTypeClaimedUpdate(db, claimData.orderId, 'Claimed');
        }
      }
    }).catch(err => {
      console.error(`[BOT ERROR] ${identifier}:`, err);
    }).finally(() => {
      isBotRunning = false;
      lastBotRunFinishedAt = Date.now();
    });

    res.json({ 
      status: "Queued", 
      id: `BT-${Math.floor(Math.random() * 10000)}`,
      message: "Filing script initialized in background." 
    });
  });

  // --- QC AUDIT ENDPOINTS ---
  app.get("/api/qc/sku-status", async (req, res, next) => {
    try {
      const db = getDbPool();
      let rows = [];
      if (db) {
        // Calculate the freshest target counts from Supabase expected pool criteria
        const targetsRes = await db.query(`
          WITH expected_items AS (
            -- ItemStatus 'good', 'recovered', or 'review declined'
            SELECT r.sku, i.lpn AS item_id
            FROM "ItemStatus" i
            JOIN "ReturnItem" r ON i.lpn = r.lpn
            WHERE i.status = 'good' OR i.status = 'recovered' OR i.status = 'review declined'
            
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

        // First set target_count = 0 for active items not inside the target pool anymore
        await db.query(`UPDATE "qc_status" SET target_count = 0`);

        // Upsert dynamic target counts for SKU’s in expected pool
        for (const row of targetsRes.rows) {
          await db.query(`
            INSERT INTO "qc_status" (sku, target_count, quantity_count, status)
            VALUES ($1, $2, 0, 'unscanned')
            ON CONFLICT (sku) 
            DO UPDATE SET target_count = EXCLUDED.target_count
          `, [row.sku, row.target_count]);
        }

        // Return list for SKUs where target_count > 0 only (FILTER GATE)
        const query = `
          SELECT 
            sku,
            target_count as expected_count,
            target_count,
            quantity_count,
            COALESCE(status, 'unscanned') as status,
            "scannedAt",
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
        // Mock fallback calculations
        const computedTargets: Record<string, number> = {};
        
        // 1. mockItemStatus good/recovered or review declined
        mockItemStatus.forEach((i: any) => {
          if (i.status === 'good' || i.status === 'recovered' || i.status === 'review declined') {
            const rit = mockReturnItems.find(r => r.lpn === i.lpn);
            const sku = rit ? rit.sku : 'UNKNOWN';
            if (sku && sku !== 'UNKNOWN') {
              computedTargets[sku] = (computedTargets[sku] || 0) + 1;
            }
          }
        });
        
        // 2. mockClaims rejected
        mockClaims.forEach((c: any) => {
          if (c.status === 'rejected' || c.status?.toLowerCase() === 'rejected') {
            const sku = c.sku;
            if (sku) {
              computedTargets[sku] = (computedTargets[sku] || 0) + 1;
            }
          }
        });
        
        // Seed mockQcStatus with computed target values
        Object.entries(computedTargets).forEach(([sku, targetCount]) => {
          let item = mockQcStatus.find(q => q.sku === sku);
          if (!item) {
            item = { sku, quantity_count: 0, status: 'unscanned', target_count: targetCount };
            mockQcStatus.push(item);
          } else {
            item.target_count = targetCount;
          }
        });
        
        // Set other items target_count to 0
        mockQcStatus.forEach(item => {
          if (!computedTargets[item.sku]) {
            item.target_count = 0;
          }
        });

        // Filter out elements where target_count === 0
        rows = mockQcStatus
          .filter(q => (q.target_count || 0) > 0)
          .map(q => {
            const matchingLpns = mockReturnItems.filter(r => r.sku === q.sku).map(r => r.lpn);
            const has_hidden_damaged = mockItemStatus.some(i => matchingLpns.includes(i.lpn) && i.status.toLowerCase() === 'damaged');
            return {
              sku: q.sku,
              quantity_count: q.quantity_count || 0,
              status: q.status || 'unscanned',
              expected_count: q.target_count,
              target_count: q.target_count,
              scannedAt: q.scannedAt || null,
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
      let dbStatus = 'ok';
      let expectedCount = 1;
      let hasHiddenDamaged = false;
      let scannedAtVal: Date | null = null;

      if (db) {
        // First check if the SKU exists in the expected pool / has target_count > 0 in qc_status
        const poolCheckRes = await db.query(`
          SELECT target_count, quantity_count, status, "scannedAt" FROM "qc_status" WHERE sku = $1
        `, [sku]);
        
        if (poolCheckRes.rows.length === 0 || poolCheckRes.rows[0].target_count === 0) {
          return res.status(404).json({
            message: `SKU ${sku} is not part of the active expected QC audit pool.`
          });
        }
        
        expectedCount = poolCheckRes.rows[0].target_count;
        quantityCount = poolCheckRes.rows[0].quantity_count + 1;
        const existingScannedAt = poolCheckRes.rows[0].scannedAt;
        scannedAtVal = existingScannedAt;

        if (!existingScannedAt) {
          scannedAtVal = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        }
        
        if (quantityCount < expectedCount) {
          dbStatus = 'quantity missing';
        } else {
          dbStatus = 'ok';
        }
        
        await db.query(`
          UPDATE "qc_status" 
          SET quantity_count = $1, status = $2, "scannedAt" = $3 
          WHERE sku = $4
        `, [quantityCount, dbStatus, scannedAtVal, sku]);

        // Cross-reference hidden damaged
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
        // Mock fallback
        let item = mockQcStatus.find((q: any) => q.sku === sku);
        if (!item || (item.target_count || 0) === 0) {
          return res.status(404).json({
            message: `SKU ${sku} is not part of the active expected QC audit pool.`
          });
        }
        
        item.quantity_count = (item.quantity_count || 0) + 1;
        quantityCount = item.quantity_count;
        expectedCount = item.target_count;
        
        if (quantityCount < expectedCount) {
          item.status = 'quantity missing';
        } else {
          item.status = 'ok';
        }
        dbStatus = item.status;

        if (!item.scannedAt) {
          item.scannedAt = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        }
        scannedAtVal = item.scannedAt;

        const matchingLpns = mockReturnItems.filter((r: any) => r.sku === sku).map((r: any) => r.lpn);
        hasHiddenDamaged = mockItemStatus.some((i: any) => matchingLpns.includes(i.lpn) && i.status.toLowerCase() === 'damaged');
      }

      res.json({
        status: "Success",
        sku,
        quantity_count: quantityCount,
        expected_count: expectedCount,
        target_count: expectedCount,
        qc_status: dbStatus,
        scannedAt: scannedAtVal,
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
        // Update qc_status to 'requires review at qc'
        await db.query(`
          INSERT INTO "qc_status" (sku, target_count, quantity_count, status)
          VALUES ($1, 0, 0, 'requires review at qc')
          ON CONFLICT (sku)
          DO UPDATE SET status = 'requires review at qc'
        `, [sku]);

        // Find LPNs of that SKU
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
        let item = mockQcStatus.find((q: any) => q.sku === sku);
        if (!item) {
          item = { sku, quantity_count: 0, target_count: 0, status: 'requires review at qc' };
          mockQcStatus.push(item);
        } else {
          item.status = 'requires review at qc';
        }

        const matchingLpns = mockReturnItems.filter((r: any) => r.sku === sku).map((r: any) => r.lpn);
        matchingLpns.forEach(lpn => {
          let statusItem = mockItemStatus.find((i: any) => i.lpn === lpn);
          if (statusItem) {
            statusItem.status = 'requires review at qc';
          } else {
            mockItemStatus.push({ lpn, status: 'requires review at qc' });
          }
        });
      }
      res.json({ status: "Success", message: `SKU ${sku} marked as damaged (requires review at QC)` });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/admin/reviews", async (req, res, next) => {
    try {
      const db = getDbPool();
      let reviews = [];
      if (db) {
        // 1. Fetch Recovery reviews
        const recRes = await db.query(`
          SELECT lpn, sku, damage_type, status 
          FROM "sample_recovery" 
          WHERE status = 'requires review at recovery'
        `);
        for (const row of recRes.rows) {
          reviews.push({
            id: `recovery-${row.lpn}`,
            type: 'RECOVERY',
            lpn: row.lpn,
            sku: row.sku,
            damage_type: row.damage_type,
            status: row.status
          });
        }

        // 2. Fetch QC reviews (matching SKU to any associated LPN from ReturnItem)
        const qcRes = await db.query(`
          SELECT q.sku, q.status, COALESCE(r.lpn, 'UNKNOWN') as lpn
          FROM "qc_status" q
          LEFT JOIN (
            SELECT DISTINCT ON (sku) sku, lpn FROM "ReturnItem" ORDER BY sku, lpn
          ) r ON q.sku = r.sku
          WHERE q.status = 'requires review at qc'
        `);
        for (const row of qcRes.rows) {
          reviews.push({
            id: `qc-${row.sku}`,
            type: 'QC',
            lpn: row.lpn,
            sku: row.sku,
            damage_type: 'QC Flagged Damage',
            status: row.status
          });
        }
      } else {
        // Mock source
        const recs = mockSampleRecovery.filter(item => item.status === 'requires review at recovery');
        recs.forEach(row => {
          reviews.push({
            id: `recovery-${row.lpn}`,
            type: 'RECOVERY',
            lpn: row.lpn,
            sku: row.sku,
            damage_type: row.damage_type,
            status: row.status
          });
        });

        const qcs = mockQcStatus.filter(item => item.status === 'requires review at qc');
        qcs.forEach(row => {
          const rit = mockReturnItems.find(r => r.sku === row.sku);
          reviews.push({
            id: `qc-${row.sku}`,
            type: 'QC',
            lpn: rit ? rit.lpn : 'UNKNOWN',
            sku: row.sku,
            damage_type: 'QC Flagged Damage',
            status: row.status
          });
        });
      }
      res.json({ status: "Success", reviews });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/reviews/resolve", async (req, res, next) => {
    try {
      const { type, lpn, sku, action } = req.body;
      const db = getDbPool();
      const targetStatus = action === 'approve' ? 'reinspection' : 'review declined';

      if (db) {
        if (type === 'RECOVERY') {
          await db.query('BEGIN');
          try {
            await db.query(`
              UPDATE "sample_recovery"
              SET status = $1
              WHERE LOWER(lpn) = LOWER($2)
            `, [targetStatus, lpn]);

            await db.query(`
              UPDATE "ItemStatus"
              SET status = $1
              WHERE LOWER(lpn) = LOWER($2)
            `, [targetStatus, lpn]);

            await db.query('COMMIT');
          } catch (txErr) {
            await db.query('ROLLBACK');
            throw txErr;
          }
        } else if (type === 'QC') {
          await db.query('BEGIN');
          try {
            await db.query(`
              UPDATE "qc_status"
              SET status = $1
              WHERE sku = $2
            `, [targetStatus, sku]);

            const lpnsRes = await db.query('SELECT lpn FROM "ReturnItem" WHERE sku = $1', [sku]);
            for (const row of lpnsRes.rows) {
              await db.query(`
                INSERT INTO "ItemStatus" (lpn, status)
                VALUES ($1, $2)
                ON CONFLICT (lpn)
                DO UPDATE SET status = EXCLUDED.status
              `, [row.lpn, targetStatus]);
            }
            await db.query('COMMIT');
          } catch (txErr) {
            await db.query('ROLLBACK');
            throw txErr;
          }
        }
      } else {
        // Mock fallback
        if (type === 'RECOVERY') {
          const idx = mockSampleRecovery.findIndex(item => item.lpn.toLowerCase() === lpn.toLowerCase());
          if (idx !== -1) {
            mockSampleRecovery[idx].status = targetStatus;
          }
          const isIdx = mockItemStatus.findIndex(item => item.lpn.toLowerCase() === lpn.toLowerCase());
          if (isIdx !== -1) {
            mockItemStatus[isIdx].status = targetStatus;
          } else {
            mockItemStatus.push({ lpn, status: targetStatus });
          }
        } else if (type === 'QC') {
          const idx = mockQcStatus.findIndex(item => item.sku === sku);
          if (idx !== -1) {
            mockQcStatus[idx].status = targetStatus;
          }
          const matchingLpns = mockReturnItems.filter((r: any) => r.sku === sku).map((r: any) => r.lpn);
          matchingLpns.forEach(lpnStr => {
            const isIdx = mockItemStatus.findIndex(item => item.lpn.toLowerCase() === lpnStr.toLowerCase());
            if (isIdx !== -1) {
              mockItemStatus[isIdx].status = targetStatus;
            } else {
              mockItemStatus.push({ lpn: lpnStr, status: targetStatus });
            }
          });
        }
      }
      res.json({ status: "Success", message: `Review successfully resolved with action: ${action}` });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/qc/handover-complete", async (req, res, next) => {
    try {
      const { bypassWarning } = req.body;
      const db = getDbPool();
      
      let poolItems: { sku: string; target_count: number; quantity_count: number; }[] = [];
      
      if (db) {
        // Fetch all active elements in the expected pool
        const skuRes = await db.query(`
          SELECT sku, target_count, quantity_count FROM "qc_status" WHERE target_count > 0
        `);
        poolItems = skuRes.rows;
      } else {
        poolItems = mockQcStatus.filter(q => (q.target_count || 0) > 0);
      }
      
      // Calculate Total Missing
      let totalMissing = 0;
      poolItems.forEach(item => {
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
      
      // If we proceed, perform the mutations:
      if (db) {
        const timestamp = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        for (const item of poolItems) {
          if (item.quantity_count < item.target_count) {
            // Shorted elements updated to 'missing at qc'
            await db.query(`
              UPDATE "qc_status" 
              SET status = 'missing at qc', "scannedAt" = COALESCE("scannedAt", $2) 
              WHERE sku = $1
            `, [item.sku, timestamp]);
            
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
            // Passed with no errors updated to 'ready for Inventory'
            await db.query(`
              UPDATE "qc_status" 
              SET status = 'ready for Inventory', "scannedAt" = COALESCE("scannedAt", $2) 
              WHERE sku = $1
            `, [item.sku, timestamp]);
            
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
        // Mock fallback mutate
        poolItems.forEach(item => {
          let mockQc = mockQcStatus.find(q => q.sku === item.sku);
          if (item.quantity_count < item.target_count) {
            if (mockQc) mockQc.status = 'missing at qc';
            
            mockReturnItems.forEach(ri => {
              if (ri.sku === item.sku) {
                let statusItem = mockItemStatus.find(ms => ms.lpn === ri.lpn);
                if (statusItem && (statusItem.status === 'good' || statusItem.status === 'recovered')) {
                  statusItem.status = 'missing at qc';
                }
              }
            });
          } else {
            if (mockQc) mockQc.status = 'ready for Inventory';
            
            mockReturnItems.forEach(ri => {
              if (ri.sku === item.sku) {
                let statusItem = mockItemStatus.find(ms => ms.lpn === ri.lpn);
                if (statusItem && (statusItem.status === 'good' || statusItem.status === 'recovered')) {
                  statusItem.status = 'ready for Inventory';
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
            COALESCE(s.is_refurbished, false) as is_refurbished,
            COALESCE(s.damage_type, 'Repackaging Check') as damage_type
          FROM "ItemStatus" i
          LEFT JOIN "ReturnItem" r ON i.lpn = r.lpn
          LEFT JOIN "sample_recovery" s ON i.lpn = s.lpn
          WHERE i.status = 'recovered' OR i.status = 'requires recovery review'
        `;
        const result = await db.query(query);
        rows = result.rows;
      } else {
        // Static mock items
        rows = mockItemStatus
          .filter((i: any) => i.status === 'recovered' || i.status === 'requires recovery review')
          .map((i: any) => {
            const returnItem = mockReturnItems.find((r: any) => r.lpn === i.lpn);
            const sampleRec = mockSampleRecovery.find((s: any) => s.lpn === i.lpn);
            return {
              lpn: i.lpn,
              sku: returnItem ? returnItem.sku : 'UNKNOWN',
              item_status: i.status,
              is_refurbished: sampleRec ? sampleRec.is_refurbished : true, 
              damage_type: sampleRec ? sampleRec.damage_type : 'DENTED BOX'
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
      let sku = 'UNKNOWN';
      if (db) {
        // Find SKU of this LPN
        const skuRes = await db.query(`SELECT sku FROM "ReturnItem" WHERE lpn = $1`, [lpn]);
        if (skuRes.rows.length > 0) {
          sku = skuRes.rows[0].sku;
        }

        // Update ItemStatus
        await db.query(`
          INSERT INTO "ItemStatus" (lpn, status)
          VALUES ($1, 'requires recovery review')
          ON CONFLICT (lpn)
          DO UPDATE SET status = 'requires recovery review'
        `, [lpn]);

        // Update qc_status
        if (sku && sku !== 'UNKNOWN') {
          await db.query(`
            INSERT INTO "qc_status" (sku, quantity_count, status)
            VALUES ($1, 1, 'requires recovery review')
            ON CONFLICT (sku)
            DO UPDATE SET status = 'requires recovery review'
          `, [sku]);
        }
      } else {
        const item = mockItemStatus.find((i: any) => i.lpn === lpn);
        if (item) {
          item.status = 'requires recovery review';
        } else {
          mockItemStatus.push({ lpn, status: 'requires recovery review' });
        }

        const returnItem = mockReturnItems.find((r: any) => r.lpn === lpn);
        sku = returnItem ? returnItem.sku : 'UNKNOWN';

        if (sku && sku !== 'UNKNOWN') {
          let qcs = mockQcStatus.find((q: any) => q.sku === sku);
          if (!qcs) {
            mockQcStatus.push({ sku, quantity_count: 1, status: 'requires recovery review' });
          } else {
            qcs.status = 'requires recovery review';
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
        // Return mock claims with status === 'rejected'
        const rejectedClaimsFromMock = mockClaims.filter((c: any) => c.status === 'rejected' || c.status?.toLowerCase() === 'rejected');
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
          rows = rejectedClaimsFromMock.map((c: any) => ({
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
      const { orderId, trackingId, status } = req.body;
      const db = getDbPool();
      if (db) {
        if (trackingId) {
          await db.query(`
            INSERT INTO "claims_status" ("trackingId", "orderId", status)
            VALUES ($1, $2, $3)
            ON CONFLICT ("trackingId")
            DO UPDATE SET status = $3, "orderId" = COALESCE("claims_status"."orderId", EXCLUDED."orderId")
          `, [trackingId, orderId || '', status]);

          try {
            await db.query(`UPDATE "claims_all" SET status = $1 WHERE "trackingId" = $2`, [status, trackingId]);
          } catch (e) {}
        } else {
          await db.query(`
            INSERT INTO "claims_status" ("orderId", status)
            VALUES ($1, $2)
            ON CONFLICT ("orderId")
            DO UPDATE SET status = $2
          `, [orderId, status]);

          try {
            await db.query(`UPDATE "claims_all" SET status = $1 WHERE "orderId" = $2`, [status, orderId]);
          } catch (e) {}
        }

        // Conditional Evidence table type update
        if (orderId) {
          await handleEvidenceTypeClaimedUpdate(db, orderId, status);
        }
      } else {
        const item = mockClaims.find((c: any) => (trackingId && c.trackingId === trackingId) || c.orderId === orderId);
        if (item) {
          item.status = status;
        }
      }
      res.json({ status: "Success", message: `Status updated to ${status}` });
    } catch (err) {
      next(err);
    }
  });

  // --- IMAGE GENERATION WORKSPACE ENDPOINTS ---
  app.get("/api/claims/locked-sessions", (req, res) => {
    const list = Array.from(lockedSessions);
    res.json({ lockedOrderIds: list, lockedTrackingIds: list });
  });

  app.post("/api/claims/lock-session", (req, res) => {
    const { orderId, trackingId } = req.body;
    const key = trackingId || orderId;
    if (!key) {
      return res.status(400).json({ error: "Missing trackingId or orderId" });
    }
    lockedSessions.add(key);
    res.json({ status: "Success", message: `Session ${key} locked` });
  });

  app.post("/api/claims/release-session", (req, res) => {
    const { orderId, trackingId } = req.body;
    const key = trackingId || orderId;
    if (!key) {
      return res.status(400).json({ error: "Missing trackingId or orderId" });
    }
    lockedSessions.delete(key);
    res.json({ status: "Success", message: `Session ${key} released` });
  });

  app.get("/api/claims/evidence-type/:orderId", async (req, res, next) => {
    try {
      const { orderId } = req.params;
      const db = getDbPool();
      if (db) {
        const evRes = await db.query('SELECT type FROM "Evidence" WHERE "orderId" = $1 LIMIT 1', [orderId]);
        if (evRes.rows.length > 0) {
          return res.json({ type: evRes.rows[0].type });
        }
      }
      // Fallback or mock
      const mockClaim = mockClaims.find((c: any) => c.orderId === orderId);
      if (mockClaim) {
        return res.json({ type: mockClaim.condition === "damaged" ? "PRODUCT_DAMAGE_PHOTO" : "RECEIVER_REJECTION" });
      }
      res.json({ type: null });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/claims/upload-annotated", async (req, res, next) => {
    try {
      const { lpn, imageData } = req.body;
      if (!lpn || !imageData) {
        return res.status(400).json({ error: "Missing lpn or imageData" });
      }
      
      const dir = path.join(process.cwd(), "public", "annotated");
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const cleanImage = imageData.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanImage, "base64");
      const filename = `${lpn}.png`;
      const localPath = path.join(dir, filename);
      fs.writeFileSync(localPath, buffer);
      
      const localUrl = `/public/annotated/${filename}`;
      const db = getDbPool();
      if (db) {
        try {
          await db.query(`UPDATE "claims_all" SET "driveLink" = $1 WHERE lpn = $2`, [localUrl, lpn]);
        } catch (e) {}
        // COMPLIANCE RULE: Under no circumstances should the system write over, mutate, or change the existing lpnDriveLink field inside the Evidence table in Supabase.
        // Bypassing/commenting out the Evidence lpnDriveLink update to freeze the evidence state.
        /*
        try {
          await db.query(`UPDATE "Evidence" SET "lpnDriveLink" = $1 WHERE lpn = $2`, [localUrl, lpn]);
        } catch (e) {}
        */
      } else {
        const item = mockClaims.find((c: any) => c.lpn === lpn);
        if (item) {
          item.driveLink = localUrl;
        }
      }
      
      res.json({ status: "Success", localUrl });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/claims/ready-for-claim", async (req, res, next) => {
    try {
      const { trackingId, orderId: fallbackOrderId } = req.body;
      const key = trackingId || fallbackOrderId;
      if (!key) {
        return res.status(400).json({ error: "Missing trackingId or orderId" });
      }
      const db = getDbPool();
      if (db) {
        // Resolve orderId and trackingId
        const orderIdQuery = await db.query('SELECT "orderId", "trackingId" FROM "claims_all" WHERE "trackingId" = $1 OR "orderId" = $1 LIMIT 1', [key]);
        const orderId = orderIdQuery.rows[0]?.orderId || fallbackOrderId || '';
        const resolvedTrackingId = orderIdQuery.rows[0]?.trackingId || trackingId || '';

        // Check if there is already a status row for this key using custom presence check
        const checkRes = await db.query('SELECT id FROM "claims_status" WHERE "trackingId" = $1 OR "orderId" = $2', [resolvedTrackingId, orderId]);
        if (checkRes.rows.length > 0) {
          await db.query(`UPDATE "claims_status" SET status = 'Ready for claim', "orderId" = COALESCE("orderId", $2), "trackingId" = COALESCE("trackingId", $3) WHERE id = $1`, [checkRes.rows[0].id, orderId, resolvedTrackingId]);
        } else {
          await db.query(`INSERT INTO "claims_status" ("trackingId", "orderId", status) VALUES ($1, $2, 'Ready for claim')`, [resolvedTrackingId, orderId]);
        }
        
        try {
          await db.query(`UPDATE "claims_all" SET status = 'Ready for claim' WHERE "trackingId" = $1 OR "orderId" = $2`, [resolvedTrackingId, orderId]);
        } catch (e) {}
        
        if (orderId) {
          await handleEvidenceTypeClaimedUpdate(db, orderId, 'Ready for claim');
        }
      } else {
        mockClaims.forEach((c: any) => {
          if (c.trackingId === key || c.orderId === key) {
            c.status = "Ready for claim";
          }
        });
      }
      res.json({ status: "Success", message: `Successfully updated ${key} to 'Ready for claim'.` });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/claims/partial-save", async (req, res, next) => {
    try {
      const { trackingId, orderId: fallbackOrderId } = req.body;
      const key = trackingId || fallbackOrderId;
      if (!key) {
        return res.status(400).json({ error: "Missing trackingId or orderId" });
      }
      const db = getDbPool();
      if (db) {
        // Resolve orderId and trackingId
        const orderIdQuery = await db.query('SELECT "orderId", "trackingId" FROM "claims_all" WHERE "trackingId" = $1 OR "orderId" = $1 LIMIT 1', [key]);
        const orderId = orderIdQuery.rows[0]?.orderId || fallbackOrderId || '';
        const resolvedTrackingId = orderIdQuery.rows[0]?.trackingId || trackingId || '';

        // Check exists
        const checkRes = await db.query('SELECT id FROM "claims_status" WHERE "trackingId" = $1 OR "orderId" = $2', [resolvedTrackingId, orderId]);
        if (checkRes.rows.length > 0) {
          await db.query(`UPDATE "claims_status" SET status = 'Partial', "orderId" = COALESCE("orderId", $2), "trackingId" = COALESCE("trackingId", $3) WHERE id = $1`, [checkRes.rows[0].id, orderId, resolvedTrackingId]);
        } else {
          await db.query(`INSERT INTO "claims_status" ("trackingId", "orderId", status) VALUES ($1, $2, 'Partial')`, [resolvedTrackingId, orderId]);
        }
        
        try {
          await db.query(`UPDATE "claims_all" SET status = 'Partial' WHERE "trackingId" = $1 OR "orderId" = $2`, [resolvedTrackingId, orderId]);
        } catch (e) {}
        
        if (orderId) {
          await handleEvidenceTypeClaimedUpdate(db, orderId, 'Partial');
        }
      } else {
        mockClaims.forEach((c: any) => {
          if (c.trackingId === key || c.orderId === key) {
            c.status = "Partial";
          }
        });
      }
      res.json({ status: "Success", message: `Successfully updated ${key} to 'Partial'.` });
    } catch (err) {
      next(err);
    }
  });

  // Helper helper to extract folder ID from Google Drive folder url
  function extractFolderId(url: string | undefined): string | null {
    if (!url) return null;
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (folderMatch) return folderMatch[1];
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch) return idMatch[1];
    // Simple fallback if they just paste the folder ID directly
    if (url.length >= 25 && !url.includes('/') && !url.includes(':') && !url.includes('?')) {
      return url;
    }
    return null;
  }

  // --- GOOGLE DRIVE INTEGRATION API HANDLERS ---
  
  // Google Drive Refresh Token Cache and helper functions
  let cachedAccessToken: string | null = null;
  let cachedTokenExpiryNum = 0; // ms epoch time

  async function getGoogleAccessToken(clientOverride?: { clientId: string; clientSecret: string; refreshToken: string }): Promise<string> {
    const isOverride = !!clientOverride;
    
    // Priority 1 (Primary): Fetch directly from GOOGLE_DRIVE_ environment variables
    const envClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const envClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const envRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    const hasPriorityEnv = !!(envClientId && envClientSecret && envRefreshToken);

    const clientId = hasPriorityEnv 
      ? envClientId! 
      : (clientOverride?.clientId || process.env.GOOGLE_DRIVE_CLIENT_ID);
    const clientSecret = hasPriorityEnv 
      ? envClientSecret! 
      : (clientOverride?.clientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET);
    const refreshToken = hasPriorityEnv 
      ? envRefreshToken! 
      : (clientOverride?.refreshToken || process.env.GOOGLE_DRIVE_REFRESH_TOKEN);

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("Missing Google OAuth credentials (Client ID, Client Secret, or Refresh Token). Please configure your permanent Refresh credentials in UI settings or set them in the server's .env.");
    }

    if (!isOverride && cachedAccessToken && Date.now() < cachedTokenExpiryNum) {
      return cachedAccessToken;
    }

    console.log("[Google Drive OAuth] Exchanging refresh token for a fresh short-lived access token...");
    
    // Call Google's standard OAuth token endpoint
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Google OAuth Refresh Failed] Status:", response.status, errText);
      throw new Error(`Google OAuth Refresh Failed: ${errText}`);
    }

    const data: any = await response.json();
    const accessToken = data.access_token;
    if (!accessToken) {
      throw new Error("Invalid response from Google server. No access_token was returned.");
    }

    if (!isOverride) {
      cachedAccessToken = accessToken;
      const expiresInSec = data.expires_in || 3600;
      cachedTokenExpiryNum = Date.now() + (expiresInSec - 300) * 1000; // five minutes safety buffer
      console.log(`[Google Drive OAuth] Successfully refreshed access_token. Expires in ${expiresInSec}s`);
    }

    return accessToken;
  }

  async function resolveGoogleToken(req: any): Promise<string> {
    // Priority 1 (Primary): Fetch directly from GOOGLE_DRIVE_ environment variables
    const envClientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const envClientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const envRefreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    if (envClientId && envClientSecret && envRefreshToken) {
      return getGoogleAccessToken({
        clientId: envClientId,
        clientSecret: envClientSecret,
        refreshToken: envRefreshToken
      });
    }

    // A. Check if the request contains override credentials in queries, body, or headers
    const clientId = (req.query.clientId as string) || (req.body && req.body.clientId) || req.headers["x-google-client-id"];
    const clientSecret = (req.query.clientSecret as string) || (req.body && req.body.clientSecret) || req.headers["x-google-client-secret"];
    const refreshToken = (req.query.refreshToken as string) || (req.body && req.body.refreshToken) || req.headers["x-google-refresh-token"];

    if (clientId && clientSecret && refreshToken) {
      return getGoogleAccessToken({ clientId, clientSecret, refreshToken });
    }

    // B. Check if we have standard accessToken passed in directly
    const authHeader = req.headers.authorization;
    const directToken = (req.query.accessToken as string) || (req.body && req.body.accessToken) || (authHeader && authHeader.replace(/^Bearer\s+/, ""));
    if (directToken && directToken !== "undefined" && directToken !== "null" && directToken !== "") {
      return directToken;
    }

    // C. Fallback to server-side dynamic Refresh Token environment variables if set
    if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET && process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
      return getGoogleAccessToken();
    }

    throw new Error("No Google credentials or valid Access Token found. Paste a short-lived access token, configure your permanent Refresh credentials in UI settings, or set them in the server's .env file.");
  }

  // 1. Fetch Google Drive Folder files step2.jpg through step6.jpg
  app.get("/api/drive/list", async (req, res, next) => {
    try {
      const { driveLink } = req.query;
      if (!driveLink) {
        return res.status(400).json({ error: "Missing driveLink" });
      }

      const folderId = extractFolderId(driveLink as string);
      if (!folderId) {
        return res.status(400).json({ error: "Could not parse Google Drive Folder ID from link." });
      }

      // Automatically resolve target authentication token
      let actualToken = "";
      try {
        actualToken = await resolveGoogleToken(req);
      } catch (authErr: any) {
        console.error("[Google OAuth Resolve Error] list:", authErr.message);
        return res.status(401).json({ error: authErr.message });
      }

      console.log(`[Google Drive] Listing files for Folder ID: ${folderId}`);

      // Query any image files inside specified folder
      const q = `'${folderId}' in parents and trashed = false and mimeType contains 'image/'`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webContentLink,thumbnailLink,size)&pageSize=50&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true`;

      const googleRes = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${actualToken}`
        }
      });

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        console.error(`[Google Drive API error] Code ${googleRes.status}:`, errText);
        return res.status(googleRes.status).json({ 
          error: `Google Drive Access Failed: ${errText || "Inaccessible folder or expired session"}` 
        });
      }

      const responseData: any = await googleRes.json();
      const files = responseData.files || [];

      console.log(`[Google Drive Audit] Success. Folder ID: ${folderId}, Images discovered:`, files.map((f: any) => f.name));

      res.json({ files: files.slice(0, 50) });
    } catch (err: any) {
      console.error("[Drive API Router Error] List Files:", err);
      next(err);
    }
  });

  // 2. Proxy endpoint for high-resolution images to prevent Canvas taint issues
  app.get("/api/drive/file/:fileId", async (req, res, next) => {
    try {
      const { fileId } = req.params;

      // Automatically resolve target authentication token
      let actualToken = "";
      try {
        actualToken = await resolveGoogleToken(req);
      } catch (authErr: any) {
        console.error("[Google OAuth Resolve Error] file download:", authErr.message);
        return res.status(401).json({ error: authErr.message });
      }

      // Supports shared drives for media downloads as well
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
      const googleRes = await fetch(downloadUrl, {
        headers: {
          "Authorization": `Bearer ${actualToken}`
        }
      });

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        console.error(`[Google Drive API File Error] Code ${googleRes.status}:`, errText);
        return res.status(googleRes.status).send(`Google Drive file access error: ${googleRes.status}`);
      }

      const contentType = googleRes.headers.get("content-type") || "image/jpeg";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      
      const arrayBuffer = await googleRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("[Drive API Router Error] Download File:", err);
      next(err);
    }
  });

  // 3. Upload composition image back to initial folder
  app.post("/api/drive/upload", async (req, res, next) => {
    try {
      const { driveLink, filename, imageData, lpn } = req.body;
      if (!driveLink || !filename || !imageData) {
        return res.status(400).json({ error: "Missing driveLink, filename, or imageData parameters." });
      }

      const folderId = extractFolderId(driveLink);
      if (!folderId) {
        return res.status(400).json({ error: "Could not parse Google Drive Folder ID from link." });
      }

      // Automatically resolve target authentication token
      let actualToken = "";
      try {
        actualToken = await resolveGoogleToken(req);
      } catch (authErr: any) {
        console.error("[Google OAuth Resolve Error] upload:", authErr.message);
        return res.status(401).json({ error: authErr.message });
      }

      // Convert chunked or full base64 data url to binary-ready format
      const base64Content = imageData.replace(/^data:image\/\w+;base64,/, "");

      console.log(`[Google Drive Audit] Commencing upload for LPN: ${lpn || "N/A"}, Target folderId: ${folderId}, Filename: ${filename}`);

      const metadata = {
        name: filename,
        parents: [folderId],
        mimeType: 'image/jpeg'
      };

      const boundary = 'xxxxxxxxxxxxxxxx';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const metadataChunk = JSON.stringify(metadata);
      const requestPayload = Buffer.concat([
        Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + metadataChunk),
        Buffer.from(delimiter + 'Content-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n' + base64Content),
        Buffer.from(closeDelimiter)
      ]);

      const googleRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${actualToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body: requestPayload
      });

      if (!googleRes.ok) {
        const errorDetail = await googleRes.text();
        console.error(`[Google Drive API upload error] Code ${googleRes.status}:`, errorDetail);
        
        console.log(`[Google Drive Audit] Upload FAILED. LPN: ${lpn || "N/A"}, Folder ID: ${folderId}, Filename: ${filename}`);
        
        return res.status(googleRes.status).json({ 
          error: `Google Drive Upload Failed: ${errorDetail || "Access issue or token expiration"}` 
        });
      }

      const uploadResult: any = await googleRes.json();
      
      console.log(`[Google Drive Audit] Upload SUCCESS. LPN: ${lpn || "N/A"}, Folder ID: ${folderId}, Filename: ${filename}, New ID: ${uploadResult.id}`);

      res.json({
        status: "Success",
        message: `Images uploaded successfully. Filename path: ${filename}`,
        fileId: uploadResult.id
      });
    } catch (err: any) {
      console.error("[Drive API Router Error] Upload File:", err);
      next(err);
    }
  });

  // API 404 Handler - MUST be before Vite/Static middleware
  // Ensures any /api missing route returns JSON, not HTML
  app.use("/api/*", (req, res) => {
    res.status(404).json({ 
      status: "Error", 
      message: `API Route not found: ${req.originalUrl}` 
    });
  });

  // Global Error Handler for API
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) {
      console.error("API Error:", err);
      return res.status(500).json({ 
        status: "Error", 
        message: err.message || "Internal Server Error" 
      });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
