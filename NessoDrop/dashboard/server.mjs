import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3003);
const API_URL = process.env.API_URL || "http://localhost:3001";

app.use(express.static(path.join(__dirname, "public")));

// Health check — must be before the wildcard catch-all
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nessodrop-dashboard", api_url: API_URL });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`NessoDrop Dashboard running on http://localhost:${PORT}`);
  console.log(`API: ${API_URL}`);
});
