import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import SellingPartnerAPI from "amazon-sp-api";

// Reconstruct __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

const prisma = new PrismaClient();

// Mock state
let nextReportId = 2000;
let nextDocumentId = 3000;
const mockReports = {};

console.log("====================================================");
console.log("🛡️  Aegis Test Runner: ESM API Fetcher Verification");
console.log("====================================================\n");

// Ensure environment variables are populated with mock values if not set
process.env.REGION = process.env.REGION || "eu";
process.env.REFRESH_TOKEN = process.env.REFRESH_TOKEN || "mock-refresh-token";
process.env.CLIENT_ID = process.env.CLIENT_ID || "mock-client-id";
process.env.CLIENT_SECRET = process.env.CLIENT_SECRET || "mock-client-secret";
process.env.AWS_ACCESS_KEY1 = process.env.AWS_ACCESS_KEY1 || "mock-aws-key";
process.env.AWS_SECRET_KEY1 = process.env.AWS_SECRET_KEY1 || "mock-aws-secret";
process.env.MARKETPLACE_ID = process.env.MARKETPLACE_ID || "mock-marketplace-id";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";
process.env.RP_TOKEN = process.env.RP_TOKEN || "mock-rp-token";
process.env.SHIPROCKET_TOKEN = process.env.SHIPROCKET_TOKEN || "mock-shiprocket-token";

// Disable automatic nested repopulation during raw sync to test them in isolation
process.env.DISABLE_REPOPULATE = "true";

// 1. Mock SellingPartnerAPI Prototype
SellingPartnerAPI.prototype.callAPI = async function ({ operation, body, path: pathParams }) {
  if (operation === "createReport") {
    const reportType = body.reportType;
    const reportId = `rep_${nextReportId++}`;
    const documentId = `doc_${nextDocumentId++}`;
    mockReports[reportId] = {
      processingStatus: "DONE",
      reportDocumentId: documentId,
      reportType,
    };
    return { reportId };
  }

  if (operation === "getReport") {
    const reportId = pathParams.reportId;
    return mockReports[reportId] || { processingStatus: "FATAL" };
  }

  if (operation === "getReportDocument") {
    const docId = pathParams.reportDocumentId;
    return { reportDocumentId: docId };
  }

  throw new Error(`[Mock SP-API] Unhandled operation: ${operation}`);
};

const sliceTSV = (filePath, maxLines = 5) => {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.slice(0, maxLines + 1).join("\n");
  } catch (err) {
    console.error(`[Error] Failed to read mock file ${filePath}:`, err.message);
    return "";
  }
};

SellingPartnerAPI.prototype.download = async function (document) {
  const docId = document.reportDocumentId;
  let reportType = null;
  for (const [_, report] of Object.entries(mockReports)) {
    if (report.reportDocumentId === docId) {
      reportType = report.reportType;
      break;
    }
  }

  if (reportType === "GET_FBA_FULFILLMENT_REMOVAL_ORDER_DETAIL_DATA") {
    return sliceTSV(path.join(projectRoot, "scripts", "removal_orders_0_30.tsv"));
  }
  if (reportType === "GET_FBA_FULFILLMENT_REMOVAL_SHIPMENT_DETAIL_DATA") {
    return sliceTSV(path.join(projectRoot, "scripts", "removal_shipments_0_30.tsv"));
  }
  if (reportType === "GET_FBA_REIMBURSEMENTS_DATA") {
    return sliceTSV(path.join(projectRoot, "scripts", "reimbursements_0_30.tsv"));
  }
  if (reportType === "GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA") {
    return sliceTSV(path.join(projectRoot, "scripts", "customer_returns_0_30.tsv"));
  }
  if (reportType === "GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL") {
    return sliceTSV(path.join(projectRoot, "scripts", "removal_orders_0_30.tsv")); // Mock orders file
  }

  throw new Error(`[Mock FBA Report] Unhandled report type: ${reportType}`);
};

// 2. Mock Global fetch
const originalFetch = global.fetch;

