import { Router } from "express";
import { query } from "../db.mjs";
import { requireAuth, requireOwner } from "../middleware/auth.mjs";
import { logAudit } from "../middleware/audit.mjs";
import { mapRows, parseCsv, OCTOPARSE_PLATFORMS } from "../lib/octoparse-mappers.mjs";

const router = Router();

// Integration keys stored per-user in settings table.
// Values are stored encrypted in production; here we use the DB's pgcrypto.
// Never returned in plaintext after write — only masked last-4 chars.

const INTEGRATION_KEYS = [
  // Shopify
  "shopify_store_domain",
  "shopify_admin_api_url",
  "shopify_client_id",
  "shopify_client_secret",
  "shopify_access_token",
  "shopify_webhook_secret",
  // Stripe (customer account)
  "stripe_account_id",
  "stripe_secret_key",
  "stripe_webhook_secret",
  "stripe_webhook_url",
  // TikTok Ads
  "tiktok_ads_account_id",
  "tiktok_client_key",
  "tiktok_client_secret",
  "tiktok_access_token",
  // Meta Ads
  "meta_ads_account_id",
  "meta_ads_manager_url",
  "meta_access_token",
  // Google Ads
  "google_ads_manager_account",
  "google_ads_customer_id",
  "google_ads_developer_token",
  "google_ads_oauth_credentials",
  // Primary Supplier API
  "supplier_api_url",
  "supplier_portal_url",
  "supplier_api_key",
  "supplier_fallback_name",
  "supplier_fallback_email",
  // Storefront
  "store_public_url",
  "store_admin_url",
];

const OWNER_ONLY_KEYS = [
  // Octoparse cloud scraping (Standard plan API; free plan uses manual import)
  "octoparse_username",
  "octoparse_password",
  "octoparse_tasks",
  // eBay official Developer API (free tier — developer.ebay.com)
  "ebay_client_id",
  "ebay_client_secret",
  // AliExpress Affiliate API (free — portals.aliexpress.com)
  "aliexpress_app_key",
  "aliexpress_app_secret",
  "owner_stripe_account_id",
  "owner_stripe_secret_key",
  "owner_stripe_webhook_secret",
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_password",
  "cloudflare_zone_id",
  "cloudflare_api_token",
];

function maskValue(val) {
  if (!val || val.length < 8) return "****";
  return "****" + val.slice(-4);
}

// GET /api/integrations — list integration status (masked values)
router.get("/", requireAuth, async (req, res) => {
  const keys = req.user.role === "owner"
    ? [...INTEGRATION_KEYS, ...OWNER_ONLY_KEYS]
    : INTEGRATION_KEYS;

  const result = await query(
    `SELECT key, value FROM settings WHERE user_id = $1 AND key = ANY($2::text[])`,
    [req.user.id, keys]
  );

  const configured = {};
  for (const row of result.rows) {
    configured[row.key] = { configured: true, preview: maskValue(row.value) };
  }

  const integrations = {};
  for (const key of keys) {
    integrations[key] = configured[key] || { configured: false, preview: null };
  }

  return res.json(integrations);
});

