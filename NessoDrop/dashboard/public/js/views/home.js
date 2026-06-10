async function initHomeView() {
  try {
    const summary = await ND.apiGet("/api/signals/summary");
    const raw = summary.raw || 0;
    const pending = summary.pending || 0;
    const promoted = summary.promoted || 0;
    const rejected = summary.rejected || 0;

    document.getElementById("hs-raw").textContent = raw.toLocaleString();
    document.getElementById("hs-pending").textContent = pending.toLocaleString();
    document.getElementById("hs-promoted").textContent = promoted.toLocaleString();
    document.getElementById("pl-raw").textContent = raw.toLocaleString();
    document.getElementById("pl-pending").textContent = pending.toLocaleString();
    document.getElementById("pl-promoted").textContent = promoted.toLocaleString();
    document.getElementById("pl-rejected").textContent = rejected.toLocaleString();
  } catch {}

  try {
    const fin = await ND.apiGet("/api/billing/financials");
    const rev = Number(fin?.summary?.total_revenue || 0);
    document.getElementById("hs-revenue").textContent =
      rev > 0
        ? rev.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
        : "$0";
  } catch {
    document.getElementById("hs-revenue").textContent = "$0";
  }

  loadScraperHealth();
}

// Scraper health: last discovery run, per-source counts, stale warning
async function loadScraperHealth() {
  const panel = document.getElementById("scraper-health");
  if (!panel) return;

  try {
    const status = await ND.apiGet("/api/signals/discovery-status");
    const run = status.last_run;

    if (!run) {
      panel.innerHTML = `
        <div class="home-pipeline-header">Scraper Health</div>
        <div class="pipeline-row"><span class="pipeline-label">No discovery runs yet — first run happens at 08:00 / 20:00 or on service start</span></div>`;
      return;
    }

    const ranAt = new Date(run.ran_at);
    const ageH = (Date.now() - ranAt.getTime()) / 3_600_000;
    const ageLabel = ageH < 1 ? `${Math.round(ageH * 60)} min ago` : `${ageH.toFixed(1)} h ago`;

    const sourceRows = Object.entries(run.sources || {}).map(([name, count]) => `
      <div class="pipeline-row">
        <span class="pipeline-label">${name}</span>
        <span class="pipeline-count ${count > 0 ? "" : "text-grey"}">${count > 0 ? `${count} signals` : "0 — check credentials"}</span>
      </div>`).join("");

    panel.innerHTML = `
      <div class="home-pipeline-header">Scraper Health — last run ${ageLabel}</div>
      ${status.stale ? `<div class="pipeline-row" style="color:var(--yellow)">
        <span class="pipeline-label">⚠ Last run is over 14h old — the discovery agent may be down</span></div>` : ""}
      <div class="pipeline-row highlight">
        <span class="pipeline-label">New products found</span>
        <span class="pipeline-count">${run.inserted ?? 0}</span>
      </div>
      <div class="pipeline-row">
        <span class="pipeline-label">Prices refreshed on known products</span>
        <span class="pipeline-count">${run.updated ?? 0}</span>
      </div>
      <div class="pipeline-row">
        <span class="pipeline-label">Filtered (non-sellable)</span>
        <span class="pipeline-count text-grey">${run.filtered ?? 0}</span>
      </div>
      ${sourceRows}`;
  } catch (err) {
    panel.innerHTML = `
      <div class="home-pipeline-header">Scraper Health</div>
      <div class="pipeline-row"><span class="pipeline-label text-grey">Unavailable: ${err.message}</span></div>`;
  }
}

window.initHomeView = initHomeView;