global.fetch = async function (url, options) {
  const urlStr = String(url);

  if (urlStr.includes("admin.returnprime.com")) {
    const filePath = path.join(projectRoot, "returnprime_returns.json");
    if (!fs.existsSync(filePath)) {
      // Write mock returnprime JSON if it doesn't exist
      fs.writeFileSync(filePath, JSON.stringify([{ id: 801, request_number: "RP100", line_items: [{ id: 901 }] }], null, 2));
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const smallData = data.slice(0, 5);
    return new Response(JSON.stringify(smallData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (urlStr.includes("external/orders/processing/return")) {
    const filePath = path.join(projectRoot, "shiprocket_returns.json");
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([{ id: 802, channel_order_id: "SR100", products: [{ id: 902 }] }], null, 2));
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const smallData = data.slice(0, 5);
    return new Response(JSON.stringify({ data: smallData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (urlStr.includes("external/auth/login")) {
    return new Response(JSON.stringify({ token: "mock-shiprocket-token" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (urlStr.includes("external/courier/track")) {
    return new Response(JSON.stringify({
      tracking_data: {
        track_status: 1,
        shipment_status: "Delivered",
        shipment_track: [{
          current_status: "Delivered",
          courier_name: "Blue Dart",
          etd: new Date().toISOString(),
        }],
        shipment_track_activities: [{
          date: "2026-05-29",
          time: "12:00",
          status: "Delivered",
          location: "Warehouse Dock",
        }],
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return originalFetch ? originalFetch(url, options) : new Response(JSON.stringify({}), { status: 404 });
};

async function runTests() {
  let failed = false;

  try {
    // ----------------------------------------------------
    // TEST 1: Shopify & Shiprocket Returns Sync
    // ----------------------------------------------------
    console.log("--- Test 1: Shopify & Shiprocket Returns Sync ---");
    const { runShopifyReturnsJob } = await import("../lib/shopifyReturns.ts");
    console.log("Running runShopifyReturnsJob()...");
    const results = await runShopifyReturnsJob();
    console.log("Shopify Job completed successfully:", results);
    console.log("✅ Test 1 Passed!\n");

    // ----------------------------------------------------
    // TEST 2: Amazon Raw Staging Sync
    // ----------------------------------------------------
    console.log("--- Test 2: Amazon Raw Staging Sync (fetch_amz_raw_reports.js) ---");
    const rawSyncModule = await import("./fetch_amz_raw_reports.js");
    console.log("Running fetch_amz_raw_reports main()...");
    await rawSyncModule.main();
    console.log("✅ Test 2 Passed!\n");

    // ----------------------------------------------------
    // TEST 3: Amazon Supabase Sync Orchestrator
    // ----------------------------------------------------
    console.log("--- Test 3: Amazon Supabase Sync (fetch_returns_to_supabase.js) ---");
    const supabaseSyncModule = await import("./fetch_returns_to_supabase.js");
    console.log("Running fetch_returns_to_supabase main()...");
    await supabaseSyncModule.main();
    console.log("✅ Test 3 Passed!\n");

    // ----------------------------------------------------
    // TEST 4: Repopulate Incremental Operational Processing
    // ----------------------------------------------------
    console.log("--- Test 4: Repopulate Incremental (repopulate_incremental.js) ---");
    const repopulateIncrementalModule = await import("./repopulate_incremental.js");
    console.log("Running repopulate_incremental main()...");
    await repopulateIncrementalModule.main();
    console.log("✅ Test 4 Passed!\n");

  } catch (error) {
    console.error("\n❌ Test Suite Failed with Error:");
    console.error(error);
    failed = true;
  } finally {
    console.log("----------------------------------------------------");
    console.log("🧹 Cleaning up test rows from local database...");
    console.log("----------------------------------------------------");

    try {
      const deletedReturnItems = await prisma.returnItem.deleteMany({});
      const deletedCoreOrders = await prisma.order.deleteMany({});
      const deletedCoreReimbursements = await prisma.reimbursement.deleteMany({});
      const deletedManifests = await prisma.manifest.deleteMany({});
      const deletedRP = await prisma.returnPrimeReturn.deleteMany({});
      const deletedSR = await prisma.shiprocketReturn.deleteMany({});
      const deletedTracking = await prisma.shopifyReturnTracking.deleteMany({});
      const deletedRawOrders = await prisma.aMZRemovalOrder.deleteMany({});
      const deletedRawShipments = await prisma.aMZRemovalShipment.deleteMany({});
      const deletedRawReturns = await prisma.aMZCustomerReturn.deleteMany({});
      const deletedRawReimbursements = await prisma.aMZReimbursement.deleteMany({});

      console.log("Operational & Raw staging tables cleaned successfully!");
    } catch (cleanError) {
      console.error("Cleanup failed:", cleanError.message);
    }

    await prisma.$disconnect();
    global.fetch = originalFetch;

    if (failed) {
      console.log("\n====================================================");
      console.log("❌ Aegis Test Runner: COMPREHENSIVE ESM SYNC TESTS FAILED ❌");
      console.log("====================================================\n");
      process.exit(1);
    } else {
      console.log("\n====================================================");
      console.log("🎉 Aegis Test Runner: ALL ESM SYNC TESTS PASSED SUCCESSFULLY! 🎉");
      console.log("====================================================\n");
      process.exit(0);
    }
  }
}

runTests();
