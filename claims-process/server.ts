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
  { lpn: "LPN001", status: "recovery", recoveryType: "Barcode Damaged" },
  { lpn: "LPN002", status: "recovery", recoveryType: "Packaging Damaged" },
  { lpn: "LPN003", status: "recovery", recoveryType: "Barcode Damaged" },
  { lpn: "LPN004", status: "recovery", recoveryType: "Packaging Damaged" },
  { lpn: "LPN005", status: "recovery", recoveryType: "Packaging Damaged" }
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
    console.log("Dropping deprecated AMZ_filed_claims table...");
    await db.query(`DROP VIEW IF EXISTS "claims_amz" CASCADE; DROP TABLE IF EXISTS "claims_amz" CASCADE; DROP VIEW IF EXISTS "claims_all" CASCADE; DROP TABLE IF EXISTS "claims_all" CASCADE;`);
    await db.query(`DROP TABLE IF EXISTS "AMZ_filed_claims" CASCADE;`);

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

    // Backwards compatibility column checks
    try {
      await db.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "trackingId" text;`);
      await db.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();`);
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
        ('LPN001', 'recovery', 'Barcode Damaged'),
        ('LPN002', 'recovery', 'Packaging Damaged'),
        ('LPN003', 'recovery', 'Barcode Damaged'),
        ('LPN004', 'recovery', 'Packaging Damaged'),
        ('LPN005', 'recovery', 'Packaging Damaged')
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

    // Check if the base returns table exists
    if (existingTables.has(returnsTable.toLowerCase())) {
      console.log(`Table "${returnsTable}" found. Proceeding with database-backed "claims_all" table setup...`);
      
      // Ensure "shopify_return_tracking" has "orderId" column for correct Shopify integration
      try {
        await db.query(`ALTER TABLE "shopify_return_tracking" ADD COLUMN IF NOT EXISTS "orderId" text;`);
        console.log(`[Schema Match] Added "orderId" column to "shopify_return_tracking" table successfully.`);
      } catch (colErr: any) {
        console.warn(`[Schema Match] "shopify_return_tracking" Column check/alter warning:`, colErr.message);
      }

      // Drop any existing table/view named "claims_AMZ" or "claims_amz" to avoid conflicts
      await db.query(`DROP VIEW IF EXISTS "claims_AMZ" CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS "claims_AMZ" CASCADE;`);
      await db.query(`DROP VIEW IF EXISTS claims_amz CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS claims_amz CASCADE;`);
      await db.query(`DROP VIEW IF EXISTS "claims_all" CASCADE;`);

      // Determine helper existence flags
      const hasRemovalShipments = existingTables.has('amz_removal_shipments');
      const hasRemovalOrders = existingTables.has('amz_removal_orders');
      const hasEvidence = existingTables.has('evidence');
      const hasManifest = existingTables.has('manifest');
      const hasReimbursements = existingTables.has('amz_reimbursements');

      // Create the physical table "claims_all" matching the schema exactly
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
            "manifestId",
            "type",
            "orderDriveLink",
            "lpnDriveLink"
          FROM "Evidence"
          ` : `
          SELECT 
            NULL::text AS lpn,
            NULL::text AS "orderId",
            NULL::text AS "manifestId",
            NULL::text AS "type",
            NULL::text AS "orderDriveLink",
            NULL::text AS "lpnDriveLink"
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
              )` : 'NULL::text'},
              ${hasReimbursements ? `(
                SELECT re."case-id" 
                FROM "AMZ_reimbursements" re 
                WHERE re.sku = br.sku OR re.fnsku = br.fnsku 
                LIMIT 1
              )` : 'NULL::text'}
            ) AS "orderId",
            
            -- trackingId mapping
            COALESCE(
              ${hasManifest ? `(
                SELECT m."trackingId" 
                FROM "Manifest" m 
                WHERE m.id = ev."manifestId" 
                LIMIT 1
              )` : 'NULL::text'},
              ${hasRemovalShipments ? `(
                SELECT rs."tracking-number" 
                FROM "AMZ_removal_shipments" rs 
                WHERE rs."order-id" = COALESCE(
                  ev."orderId", 
                  (SELECT rs2."order-id" FROM "AMZ_removal_shipments" rs2 WHERE rs2.sku = br.sku OR rs2.fnsku = br.fnsku LIMIT 1)
                )
                LIMIT 1
              )` : 'NULL::text'}
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
              )` : 'FALSE'} THEN 'Amazon B2B'
              
              WHEN br."detailed-disposition" != 'SELLABLE' AND NOT ${hasRemovalOrders ? `EXISTS (
                SELECT 1 
                FROM "AMZ_removal_orders" ro 
                WHERE ro."order-id" = COALESCE(
                  ev."orderId",
                  (SELECT rs."order-id" FROM "AMZ_removal_shipments" rs WHERE rs.sku = br.sku OR rs.fnsku = br.fnsku LIMIT 1)
                )
              )` : 'FALSE'} THEN 'AMZ B2C'
              
              ELSE 'AMZ B2C'
            END AS channel,
            
            -- type mapping
            CASE
              WHEN ev.lpn IS NOT NULL AND ev.type = 'RECEIVER_REJECTION' THEN 'Rejected'
              WHEN ev.lpn IS NOT NULL AND ev.type = 'Claimed' THEN 'Claimed'
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

          UNION ALL

          -- Part 2: Shopify Returns Queue (RTO Channel classification)
          -- Match srt.trackingNumber inside shiprocket_returns
          SELECT
            sr.id AS lpn,
            COALESCE(srt."orderId", sr."orderId") AS "orderId",
            srt."trackingNumber" AS "trackingId",
            sr.sku AS sku,
            NULL::text AS fnsku,
            sr."productName" AS "productName",
            'Shopify RTO'::text AS channel,
            'RejectedDelivery'::text AS type,
            -- Pull drive links from Evidence matched either by orderId or lpn
            (SELECT COALESCE(e."lpnDriveLink", e."orderDriveLink") FROM "Evidence" e WHERE e."orderId" = COALESCE(srt."orderId", sr."orderId") OR e.lpn = sr.id LIMIT 1) AS "driveLink",
            (SELECT e."orderDriveLink" FROM "Evidence" e WHERE e."orderId" = COALESCE(srt."orderId", sr."orderId") OR e.lpn = sr.id LIMIT 1) AS "orderDriveLink",
            sr."createdAt" AS "createdAt",
            sr.quantity AS qty
          FROM "shopify_return_tracking" srt
          JOIN "shiprocket_returns" sr ON srt."trackingNumber" = sr."trackingNumber"

          UNION ALL

          -- Part 3: Shopify Returns Queue (RTV Channel classification)
          -- Match srt.trackingNumber inside return_prime_returns AND approved requestType
          SELECT
            rpr.id AS lpn,
            COALESCE(srt."orderId", rpr."orderId") AS "orderId",
            srt."trackingNumber" AS "trackingId",
            rpr.sku AS sku,
            NULL::text AS fnsku,
            NULL::text AS "productName",
            'Shopify RTV'::text AS channel,
            'CustomerReturn'::text AS type,
            -- Pull drive links from Evidence matched either by orderId or lpn
            (SELECT COALESCE(e."lpnDriveLink", e."orderDriveLink") FROM "Evidence" e WHERE e."orderId" = COALESCE(srt."orderId", rpr."orderId") OR e.lpn = rpr.id LIMIT 1) AS "driveLink",
            (SELECT e."orderDriveLink" FROM "Evidence" e WHERE e."orderId" = COALESCE(srt."orderId", rpr."orderId") OR e.lpn = rpr.id LIMIT 1) AS "orderDriveLink",
            rpr."createdAt" AS "createdAt",
            rpr.quantity AS qty
          FROM "shopify_return_tracking" srt
          JOIN "return_prime_returns" rpr ON srt."trackingNumber" = rpr."trackingNumber"
          WHERE rpr."requestType" = 'approved'
            AND NOT EXISTS (
              SELECT 1 FROM "shiprocket_returns" sr2 WHERE sr2."trackingNumber" = srt."trackingNumber"
            )
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
      console.log('✅ Physical "claims_all" table successfully populated from base tables.');
    } else {
      console.warn(`⚠️ Base table "${returnsTable}" was not found! Ensuring "claims_all" physical table exists...`);
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
      console.log('✅ Fallback physical table "claims_all" created.');
    }
  } catch (err: any) {
    console.error('❌ setupDatabaseSchema error:', err.message);
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

          // Listen to changes on ItemStatus: only when status = 'RECOVERY'
          if (cleanStatus === "RECOVERY") {
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
            await client.query(`
              INSERT INTO "sample_recovery" (lpn, sku, damage_type, is_refurbished, status)
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

      if (cleanStatus === "RECOVERY") {
        const foundReturnItem = mockReturnItems.find((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
        if (!foundReturnItem) {
          const errorMsg = `Relational mapping failed: SKU not found for LPN ${cleanLpn}`;
          console.error(`❌ [Sync Flow Mock] ${errorMsg}`);
          return { success: false, message: errorMsg, errorType: "RelationalMappingFailed" };
        }

        const sku = foundReturnItem.sku;

        // Sync into mockSampleRecovery
        const existingRecoveryIdx = mockSampleRecovery.findIndex((item) => item.lpn.toLowerCase() === cleanLpn.toLowerCase());
        const recoveryRecord = {
          lpn: cleanLpn,
          sku,
          damage_type: mappedDamageType,
          is_refurbished: false,
          status: "inspected" as any
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

        // Look up item in ItemStatus with status === 'recovery' (case insensitive) among the solved LPNS
        const lookupRes = await pool.query(`
          SELECT i.lpn, i.status, i."recoveryType"
          FROM "ItemStatus" i
          WHERE LOWER(i.lpn) = ANY($1) AND LOWER(i.status) = 'recovery'
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
          await pool.query(`
            INSERT INTO "sample_recovery" (lpn, sku, damage_type, is_refurbished, status)
            VALUES ($1, $2, $3, false, 'recovery')
            ON CONFLICT (lpn) 
            DO UPDATE SET 
              sku = EXCLUDED.sku,
              damage_type = EXCLUDED.damage_type,
              status = 'recovery'
          `, [lpn, sku, rawRecoveryType]);

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
          i.status.toLowerCase() === 'recovery'
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
          const syncedRecord = {
            lpn,
            sku,
            damage_type: rawRecoveryType,
            is_refurbished: false,
            status: 'recovery'
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
          const existingRecord = mockSampleRecovery.find(s => s.lpn.toLowerCase() === search.toLowerCase() || s.sku.toLowerCase() === search.toLowerCase());
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

      const pool = getDbPool();
      if (pool) {
        await pool.query(`
          UPDATE "sample_recovery"
          SET is_refurbished = $2, status = $3
          WHERE LOWER(lpn) = LOWER($1)
        `, [lpn, is_refurbished, recordStatus]);

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
        } else {
          mockSampleRecovery.push({
            lpn,
            sku: sku || "UNKNOWN",
            damage_type,
            is_refurbished,
            status: recordStatus
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
        const result = await pool.query('SELECT lpn FROM "ItemStatus" WHERE LOWER(status) = \'recovery\'');
        expectedItems = result.rows.map(r => r.lpn);
      } else {
        expectedItems = mockItemStatus.filter(i => i.status.toLowerCase() === 'recovery').map(i => i.lpn);
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
        const result = await pool.query('SELECT lpn FROM "ItemStatus" WHERE LOWER(status) = \'recovery\'');
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
        const expectedItems = mockItemStatus.filter(i => i.status.toLowerCase() === 'recovery').map(i => i.lpn);
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
        try {
          const result = await pool.query(`
            SELECT c.*, s.status AS db_status, s."claimId" AS db_claim_id, s.bot_log_reason 
            FROM "claims_all" c 
            LEFT JOIN "claims_status" s ON c."orderId" = s."orderId"
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

        // Grouping key: Tracking ID + SKU
        const tid = data.trackingId || 'N/A';
        const sku = data.sku || 'N/A';
        const key = `${tid}-${sku}`;

        const rowQty = typeof data.qty === 'number' ? data.qty : 1;
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
          // 1. Insert or update claims_status to reflect 'Claimed'
          db.query(
            `INSERT INTO "claims_status" ("orderId", "trackingId", "claimId", status)
             VALUES ($1, $2, $3, 'Claimed')
             ON CONFLICT ("orderId") 
             DO UPDATE SET 
               status = 'Claimed', 
               "claimId" = COALESCE(NULLIF(EXCLUDED."claimId", ''), "claims_status"."claimId", ''), 
               "trackingId" = COALESCE("claims_status"."trackingId", EXCLUDED."trackingId")`,
            [claimData.orderId || '', claimData.trackingId || '', result.caseId || '']
          ).then(() => {
            console.log(`[DB SUCCESS] Recorded claimed status in claims_status for Order ID: ${claimData.orderId}`);
          }).catch(dbErr => {
            console.error(`[DB ERROR] Failed to record status in claims_status:`, dbErr);
          });
          
          // 2. Also try to update status directly in the fallback table claims_all if it's not a view
          db.query(
            `UPDATE "claims_all" SET status = 'Claimed' WHERE lpn = $1 OR "orderId" = $2`,
            [claimData.lpn || '', claimData.orderId || '']
          ).catch(() => {});

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
        
        // 1. mockItemStatus good/recovered
        mockItemStatus.forEach((i: any) => {
          if (i.status === 'good' || i.status === 'recovered') {
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

      if (db) {
        // First check if the SKU exists in the expected pool / has target_count > 0 in qc_status
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
          dbStatus = 'quantity missing';
        } else {
          dbStatus = 'ok';
        }
        
        await db.query(`
          UPDATE "qc_status" 
          SET quantity_count = $1, status = $2 
          WHERE sku = $3
        `, [quantityCount, dbStatus, sku]);

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
        for (const item of poolItems) {
          if (item.quantity_count < item.target_count) {
            // Shorted elements updated to 'missing at qc'
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
            // Passed with no errors updated to 'ready for Inventory'
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
      const { orderId, status } = req.body;
      const db = getDbPool();
      if (db) {
        // Update claims_status table
        await db.query(`
          INSERT INTO "claims_status" ("orderId", status)
          VALUES ($1, $2)
          ON CONFLICT ("orderId")
          DO UPDATE SET status = $2
        `, [orderId, status]);

        // Try updating physical claims_all if it is a physical table rather than a read-only view
        try {
          await db.query(`UPDATE "claims_all" SET status = $1 WHERE "orderId" = $2`, [status, orderId]);
        } catch (e) {
          // Suppress error since it might be a read-only view
        }

        // Conditional Evidence table type update
        await handleEvidenceTypeClaimedUpdate(db, orderId, status);
      } else {
        const item = mockClaims.find((c: any) => c.orderId === orderId);
        if (item) {
          item.status = status;
        }
      }
      res.json({ status: "Success", message: `Status updated to ${status}` });
    } catch (err) {
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
