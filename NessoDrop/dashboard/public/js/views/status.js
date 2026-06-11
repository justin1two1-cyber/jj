// System Status view — real health data from each service's /health endpoint.
// The API health includes db_connected and queue_depth; the dashboard's own
// health is implicit (this page loaded). Owner console is cross-origin from
// the customer dashboard, so it is only checked when reachable.

function statusRow(label, ok, detail = "") {
  const cls = ok === null ? "text-grey" : ok ? "text-green" : "text-red";
  const text = ok === null ? "UNREACHABLE" : ok ? "HEALTHY" : "DEGRADED";
  return `
    <div class="pipeline-row">
      <span class="pipeline-label">${label}${detail ? ` <span class="text-grey">— ${detail}</span>` : ""}</span>
      <span class="pipeline-count ${cls}">${text}</span>
    </div>`;
}

async function initStatusView() {
  const services = document.getElementById("status-services");
  const detail = document.getElementById("status-detail");

  let apiHealth = null;
  try {
    const r = await fetch(`${ND.API_BASE}/health`);
    apiHealth = await r.json();
  } catch {}

  // Dashboard server health (same origin)
  let dashOk = null;
  try {
    const r = await fetch("/health");
    dashOk = r.ok;
  } catch {}

  services.innerHTML = `
    <div class="home-pipeline-header">Services</div>
    ${statusRow("Platform API", apiHealth ? apiHealth.ok : null)}
    ${statusRow("Database (Postgres)", apiHealth ? apiHealth.db_connected : null)}
    ${statusRow("Dashboard", dashOk)}
  `;

  if (apiHealth) {
    detail.innerHTML = `
      <div class="home-pipeline-header">Platform API Detail</div>
      <div class="pipeline-row"><span class="pipeline-label">Version</span><span class="pipeline-count">${apiHealth.version || "—"}</span></div>
      <div class="pipeline-row"><span class="pipeline-label">Task queue depth</span><span class="pipeline-count">${apiHealth.queue_depth ?? "—"}</span></div>
      <div class="pipeline-row"><span class="pipeline-label">Last checked</span><span class="pipeline-count">${apiHealth.ts ? new Date(apiHealth.ts).toLocaleTimeString() : "—"}</span></div>
    `;
  } else {
    detail.innerHTML = `
      <div class="home-pipeline-header">Platform API Detail</div>
      <div class="pipeline-row"><span class="pipeline-label">API unreachable from this browser — check that the API service is running on ${ND.API_BASE}</span></div>
    `;
  }
}

function initDownloadsView() {
  // Static for now — downloads/exports backend not yet implemented.
  // The empty state in the HTML is the truthful representation.
}

window.initStatusView = initStatusView;
window.initDownloadsView = initDownloadsView;
