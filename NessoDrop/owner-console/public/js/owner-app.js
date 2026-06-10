// Owner Console Application

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const el = document.getElementById(`view-${name}`);
  if (el) el.classList.remove("hidden");
  document.querySelectorAll(".nav-links a").forEach((a) => a.classList.toggle("active", a.dataset.view === name));
  const loaders = {
    overview: loadOverview, campaigns: loadCampaignApprovals,
    candidates: loadCandidateApprovals, billing: loadBilling,
    users: loadUsers, audit: loadAudit, tasks: loadTasks,
    integrations: loadOwnerIntegrations,
  };
  if (loaders[name]) loaders[name]();
}

// ── Overview ──────────────────────────────────────────────────────────────
async function loadOverview() {
  const grid = document.getElementById("overview-grid");
  try {
    const d = await OC.apiGet("/api/admin/overview");

    const statCard = (label, value, color = "") =>
      `<div class="stat-card"><span class="stat-label">${label}</span><strong class="stat-value ${color}">${value}</strong></div>`;

    const serviceHealth = [
      { name: "Platform API",    port: "3001", check: "/health" },
      { name: "Dashboard",       port: "3003", check: null },
      { name: "Owner Console",   port: "3010", check: null },
    ];

    grid.innerHTML = `
      <h3 class="section-title">Financial Summary</h3>
      <div class="stat-grid">
        ${statCard("Total Revenue", OC.fmt(d.billing.total_revenue), "text-green")}
        ${statCard("Total Net Profit", OC.fmt(d.billing.total_net), Number(d.billing.total_net) >= 0 ? "text-green" : "text-red")}
        ${statCard("Customers", d.users.customers)}
        ${statCard("Signals (Raw)", d.signals.raw || 0)}
        ${statCard("Candidates Pending", d.candidates.pending || 0, "text-yellow")}
        ${statCard("Campaigns Pending", d.campaigns.pending_approval || 0, "text-yellow")}
      </div>

      <h3 class="section-title">Orders</h3>
      <div class="stat-grid">
        ${Object.entries(d.orders).map(([s, c]) => statCard(s, c)).join("")}
      </div>

      <h3 class="section-title">Tasks (Last 24h)</h3>
      <div class="stat-grid">
        ${Object.entries(d.tasks_24h).map(([s, c]) => statCard(s, c)).join("")}
      </div>`;
  } catch (err) {
    grid.innerHTML = `<p class="text-red">Failed to load overview: ${err.message}</p>`;
  }
}

