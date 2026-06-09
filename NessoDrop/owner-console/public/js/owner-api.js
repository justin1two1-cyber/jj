const API_BASE = window.API_BASE || "http://localhost:3001";
let _token = localStorage.getItem("nd_owner_token");

function getToken() { return _token; }
function setToken(t) { _token = t; localStorage.setItem("nd_owner_token", t); }
function clearToken() { _token = null; localStorage.removeItem("nd_owner_token"); }

async function apiFetch(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401) { clearToken(); window.location.reload(); }
  return res;
}

async function apiGet(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
  return res.json();
}

async function apiPatch(path, body) {
  const res = await apiFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
  return res.json();
}

async function apiPut(path, body) {
  const res = await apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.status); }
  return res.json();
}

function fmt(v) { return Number(v||0).toLocaleString("en-US", { style: "currency", currency: "USD" }); }
function fmtDate(d) { return d ? new Date(d).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "—"; }
function badge(s) {
  const c = { approved:"green", live:"teal", pending:"yellow", pending_approval:"orange", draft:"grey", rejected:"red", done:"green", failed:"red", running:"yellow", queued:"grey" };
  return `<span class="badge badge-${c[s]||"grey"}">${s.replace(/_/g," ")}</span>`;
}

window.OC = { getToken, setToken, clearToken, apiGet, apiPost, apiPatch, apiPut, fmt, fmtDate, badge };
