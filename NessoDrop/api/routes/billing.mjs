import { Router } from "express";
import { query } from "../db.mjs";
import { requireAuth, requireOwner } from "../middleware/auth.mjs";
import { calcStripeFeeDollars } from "../lib/pricing.mjs";

const router = Router();

// POST /api/billing/record — create a complete billing record for an order
// Called by the order dispatch worker after supplier cost is confirmed
router.post("/record", requireAuth, async (req, res) => {
  const { order_id, supplier_cost, shipping_cost, ad_spend = 0, platform_fee = 0 } = req.body;
  if (!order_id || supplier_cost == null || shipping_cost == null) {
    return res.status(400).json({ error: "order_id, supplier_cost, shipping_cost required" });
  }

  // Get order total
  const orderRes = await query(
    `SELECT o.user_id,
            COALESCE(SUM(oi.unit_sale_price * oi.qty), 0) as sale_total
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1
     GROUP BY o.id, o.user_id`,
    [order_id]
  );
  if (!orderRes.rows[0]) return res.status(404).json({ error: "Order not found" });

  const { sale_total, user_id } = orderRes.rows[0];
  const stripe_fee = calcStripeFeeDollars(sale_total);

  const result = await query(
    `INSERT INTO billing_records
       (order_id, user_id, sale_total, supplier_cost, shipping_cost, stripe_fee, ad_spend, platform_fee)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [order_id, user_id, sale_total, supplier_cost, shipping_cost, stripe_fee, ad_spend, platform_fee]
  );

  return res.status(201).json(result.rows[0]);
});

// GET /api/billing/financials — summary for dashboard (replaces localhost:3003/financials)
router.get("/financials", requireAuth, async (req, res) => {
  const { period, user_id: queryUserId } = req.query;
  const isOwner = req.user.role === "owner";
  const targetUserId = isOwner && queryUserId ? queryUserId : req.user.id;

  let periodFilter = "";
  const params = [];

  if (!isOwner) {
    params.push(targetUserId);
    periodFilter = ` AND user_id = $${params.length}`;
  }

  if (period) {
    params.push(`${period}%`);
    periodFilter += ` AND recorded_at::text LIKE $${params.length}`;
  }

  const summaryRes = await query(
    `SELECT
       COUNT(*) as order_count,
       COALESCE(SUM(sale_total), 0)    as total_revenue,
       COALESCE(SUM(supplier_cost), 0) as total_supplier_cost,
       COALESCE(SUM(shipping_cost), 0) as total_shipping,
       COALESCE(SUM(stripe_fee), 0)    as total_stripe_fees,
       COALESCE(SUM(ad_spend), 0)      as total_ad_spend,
       COALESCE(SUM(platform_fee), 0)  as total_platform_fees,
       COALESCE(SUM(net_profit), 0)    as total_net_profit,
       COUNT(*) FILTER (WHERE is_complete = false) as incomplete_records
     FROM billing_records
     WHERE 1=1 ${periodFilter}`,
    params
  );

  // Monthly breakdown (last 6 months)
  const breakdownParams = isOwner ? [] : [targetUserId];
  const breakdownRes = await query(
    `SELECT
       TO_CHAR(recorded_at, 'YYYY-MM') as month,
       COALESCE(SUM(sale_total), 0)  as revenue,
       COALESCE(SUM(net_profit), 0)  as net_profit,
       COUNT(*) as orders
     FROM billing_records
     WHERE recorded_at >= NOW() - INTERVAL '6 months'
       ${isOwner ? "" : "AND user_id = $1"}
     GROUP BY month
     ORDER BY month ASC`,
    breakdownParams
  );

  return res.json({
    summary: summaryRes.rows[0],
    monthly: breakdownRes.rows,
    note: summaryRes.rows[0].incomplete_records > 0
      ? `${summaryRes.rows[0].incomplete_records} records missing cost data — net profit may be understated`
      : null,
  });
});

// GET /api/billing/records — paginated billing records
router.get("/records", requireAuth, async (req, res) => {
  const { page = 1, limit = 50, complete_only } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const isOwner = req.user.role === "owner";

  let sql = `
    SELECT br.*, o.customer_email, o.status as order_status
    FROM billing_records br
    JOIN orders o ON o.id = br.order_id
    WHERE 1=1
  `;
  const params = [];

  if (!isOwner) {
    params.push(req.user.id);
    sql += ` AND br.user_id = $${params.length}`;
  }
  if (complete_only === "true") {
    sql += ` AND br.is_complete = true`;
  }

  sql += ` ORDER BY br.recorded_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ records: result.rows });
});

// GET /api/billing/budgets — ad budget vs actual spend
router.get("/budgets", requireAuth, async (req, res) => {
  const period = req.query.period || new Date().toISOString().slice(0, 7);
  const result = await query(
    `SELECT * FROM budgets WHERE user_id = $1 AND period = $2`,
    [req.user.id, period]
  );
  return res.json(result.rows[0] || { period, ad_budget: 0, ad_spent: 0 });
});

export default router;
