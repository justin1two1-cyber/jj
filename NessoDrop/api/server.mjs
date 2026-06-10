import "dotenv/config";
import "./middleware/asyncErrors.mjs"; // patch Express 4 async error handling — must be first
import express from "express";
import rateLimit from "express-rate-limit";
import authRoutes from "./routes/auth.mjs";
import signalsRoutes from "./routes/signals.mjs";
import candidatesRoutes from "./routes/candidates.mjs";
import suppliersRoutes from "./routes/suppliers.mjs";
import campaignsRoutes from "./routes/campaigns.mjs";
import ordersRoutes from "./routes/orders.mjs";
import billingRoutes from "./routes/billing.mjs";
import integrationsRoutes from "./routes/integrations.mjs";
import adminRoutes from "./routes/admin.mjs";

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Raw body needed for Stripe webhook signature verification
app.use("/api/orders/webhook", express.raw({ type: "application/json" }), (req, _res, next) => {
  req.rawBody = req.body;
  next();
});

app.use(express.json({ limit: "4mb" }));

// CORS — restrict to known origins; * is too broad for a credentialed API
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3003,http://localhost:3010")
    .split(",")
    .map((o) => o.trim())
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  next();
});
app.options("*", (_req, res) => res.sendStatus(204));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — try again later" },
});
const campaignLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Campaign generation rate limit exceeded" },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/campaigns/generate", campaignLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/signals", signalsRoutes);
app.use("/api/candidates", candidatesRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/admin", adminRoutes);

// Global health endpoint (no auth)
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nessodrop-api", ts: new Date().toISOString() });
});

// Global error handler — never expose raw error messages in production
app.use((err, _req, res, _next) => {
  const isProd = process.env.NODE_ENV === "production";
  console.error("Unhandled error:", err.stack || err.message);
  res.status(err.status || 500).json({
    error: isProd ? "Internal server error" : (err.message || "Internal server error"),
  });
});

app.listen(PORT, () => {
  console.log(`NessoDrop API running on http://localhost:${PORT}`);
});
