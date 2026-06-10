// Octoparse cloud-scraper source.
// Templates (AliExpress / eBay / Etsy / TikTok / Amazon) run on Octoparse's
// cloud on their own schedule; we pull finished rows via their OpenAPI:
//   POST /token                          → 24h access token (Standard plan+)
//   POST /allData/GetDataOfTaskByOffset  → page through task data
//   POST /waitOrNotExportedData/...      → non-exported rows + mark-exported
// Docs: https://openapi.octoparse.com/en-US/
//
// Config lives in owner settings:
//   octoparse_username, octoparse_password
//   octoparse_tasks — JSON: [{ "task_id": "...", "platform": "aliexpress",
//                              "purpose": "signals" | "supplier_prices" }]
// Rows for "supplier_prices" tasks are ALSO returned as signals; the agent
// queues them separately for candidate↔supplier matching.

import { mapRows, OCTOPARSE_PLATFORMS } from "./octoparse-mappers.mjs";

export const SOURCE_ID = "octoparse";

const BASE = "https://openapi.octoparse.com";
const PAGE_SIZE = 1000; // API max rows per request

let _token = null;
let _tokenExpiry = 0;

async function getToken(username, password) {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const resp = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, grant_type: "password" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Octoparse auth failed: HTTP ${resp.status}`);
  const data = await resp.json();
  const token = data?.data?.access_token || data?.access_token;
  if (!token) throw new Error(`Octoparse auth response missing token (requestId: ${data?.requestId})`);

  _token = token;
  // expires_in is seconds (86400); refresh 5 minutes early
  const expiresIn = Number(data?.data?.expires_in || data?.expires_in || 86400);
  _tokenExpiry = Date.now() + (expiresIn - 300) * 1000;
  return _token;
}

async function api(path, body, token) {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (resp.status === 401) {
    _token = null; // force re-auth on next call
    throw new Error("Octoparse token rejected (401)");
  }
  if (!resp.ok) throw new Error(`Octoparse API ${path}: HTTP ${resp.status}`);
  return resp.json();
}

// Fetch all not-yet-exported rows for one task, marking each batch exported
// only AFTER the caller has had a chance to persist them. We return rows and
// a confirm() callback per batch — but to keep the source contract simple we
// instead mark-exported eagerly per batch and rely on the agent's dedup by
// source_product_id: a crash between mark and insert loses at most one batch,
// re-running the Octoparse cloud task re-produces the data.
async function fetchTaskRows(token, taskId) {
  const rows = [];

  for (let i = 0; i < 50; i++) { // hard cap: 50k rows per task per cycle
    const data = await api("/waitOrNotExportedData/getTop", { taskId, size: PAGE_SIZE }, token);
    const batch = data?.data?.dataList || data?.dataList || [];
    if (!batch.length) break;

    rows.push(...batch);

    await api("/waitOrNotExportedData/markExported", { taskId }, token);
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

function parseTaskConfig(tasksJson) {
  if (!tasksJson) return [];
  let tasks;
  try {
    tasks = typeof tasksJson === "string" ? JSON.parse(tasksJson) : tasksJson;
  } catch {
    console.error("[openclaw:octoparse] octoparse_tasks is not valid JSON — skipping");
    return [];
  }
  if (!Array.isArray(tasks)) return [];

  return tasks.filter((t) => {
    if (!t.task_id || !OCTOPARSE_PLATFORMS.includes(t.platform)) {
      console.warn(`[openclaw:octoparse] Skipping invalid task config entry: ${JSON.stringify(t)}`);
      return false;
    }
    return true;
  });
}

// Source contract: fetchSignals({ username, password, tasks }) → signal[]
// Signals from supplier_prices-purpose tasks carry purpose so the agent can
// queue supplier matching for them.
export async function fetchSignals({ username, password, tasks } = {}) {
  if (!username || !password) {
    console.log("[openclaw:octoparse] No credentials — skipping (set octoparse_username / octoparse_password in owner settings, or use manual import)");
    return [];
  }

  const taskList = parseTaskConfig(tasks);
  if (!taskList.length) {
    console.log("[openclaw:octoparse] No tasks configured — skipping (set octoparse_tasks in owner settings)");
    return [];
  }

  let token;
  try {
    token = await getToken(username, password);
  } catch (err) {
    console.error("[openclaw:octoparse] Auth failed:", err.message);
    return [];
  }

  const all = [];
  for (const task of taskList) {
    try {
      const rows = await fetchTaskRows(token, task.task_id);
      const { signals } = mapRows(task.platform, rows);
      for (const s of signals) s._purpose = task.purpose || "signals";
      all.push(...signals);
      console.log(`[openclaw:octoparse] ${task.platform} (${task.task_id}): ${rows.length} rows → ${signals.length} signals`);
    } catch (err) {
      console.error(`[openclaw:octoparse] Task ${task.task_id} (${task.platform}) failed:`, err.message);
    }
  }

  return all;
}
