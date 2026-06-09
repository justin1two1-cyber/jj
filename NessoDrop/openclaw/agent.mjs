import "dotenv/config";
import pg from "pg";
import { scoreCommercialIntent, isCommerciallyViable } from "./filters/commercial-intent.mjs";
import { fetchSignals as fetchAliexpress } from "./sources/aliexpress.mjs";
import { fetchSignals as fetchAmazon } from "./sources/amazon.mjs";
import { fetchSignals as fetchTikTok } from "./sources/tiktok.mjs";
import { fetchSignals as fetchEbay } from "./sources/ebay.mjs";
import { fetchSignals as fetchManual } from "./sources/manual.mjs";

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
       'supplier_api_key'
     )`
  );
  const creds = Object.fromEntries(credResult.rows.map((r) => [r.key, r.value]));

  // Fetch from all sources in parallel
  const [aliexpress, amazon, tiktok, ebay, manual] = await Promise.all([
    fetchAliexpress({ appKey: creds.aliexpress_app_key, appSecret: creds.aliexpress_app_secret }),
    fetchAmazon({ apiKey: process.env.RAINFOREST_API_KEY }),
    fetchTikTok({ accessToken: creds.tiktok_access_token, clientKey: creds.tiktok_client_key }),
    fetchEbay({ serpApiKey: process.env.SERPAPI_KEY }),
    fetchManual({ db: pool }),
  ]);

  const allSignals = [...aliexpress, ...amazon, ...tiktok, ...ebay];
  console.log(`[openclaw] Fetched ${allSignals.length} raw signals from ${4} sources`);

  let inserted = 0;
  let filtered = 0;
  let duplicates = 0;

  for (const signal of allSignals) {
    if (signal._already_in_db) continue;

    const score = scoreCommercialIntent(signal);
    signal.commercial_intent_score = score;

    if (!isCommerciallyViable(signal)) {
      filtered++;
      continue;
    }

    // Check for duplicates by source + source_product_id
    if (signal.source_product_id) {
      const exists = await pool.query(
        `SELECT id FROM signals WHERE source = $1 AND source_product_id = $2`,
        [signal.source, signal.source_product_id]
      );
      if (exists.rows.length > 0) {
        duplicates++;
        continue;
      }
    }

    try {
      await pool.query(
        `INSERT INTO signals
           (source, source_product_id, title, description, image_url, source_url,
            raw_price, currency, category, tags, commercial_intent_score, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'raw')`,
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
          score,
        ]
      );
      inserted++;
    } catch (err) {
      if (err.code !== "23505") { // ignore unique constraint violations
        console.error("[openclaw] Insert failed:", err.message);
      }
    }
  }

  const duration = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `[openclaw] Cycle complete in ${duration}s — inserted: ${inserted}, filtered (non-commercial): ${filtered}, duplicates: ${duplicates}`
  );

  // Log cycle result to audit
  await pool.query(
    `INSERT INTO audit_log (action, entity_type, detail)
     VALUES ('discovery_cycle', 'signal', $1)`,
    [JSON.stringify({ inserted, filtered, duplicates, duration_s: duration })]
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

    try {
      await pool.query(
        `INSERT INTO candidates
           (signal_id, user_id, title, description, image_url, category, price_band, viability_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING`,
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
      await pool.query(`UPDATE signals SET status = 'promoted' WHERE id = $1`, [signal.id]);
    } catch {}
  }

  if (result.rows.length > 0) {
    console.log(`[openclaw] Auto-promoted ${result.rows.length} high-confidence signals`);
  }
}

// ─── Schedule ─────────────────────────────────────────────────────────────

const CYCLE_INTERVAL_MS = 2 * 60 * 60 * 1000; // every 2 hours

async function main() {
  console.log("[openclaw] OpenClaw discovery agent starting");

  try {
    await runDiscoveryCycle();
    await autoPromoteHighConfidence();
  } catch (err) {
    console.error("[openclaw] Startup cycle failed:", err.message);
  }

  setInterval(async () => {
    try {
      await runDiscoveryCycle();
      await autoPromoteHighConfidence();
    } catch (err) {
      console.error("[openclaw] Scheduled cycle failed:", err.message);
    }
  }, CYCLE_INTERVAL_MS);
}

main();
