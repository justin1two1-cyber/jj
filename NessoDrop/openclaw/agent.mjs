import "dotenv/config";
import pg from "pg";
import { scoreCommercialIntent, isCommerciallyViable } from "./filters/commercial-intent.mjs";
import { fetchSignals as fetchAliexpress } from "./sources/aliexpress.mjs";
import { fetchSignals as fetchAmazon } from "./sources/amazon.mjs";
import { fetchSignals as fetchTikTok } from "./sources/tiktok.mjs";
import { fetchSignals as fetchEbay } from "./sources/ebay.mjs";
import { fetchSignals as fetchManual } from "./sources/manual.mjs";
import { fetchSignals as fetchOctoparse } from "./sources/octoparse.mjs";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Run a full discovery cycle: pull from all sources, filter, dedupe, insert
async function runDiscoveryCycle() {
  console.log("[openclaw] Discovery cycle starting...");
  const started = Date.now();

  // Gather credentials from DB (owner-level settings)
  const credResult = await pool.query(
    `SELECT key, value FROM settings WHERE user_id IN (
       SELECT id FROM users WHERE role = 'owner' LIMIT 1
     ) AND key IN (
       'aliexpress_app_key','aliexpress_app_secret',
       'tiktok_client_key','tiktok_access_token',
       'supplier_api_key',
       'ebay_client_id','ebay_client_secret',
       'octoparse_username','octoparse_password','octoparse_tasks'
     )`
  );
  const creds = Object.fromEntries(credResult.rows.map((r) => [r.key, r.value]));

  // Fetch from all sources in parallel
  const [aliexpress, amazon, tiktok, ebay, manual, octoparse] = await Promise.all([
    fetchAliexpress({ appKey: creds.aliexpress_app_key, appSecret: creds.aliexpress_app_secret }),
    fetchAmazon({ apiKey: process.env.RAINFOREST_API_KEY }),
    fetchTikTok({ accessToken: creds.tiktok_access_token, clientKey: creds.tiktok_client_key }),
    fetchEbay({
      ebayClientId: creds.ebay_client_id || process.env.EBAY_CLIENT_ID,
      ebayClientSecret: creds.ebay_client_secret || process.env.EBAY_CLIENT_SECRET,
      serpApiKey: process.env.SERPAPI_KEY,
    }),
    fetchManual({ db: pool }),
    fetchOctoparse({
      username: creds.octoparse_username,
      password: creds.octoparse_password,
      tasks: creds.octoparse_tasks,
    }),
  ]);

  const allSignals = [...aliexpress, ...amazon, ...tiktok, ...ebay, ...octoparse];
  console.log(`[openclaw] Fetched ${allSignals.length} raw signals from 5 source families`);

  let inserted = 0;
  let filtered = 0;
  let duplicates = 0;
  let updated = 0;

  // Score and filter first
  const viable = [];
  for (const signal of allSignals) {
    const score = scoreCommercialIntent(signal);
    signal.commercial_intent_score = score;
    if (!isCommerciallyViable(signal)) { filtered++; continue; }
    viable.push(signal);
  }

  // Batch dedup: one query per source instead of one per signal — O(sources) not O(signals)
  const existingKeys = new Set();
  const bySource = {};
  for (const s of viable) {
    if (s.source_product_id) {
      (bySource[s.source] ??= []).push(s.source_product_id);
    }
  }
  for (const [src, ids] of Object.entries(bySource)) {
    const rows = await pool.query(
      `SELECT source_product_id FROM signals WHERE source = $1 AND source_product_id = ANY($2)`,
      [src, ids]
    );
    for (const row of rows.rows) {
      existingKeys.add(`${src}:${row.source_product_id}`);
    }
  }

  for (const signal of viable) {
    if (signal.source_product_id && existingKeys.has(`${signal.source}:${signal.source_product_id}`)) {
      // Re-scraped product: refresh price/sales metrics if they changed,
      // so the dashboard always shows the latest scraped truth.
      try {
        const upd = await pool.query(
          `UPDATE signals
           SET raw_price    = COALESCE($3, raw_price),
               sales_volume = COALESCE($4, sales_volume),
               rating       = COALESCE($5, rating),
               review_count = COALESCE($6, review_count)
           WHERE source = $1 AND source_product_id = $2
             AND (raw_price    IS DISTINCT FROM COALESCE($3, raw_price)
               OR sales_volume IS DISTINCT FROM COALESCE($4, sales_volume)
               OR rating       IS DISTINCT FROM COALESCE($5, rating)
               OR review_count IS DISTINCT FROM COALESCE($6, review_count))`,
          [
            signal.source,
            signal.source_product_id,
            signal.raw_price ?? null,
            signal.sales_volume ?? null,
            signal.rating ?? null,
            signal.review_count ?? null,
          ]
        );
        if (upd.rowCount > 0) updated++;
        else duplicates++;
      } catch (err) {
        console.error("[openclaw] Price update failed:", err.message);
        duplicates++;
      }
      continue;
    }

    try {
      await pool.query(
        `INSERT INTO signals
           (source, source_product_id, title, description, image_url, source_url,
            raw_price, currency, category, tags, commercial_intent_score, status,
            sales_volume, rating, review_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'raw',$12,$13,$14)`,
        [
          signal.source,
          signal.source_product_id,
          signal.title,
          signal.description,
          signal.image_url,
          signal.source_url,
          signal.raw_price,
          signal.currency || "USD",
          signal.category,
          signal.tags || [],
          signal.commercial_intent_score,
          signal.sales_volume ?? null,
          signal.rating ?? null,
          signal.review_count ?? null,
        ]
      );
      inserted++;
    } catch (err) {
      if (err.code !== "23505") { // ignore unique constraint violations
        console.error("[openclaw] Insert failed:", err.message);
      }
    }
  }

  // Octoparse supplier-price rows: queue candidate matching so real supplier
  // costs flow into supplier_options (worker task: octoparse_supplier_match)
  const supplierRows = allSignals.filter((s) => s._purpose === "supplier_prices" && s.title && s.raw_price);
  if (supplierRows.length > 0) {
    await pool.query(
      `INSERT INTO tasks (type, payload) VALUES ('octoparse_supplier_match', $1)`,
      [JSON.stringify({
        items: supplierRows.map((s) => ({
          title: s.title,
          cost_price: s.raw_price,
          product_url: s.source_url,
          supplier_product_id: s.source_product_id,
          rating: s.rating,
          review_count: s.review_count,
          platform: s.source.replace("octoparse_", ""),
        })),
      })]
    );
    console.log(`[openclaw] Queued supplier matching for ${supplierRows.length} scraped supplier prices`);
  }

  const duration = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[openclaw] Cycle complete in ${duration}s — inserted: ${inserted}, updated: ${updated}, filtered (non-commercial): ${filtered}, duplicates: ${duplicates}`
  );

  // Log cycle result to audit — per-source counts power the dashboard
  // scraper-health panel (a source returning 0 usually means missing
  // credentials or a broken template).
  const sources = {
    aliexpress: aliexpress.length,
    amazon: amazon.length,
    tiktok: tiktok.length,
    ebay: ebay.length,
    octoparse: octoparse.length,
  };
  await pool.query(
    `INSERT INTO audit_log (action, entity_type, detail)
     VALUES ('discovery_cycle', 'signal', $1)`,
    [JSON.stringify({ inserted, updated, filtered, duplicates, duration_s: duration, sources })]
  );
}

// Auto-promote high-confidence signals (score >= 0.8) to candidates
async function autoPromoteHighConfidence() {
  const result = await pool.query(
    `SELECT s.*, u.id as owner_id
     FROM signals s
     CROSS JOIN (SELECT id FROM users WHERE role = 'owner' LIMIT 1) u
     WHERE s.status = 'raw'
       AND s.commercial_intent_score >= 0.8
     LIMIT 20`
  );

  for (const signal of result.rows) {
    const price = Number(signal.raw_price || 0);
    let price_band = "over_1000";
    if (price < 200) price_band = "under_200";
    else if (price < 600) price_band = "band_200_600";
    else if (price < 1000) price_band = "band_600_1000";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Re-check status under lock to prevent concurrent double-promotion
      const locked = await client.query(
        `SELECT status FROM signals WHERE id = $1 FOR UPDATE`,
        [signal.id]
      );
      if (!locked.rows[0] || locked.rows[0].status !== "raw") {
        await client.query("ROLLBACK");
        continue;
      }
      await client.query(
        `INSERT INTO candidates
           (signal_id, user_id, title, description, image_url, category, price_band, viability_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          signal.id,
          signal.owner_id,
          signal.title,
          signal.description,
          signal.image_url,
          signal.category,
          price_band,
          signal.commercial_intent_score,
        ]
      );
      await client.query(
        `UPDATE signals SET status = 'promoted', reviewed_at = NOW() WHERE id = $1`,
        [signal.id]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[openclaw] Auto-promote failed for signal ${signal.id}:`, err.message);
    } finally {
      client.release();
    }
  }

  if (result.rows.length > 0) {
    console.log(`[openclaw] Auto-promoted ${result.rows.length} high-confidence signals`);
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────
// Runs at 08:00 and 20:00 daily. On startup, runs immediately once,
// then schedules the next 8 AM or 8 PM run.

function msUntilNextRun() {
  const now = new Date();
  const h = now.getHours();
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(0);

  if (h < 8) {
    next.setHours(8);
  } else if (h < 20) {
    next.setHours(20);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(8);
  }

  return next.getTime() - now.getTime();
}

function scheduleNext() {
  const delayMs = msUntilNextRun();
  const nextRun = new Date(Date.now() + delayMs);
  console.log(
    `[openclaw] Next discovery run: ${nextRun.toLocaleTimeString()} on ${nextRun.toLocaleDateString()} (in ${Math.round(delayMs / 60000)} min)`
  );
  setTimeout(async () => {
    try {
      await runDiscoveryCycle();
      await autoPromoteHighConfidence();
    } catch (err) {
      console.error("[openclaw] Scheduled cycle failed:", err.message);
    }
    scheduleNext();
  }, delayMs);
}

async function main() {
  console.log("[openclaw] OpenClaw discovery agent starting — scheduled at 08:00 and 20:00 daily");

  try {
    await runDiscoveryCycle();
    await autoPromoteHighConfidence();
  } catch (err) {
    console.error("[openclaw] Startup cycle failed:", err.message);
  }

  scheduleNext();
}

main();
