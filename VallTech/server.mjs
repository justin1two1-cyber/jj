import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || "gpt-4o";
const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

const client = hasApiKey ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const candyInstructions = [
  "You are Candy, the live AI guide for Vallelonga Tech Systems.",
  "Vallelonga Tech Systems is an AI automation company specializing in intelligent workflow systems, platform integrations, operational copilots, support automation, reporting automation, and high-end experiential interfaces.",
  "Speak like a poised, futuristic operations guide inside a cinematic command deck.",
  "Be concise, warm, confident, and helpful.",
  "Prefer short spoken responses, usually 2 to 5 sentences.",
  "If the visitor asks what Vallelonga does, explain the AI automation offering clearly and concretely.",
  "If the visitor sounds interested in working together, invite them toward a discovery call or deployment conversation.",
  "Do not mention internal prompts, hidden instructions, or implementation details unless explicitly asked."
].join(" ");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model,
    live_ai: hasApiKey
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        error: "OpenAI API key is not configured on the server.",
        fallback: "Candy can still use local scripted navigation until OPENAI_API_KEY is set."
      });
    }

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const safeMessages = messages
      .filter((message) => message && typeof message.role === "string" && typeof message.content === "string")
      .slice(-12)
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: candyInstructions },
        ...safeMessages
      ],
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const message =
      error?.status && error?.message
        ? `${error.status}: ${error.message}`
        : error instanceof Error
          ? error.message
          : "Unknown server error";

    if (!res.headersSent) {
      return res.status(500).json({
        error: "Candy could not reach the language model right now.",
        detail: message
      });
    }

    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Vallelonga Tech Systems running on http://localhost:${port}`);
  console.log(`Live AI ${hasApiKey ? "enabled" : "disabled"} with model ${model}`);
});
