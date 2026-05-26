import pg from 'pg';
import 'dotenv/config';

/**
 * Periodically updates Amazon SAFE-T Claim statuses for demonstration and mock background pipeline testing.
 * In a real-world scenario, this might poll Amazon Seller APIs or process callbacks.
 * Here, it checks for 'New' or 'Claimed' records in physical tables or runs simulations.
 */
export async function updateClaimsStatus(): Promise<void> {
  console.log("[CRON] Checking for updates on SAFE-T claims status...");

  let connectionString = process.env.SUPABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("[CRON Mock] No database pool connection found. Simulating claims status updates in memory or skipping.");
    return;
  }

  connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (connectionString.startsWith('hpostgresql://')) {
    connectionString = connectionString.substring(1);
  }

  // Sanitize password bracket wrapping (common issue in dynamic deployments)
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
      connectionTimeoutMillis: 10000,
      max: 1,
      ssl: (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
        ? false
        : { rejectUnauthorized: false }
    });

    // 1. Discover if claims_amz tables exist and update status fields over time
    // For outstanding 'Claimed' claims, transition some to 'Approved' or 'Rejected' to simulate real-world workflow
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND LOWER(table_name) = 'claims_amz'
    `);

    if (tableCheck.rows.length > 0) {
      // Find one 'Claimed' claim and mark it as 'Approved' or 'Rejected' to show dynamic activity
      const selectRes = await pool.query('SELECT lpn FROM "claims_amz" WHERE status = \'Claimed\' LIMIT 5');
      if (selectRes.rows.length > 0) {
        for (const row of selectRes.rows) {
          const nextStatus = Math.random() > 0.4 ? 'Approved' : 'Rejected';
          await pool.query('UPDATE "claims_amz" SET status = $1 WHERE lpn = $2', [nextStatus, row.lpn]);
          console.log(`[CRON DB] Simulated status update for claim on LPN ${row.lpn} from 'Claimed' to '${nextStatus}'`);
        }
      } else {
        console.log("[CRON DB] No outstanding 'Claimed' claims found to simulate update on.");
      }
    } else {
      console.log("[CRON DB] Physical table 'claims_amz' not found. Skipping SQL status simulation.");
    }
  } catch (err: any) {
    console.error("[CRON DB Error] Error while processing automated claim status updates:", err.message);
  } finally {
    if (pool) {
      await pool.end().catch(() => {});
    }
  }
}
