import { query } from "../db.mjs";

export async function logAudit(userId, action, entityType, entityId, detail, ip) {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, detail, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, detail ? JSON.stringify(detail) : null, ip]
    );
  } catch (err) {
    console.error("Audit log write failed:", err.message);
  }
}

export function auditMiddleware(action, entityType) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode < 400 && req.user) {
        const entityId = body?.id || req.params?.id || null;
        logAudit(req.user.id, action, entityType, entityId, null, req.ip);
      }
      return originalJson(body);
    };
    next();
  };
}