// ── Campaign Approvals ────────────────────────────────────────────────────
async function loadCampaignApprovals() {
  const list = document.getElementById("campaigns-list");
  try {
    const data = await OC.apiGet("/api/campaigns?status=pending_approval");
    if (!data.campaigns.length) {
      list.innerHTML = '<p class="empty-state">No campaigns awaiting approval.</p>';
      return;
    }
    list.innerHTML = data.campaigns.map((c) => `
      <div class="approval-card">
        <div class="approval-header">
          <span class="product-name">${c.product_title}</span>
          ${OC.badge(c.status)}
          <span class="quality-score">QS: ${Math.round((c.quality_score||0)*100)}%</span>
        </div>
        <div class="campaign-copy">
          <p><strong>${c.headline}</strong></p>
          <p class="hook">${c.hook}</p>
          <p class="body">${c.body_copy}</p>
          <p class="cta-preview">CTA: ${c.cta_text} → <a href="${c.store_cta_url||"#"}" target="_blank">${c.store_cta_url||"(no URL)"}</a></p>
          ${c.video_url ? `<p class="badge badge-teal">Video: ${c.video_url}</p>` : `<p class="badge badge-grey">No video yet</p>`}
        </div>
        <div class="approval-actions">
          <button class="btn btn-primary" onclick="approveCampaign('${c.id}')">Approve</button>
          <button class="btn btn-danger" onclick="rejectCampaign('${c.id}')">Reject</button>
        </div>
      </div>`).join("");
  } catch (err) {
    list.innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

async function approveCampaign(id) {
  await OC.apiPatch(`/api/campaigns/${id}/approve`, {});
  loadCampaignApprovals();
}

async function rejectCampaign(id) {
  const reason = prompt("Rejection reason:");
  if (!reason) return;
  await OC.apiPatch(`/api/campaigns/${id}/reject`, { reason });
  loadCampaignApprovals();
}

// ── Candidate Approvals ───────────────────────────────────────────────────
async function loadCandidateApprovals() {
  const list = document.getElementById("candidates-list");
  try {
    const data = await OC.apiGet("/api/candidates?status=pending");
    if (!data.candidates.length) {
      list.innerHTML = '<p class="empty-state">No candidates awaiting approval.</p>';
      return;
    }
    list.innerHTML = data.candidates.map((c) => `
      <div class="approval-card">
        <div class="approval-header">
          ${c.image_url ? `<img src="${c.image_url}" class="approval-thumb">` : ""}
          <div>
            <strong>${c.title}</strong>
            <p class="text-muted">${c.category||""} · ${(c.price_band||"").replace(/_/g," ")} · Score: ${Math.round((c.viability_score||0)*100)}%</p>
          </div>
          ${OC.badge(c.status)}
        </div>
        <div class="approval-actions">
          <button class="btn btn-primary" onclick="approveCandidate('${c.id}')">Approve</button>
          <button class="btn btn-danger" onclick="rejectCandidate('${c.id}')">Reject</button>
        </div>
      </div>`).join("");
  } catch (err) {
    list.innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

async function approveCandidate(id) {
  await OC.apiPatch(`/api/candidates/${id}/approve`, {});
  loadCandidateApprovals();
}

async function rejectCandidate(id) {
  const reason = prompt("Rejection reason:");
  await OC.apiPatch(`/api/candidates/${id}/reject`, { reason });
  loadCandidateApprovals();
}

// ── Billing ───────────────────────────────────────────────────────────────
async function loadBilling() {
  const content = document.getElementById("billing-content");
  try {
    const data = await OC.apiGet("/api/billing/financials");
    const s = data.summary;
    content.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><span class="stat-label">Total Revenue</span><strong class="text-green">${OC.fmt(s.total_revenue)}</strong></div>
        <div class="stat-card"><span class="stat-label">Net Profit</span><strong class="${Number(s.total_net_profit)>=0?"text-green":"text-red"}">${OC.fmt(s.total_net_profit)}</strong></div>
        <div class="stat-card"><span class="stat-label">Orders</span><strong>${s.order_count}</strong></div>
        <div class="stat-card"><span class="stat-label">Supplier Cost</span><strong>${OC.fmt(s.total_supplier_cost)}</strong></div>
        <div class="stat-card"><span class="stat-label">Ad Spend</span><strong>${OC.fmt(s.total_ad_spend)}</strong></div>
        <div class="stat-card"><span class="stat-label">Stripe Fees</span><strong>${OC.fmt(s.total_stripe_fees)}</strong></div>
      </div>
      ${s.incomplete_records > 0 ? `<p class="warning-text">⚠ ${s.incomplete_records} billing records missing cost data</p>` : ""}
    `;
  } catch (err) {
    content.innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

// ── Users ─────────────────────────────────────────────────────────────────
async function loadUsers() {
  const wrap = document.getElementById("users-table-wrap");
  try {
    const data = await OC.apiGet("/api/admin/users");
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Store</th><th>Joined</th></tr></thead>
        <tbody>
          ${data.users.map((u) => `
            <tr>
              <td>${u.email}</td>
              <td>${u.name}</td>
              <td>${OC.badge(u.role)}</td>
              <td>${u.store_url ? `<a href="${u.store_url}" target="_blank">View</a>` : "—"}</td>
              <td>${OC.fmtDate(u.created_at)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    wrap.innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

// ── Audit Log ─────────────────────────────────────────────────────────────
async function loadAudit() {
  const wrap = document.getElementById("audit-table-wrap");
  const action = document.getElementById("filter-action").value;
  const entity = document.getElementById("filter-entity").value;

  let path = "/api/admin/audit?limit=100";
  if (action) path += `&action=${encodeURIComponent(action)}`;
  if (entity) path += `&entity_type=${entity}`;

  try {
    const data = await OC.apiGet(path);
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
        <tbody>
          ${data.entries.map((e) => `
            <tr>
              <td class="mono">${OC.fmtDate(e.created_at)}</td>
              <td>${e.email || "system"}</td>
              <td>${e.action}</td>
              <td>${e.entity_type || "—"}</td>
              <td class="detail-cell">${e.detail ? JSON.stringify(e.detail).slice(0,80) : "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    wrap.innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

// ── Tasks ─────────────────────────────────────────────────────────────────
async function loadTasks() {
  const wrap = document.getElementById("tasks-table-wrap");
  try {
    const data = await OC.apiGet("/api/admin/tasks?limit=50");
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Type</th><th>Status</th><th>Attempts</th><th>Queued</th><th>Completed</th><th>Error</th></tr></thead>
        <tbody>
          ${data.tasks.map((t) => `
            <tr>
              <td>${t.type}</td>
              <td>${OC.badge(t.status)}</td>
              <td>${t.attempts}</td>
              <td class="mono">${OC.fmtDate(t.queued_at)}</td>
              <td class="mono">${OC.fmtDate(t.completed_at)}</td>
              <td class="text-red" style="font-size:11px">${t.error||""}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    wrap.innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

// ── Owner Integrations ────────────────────────────────────────────────────
async function loadOwnerIntegrations() {
  const grid = document.getElementById("owner-integrations-grid");
  const OWNER_FIELDS = [
    // Octoparse cloud scraping (free plan: leave blank, use Import button below)
    { key: "octoparse_username", label: "Octoparse Username" },
    { key: "octoparse_password", label: "Octoparse Password", secret: true },
    { key: "octoparse_tasks", label: "Octoparse Tasks (JSON: [{task_id, platform, purpose}])" },
    // eBay official Developer API — free at developer.ebay.com
    { key: "ebay_client_id", label: "eBay Client ID (free dev account)" },
    { key: "ebay_client_secret", label: "eBay Client Secret", secret: true },
    // AliExpress Affiliate API — free at portals.aliexpress.com
    { key: "aliexpress_app_key", label: "AliExpress App Key (free affiliate)" },
    { key: "aliexpress_app_secret", label: "AliExpress App Secret", secret: true },
    { key: "owner_stripe_account_id", label: "Owner Stripe Account ID" },
    { key: "owner_stripe_secret_key", label: "Owner Stripe Secret Key", secret: true },
    { key: "owner_stripe_webhook_secret", label: "Owner Stripe Webhook Secret", secret: true },
    { key: "smtp_host", label: "SMTP Host" },
    { key: "smtp_port", label: "SMTP Port" },
    { key: "smtp_user", label: "SMTP Username" },
    { key: "smtp_password", label: "SMTP Password", secret: true },
    { key: "cloudflare_zone_id", label: "Cloudflare Zone ID" },
    { key: "cloudflare_api_token", label: "Cloudflare API Token", secret: true },
  ];

  try {
    const data = await OC.apiGet("/api/integrations");
    const rows = OWNER_FIELDS.map((f) => {
      const status = data[f.key];
      return `
        <div class="integration-row">
          <div class="integration-info">
            <span class="integration-label">${f.label}</span>
            <span class="integration-preview">${status?.configured ? status.preview : "Not set"}</span>
          </div>
          <div class="integration-actions">
            <span class="dot ${status?.configured ? "dot-green" : "dot-grey"}"></span>
            <button class="btn btn-ghost btn-sm" onclick="editOwnerIntegration('${f.key}', '${f.label}', ${f.secret||false})">
              ${status?.configured ? "Update" : "Set"}
            </button>
          </div>
        </div>`;
    }).join("");

    // Manual Octoparse import — works on the free Octoparse plan
    const importPanel = `
      <div class="integration-row" style="display:block; padding-top:16px;">
        <div class="integration-info" style="margin-bottom:10px;">
          <span class="integration-label">Octoparse Manual Import (free plan)</span>
          <span class="integration-preview">Export from Octoparse as CSV or JSON, paste below</span>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
          <select id="octo-import-platform">
            <option value="aliexpress">AliExpress</option>
            <option value="ebay">eBay</option>
            <option value="etsy">Etsy</option>
            <option value="tiktok">TikTok</option>
            <option value="amazon">Amazon</option>
          </select>
          <select id="octo-import-purpose">
            <option value="signals">Discovery signals</option>
            <option value="supplier_prices">Supplier prices (AliExpress costs)</option>
          </select>
          <select id="octo-import-format">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <textarea id="octo-import-data" rows="6" style="width:100%;" placeholder="Paste exported CSV or JSON array here"></textarea>
        <div style="margin-top:8px;">
          <button class="btn btn-primary btn-sm" onclick="submitOctoparseImport()">Import</button>
          <span id="octo-import-result" class="integration-preview" style="margin-left:10px;"></span>
        </div>
      </div>`;

    grid.innerHTML = rows + importPanel;
  } catch (err) {
    grid.innerHTML = `<p class="text-red">${err.message}</p>`;
  }
}

async function submitOctoparseImport() {
  const platform = document.getElementById("octo-import-platform").value;
  const purpose = document.getElementById("octo-import-purpose").value;
  const format = document.getElementById("octo-import-format").value;
  const raw = document.getElementById("octo-import-data").value.trim();
  const out = document.getElementById("octo-import-result");

  if (!raw) { out.textContent = "Nothing to import"; return; }

  let data = raw;
  if (format === "json") {
    try { data = JSON.parse(raw); }
    catch { out.textContent = "Invalid JSON"; return; }
  }

  out.textContent = "Importing…";
  try {
    const result = await OC.apiPost("/api/integrations/octoparse/import", { platform, purpose, format, data });
    out.textContent = `Imported ${result.inserted} new (${result.duplicates} duplicates, ${result.skipped} unmappable)`;
    document.getElementById("octo-import-data").value = "";
  } catch (err) {
    out.textContent = `Failed: ${err.message}`;
  }
}

function editOwnerIntegration(key, label, isSecret) {
  const value = prompt(`${label}:`);
  if (!value) return;
  OC.apiPut(`/api/integrations/${key}`, { value })
    .then(() => loadOwnerIntegrations())
    .catch((err) => alert(`Failed: ${err.message}`));
}

// ── Auth ──────────────────────────────────────────────────────────────────
function showLogin() {
  document.body.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand"><span class="brand-mark">N</span><div><span class="brand-name">Nesso Drop</span><br><span class="brand-role">Owner Console</span></div></div>
        <h1>Owner Sign In</h1>
        <form id="login-form">
          <label>Email <input type="email" name="email" required></label>
          <label>Password <input type="password" name="password" required></label>
          <button type="submit" class="btn btn-primary">Sign In</button>
        </form>
        <p id="login-error" class="text-red"></p>
      </div>
    </div>`;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(e.target));
    try {
      const result = await OC.apiPost("/api/auth/login", { email, password });
      if (result.user?.role !== "owner") throw new Error("Owner credentials required");
      OC.setToken(result.token);
      window.location.reload();
    } catch (err) {
      document.getElementById("login-error").textContent = err.message;
    }
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────
(async function boot() {
  if (!OC.getToken()) { showLogin(); return; }

  try {
    await OC.apiGet("/api/admin/overview");
  } catch {
    showLogin();
    return;
  }

  document.querySelectorAll(".nav-links a[data-view]").forEach((link) => {
    link.addEventListener("click", (e) => { e.preventDefault(); showView(link.dataset.view); });
  });

  document.getElementById("filter-action").addEventListener("input", loadAudit);
  document.getElementById("filter-entity").addEventListener("change", loadAudit);

  document.getElementById("btn-logout").addEventListener("click", () => {
    OC.clearToken();
    window.location.reload();
  });

  try {
    const payload = JSON.parse(atob(OC.getToken().split(".")[1]));
    document.getElementById("user-email").textContent = payload.email || "Owner";
  } catch {}

  showView("overview");
})();

window.approveCampaign = approveCampaign;
window.rejectCampaign = rejectCampaign;
window.approveCandidate = approveCandidate;
window.rejectCandidate = rejectCandidate;
window.loadOverview = loadOverview;
window.editOwnerIntegration = editOwnerIntegration;
window.submitOctoparseImport = submitOctoparseImport;
