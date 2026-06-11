import "dotenv/config";
import { query, getClient } from "./db.mjs";
import { calcStripeFeeDollars } from "./lib/pricing.mjs";

const POLL_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 3;

async function claimTask() {
  const result = await query(
    `UPDATE tasks
     SET status = 'running', started_at = NOW(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM tasks
       WHERE status = 'queued' AND attempts < $1
       ORDER BY queued_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING *`,
    [MAX_ATTEMPTS]
  );
  return result.rows[0] || null;
}

async function completeTask(id) {
  await query(
    `UPDATE tasks SET status = 'done', completed_at = NOW() WHERE id = $1`,
    [id]
  );
}

async function failTask(id, error) {
  await query(
    `UPDATE tasks SET status = 'failed', error = $2 WHERE id = $1`,
    [id, String(error)]
  );
}

// ─── Handlers ─────────────────────────────────────────────────────────────

async function handleDispatchOrder(payload) {
  const { order_id } = payload;
  const orderRes = await query(
    `SELECT o.*,
            json_agg(row_to_json(oi.*)) as items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1 GROUP BY o.id`,
    [order_id]
  );
  const order = orderRes.rows[0];
  if (!order) throw new Error(`Order ${order_id} not found`);

  // Build per-item supplier dispatch (real implementation would call supplier API)
  let totalSupplierCost = 0;
  let totalShipping = 0;

  for (const item of order.items) {
    totalSupplierCost += Number(item.unit_cost_price) * item.qty;
    totalShipping += Number(item.unit_shipping) * item.qty;
    console.log(`[worker] Dispatching item ${item.title} x${item.qty} to supplier`);
    // TODO: call actual supplier API using credentials from settings
    // const supplierApiUrl = await getSetting(order.user_id, 'supplier_api_url');
  }

  await query(
    `UPDATE orders SET status = 'dispatched_to_supplier', updated_at = NOW() WHERE id = $1`,
    [order_id]
  );

  // Create billing record — Stripe fee calculated in integer cents to avoid float drift
  const saleTotalRes = await query(
    `SELECT COALESCE(SUM(unit_sale_price * qty), 0) as t FROM order_items WHERE order_id = $1`,
    [order_id]
  );
  const stripe_fee = calcStripeFeeDollars(saleTotalRes.rows[0].t);

  await query(
    `INSERT INTO billing_records
       (order_id, user_id, sale_total, supplier_cost, shipping_cost, stripe_fee)
     SELECT o.id, o.user_id,
            COALESCE(SUM(oi.unit_sale_price * oi.qty), 0),
            $2, $3, $4
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id, o.user_id
     ON CONFLICT DO NOTHING`,
    [order_id, totalSupplierCost, totalShipping, stripe_fee]
  );

  console.log(`[worker] Order ${order_id} dispatched, billing record created`);
}

async function handleSupplierSync(payload) {
  const { candidateId } = payload;
  console.log(`[worker] Syncing supplier prices for candidate ${candidateId}`);

  // Update last_synced timestamp; real implementation queries supplier APIs
  await query(
    `UPDATE supplier_options SET last_synced = NOW() WHERE candidate_id = $1`,
    [candidateId]
  );
  console.log(`[worker] Supplier sync complete for ${candidateId}`);
}

// ── Octoparse supplier matching ──
// Scraped supplier-price rows (e.g. AliExpress) are matched to existing
// candidates by normalised-title token overlap. Matches upsert a real-cost
// supplier_options row — replacing heuristic price estimates with scraped truth.

function normaliseTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2); // drop stopword-length tokens
}

function titleSimilarity(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const setB = new Set(tokensB);
  const overlap = tokensA.filter((t) => setB.has(t)).length;
  return overlap / Math.min(tokensA.length, tokensB.length);
}

const SUPPLIER_MATCH_THRESHOLD = 0.6;

