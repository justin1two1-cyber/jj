import { Router } from "express";
import OpenAI from "openai";
import { query } from "../db.mjs";
import { requireAuth, requireOwner } from "../middleware/auth.mjs";
import { logAudit } from "../middleware/audit.mjs";

const router = Router();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const COPY_PROMPT = (product) => `
You are a world-class direct-response copywriter creating a high-conversion dropshipping ad.

Product:
- Title: ${product.title}
- Description: ${product.description || ""}
- Price: $${product.target_sale_price || ""}
- Category: ${product.category || ""}

Write a complete ad campaign. Be specific about the product — no generic hype. Explain exactly what it does and why someone would want it. The CTA must include "Buy Now" language with a clear sense of urgency.

Return ONLY valid JSON (no markdown, no explanation) in this exact shape:
{
  "headline": "A bold 8-12 word headline that names the product benefit directly",
  "hook": "An opening 1-2 sentences that name a real problem or desire this product solves",
  "body_copy": "3-5 sentences explaining what the product does, why it is different, and who it is for. Be specific. No buzzwords.",
  "cta_text": "Action-first CTA phrase (e.g. 'Get Yours Now — Ships Free')",
  "video_script": "A 30-second talking-presenter script. Natural speech. Opens with the hook. Ends with the CTA. Mentions the store URL."
}
`.trim();

const QUALITY_CHECK_PROMPT = (copy) => `
Review this ad copy for quality. Score it 0-1.

Penalise:
- Generic phrases like "game-changing", "revolutionary", "must-have"
- Vague benefits not tied to the specific product
- No mention of what the product actually does
- Missing CTA or store reference
- Reads like a template, not a real ad

Copy to review:
${JSON.stringify(copy, null, 2)}

Return ONLY valid JSON: {"score": 0.0-1.0, "issues": ["issue1", "issue2"]}
`.trim();

// GET /api/campaigns — list by status
router.get("/", requireAuth, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const isOwner = req.user.role === "owner";

  let sql = `
    SELECT camp.*, c.title as product_title, c.image_url as product_image
    FROM campaigns camp
    JOIN candidates c ON c.id = camp.candidate_id
    WHERE 1=1
  `;
  const params = [];

  if (!isOwner) {
    params.push(req.user.id);
    sql += ` AND camp.user_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND camp.status = $${params.length}`;
  }

  sql += ` ORDER BY camp.updated_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(Number(limit), offset);

  const result = await query(sql, params);
  return res.json({ campaigns: result.rows });
});

// POST /api/campaigns/generate — generate ad copy for a candidate
router.post("/generate", requireAuth, async (req, res) => {
  const { candidate_id, store_url } = req.body;
  if (!candidate_id) return res.status(400).json({ error: "candidate_id required" });

  const candResult = await query(`SELECT * FROM candidates WHERE id = $1`, [candidate_id]);
  const product = candResult.rows[0];
  if (!product) return res.status(404).json({ error: "Candidate not found" });

  if (!openai) {
    return res.status(503).json({ error: "OPENAI_API_KEY not configured" });
  }

  // Generate copy — 25s timeout per call; 4 sequential calls = max ~100s total
  const OAI_TIMEOUT = { timeout: 25000 };
  let copy;
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: COPY_PROMPT(product) }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    }, OAI_TIMEOUT);
    copy = JSON.parse(resp.choices[0].message.content);
  } catch (err) {
    return res.status(500).json({ error: "Copy generation failed", detail: err.message });
  }

  // Quality self-check — retry once if score < 0.7
  let qualityScore = 0;
  let qualityIssues = [];
  try {
    const qResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: QUALITY_CHECK_PROMPT(copy) }],
      temperature: 0,
      response_format: { type: "json_object" },
    }, OAI_TIMEOUT);
    const qResult = JSON.parse(qResp.choices[0].message.content);
    qualityScore = qResult.score || 0;
    qualityIssues = qResult.issues || [];

    if (qualityScore < 0.7) {
      // Retry: user → assistant (original output) → user (feedback) — correct role alternation
      const retryResp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: COPY_PROMPT(product) },
          { role: "assistant", content: JSON.stringify(copy) },
          {
            role: "user",
            content: `Score: ${qualityScore.toFixed(2)}/1.0. Issues: ${qualityIssues.join("; ")}. Rewrite to fix all issues.`,
          },
        ],
        temperature: 0.6,
        response_format: { type: "json_object" },
      }, OAI_TIMEOUT);
      copy = JSON.parse(retryResp.choices[0].message.content);
      const qResp2 = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: QUALITY_CHECK_PROMPT(copy) }],
        temperature: 0,
        response_format: { type: "json_object" },
      }, OAI_TIMEOUT);
      const q2 = JSON.parse(qResp2.choices[0].message.content);
      qualityScore = q2.score || qualityScore;
      qualityIssues = q2.issues || [];
    }
  } catch (err) {
    console.error("[campaigns] Quality check failed:", err.message);
    // Non-fatal — campaign proceeds with qualityScore = 0
  }

  const ctaUrl = store_url || `https://yourstore.com/products/${candidate_id}`;

  const result = await query(
    `INSERT INTO campaigns
       (candidate_id, user_id, headline, hook, body_copy, cta_text, store_cta_url, quality_score, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'quality_check')
     RETURNING *`,
    [
      candidate_id,
      req.user.id,
      copy.headline,
      copy.hook,
      copy.body_copy,
      copy.cta_text,
      ctaUrl,
      qualityScore,
    ]
  );

  // Queue video generation as background task
  await query(
    `INSERT INTO tasks (type, payload) VALUES ('generate_video', $1)`,
    [JSON.stringify({ campaign_id: result.rows[0].id, script: copy.video_script, product_image: product.image_url })]
  );

  const status = qualityScore >= 0.7 ? "pending_approval" : "quality_check";
  await query(`UPDATE campaigns SET status = $1 WHERE id = $2`, [status, result.rows[0].id]);

  return res.status(201).json({
    campaign: { ...result.rows[0], status, quality_score: qualityScore },
    quality_issues: qualityIssues,
    video_generation: "queued",
  });
});

// PATCH /api/campaigns/:id/approve — owner approves campaign
router.patch("/:id/approve", requireAuth, requireOwner, async (req, res) => {
  const result = await query(
    `UPDATE campaigns SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Not found" });
  await logAudit(req.user.id, "approve_campaign", "campaign", req.params.id, null, req.ip);
  return res.json(result.rows[0]);
});

// PATCH /api/campaigns/:id/reject
router.patch("/:id/reject", requireAuth, requireOwner, async (req, res) => {
  const { reason } = req.body;
  const result = await query(
    `UPDATE campaigns SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id, reason]
  );
  await logAudit(req.user.id, "reject_campaign", "campaign", req.params.id, { reason }, req.ip);
  return res.json(result.rows[0]);
});

export default router;
