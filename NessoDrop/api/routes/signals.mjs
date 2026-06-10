import { Router } from "express";
import { query, getClient } from "../db.mjs";
import { requireAuth, requireOwner } from "../middleware/auth.mjs";
import { priceBandFromRaw } from "../lib/pricing.mjs";

const router = Router();

// GET /api/signals — paginated, filterable by status/source
router.get("/", requireAuth, async (req, res) => {
  const { status = "raw", source, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `SELECT * FROM signals WHERE 1=1`;
  const params = [];

  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  if (source) {
    params.push(source);
    sql += ` AND source = $${params.length}`;
  }

  sql += ` ORDER BY ingested_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ signals: result.rows, page: Number(page), limit: Number(limit) });
});

// GET /api/signals/summary — counts by status (for dashboard lanes)
router.get("/summary", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT status, COUNT(*) as count FROM signals GROUP BY status`
  );
  const summary = Object.fromEntries(result.rows.map((r) => [r.status, Number(r.count)]));
  return res.json(summary);
});

// POST /api/signals/:id/promote — promote raw signal to candidate
router.post("/:id/promote", requireAuth, async (req, res) => {
  const { id } = req.params;

  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Lock the signal row to prevent concurrent double-promotion
    const sig = await client.query(
      `SELECT * FROM signals WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!sig.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Signal not found" });
    }
    const signal = sig.rows[0];

    if (signal.status !== "raw") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: `Signal already ${signal.status}` });
    }

    if (signal.commercial_intent_score < 0.5) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Signal commercial intent score too low to promote",
        score: signal.commercial_intent_score,
      });
    }

    const price_band = priceBandFromRaw(signal.raw_price);

    const candidate = await client.query(
      `INSERT INTO candidates
         (signal_id, user_id, title, description, image_url, category, price_band, viability_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        signal.id,
        req.user.id,
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
      [id]
    );

    await client.query("COMMIT");
    return res.status(201).json({ candidate: candidate.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
});

// POST /api/signals/:id/reject — mark signal as rejected
router.post("/:id/reject", requireAuth, async (req, res) => {
  await query(`UPDATE signals SET status = 'rejected', reviewed_at = NOW() WHERE id = $1`, [req.params.id]);
  return res.json({ ok: true });
});

export default router;
