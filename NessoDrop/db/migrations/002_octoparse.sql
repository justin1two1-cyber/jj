-- Migration 002: Octoparse multi-platform scraper integration
-- Adds sales/popularity metrics to signals (scraped templates provide sold
-- counts and ratings — the strongest commercial-intent evidence available).

ALTER TABLE signals ADD COLUMN IF NOT EXISTS sales_volume INTEGER;
ALTER TABLE signals ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2);
ALTER TABLE signals ADD COLUMN IF NOT EXISTS review_count INTEGER;

-- Frequent dashboard sort: most-sold first within a status lane
CREATE INDEX IF NOT EXISTS idx_signals_sales_volume
  ON signals (sales_volume DESC NULLS LAST)
  WHERE sales_volume IS NOT NULL;
