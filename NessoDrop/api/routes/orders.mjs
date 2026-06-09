import { Router } from "express";
import Stripe from "stripe";
import { query, getClient } from "../db.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { logAudit } from "../middleware/audit.mjs";

const router = Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-11-20.acacia" });
}

// POST /api/orders — create order + Stripe PaymentIntent
router.post("/", requireAuth, async (req, res) => {
  const { items, customer_email, customer_name, shipping_address } = req.body;
  if (!items?.length || !customer_email) {
    return res.status(400).json({ error: "items and customer_email required" });
  }

  // Fetch candidate + chosen supplier for each item
  const enriched = [];
  for (const item of items) {
    const r = await query(
      `SELECT c.*, so.cost_price, so.shipping_cost, so.landed_cost, so.id as supplier_option_id
       FROM candidates c
       LEFT JOIN supplier_options so ON so.candidate_id = c.id AND so.is_chosen = true
       WHERE c.id = $1`,
      [item.candidate_id]
    );
    if (!r.rows[0]) return res.status(400).json({ error: `Candidate ${item.candidate_id} not found` });
    const product = r.rows[0];
    if (!product.supplier_option_id) {
      return res.status(400).json({ error: `No supplier chosen for product: ${product.title}` });
    }
    enriched.push({ ...item, product });
  }

  const totalCents = Math.round(
    enriched.reduce((sum, i) => sum + Number(i.product.target_sale_price) * i.qty, 0) * 100
  );

  const stripe = getStripe();
  let paymentIntentId = null;

  if (stripe) {
    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      metadata: { user_id: req.user.id, customer_email },
    });
    paymentIntentId = intent.id;
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, customer_email, customer_name, shipping_address, stripe_payment_intent)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.user.id, customer_email, customer_name, JSON.stringify(shipping_address), paymentIntentId]
    );
    const orderId = orderRes.rows[0].id;

    for (const item of enriched) {
      await client.query(
        `INSERT INTO order_items
           (order_id, candidate_id, supplier_option_id, title, qty, unit_sale_price, unit_cost_price, unit_shipping)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          orderId,
          item.candidate_id,
          item.product.supplier_option_id,
          item.product.title,
          item.qty,
          item.product.target_sale_price,
          item.product.cost_price,
          item.product.shipping_cost,
        ]
      );
    }

    await client.query("COMMIT");
    await logAudit(req.user.id, "create_order", "order", orderId, { items: enriched.length }, req.ip);

    return res.status(201).json({
      order_id: orderId,
      payment_intent_client_secret: stripe ? (await getStripe().paymentIntents.retrieve(paymentIntentId)).client_secret : null,
      total_cents: totalCents,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/orders/webhook — Stripe webhook: payment confirmed → dispatch to supplier
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(200).json({ ok: true });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    await query(
      `UPDATE orders SET status = 'paid', updated_at = NOW()
       WHERE stripe_payment_intent = $1`,
      [pi.id]
    );

    // Queue supplier dispatch
    const orderRes = await query(`SELECT id FROM orders WHERE stripe_payment_intent = $1`, [pi.id]);
    if (orderRes.rows[0]) {
      await query(
        `INSERT INTO tasks (type, payload) VALUES ('dispatch_order', $1)`,
        [JSON.stringify({ order_id: orderRes.rows[0].id })]
      );
    }
  }

  return res.json({ received: true });
});

// GET /api/orders — list orders for user/owner
router.get("/", requireAuth, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const isOwner = req.user.role === "owner";
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT o.*,
           COUNT(oi.id) as item_count,
           SUM(oi.unit_sale_price * oi.qty) as total
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    WHERE 1=1
  `;
  const params = [];

  if (!isOwner) {
    params.push(req.user.id);
    sql += ` AND o.user_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND o.status = $${params.length}`;
  }

  sql += ` GROUP BY o.id ORDER BY o.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ orders: result.rows });
});

// GET /api/orders/:id
router.get("/:id", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT o.*,
            json_agg(row_to_json(oi.*)) as items
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(result.rows[0]);
});

// PATCH /api/orders/:id/status
router.patch("/:id/status", requireAuth, async (req, res) => {
  const { status, tracking_number } = req.body;
  const result = await query(
    `UPDATE orders SET status = $1, tracking_number = COALESCE($2, tracking_number), updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, tracking_number, req.params.id]
  );
  await logAudit(req.user.id, "update_order_status", "order", req.params.id, { status }, req.ip);
  return res.json(result.rows[0]);
});

export default router;
