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
}

window.initHomeView = initHomeView;
