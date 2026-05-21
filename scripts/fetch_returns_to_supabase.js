require("dotenv").config();

const SellingPartnerAPI = require("amazon-sp-api");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

// Environment variables required:
// REGION, REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET, AWS_ACCESS_KEY, AWS_SECRET_KEY
// MARKETPLACE_ID
// SUPABASE_URL, SUPABASE_KEY

const sp = new SellingPartnerAPI({
  region: process.env.REGION,
  refresh_token: process.env.REFRESH_TOKEN,
  credentials: {
    SELLING_PARTNER_APP_CLIENT_ID: process.env.CLIENT_ID,
    SELLING_PARTNER_APP_CLIENT_SECRET: process.env.CLIENT_SECRET,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_KEY,
  },
});

const MARKETPLACE_ID = process.env.MARKETPLACE_ID;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function generateReport(reportType, fileName, start, end) {
  try {
    console.log("\n====================");
    console.log("REPORT:", reportType);
    console.log("FROM:", start.toISOString());
    console.log("TO:", end.toISOString());

    const report = await sp.callAPI({
      operation: "createReport",
      endpoint: "reports",
      body: {
        reportType,
        dataStartTime: start.toISOString(),
        dataEndTime: end.toISOString(),
        marketplaceIds: [MARKETPLACE_ID],
      },
    });

    console.log("REPORT ID:", report.reportId);

    let reportStatus;

    while (true) {
      reportStatus = await sp.callAPI({
        operation: "getReport",
        endpoint: "reports",
        path: { reportId: report.reportId },
      });

      console.log("STATUS:", reportStatus.processingStatus);

      if (
        reportStatus.processingStatus === "DONE" ||
        reportStatus.processingStatus === "DONE_NO_DATA" ||
        reportStatus.processingStatus === "FATAL" ||
        reportStatus.processingStatus === "CANCELLED"
      ) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 15000));
    }

    if (reportStatus.processingStatus !== "DONE") {
      console.log(`${reportType} FAILED / EMPTY`);
      return null;
    }

    const document = await sp.callAPI({
      operation: "getReportDocument",
      endpoint: "reports",
      path: { reportDocumentId: reportStatus.reportDocumentId },
    });

    const reportData = await sp.download(document);

    fs.writeFileSync(`${fileName}.tsv`, reportData);
    console.log(`${fileName}.tsv SAVED`);
    return reportData;
  } catch (error) {
    console.error(error.response?.data || error.message || error);
    return null;
  }
}

function parseTSV(tsv) {
  if (!tsv) return [];
  const lines = tsv.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split("\t").map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length === 0) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j] ? header[j].toLowerCase().replace(/\s+/g, "_") : `col_${j}`;
      obj[key] = cols[j] !== undefined ? cols[j] : null;
    }
    rows.push(obj);
  }
  return rows;
}

async function upsertReturns(rows) {
  if (!rows || rows.length === 0) {
    console.log("No rows to upsert");
    return;
  }

  // NOTE: adjust `onConflict` to a unique key present in your Supabase table
  // common candidates: return_authorization_id, order_id, shipment_id
  try {
    const { data, error } = await supabase
      .from("customer_returns")
      .upsert(rows, { onConflict: "return_authorization_id" });

    if (error) {
      console.error("Upsert error:", error);
    } else {
      console.log(`Upserted ${Array.isArray(data) ? data.length : 1} rows`);
    }
  } catch (err) {
    console.error("Supabase error:", err.message || err);
  }
}

async function fetchChunk(reportType, fileName, startDaysAgo, endDaysAgo) {
  const end = new Date();
  end.setDate(end.getDate() - endDaysAgo);
  const start = new Date();
  start.setDate(start.getDate() - startDaysAgo);
  return await generateReport(reportType, fileName, start, end);
}

async function main() {
  console.log("\nFETCHING LAST 30 DAYS - CUSTOMER RETURNS\n");

  const customerReturns30 = await fetchChunk(
    "GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA",
    "customer_returns_0_30",
    30,
    0,
  );

  if (!customerReturns30) return;

  const rows = parseTSV(customerReturns30.toString());

  console.log(`Parsed ${rows.length} return rows`);

  // Optional: transform or pick only desired fields before upsert
  // const payload = rows.map(r => ({ order_id: r.order_id, return_reason: r.return_reason, ... }));

  await upsertReturns(rows);
}

main().catch((e) => console.error(e));
