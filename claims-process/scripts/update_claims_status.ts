import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

interface LogParseResult {
  status: string;
  claimId: string;
  botLogReason: string | null;
}

/**
 * Utility to parse Playwright/Bot log contents and extract status, claimId, and errors.
 */
function parseLogContent(content: string): LogParseResult {
  const lines = content.split('\n');
  let hasError = false;
  let exceptionSnippet: string | null = null;
  let capturedClaimId: string | null = null;

  // Error identification terms
  const errorKeywords = ['error', 'failed', 'exception', 'timeout', 'fail', 'crash', 'critical'];

  // Patterns to locate SAFE-T Claim ID
  const claimIdRegex = /SAFE-T Claim ID:\s*(S-[A-Z0-9\-_]+|S-\d+|\d+)/i;
  const fallbackClaimIdRegex = /\s(S-\d{5,15})\b/i;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // 1. Check for successfully generated SAFE-T Claim ID
    const match = line.match(claimIdRegex);
    if (match && match[1]) {
      capturedClaimId = match[1].trim();
    } else {
      const fallbackMatch = line.match(fallbackClaimIdRegex);
      if (fallbackMatch && fallbackMatch[1]) {
        capturedClaimId = fallbackMatch[1].trim();
      }
    }

    // 2. Scan line for potential errors, fail-safes, or descriptive exception blocks
    const isErrorLine = errorKeywords.some(keyword => lowerLine.includes(keyword));
    if (isErrorLine) {
      hasError = true;
      // Strip dynamic log noise & bracket timestamps for clean mapping
      let cleanLine = line.trim();
      cleanLine = cleanLine.replace(/^\[[^\]]+\]\s*/, ''); // strip timestamp prefix e.g [2026-05-26...]
      if (!exceptionSnippet || exceptionSnippet.length < cleanLine.length) {
        exceptionSnippet = cleanLine;
      }
    }
  }

  if (hasError) {
    return {
      status: 'Failed',
      claimId: capturedClaimId || '',
      botLogReason: exceptionSnippet ? exceptionSnippet.substring(0, 255) : 'Unknown automation error execution exception'
    };
  }

  if (capturedClaimId) {
    return {
      status: 'complete',
      claimId: capturedClaimId,
      botLogReason: null
    };
  }

  // Not completed and no distinct error found yet (possibly in queue or still executing)
  return {
    status: 'unclaimed',
    claimId: '',
    botLogReason: null
  };
}

/**
 * Background worker synchronizing automation output logs back to claims_status database state.
 */
