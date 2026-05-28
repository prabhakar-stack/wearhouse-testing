-- Rename Shopify return tables to source-based names.
ALTER TABLE "shopify_b2c_returns" RENAME TO "return_prime_returns";
ALTER TABLE "shopify_b2b_returns" RENAME TO "shiprocket_returns";
ALTER INDEX "shopify_b2c_returns_requestNumber_key" RENAME TO "return_prime_returns_requestNumber_key";
ALTER INDEX "shopify_b2c_returns_orderId_idx" RENAME TO "return_prime_returns_orderId_idx";
ALTER INDEX "shopify_b2c_returns_trackingNumber_idx" RENAME TO "return_prime_returns_trackingNumber_idx";
ALTER INDEX "shopify_b2b_returns_orderId_idx" RENAME TO "shiprocket_returns_orderId_idx";
ALTER INDEX "shopify_b2b_returns_trackingNumber_idx" RENAME TO "shiprocket_returns_trackingNumber_idx";