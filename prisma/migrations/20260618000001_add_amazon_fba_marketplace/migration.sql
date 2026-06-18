-- Migration: add_amazon_fba_marketplace
-- Adds AMAZON_FBA value to the Marketplace enum.
-- NOTE: ALTER TYPE … ADD VALUE cannot run inside a transaction on PostgreSQL < 14.
-- On Supabase (PostgreSQL 15+) this is safe as-is.

ALTER TYPE "Marketplace" ADD VALUE IF NOT EXISTS 'AMAZON_FBA';
