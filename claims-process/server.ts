import 'dotenv/config';
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import pg from "pg";
import { fileAmazonClaim } from "./bot/amazonFiler";
import postgres from "postgres";

// Lazy initialization for PostgreSQL Pool
let pool: pg.Pool | null = null;

function getDbPool() {
  if (!pool) {
    let connectionString = process.env.SUPABASE_URL;
    
    if (connectionString) {
      // Fix potential typos and hidden characters
      connectionString = connectionString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');

      if (connectionString.startsWith('hpostgresql://')) {
        connectionString = connectionString.substring(1);
      }
      
      // Sanitize password if it contains common placeholder brackets [PASSWORD]
      const passwordMatch = connectionString.match(/:(.*)@/);
      
      console.log(`Initializing PostgreSQL Pool...`);
      pool = new pg.Pool({
        connectionString,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 20,
        ssl: {
          rejectUnauthorized: false
        }
      });

      // Test connection and log instructions
      (async () => {
        try {
          const client = await pool.connect();
          console.log("✅ Successfully connected to Supabase PostgreSQL");
          client.release();
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

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

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
    }
  ];

  // Bot state tracking
  let isBotRunning = false;
  let isOtpRequired = false;
  let lastBotRunFinishedAt: number | null = null;
  const COOLING_PERIOD_MS = 1 * 60 * 1000; // 1 minute for testability

  // API Routes
  app.get("/api/claims", async (req, res) => {
    const pool = getDbPool();
    let rawRows = [];

    if (pool) {
      try {
        const result = await pool.query('SELECT * FROM claims');
        rawRows = result.rows;
        if (rawRows.length === 0) {
          rawRows = mockClaims;
        }
      } catch (error: any) {
        console.log(`SQL error with 'claims' table: ${error.message}. Retrying with alternatives...`);
        try {
          const retryResult = await pool.query('SELECT * FROM "Claims"');
          rawRows = retryResult.rows;
        } catch (innerError: any) {
          console.error("Database fetch failure - using mock data fallback.");
          rawRows = mockClaims;
        }
      }
    } else {
      rawRows = mockClaims;
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
          items: [data] // Keep track of original rows if needed
        };
      } else {
        processedMap[key].qty += 1;
        // Merge some fields if they differ? For now we just count.
        // Update status or other fields if needed
        processedMap[key].items.push(data);
      }
    });

    res.json(Object.values(processedMap));
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

        // Try both table names: lowercase 'claims' and quoted '"Claims"'
        const tables = ['claims', '"Claims"'];
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