async function handleOctoparseSupplierMatch(payload) {
  const { items } = payload;
  if (!items?.length) return;

  const candidatesRes = await query(
    `SELECT id, title FROM candidates WHERE status IN ('pending', 'approved', 'live')`
  );
  const candidates = candidatesRes.rows.map((c) => ({
    id: c.id,
    tokens: normaliseTitle(c.title),
  }));

  let matched = 0;
  for (const item of items) {
    if (!item.cost_price || !item.title) continue;
    const itemTokens = normaliseTitle(item.title);

    let best = null;
    let bestScore = 0;
    for (const cand of candidates) {
      const score = titleSimilarity(itemTokens, cand.tokens);
      if (score > bestScore) { bestScore = score; best = cand; }
    }
    if (!best || bestScore < SUPPLIER_MATCH_THRESHOLD) continue;

    // Upsert: update existing scraped option for this candidate+platform+product,
    // otherwise insert a new supplier option with the real scraped cost
    const existing = await query(
      `SELECT id FROM supplier_options
       WHERE candidate_id = $1 AND platform = $2
         AND (supplier_product_id = $3 OR product_url = $4)
       LIMIT 1`,
      [best.id, item.platform, item.supplier_product_id, item.product_url]
    );

    if (existing.rows[0]) {
      await query(
        `UPDATE supplier_options
         SET cost_price = $2, rating = COALESCE($3, rating),
             review_count = COALESCE($4, review_count), last_synced = NOW()
         WHERE id = $1`,
        [existing.rows[0].id, item.cost_price, item.rating, item.review_count]
      );
    } else {
      await query(
        `INSERT INTO supplier_options
           (candidate_id, platform, supplier_name, product_url, supplier_product_id,
            cost_price, shipping_cost, rating, review_count, last_synced)
         VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, NOW())`,
        [
          best.id,
          item.platform,
          `${item.platform} (scraped)`,
          item.product_url,
          item.supplier_product_id,
          item.cost_price,
          item.rating,
          item.review_count,
        ]
      );
    }
    matched++;
  }

  console.log(`[worker] Octoparse supplier match: ${matched}/${items.length} scraped prices matched to candidates`);
}

async function handleGenerateVideo(payload) {
  const { campaign_id, script, product_image } = payload;

  if (!process.env.HEYGEN_API_KEY) {
    console.log(`[worker] HEYGEN_API_KEY not set — skipping video generation for campaign ${campaign_id}`);
    return;
  }

  console.log(`[worker] Generating video for campaign ${campaign_id}`);
  try {
    // HeyGen API: create a talking-presenter video
    const resp = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.HEYGEN_API_KEY,
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: "default_talking_presenter",
              avatar_style: "normal",
            },
            voice: {
              type: "text",
              input_text: script,
              voice_id: "en-US-AriaNeural",
            },
            background: product_image
              ? { type: "image", url: product_image }
              : { type: "color", value: "#1a1a2e" },
          },
        ],
        dimension: { width: 1280, height: 720 },
        aspect_ratio: "16:9",
      }),
    });

    const data = await resp.json();
    if (data.data?.video_id) {
      await query(
        `UPDATE campaigns SET video_url = $1 WHERE id = $2`,
        [`heygen:${data.data.video_id}`, campaign_id]
      );
      console.log(`[worker] Video generation started: ${data.data.video_id}`);
    } else {
      throw new Error(JSON.stringify(data));
    }
  } catch (err) {
    console.error(`[worker] Video generation failed for ${campaign_id}:`, err.message);
    // Non-fatal — campaign continues without video
  }
}

async function handlePriceOptimizer(_payload) {
  // Nightly job: for each live candidate, check if target_sale_price needs adjustment
  console.log("[worker] Running price optimizer");
  const candidates = await query(
    `SELECT c.id, c.title, c.target_sale_price, so.landed_cost
     FROM candidates c
     JOIN supplier_options so ON so.candidate_id = c.id AND so.is_chosen = true
     WHERE c.status = 'live' AND c.target_sale_price > 0`
  );

  for (const c of candidates.rows) {
    const margin = (Number(c.target_sale_price) - Number(c.landed_cost)) / Number(c.target_sale_price);
    if (margin < 0.3) {
      // Suggest a price that gives 40% margin
      const suggested = Math.round((Number(c.landed_cost) / 0.6) * 100) / 100;
      console.log(`[worker] Low margin on "${c.title}": ${(margin * 100).toFixed(1)}% — suggested price: $${suggested}`);
      await query(
        `INSERT INTO audit_log (action, entity_type, entity_id, detail)
         VALUES ('price_optimizer_suggestion', 'candidate', $1, $2)`,
        [c.id, JSON.stringify({ current: c.target_sale_price, suggested, margin_pct: (margin * 100).toFixed(1) })]
      );
    }
  }
}

