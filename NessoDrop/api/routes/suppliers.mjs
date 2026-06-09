import { Router } from "express";
import { query } from "../db.mjs";
import { requireAuth } from "../middleware/auth.mjs";

const router = Router();

// GET /api/suppliers/:candidateId — all supplier options for a candidate
// Supports views: ?view=best_value | cheapest | fastest
router.get("/:candidateId", requireAuth, async (req, res) => {
  const { view = "best_value" } = req.query;

  let orderBy;
  switch (view) {
    case "cheapest":
      orderBy = "landed_cost ASC";
      break;
    case "fastest":
      orderBy = "shipping_days_min ASC, landed_cost ASC";
      break;
    default:
      // best_value: balance of landed cost, rating, delivery speed
      orderBy = "(landed_cost / NULLIF(rating, 0)) ASC NULLS LAST, landed_cost ASC";
  }

  const result = await query(
    `SELECT so.*,
            ROUND(((c.target_sale_price - so.landed_cost) / NULLIF(c.target_sale_price, 0)) * 100, 1) as margin_pct
     FROM supplier_options so
     JOIN candidates c ON c.id = so.candidate_id
     WHERE so.candidate_id = $1 AND so.in_stock = true
     ORDER BY ${orderBy}`,
    [req.params.candidateId]
  );

  return res.json({ suppliers: result.rows, view });
});

// POST /api/suppliers/:candidateId/sync — trigger supplier price refresh
router.post("/:candidateId/sync", requireAuth, async (req, res) => {
  const { candidateId } = req.params;

  // Queue a task for the worker to fetch fresh prices
  await query(
    `INSERT INTO tasks (type, payload) VALUES ('supplier_sync', $1)`,
    [JSON.stringify({ candidateId })]
  );

  return res.json({ ok: true, message: "Supplier sync queued" });
});

// POST /api/suppliers/:candidateId — manually add a supplier option
router.post("/:candidateId", requireAuth, async (req, res) => {
  const {
    platform = "manual",
    supplier_name,
    product_url,
    supplier_product_id,
    cost_price,
    shipping_cost = 0,
    shipping_days_min = 7,
    shipping_days_max = 21,
    rating,
    review_count = 0,
  } = req.body;

  if (!cost_price) return res.status(400).json({ error: "cost_price required" });

  const result = await query(
    `INSERT INTO supplier_options
       (candidate_id, platform, supplier_name, product_url, supplier_product_id,
        cost_price, shipping_cost, shipping_days_min, shipping_days_max, rating, review_count)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      req.params.candidateId,
      platform,
      supplier_name,
      product_url,
      supplier_product_id,
      cost_price,
      shipping_cost,
      shipping_days_min,
      shipping_days_max,
      rating,
      review_count,
    ]
  );

  return res.status(201).json(result.rows[0]);
});

export default router;