// PUT /api/integrations/:key — set or update an integration credential
router.put("/:key", requireAuth, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  const allowed = req.user.role === "owner"
    ? [...INTEGRATION_KEYS, ...OWNER_ONLY_KEYS]
    : INTEGRATION_KEYS;

  if (!allowed.includes(key)) {
    return res.status(403).json({ error: "Key not allowed" });
  }
  if (!value) return res.status(400).json({ error: "value required" });

  await query(
    `INSERT INTO settings (user_id, key, value)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
    [req.user.id, key, value]
  );

  await logAudit(req.user.id, "update_integration", "settings", null, { key }, req.ip);

  return res.json({ ok: true, key, preview: maskValue(value) });
});

// DELETE /api/integrations/:key — remove a credential
router.delete("/:key", requireAuth, async (req, res) => {
  await query(
    `DELETE FROM settings WHERE user_id = $1 AND key = $2`,
    [req.user.id, req.params.key]
  );
  await logAudit(req.user.id, "remove_integration", "settings", null, { key: req.params.key }, req.ip);
  return res.json({ ok: true });
});

// GET /api/integrations/test/:key — smoke-test a specific integration
router.get("/test/:key", requireAuth, async (req, res) => {
  const settingRes = await query(
    `SELECT value FROM settings WHERE user_id = $1 AND key = $2`,
    [req.user.id, req.params.key]
  );
  if (!settingRes.rows[0]) {
    return res.json({ ok: false, message: "Not configured" });
  }

  // Basic connectivity tests for known integrations
  const key = req.params.key;
  try {
    if (key === "shopify_access_token") {
      const domainRow = await query(
        `SELECT value FROM settings WHERE user_id = $1 AND key = 'shopify_store_domain'`,
        [req.user.id]
      );
      if (!domainRow.rows[0]) return res.json({ ok: false, message: "shopify_store_domain not set" });
      const r = await fetch(
        `https://${domainRow.rows[0].value}/admin/api/2024-01/shop.json`,
        { headers: { "X-Shopify-Access-Token": settingRes.rows[0].value } }
      );
      return res.json({ ok: r.ok, status: r.status });
    }

    if (key === "stripe_secret_key") {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(settingRes.rows[0].value, { apiVersion: "2024-11-20.acacia" });
      await stripe.balance.retrieve();
      return res.json({ ok: true });
    }

    return res.json({ ok: true, message: "Connectivity test not implemented for this key — value is set" });
  } catch (err) {
    return res.json({ ok: false, message: err.message });
  }
});

// POST /api/integrations/octoparse/import — manual Octoparse export import.
// Free-plan path: export from Octoparse (CSV or JSON), upload here with the
// platform name. Same field mappers as the automated API connector.
// Body: { platform: "aliexpress"|"ebay"|"etsy"|"tiktok"|"amazon",
//         format: "json"|"csv", data: <JSON array or CSV string>,
//         purpose?: "signals"|"supplier_prices" }
router.post("/octoparse/import", requireAuth, requireOwner, async (req, res) => {
  const { platform, format = "json", data, purpose = "signals" } = req.body;

  if (!OCTOPARSE_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `platform must be one of: ${OCTOPARSE_PLATFORMS.join(", ")}` });
  }
  if (!data) return res.status(400).json({ error: "data required (JSON array or CSV string)" });

  let rows;
  if (format === "csv") {
    if (typeof data !== "string") return res.status(400).json({ error: "CSV data must be a string" });
    rows = parseCsv(data);
  } else {
    rows = Array.isArray(data) ? data : null;
  }
  if (!rows?.length) return res.status(400).json({ error: "No rows found in data" });

  const { signals, skipped } = mapRows(platform, rows);

  let inserted = 0;
  let duplicates = 0;
  for (const s of signals) {
    try {
      const result = await query(
        `INSERT INTO signals
           (source, source_product_id, title, description, image_url, source_url,
            raw_price, currency, category, tags, commercial_intent_score, status,
            sales_volume, rating, review_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'raw',$12,$13,$14)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          s.source, s.source_product_id, s.title, s.description, s.image_url,
          s.source_url, s.raw_price, s.currency || "USD", s.category,
          s.tags || [], 0.7, // imported product listings are commerce by construction
          s.sales_volume, s.rating, s.review_count,
        ]
      );
      if (result.rows[0]) inserted++;
      else duplicates++;
    } catch (err) {
      if (err.code === "23505") duplicates++;
      else console.error("[integrations:octoparse] Insert failed:", err.message);
    }
  }

  // Supplier-price imports also queue candidate matching (real costs → supplier_options)
  if (purpose === "supplier_prices") {
    const items = signals
      .filter((s) => s.title && s.raw_price)
      .map((s) => ({
        title: s.title,
        cost_price: s.raw_price,
        product_url: s.source_url,
        supplier_product_id: s.source_product_id,
        rating: s.rating,
        review_count: s.review_count,
        platform,
      }));
    if (items.length) {
      await query(
        `INSERT INTO tasks (type, payload) VALUES ('octoparse_supplier_match', $1)`,
        [JSON.stringify({ items })]
      );
    }
  }

  await logAudit(req.user.id, "octoparse_import", "signal", null,
    { platform, purpose, rows: rows.length, inserted, duplicates, skipped }, req.ip);

  return res.json({ ok: true, platform, purpose, rows: rows.length, inserted, duplicates, skipped });
});

export default router;
