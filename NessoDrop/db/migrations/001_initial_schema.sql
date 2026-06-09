-- Nesso Drop: Initial Schema
-- Source of truth for signals, candidates, reviews, users, settings,
-- budgets, audit, tasks, exports, billing records.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','owner')),
  password_hash TEXT NOT NULL,
  store_url   TEXT,
  budget_limit NUMERIC(12,2) DEFAULT 500.00,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Settings ─────────────────────────────────────────────────────────────
CREATE TABLE settings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, key)
);

-- ─── Discovery Signals ────────────────────────────────────────────────────
-- Raw output from OpenClaw before any scoring or review.
CREATE TYPE signal_source AS ENUM (
  'aliexpress_bsr',
  'amazon_movers',
  'tiktok_shop',
  'ebay_sold',
  'reddit',
  'cj_trending',
  'spocket_trending',
  'manual'
);

CREATE TYPE signal_status AS ENUM (
  'raw',          -- just ingested, not reviewed
  'pending',      -- under review / scoring
  'promoted',     -- became a candidate
  'rejected',     -- filtered out
  'duplicate'     -- already exists
);

CREATE TABLE signals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source            signal_source NOT NULL,
  source_product_id TEXT,
  title             TEXT NOT NULL,
  description       TEXT,
  image_url         TEXT,
  source_url        TEXT,
  raw_price         NUMERIC(10,2),
  currency          TEXT DEFAULT 'USD',
  category          TEXT,
  tags              TEXT[],
  commercial_intent_score NUMERIC(4,3) DEFAULT 0,  -- 0-1, gate at 0.6
  is_product        BOOLEAN DEFAULT true,
  status            signal_status NOT NULL DEFAULT 'raw',
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ
);

CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_source ON signals(source);
CREATE INDEX idx_signals_ingested ON signals(ingested_at DESC);

-- ─── Candidate Products ───────────────────────────────────────────────────
-- Signals that passed the commercial viability gate.
CREATE TYPE price_band AS ENUM (
  'under_200',
  'band_200_600',
  'band_600_1000',
  'over_1000'
);

CREATE TYPE intent_category AS ENUM (
  'most_purchased',
  'most_viewed',
  'best_reviewed'
);

CREATE TYPE candidate_status AS ENUM (
  'pending',    -- awaiting owner/user review
  'approved',   -- cleared for supplier sourcing and campaigns
  'rejected',   -- not suitable
  'live'        -- actively selling
);

CREATE TABLE candidates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  signal_id           UUID REFERENCES signals(id),
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  category            TEXT,
  price_band          price_band,
  intent_category     intent_category,
  viability_score     NUMERIC(4,3) DEFAULT 0,   -- 0-1, only >0.65 shown in top products
  status              candidate_status NOT NULL DEFAULT 'pending',
  chosen_supplier_id  UUID,                      -- set before launch
  target_sale_price   NUMERIC(10,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_user ON candidates(user_id);
CREATE INDEX idx_candidates_viability ON candidates(viability_score DESC);
CREATE INDEX idx_candidates_price_band ON candidates(price_band);

-- ─── Supplier Options ─────────────────────────────────────────────────────
CREATE TYPE supplier_platform AS ENUM (
  'aliexpress',
  'cjdropshipping',
  'spocket',
  'manual'
);

CREATE TABLE supplier_options (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id      UUID REFERENCES candidates(id) ON DELETE CASCADE,
  platform          supplier_platform NOT NULL,
  supplier_name     TEXT,
  product_url       TEXT,
  supplier_product_id TEXT,
  cost_price        NUMERIC(10,2) NOT NULL,
  shipping_cost     NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_days_min INT DEFAULT 7,
  shipping_days_max INT DEFAULT 21,
  landed_cost       NUMERIC(10,2) GENERATED ALWAYS AS (cost_price + shipping_cost) STORED,
  in_stock          BOOLEAN DEFAULT true,
  rating            NUMERIC(3,2),
  review_count      INT DEFAULT 0,
  last_synced       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_chosen         BOOLEAN DEFAULT false
);

CREATE INDEX idx_supplier_options_candidate ON supplier_options(candidate_id);
CREATE INDEX idx_supplier_options_landed ON supplier_options(landed_cost ASC);

-- Only one chosen supplier per candidate
CREATE UNIQUE INDEX idx_one_chosen_supplier ON supplier_options(candidate_id) WHERE is_chosen = true;

-- ─── Campaigns ────────────────────────────────────────────────────────────
CREATE TYPE campaign_status AS ENUM (
  'draft',
  'quality_check',
  'pending_approval',
  'approved',
  'live',
  'paused',
  'rejected'
);

CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id    UUID REFERENCES candidates(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  headline        TEXT,
  hook            TEXT,
  body_copy       TEXT,
  cta_text        TEXT DEFAULT 'Buy Now',
  store_cta_url   TEXT,
  image_url       TEXT,
  video_url       TEXT,
  ad_spend_budget NUMERIC(10,2) DEFAULT 0,
  quality_score   NUMERIC(4,3),              -- AI self-check score 0-1
  status          campaign_status NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_user ON campaigns(user_id);

-- ─── Orders ───────────────────────────────────────────────────────────────
CREATE TYPE order_status AS ENUM (
  'pending',
  'paid',
  'processing',
  'dispatched_to_supplier',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  customer_email  TEXT NOT NULL,
  customer_name   TEXT,
  shipping_address JSONB,
  status          order_status NOT NULL DEFAULT 'pending',
  stripe_payment_intent TEXT,
  tracking_number TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  candidate_id    UUID REFERENCES candidates(id),
  supplier_option_id UUID REFERENCES supplier_options(id),
  title           TEXT NOT NULL,
  qty             INT NOT NULL DEFAULT 1,
  unit_sale_price NUMERIC(10,2) NOT NULL,
  unit_cost_price NUMERIC(10,2) NOT NULL,
  unit_shipping   NUMERIC(10,2) NOT NULL DEFAULT 0
);

-- ─── Billing Records ──────────────────────────────────────────────────────
-- Net profit = sale - supplier_cost - shipping - stripe_fee - ad_spend - platform_fee
CREATE TABLE billing_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id),
  user_id         UUID REFERENCES users(id),
  sale_total      NUMERIC(12,2) NOT NULL,
  supplier_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  stripe_fee      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- 2.9% + $0.30
  ad_spend        NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_fee    NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_profit      NUMERIC(12,2) GENERATED ALWAYS AS (
    sale_total - supplier_cost - shipping_cost - stripe_fee - ad_spend - platform_fee
  ) STORED,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_complete     BOOLEAN GENERATED ALWAYS AS (
    supplier_cost > 0 AND stripe_fee > 0
  ) STORED
);

CREATE INDEX idx_billing_user ON billing_records(user_id);
CREATE INDEX idx_billing_complete ON billing_records(is_complete);
CREATE INDEX idx_billing_date ON billing_records(recorded_at DESC);

-- ─── Budgets ──────────────────────────────────────────────────────────────
CREATE TABLE budgets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  period      TEXT NOT NULL,  -- YYYY-MM
  ad_budget   NUMERIC(12,2) DEFAULT 0,
  ad_spent    NUMERIC(12,2) DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period)
);

-- ─── Audit Log ────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  detail      JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_log(created_at DESC);

-- ─── Tasks ────────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL,
  payload     JSONB,
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  attempts    INT DEFAULT 0,
  error       TEXT,
  queued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status, queued_at);

-- ─── Exports ──────────────────────────────────────────────────────────────
CREATE TABLE exports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id),
  type        TEXT NOT NULL,
  file_path   TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Updated-at trigger ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_candidates_updated BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
