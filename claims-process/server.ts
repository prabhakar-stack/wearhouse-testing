import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import { fileAmazonClaim } from "./bot/amazonFiler";
import "dotenv/config";

// Lazy initialization for PostgreSQL Pool
let pool: pg.Pool | null = null;

let mockSampleRecovery = [
  { lpn: "LPN001", sku: "1120100", damage_type: "barcode_damage", is_refurbished: false, status: "pending" },
  { lpn: "LPN002", sku: "1120200", damage_type: "box_damage", is_refurbished: false, status: "pending" },
  { lpn: "LPN003", sku: "4829102", damage_type: "barcode_damage", is_refurbished: false, status: "pending" },
  { lpn: "LPN004", sku: "1092837", damage_type: "box_damage", is_refurbished: false, status: "pending" },
  { lpn: "LPN005", sku: "SKU-REP-990", damage_type: "box_damage", is_refurbished: false, status: "pending" },
];


let mockItemStatus: any[] = [];
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
    console.log("Checking and setting up AMZ_filed_claims table...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS "AMZ_filed_claims" (
        lpn text PRIMARY KEY,
        filed_at timestamp with time zone DEFAULT now(),
        case_id text
      );
    `);

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


    console.log("Checking and setting up claims_AMZ view...");

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
      console.log(`Table "${returnsTable}" found. Proceeding with database-backed "claims_amz" view...`);
      
      // Drop any existing table/view named "claims_AMZ" to avoid conflicts
      await db.query(`DROP VIEW IF EXISTS "claims_AMZ" CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS "claims_AMZ" CASCADE;`);
      await db.query(`DROP VIEW IF EXISTS claims_amz CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS claims_amz CASCADE;`);

      // Determine helper existence flags
      const hasRemovalShipments = existingTables.has('amz_removal_shipments');
      const hasRemovalOrders = existingTables.has('amz_removal_orders');
      const hasEvidence = existingTables.has('evidence');
      const hasManifest = existingTables.has('manifest');
      const hasReimbursements = existingTables.has('amz_reimbursements');

      const viewSql = `
        CREATE OR REPLACE VIEW "claims_amz" AS
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
            "lpnDriveLink" AS drive_link,
            "orderDriveLink" AS order_drive_link,
            "claimReason" AS claim_reason,
            "claimSubReason" AS claim_sub_reason,
            "manifestId"
          FROM "Evidence"
          ` : `
          SELECT 
            NULL::text AS lpn,
            NULL::text AS "orderId",
            NULL::text AS drive_link,
            NULL::text AS order_drive_link,
            NULL::text AS claim_reason,
            NULL::text AS claim_sub_reason,
            NULL::text AS "manifestId"
          LIMIT 0
          `}
        )
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
          
          -- status mapping
          CASE
            WHEN EXISTS (SELECT 1 FROM "AMZ_filed_claims" fc WHERE fc.lpn = br.lpn) THEN 'Claimed'
            WHEN ev.lpn IS NOT NULL THEN 'Inspected'
            WHEN ${hasManifest ? `EXISTS (
              SELECT 1 
              FROM "Manifest" m 
              WHERE m."trackingId" = COALESCE(
                (SELECT m2."trackingId" FROM "Manifest" m2 WHERE m2.id = ev."manifestId" LIMIT 1),
                (SELECT rs."tracking-number" FROM "AMZ_removal_shipments" rs WHERE rs."order-id" = COALESCE(ev."orderId", (SELECT rs2."order-id" FROM "AMZ_removal_shipments" rs2 WHERE rs2.sku = br.sku OR rs2.fnsku = br.fnsku LIMIT 1)) LIMIT 1)
              ) AND m.status::text = 'AT_DOCK'
            )` : 'FALSE'} THEN 'Received'
            ELSE 'not delivered'
          END AS status,
          
          -- type mapping
          CASE
            WHEN ev.lpn IS NOT NULL THEN 'Damaged'
            ELSE 'Missing'
          END AS type,
          
          ev.claim_reason,
          ev.claim_reason AS "claimReason",
          ev.claim_sub_reason,
          ev.claim_sub_reason AS "claimSubReason",
          ev.drive_link,
          ev.drive_link AS "driveLink",
          ev.order_drive_link,
          ev.order_drive_link AS "orderDriveLink",
          
          -- sla_days_elapsed mapping
          ${hasManifest ? `COALESCE(
            (
              SELECT EXTRACT(DAY FROM (NOW() - m."expectedDate"))::int8
              FROM "Manifest" m
              WHERE m."trackingId" = COALESCE(
                (SELECT m2."trackingId" FROM "Manifest" m2 WHERE m2.id = ev."manifestId" LIMIT 1),
                (SELECT rs."tracking-number" FROM "AMZ_removal_shipments" rs WHERE rs."order-id" = COALESCE(ev."orderId", (SELECT rs2."order-id" FROM "AMZ_removal_shipments" rs2 WHERE rs2.sku = br.sku OR rs2.fnsku = br.fnsku LIMIT 1)) LIMIT 1)
              )
              LIMIT 1
            ),
            0::int8
          )` : '0::int8'} AS sla_days_elapsed,
          ${hasManifest ? `COALESCE(
            (
              SELECT EXTRACT(DAY FROM (NOW() - m."expectedDate"))::int8
              FROM "Manifest" m
              WHERE m."trackingId" = COALESCE(
                (SELECT m2."trackingId" FROM "Manifest" m2 WHERE m2.id = ev."manifestId" LIMIT 1),
                (SELECT rs."tracking-number" FROM "AMZ_removal_shipments" rs WHERE rs."order-id" = COALESCE(ev."orderId", (SELECT rs2."order-id" FROM "AMZ_removal_shipments" rs2 WHERE rs2.sku = br.sku OR rs2.fnsku = br.fnsku LIMIT 1)) LIMIT 1)
              )
              LIMIT 1
            ),
            0::int8
          )` : '0::int8'} AS "slaDaysElapsed",
          
          NULL::text AS "claimId",
          NULL::text AS claim_id
          
        FROM base_returns br
        LEFT JOIN evidences ev ON br.lpn = ev.lpn;
      `;
      
      await db.query(viewSql);
      console.log('✅ "claims_amz" view successfully created or replaced in PostgreSQL.');
    } else {
      console.warn(`⚠️ Base table "${returnsTable}" was not found! Creating a dynamic mock table for "claims_amz"...`);
      await db.query(`DROP VIEW IF EXISTS "claims_amz" CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS "claims_amz" CASCADE;`);
      await db.query(`
        CREATE TABLE "claims_amz" (
          lpn text PRIMARY KEY,
          "orderId" text,
          "trackingId" text,
          sku text,
          fnsku text,
          "productName" text,
          channel text,
          status text,
          type text,
          claim_reason text,
          "claimReason" text,
          claim_sub_reason text,
          "claimSubReason" text,
          drive_link text,
          "driveLink" text,
          order_drive_link text,
          "orderDriveLink" text,
          sla_days_elapsed int8,
          "slaDaysElapsed" int8,
          "claimId" text,
          claim_id text
        );
      `);
      console.log('✅ Fallback table "claims_amz" created.');
      
    
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

  const enableClaimsStatusCron = process.env.ENABLE_CLAIMS_STATUS_CRON === "true";
  if (enableClaimsStatusCron) {
    // Optional background scheduler; keep disabled unless explicitly enabled.
    setInterval(() => {
      updateClaimsStatus().catch(err => console.error("[CRON ERROR] Failed to update claims status:", err.message));
    }, 60 * 1000 * 10); // Check every 10 minute
  } else {
    console.log("[CRON] Claims status scheduler is disabled. Run updateClaimsStatus() manually when needed.");
  }


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
      if (pool) {
        const result = await pool.query(
          'SELECT * FROM "sample_recovery" WHERE LOWER(lpn) = LOWER($1) OR LOWER(sku) = LOWER($1) LIMIT 1',
          [search]
        );
        if (result.rows.length > 0) {
          return res.json(toCamelCase(result.rows[0]));
        }
      } else {
        const found = mockSampleRecovery.find(
          item => item.lpn.toLowerCase() === search.toLowerCase() || item.sku.toLowerCase() === search.toLowerCase()
        );
        if (found) {
          return res.json(found);
        }
      }
      return res.status(404).json({ status: "Error", message: "Item not found in database" });
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

      const damage_type = damageType || "barcode_damage";
      const is_refurbished = !!isRefurbished;
      const recordStatus = status || "recovered";

      const pool = getDbPool();
      if (pool) {

        await pool.query(`
          UPDATE "sample_recovery"
          SET is_refurbished = $2, status = $3
          WHERE LOWER(lpn) = LOWER($1)
        `, [lpn, is_refurbished, recordStatus]);

        console.log(`[DB] Successfully updated the recovery items database for ${lpn}`);
      } else {
        const idx = mockSampleRecovery.findIndex(item => item.lpn.toLowerCase() === lpn.toLowerCase());
        if (idx !== -1) {
          mockSampleRecovery[idx].is_refurbished = is_refurbished;
          mockSampleRecovery[idx].status = recordStatus;
        }
      }

      return res.json({ status: "Success", message: "Item successfully updated in database." });
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
          const result = await pool.query('SELECT * FROM "claims_amz"');
          rawRows = result.rows;
        } catch (error: any) {
          console.log(`SQL error with "claims_amz" view: ${error.message}. Retrying with fallback tables...`);
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

        if (!processedMap[key]) {
          processedMap[key] = {
            ...data,
            qty: 1,
            items: [data]
          };
        } else {
          processedMap[key].qty += 1;
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

        // Try table names: quoted '"claims_AMZ"', lowercase 'claims', and quoted '"Claims"'
        const tables = ['"claims_amz"'];
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
            WHERE ${searchTerms.join(' OR ')}
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
          // 1. Insert into AMZ_filed_claims table to reflect 'Claimed' dynamically in the claims_AMZ view
          db.query(
            `INSERT INTO "AMZ_filed_claims" (lpn, case_id) VALUES ($1, $2) ON CONFLICT (lpn) DO NOTHING`,
            [claimData.lpn || '', result.caseId || '']
          ).then(() => {
            console.log(`[DB SUCCESS] Recorded claimed status in AMZ_filed_claims for LPN/Identifier: ${claimData.lpn}`);
          }).catch(dbErr => {
            console.error(`[DB ERROR] Failed to record status in AMZ_filed_claims:`, dbErr);
          });
          
          // 2. Also try to update status directly in the fallback table claims_AMZ if it's not a view
          db.query(
            `UPDATE "claims_amz" SET status = 'Claimed' WHERE lpn = $1`,
            [claimData.lpn || '']
          ).catch(() => {});
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
