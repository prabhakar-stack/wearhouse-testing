require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the field definitions and helper functions from fetch_amz_raw_reports.cjs
const fetchModulePath = path.join(process.cwd(), 'scripts', 'fetch_amz_raw_reports.cjs');
const fetchModule = require(fetchModulePath);

// Destructure needed exports
const {
  parseTSV,
  syncRemovalOrders,
  syncRemovalShipments,
  syncReimbursements,
  syncCustomerReturns,
  fetchReportData,
  REMOVAL_ORDERS_REPORT_TYPE,
  REMOVAL_SHIPMENTS_REPORT_TYPE,
  REIMBURSEMENTS_REPORT_TYPE,
  RETURNS_REPORT_TYPE,
} = fetchModule;

async function main() {
  const reports = [
    { type: REMOVAL_ORDERS_REPORT_TYPE, file: 'removal_orders' },
    { type: REMOVAL_SHIPMENTS_REPORT_TYPE, file: 'removal_shipments' },
    { type: REIMBURSEMENTS_REPORT_TYPE, file: 'reimbursements' },
    { type: RETURNS_REPORT_TYPE, file: 'customer_returns' },
  ];

  for (const { type, file } of reports) {
    console.log(`\n=== Fetching ${file} ===`);
    const tsv = await fetchReportData(type, file, 30, 0);
    if (!tsv) {
      console.warn(`No data for ${file}, skipping.`);
      continue;
    }
    const rows = parseTSV(tsv);
    switch (file) {
      case 'removal_orders':
        await syncRemovalOrders(rows);
        break;
      case 'removal_shipments':
        await syncRemovalShipments(rows);
        break;
      case 'reimbursements':
        await syncReimbursements(rows);
        break;
      case 'customer_returns':
        await syncCustomerReturns(rows);
        break;
    }
  }
  console.log('All imports complete.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
