import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.mjs";
import { signToken, requireAuth } from "../middleware/auth.mjs";

const router = Router();

router.post("/register", async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({ error: "email, name, password required" });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, 'customer')
       RETURNING id, email, name, role`,
      [email.toLowerCase(), name, hash]
    );
    const user = result.rows[0];
    return res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    throw err;
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password required" });
  }
  const result = await query(
    `SELECT id, email, name, role, password_hash FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const { password_hash, ...safe } = user;
  return res.json({ token: signToken(safe), user: safe });
});

// GET /api/auth/me — return current user from token
router.get("/me", requireAuth, async (req, res) => {
  const result = await query(
    `SELECT id, email, name, role, store_url FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
  return res.json(result.rows[0]);
});

export default router;
