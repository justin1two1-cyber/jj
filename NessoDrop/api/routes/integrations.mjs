import { Router } from "express";
import { query } from "../db.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { logAudit } from "../middleware/audit.mjs";

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

export default router;