async function handleBillingIntegrity(_payload) {
  // Nightly check: every paid/dispatched order must have a complete billing record.
  console.log("[worker] Running billing integrity check");

  // Orders that have progressed past payment but have NO billing record at all
  const missing = await query(
    `SELECT o.id, o.status, o.created_at
     FROM orders o
     LEFT JOIN billing_records br ON br.order_id = o.id
     WHERE o.status IN ('paid', 'dispatched_to_supplier', 'shipped', 'delivered')
       AND br.id IS NULL`
  );

  // Billing records older than 24h still missing cost components
  const incomplete = await query(
    `SELECT id, order_id FROM billing_records
     WHERE is_complete = false AND recorded_at < NOW() - INTERVAL '24 hours'`
  );

  for (const o of missing.rows) {
    await query(
      `INSERT INTO audit_log (action, entity_type, entity_id, detail)
       VALUES ('billing_integrity_missing_record', 'order', $1, $2)`,
      [o.id, JSON.stringify({ order_status: o.status, order_created: o.created_at })]
    );
  }
  for (const r of incomplete.rows) {
    await query(
      `INSERT INTO audit_log (action, entity_type, entity_id, detail)
       VALUES ('billing_integrity_incomplete', 'billing_record', $1, $2)`,
      [r.id, JSON.stringify({ order_id: r.order_id })]
    );
  }

  console.log(
    `[worker] Billing integrity: ${missing.rows.length} orders missing records, ${incomplete.rows.length} stale incomplete records`
  );
}

// ─── Main Loop ────────────────────────────────────────────────────────────

const handlers = {
  dispatch_order: handleDispatchOrder,
  supplier_sync: handleSupplierSync,
  generate_video: handleGenerateVideo,
  price_optimizer: handlePriceOptimizer,
  octoparse_supplier_match: handleOctoparseSupplierMatch,
  billing_integrity: handleBillingIntegrity,
};

async function tick() {
  const task = await claimTask();
  if (!task) return;

  console.log(`[worker] Processing task ${task.id} (${task.type})`);
  const handler = handlers[task.type];

  if (!handler) {
    await failTask(task.id, `Unknown task type: ${task.type}`);
    return;
  }

  try {
    await handler(task.payload || {});
    await completeTask(task.id);
  } catch (err) {
    console.error(`[worker] Task ${task.id} failed:`, err.message);
    await failTask(task.id, err.message);
  }
}

// DB-idempotent nightly scheduler: inserts each nightly job once per day at 3am.
// Crash-safe — checks DB so restarts don't skip or double-schedule.
const NIGHTLY_JOBS = ["price_optimizer", "billing_integrity"];

async function maybeScheduleNightlyJobs() {
  const now = new Date();
  if (now.getHours() !== 3) return;
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  for (const jobType of NIGHTLY_JOBS) {
    const existing = await query(
      `SELECT id FROM tasks WHERE type = $1 AND queued_at >= $2::timestamptz`,
      [jobType, today]
    );
    if (existing.rows.length === 0) {
      await query(`INSERT INTO tasks (type) VALUES ($1)`, [jobType]);
      console.log(`[worker] Scheduled nightly ${jobType}`);
    }
  }
}

// Recursive setTimeout prevents concurrent overlapping ticks if processing takes > poll interval
let _tickRunning = false;

async function safeTick() {
  if (!_tickRunning) {
    _tickRunning = true;
    try {
      await tick();
      await maybeScheduleNightlyJobs();
    } catch (err) {
      console.error("[worker] Tick error:", err.message);
    } finally {
      _tickRunning = false;
    }
  }
  setTimeout(safeTick, POLL_INTERVAL_MS);
}

console.log("[worker] NessoDrop task worker starting...");
safeTick();
