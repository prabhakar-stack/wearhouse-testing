import { main as fetchAndSync } from "./fetch_returns_to_supabase.js";
import { materializeOrdersFromShipments } from "./materialize_orders_from_shipments.js";

async function runFullSync() {
  try {
    console.log("🚀 Starting Amazon data fetch & staging …");
    await fetchAndSync();
    console.log("✅ Fetch & staging completed.");

    console.log("🛠️ Mapping shipments → Orders & Manifests …");
    await materializeOrdersFromShipments();
    console.log("✅ Orders & Manifests materialized.");
  } catch (error) {
    console.error("❌ Full sync failed:", error);
    process.exit(1);
  }
}

runFullSync();