export async function updateClaimsStatus(): Promise<void> {
  console.log("[CRON] Executing automated claims_status synchronization step...");

  let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("[CRON Mock] No database pool connection found. Skipping SQL sync.");
    return;
  }

  connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (connectionString.startsWith('hpostgresql://')) {
    connectionString = connectionString.substring(1);
  }

  // Sanitize password bracket wrapping (common developer configuration mismatch)
  const passwordMatch = connectionString.match(/:(.*)@/);
  if (passwordMatch && passwordMatch[1]) {
    const password = passwordMatch[1];
    if (password.startsWith('[') && password.endsWith(']')) {
      const sanitizedPassword = password.substring(1, password.length - 1);
      connectionString = connectionString.replace(password, sanitizedPassword);
    }
  }

  let pool: pg.Pool | null = null;
  try {
    pool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 15000,
      max: 1,
      ssl: (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
        ? false
        : { rejectUnauthorized: false }
    });

    // 1. Initialize schemas (Table structurally enforces id, orderId, trackingId, claimId, status, bot_log_reason, created_at)
    await pool.query(`
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

    // Ensure columns exist on already created table
    try {
      await pool.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "trackingId" text;`);
      await pool.query(`ALTER TABLE "claims_status" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();`);
      await pool.query(`ALTER TABLE "claims_status" ALTER COLUMN "orderId" DROP NOT NULL;`);
      
      // Drop key constraint or index on orderId
      await pool.query(`ALTER TABLE "claims_status" DROP CONSTRAINT IF EXISTS "claims_status_orderId_unique" CASCADE;`);
      await pool.query(`ALTER TABLE "claims_status" DROP CONSTRAINT IF EXISTS "claims_status_orderId_key" CASCADE;`);
      await pool.query(`DROP INDEX IF EXISTS "claims_status_orderId_unique";`);
      await pool.query(`DROP INDEX IF EXISTS "claims_status_orderId_key";`);
      
      // Deduplicate on trackingId and enforce unique trackingId
      await pool.query(`
        DELETE FROM "claims_status" a 
        USING "claims_status" b 
        WHERE a.id < b.id AND a."trackingId" = b."trackingId" AND a."trackingId" IS NOT NULL AND a."trackingId" != ''
      `);
      
      await pool.query(`
        ALTER TABLE "claims_status" ADD CONSTRAINT "claims_status_trackingId_unique" UNIQUE ("trackingId");
      `);
    } catch (e: any) {
      if (!e.message.includes("already exists") && !e.message.includes("multiple unique") && !e.message.includes("relation")) {
        console.warn("[CRON] Column/Constraint check on claims_status warning:", e.message);
      }
    }

    // Check if the "Evidence" table exists (case-insensitive search in schema)
    const evidenceTableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND LOWER(table_name) = 'evidence'
    `);
    const hasEvidenceTable = evidenceTableCheck.rows.length > 0;
    const evidenceTableName = hasEvidenceTable ? evidenceTableCheck.rows[0].table_name : 'Evidence';

    // Prune any existing records in claims_status that are not present in the Evidence table if it exists
    if (hasEvidenceTable) {
      const pruneRes = await pool.query(`
        DELETE FROM "claims_status"
        WHERE "orderId" NOT IN (
          SELECT DISTINCT "orderId" 
          FROM "${evidenceTableName}"
          WHERE "orderId" IS NOT NULL AND "orderId" != 'N/A'
        )
      `);
      if (pruneRes.rowCount && pruneRes.rowCount > 0) {
        console.log(`[CRON] Pruned ${pruneRes.rowCount} orphan records from claims_status not found in "${evidenceTableName}" table.`);
      }
    }

    // 2. Discover canonical orderIds and trackingIds from the claims_all view/table and initialize them in claims_status
    const viewCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' AND LOWER(table_name) = 'claims_all'
    `);
    
    // Fallback if it is a physical table instead of a view
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND LOWER(table_name) = 'claims_all'
    `);

    const hasClaimsAll = viewCheck.rows.length > 0 || tableCheck.rows.length > 0;

    if (hasClaimsAll) {
      let queryStr = 'SELECT DISTINCT "orderId", "trackingId" FROM "claims_all"';
      if (hasEvidenceTable) {
        queryStr = `
          SELECT DISTINCT "orderId", "trackingId" 
          FROM "claims_all" 
          WHERE "orderId" IN (
            SELECT DISTINCT "orderId" FROM "${evidenceTableName}" WHERE "orderId" IS NOT NULL AND "orderId" != 'N/A'
          )
        `;
      }
      const allClaimsRes = await pool.query(queryStr);
      for (const row of allClaimsRes.rows) {
        const oId = row.orderId;
        const tId = row.trackingId || null;
        if (oId && oId !== 'N/A' && oId.trim() !== '') {
          // Initialize records in claims_status by default to 'unclaimed'
          const cleanOId = oId.trim();
          const cleanTId = tId && tId.trim() !== '' ? tId.trim() : null;
          if (cleanTId) {
            await pool.query(`
              INSERT INTO "claims_status" ("orderId", "trackingId", status)
              VALUES ($1, $2, 'unclaimed')
              ON CONFLICT ("trackingId") DO UPDATE SET
                "orderId" = COALESCE("claims_status"."orderId", EXCLUDED."orderId")
            `, [cleanOId, cleanTId]);
          } else {
            const upRes = await pool.query(`
              UPDATE "claims_status"
              SET "trackingId" = COALESCE("trackingId", $2)
              WHERE "orderId" = $1
            `, [cleanOId, null]);
            if (upRes.rowCount === 0) {
              await pool.query(`
                INSERT INTO "claims_status" ("orderId", "trackingId", status)
                VALUES ($1, NULL, 'unclaimed')
              `, [cleanOId]).catch(() => {});
            }
          }
        }
      }
    }

    // 3. Sync from Bot File logs (*.log)
    const logDir = path.join(process.cwd(), 'bot_logs');
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      for (const file of files) {
        if (file.endsWith('.log')) {
          const id = path.basename(file, '.log').trim();
          if (!id) continue;

          const filePath = path.join(logDir, file);
          const logContent = fs.readFileSync(filePath, 'utf-8');
          const parseResult = parseLogContent(logContent);

          const stats = fs.statSync(filePath);
          const createdAt = stats.birthtime || stats.mtime || new Date();

          // Find corresponding rows tracking that identifier inside claims_all to resolve true orderId(s) and trackingId(s)
          let targetPairs: { orderId: string, trackingId: string | null }[] = [];
          if (hasClaimsAll) {
            try {
              const matchRes = await pool.query(
                `SELECT DISTINCT "orderId", "trackingId" FROM "claims_all" WHERE LOWER("orderId") = LOWER($1) OR LOWER("trackingId") = LOWER($1) OR LOWER(lpn) = LOWER($1)`,
                [id]
              );
              for (const mRow of matchRes.rows) {
                if (mRow.orderId && mRow.orderId !== 'N/A') {
                  targetPairs.push({
                    orderId: mRow.orderId.trim(),
                    trackingId: mRow.trackingId ? mRow.trackingId.trim() : null
                  });
                }
              }
            } catch (err: any) {
              console.warn(`[WARN] Finding orderId/trackingId matching ${id} failed:`, err.message);
            }
          }

          // If no lookup relation is matched in base DB, fallback to using the file logID itself as orderId
          if (targetPairs.length === 0) {
            targetPairs.push({ orderId: id, trackingId: null });
          }

          // Batch-upsert / update each related orderId record simultaneously
          for (const pair of targetPairs) {
            if (!pair.orderId || pair.orderId.trim() === '' || pair.orderId === 'N/A') continue;

            // Enforce that log status synchronization only applies if targetOrderId exists in Evidence
            if (hasEvidenceTable) {
              const checkEvidence = await pool.query(`SELECT 1 FROM "${evidenceTableName}" WHERE "orderId" = $1 LIMIT 1`, [pair.orderId]);
              if (checkEvidence.rows.length === 0) {
                console.log(`[CRON LOG SYNC] Skipped Order ID: ${pair.orderId} since it is NOT present in "${evidenceTableName}" table.`);
                continue;
              }
            }

            const cleanPairTId = pair.trackingId && pair.trackingId.trim() !== '' ? pair.trackingId.trim() : null;
            if (cleanPairTId) {
              await pool.query(`
                INSERT INTO "claims_status" ("orderId", "trackingId", "claimId", status, bot_log_reason, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT ("trackingId")
                DO UPDATE SET
                  status = EXCLUDED.status,
                  "claimId" = COALESCE(NULLIF(EXCLUDED."claimId", ''), "claims_status"."claimId", ''),
                  "orderId" = COALESCE("claims_status"."orderId", EXCLUDED."orderId"),
                  bot_log_reason = EXCLUDED.bot_log_reason,
                  created_at = EXCLUDED.created_at
              `, [
                pair.orderId,
                cleanPairTId,
                parseResult.claimId,
                parseResult.status,
                parseResult.botLogReason,
                createdAt
              ]);
            } else {
              const upRes = await pool.query(`
                UPDATE "claims_status"
                SET 
                  status = $2,
                  "claimId" = COALESCE(NULLIF($3, ''), "claimId", ''),
                  bot_log_reason = $4,
                  created_at = $5
                WHERE "orderId" = $1
              `, [
                pair.orderId,
                parseResult.status,
                parseResult.claimId,
                parseResult.botLogReason,
                createdAt
              ]);
              if (upRes.rowCount === 0) {
                await pool.query(`
                  INSERT INTO "claims_status" ("orderId", "trackingId", "claimId", status, bot_log_reason, created_at)
                  VALUES ($1, NULL, $2, $3, $4, $5)
                `, [
                  pair.orderId,
                  parseResult.claimId,
                  parseResult.status,
                  parseResult.botLogReason,
                  createdAt
                ]).catch(() => {});
              }
            }
            console.log(`[CRON LOG SYNC] Synchronized logs for Order ID: ${pair.orderId} (Status: ${parseResult.status}, CreatedAt: ${createdAt})`);
          }
        }
      }
    } else {
      console.log("[CRON] No execution logs directory found at `./bot_logs` yet.");
    }

    // Final defensive pruning check to keep tables purely synched
    if (hasEvidenceTable) {
      await pool.query(`
        DELETE FROM "claims_status"
        WHERE "orderId" NOT IN (
          SELECT DISTINCT "orderId" 
          FROM "${evidenceTableName}"
          WHERE "orderId" IS NOT NULL AND "orderId" != 'N/A'
        )
      `);
    }

  } catch (err: any) {
    console.error("[CRON ERROR] Syncing automated status metrics failed:", err.message);
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}
