import "dotenv/config";
import { query, getClient } from "./db.mjs";

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

  // Create billing record with real costs
  const stripe_fee = Math.round((Number(
    (await query(`SELECT COALESCE(SUM(unit_sale_price * qty),0) as t FROM order_items WHERE order_id=$1`, [order_id]))
    .rows[0].t) * 0.029 + 0.30) * 100) / 100;

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

// ─── Main Loop ────────────────────────────────────────────────────────────

const handlers = {
  dispatch_order: handleDispatchOrder,
  supplier_sync: handleSupplierSync,
  generate_video: handleGenerateVideo,
  price_optimizer: handlePriceOptimizer,
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

// Schedule nightly price optimizer
function scheduleNightlyJobs() {
  const now = new Date();
  const next = new Date();
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const ms = next - now;

  setTimeout(async () => {
    await query(
      `INSERT INTO tasks (type) VALUES ('price_optimizer')`
    );
    setInterval(async () => {
      await query(`INSERT INTO tasks (type) VALUES ('price_optimizer')`);
    }, 24 * 60 * 60 * 1000);
  }, ms);
}

console.log("[worker] NessoDrop task worker starting...");
scheduleNightlyJobs();

setInterval(tick, POLL_INTERVAL_MS);
tick();
