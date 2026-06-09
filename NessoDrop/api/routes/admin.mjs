import { Router } from "express";
import { query } from "../db.mjs";
import { requireAuth, requireOwner } from "../middleware/auth.mjs";

const router = Router();

// Owner-only routes for the owner console (localhost:3010)

// GET /api/admin/overview — platform-wide health snapshot
router.get("/overview", requireAuth, requireOwner, async (req, res) => {
  const [users, signals, candidates, campaigns, orders, billing, tasks] = await Promise.all([
    query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE role='customer') as customers FROM users`),
    query(`SELECT status, COUNT(*) as count FROM signals GROUP BY status`),
    query(`SELECT status, COUNT(*) as count FROM candidates GROUP BY status`),
    query(`SELECT status, COUNT(*) as count FROM campaigns GROUP BY status`),
    query(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`),
    query(`SELECT COALESCE(SUM(net_profit),0) as total_net, COALESCE(SUM(sale_total),0) as total_revenue FROM billing_records`),
    query(`SELECT status, COUNT(*) as count FROM tasks WHERE queued_at > NOW() - INTERVAL '24 hours' GROUP BY status`),
  ]);

  return res.json({
    users: users.rows[0],
    signals: Object.fromEntries(signals.rows.map((r) => [r.status, Number(r.count)])),
    candidates: Object.fromEntries(candidates.rows.map((r) => [r.status, Number(r.count)])),
    campaigns: Object.fromEntries(campaigns.rows.map((r) => [r.status, Number(r.count)])),
    orders: Object.fromEntries(orders.rows.map((r) => [r.status, Number(r.count)])),
    billing: billing.rows[0],
    tasks_24h: Object.fromEntries(tasks.rows.map((r) => [r.status, Number(r.count)])),
  });
});

// GET /api/admin/users — all users
router.get("/users", requireAuth, requireOwner, async (req, res) => {
  const result = await query(
    `SELECT id, email, name, role, store_url, budget_limit, created_at FROM users ORDER BY created_at DESC`
  );
  return res.json({ users: result.rows });
});

// GET /api/admin/audit — filtered audit log
router.get("/audit", requireAuth, requireOwner, async (req, res) => {
  const { user_id, action, entity_type, page = 1, limit = 100 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `
    SELECT al.*, u.email
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE 1=1
  `;
  const params = [];

  if (user_id) { params.push(user_id); sql += ` AND al.user_id = $${params.length}`; }
  if (action) { params.push(`%${action}%`); sql += ` AND al.action ILIKE $${params.length}`; }
  if (entity_type) { params.push(entity_type); sql += ` AND al.entity_type = $${params.length}`; }

  sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ entries: result.rows });
});

// GET /api/admin/tasks — background task queue status
router.get("/tasks", requireAuth, requireOwner, async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let sql = `SELECT * FROM tasks WHERE 1=1`;
  const params = [];
  if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  sql += ` ORDER BY queued_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ tasks: result.rows });
});

// GET /api/admin/health — service health check
router.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch {}

  return res.json({
    ok: dbOk,
    service: "platform-api",
    version: "1.0.0",
    db_connected: dbOk,
    timestamp: new Date().toISOString(),
  });
});

export default router;
