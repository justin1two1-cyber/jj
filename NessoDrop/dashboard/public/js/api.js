// Central API client — all requests go through here
const API_BASE = window.API_BASE || "http://localhost:3001";

let _token = localStorage.getItem("nd_token");

function getToken() { return _token; }
function setToken(t) { _token = t; localStorage.setItem("nd_token", t); }
function clearToken() { _token = null; localStorage.removeItem("nd_token"); }

async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (_token) headers["Authorization"] = `Bearer ${_token}`;

  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }
  return res;
}

async function apiGet(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `POST ${path} → ${res.status}`);
  }
  return res.json();
}

async function apiPatch(path, body) {
  const res = await apiFetch(path, { method: "PATCH", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `PATCH ${path} → ${res.status}`);
  }
  return res.json();
}

async function apiPut(path, body) {
  const res = await apiFetch(path, { method: "PUT", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `PUT ${path} → ${res.status}`);
  }
  return res.json();
}

window.ND = { getToken, setToken, clearToken, apiGet, apiPost, apiPatch, apiPut, API_BASE };
