import { Router } from "express";
import { query } from "../db.mjs";
import { requireAuth, requireOwner } from "../middleware/auth.mjs";
import { logAudit } from "../middleware/audit.mjs";

const router = Router();

// GET /api/candidates — with lane, price_band, intent_category filters
router.get("/", requireAuth, async (req, res) => {
  const { status, price_band, intent_category, page = 1, limit = 30 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const isOwner = req.user.role === "owner";

  let sql = `
    SELECT c.*,
           u.email as owner_email,
           so.id as chosen_supplier_id,
           so.platform as chosen_supplier_platform,
           so.cost_price, so.shipping_cost, so.landed_cost
    FROM candidates c
    JOIN users u ON u.id = c.user_id
    LEFT JOIN supplier_options so ON so.candidate_id = c.id AND so.is_chosen = true
    WHERE 1=1
  `;
  const params = [];

  if (!isOwner) {
    params.push(req.user.id);
    sql += ` AND c.user_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND c.status = $${params.length}`;
  }
  if (price_band) {
    params.push(price_band);
    sql += ` AND c.price_band = $${params.length}`;
  }
  if (intent_category) {
    params.push(intent_category);
    sql += ` AND c.intent_category = $${params.length}`;
  }

  sql += ` ORDER BY c.viability_score DESC, c.created_at DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ candidates: result.rows, page: Number(page), limit: Number(limit) });
});

// GET /api/candidates/top — only viability_score >= 0.65 and status = approved/live
router.get("/top", requireAuth, async (req, res) => {
  const { price_band, intent_category } = req.query;
  const params = [0.65];
  let sql = `
    SELECT c.*, so.landed_cost, so.platform as supplier_platform
    FROM candidates c
    LEFT JOIN supplier_options so ON so.candidate_id = c.id AND so.is_chosen = true
    WHERE c.viability_score >= $1
      AND c.status IN ('approved', 'live')
  `;

  if (price_band) {
    params.push(price_band);
    sql += ` AND c.price_band = $${params.length}`;
  }
  if (intent_category) {
    params.push(intent_category);
    sql += ` AND c.intent_category = $${params.length}`;
  }

  sql += ` ORDER BY c.viability_score DESC LIMIT 50`;

  const result = await query(sql, params);
  return res.json({ candidates: result.rows });
});

// GET /api/candidates/:id
router.get("/:id", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT c.*,
            array_agg(row_to_json(so.*)) FILTER (WHERE so.id IS NOT NULL) as supplier_options
     FROM candidates c
     LEFT JOIN supplier_options so ON so.candidate_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
  return res.json(result.rows[0]);
});

// PATCH /api/candidates/:id/approve — owner approves
router.patch("/:id/approve", requireAuth, requireOwner, async (req, res) => {
  const result = await query(
    `UPDATE candidates SET status = 'approved', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
  await logAudit(req.user.id, "approve_candidate", "candidate", req.params.id, null, req.ip);
  return res.json(result.rows[0]);
});

// PATCH /api/candidates/:id/reject — owner rejects
router.patch("/:id/reject", requireAuth, requireOwner, async (req, res) => {
  const { reason } = req.body;
  const result = await query(
    `UPDATE candidates SET status = 'rejected', updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  await logAudit(req.user.id, "reject_candidate", "candidate", req.params.id, { reason }, req.ip);
  return res.json(result.rows[0]);
});

// PATCH /api/candidates/:id/choose-supplier
router.patch("/:id/choose-supplier", requireAuth, async (req, res) => {
  const { supplier_option_id } = req.body;
  if (!supplier_option_id) return res.status(400).json({ error: "supplier_option_id required" });

  const client = await (await import("../db.mjs")).getClient();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE supplier_options SET is_chosen = false WHERE candidate_id = $1`,
      [req.params.id]
    );
    await client.query(
      `UPDATE supplier_options SET is_chosen = true WHERE id = $1 AND candidate_id = $2`,
      [supplier_option_id, req.params.id]
    );
    await client.query(
      `UPDATE candidates SET chosen_supplier_id = $1 WHERE id = $2`,
      [supplier_option_id, req.params.id]
    );
    await client.query("COMMIT");
    await logAudit(req.user.id, "choose_supplier", "candidate", req.params.id, { supplier_option_id }, req.ip);
    return res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

export default router;
