-- Migration 002: Octoparse multi-platform scraper integration
-- 1. New signal_source enum values — without these, every octoparse/etsy
--    signal insert fails with an invalid-enum error.
-- 2. Sales/popularity metrics on signals (scraped templates provide sold
--    counts and ratings — the strongest commercial-intent evidence).
-- 3. Unique index so dedup is race-safe and ON CONFLICT upserts work.
--
-- Idempotent: safe to run on an existing database.
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block;
-- run this file with psql -f (statement-at-a-time), not wrapped in BEGIN.

ALTER TYPE signal_source ADD VALUE IF NOT EXISTS 'octoparse_aliexpress';
ALTER TYPE signal_source ADD VALUE IF NOT EXISTS 'octoparse_ebay';
ALTER TYPE signal_source ADD VALUE IF NOT EXISTS 'octoparse_etsy';
ALTER TYPE signal_source ADD VALUE IF NOT EXISTS 'octoparse_tiktok';
ALTER TYPE signal_source ADD VALUE IF NOT EXISTS 'octoparse_amazon';

ALTER TABLE signals ADD COLUMN IF NOT EXISTS sales_volume INTEGER;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2);
ALTER TABLE signals ADD COLUMN IF NOT EXISTS review_count INTEGER;

-- Frequent dashboard sort: most-sold first within a status lane
CREATE INDEX IF NOT EXISTS idx_signals_sales_volume
  ON signals (sales_volume DESC NULLS LAST)
  WHERE sales_volume IS NOT NULL;

-- Clean up any pre-existing duplicates before the unique index lands.
-- Keeps the newest row per (source, product); never deletes a signal that
-- a candidate references.
DELETE FROM signals a
USING signals b
WHERE a.source = b.source
  AND a.source_product_id = b.source_product_id
  AND a.source_product_id IS NOT NULL
  AND a.id <> b.id
  AND a.ingested_at < b.ingested_at
  AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.signal_id = a.id);

-- Race-safe dedup + enables ON CONFLICT price updates on re-scrape
CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_source_product
  ON signals (source, source_product_id)
  WHERE source_product_id IS NOT NULL;
