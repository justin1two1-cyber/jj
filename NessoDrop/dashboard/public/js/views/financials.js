async function loadFinancials() {
  const stats = document.getElementById("financials-stats");
  const warning = document.getElementById("financials-warning");
  stats.innerHTML = [
    "Revenue", "Net Profit", "Orders", "Supplier Cost", "Ad Spend", "Stripe Fees"
  ].map((l) => `<div class="stat-card loading">${l}<br><strong>—</strong></div>`).join("");

  try {
    const data = await ND.apiGet("/api/billing/financials");
    const s = data.summary;

    const fmt = ND_UI.formatCurrency;
    const statCards = [
      { label: "Total Revenue",     value: fmt(s.total_revenue),       color: "green" },
      { label: "Net Profit",        value: fmt(s.total_net_profit),    color: Number(s.total_net_profit) >= 0 ? "green" : "red" },
      { label: "Orders",            value: s.order_count,              color: "blue" },
      { label: "Supplier Cost",     value: fmt(s.total_supplier_cost), color: "grey" },
      { label: "Ad Spend",          value: fmt(s.total_ad_spend),      color: "grey" },
      { label: "Stripe Fees",       value: fmt(s.total_stripe_fees),   color: "grey" },
    ];

    stats.innerHTML = statCards.map((c) => `
      <div class="stat-card">
        <span class="stat-label">${c.label}</span>
        <strong class="stat-value text-${c.color}">${c.value}</strong>
      </div>`).join("");

    if (data.note) {
      warning.textContent = `⚠ ${data.note}`;
      warning.classList.remove("hidden");
    } else {
      warning.classList.add("hidden");
    }

    // Monthly sparkline
    if (data.monthly?.length) {
      renderMonthlyChart(data.monthly);
    }
  } catch (err) {
    stats.innerHTML = ND_UI.emptyState(`Could not load financials: ${err.message}`);
  }
}

function renderMonthlyChart(months) {
  const wrap = document.getElementById("monthly-chart");
  const maxRevenue = Math.max(...months.map((m) => Number(m.revenue)));
  const fmt = ND_UI.formatCurrency;

  wrap.innerHTML = `
    <h3 class="chart-title">Monthly Revenue & Net Profit (Last 6 Months)</h3>
    <div class="bar-chart">
      ${months.map((m) => {
        const rev = Number(m.revenue);
        const net = Number(m.net_profit);
        const revPct = maxRevenue ? Math.round((rev / maxRevenue) * 100) : 0;
        const netPct = maxRevenue ? Math.round((Math.abs(net) / maxRevenue) * 100) : 0;
        return `
          <div class="bar-group">
            <div class="bar-pair">
              <div class="bar bar-revenue" style="height:${revPct}%" title="Revenue: ${fmt(rev)}"></div>
              <div class="bar ${net >= 0 ? "bar-profit" : "bar-loss"}" style="height:${netPct}%" title="Net: ${fmt(net)}"></div>
            </div>
            <span class="bar-label">${m.month}</span>
          </div>`;
      }).join("")}
    </div>
    <div class="chart-legend">
      <span class="legend-item"><span class="dot dot-revenue"></span>Revenue</span>
      <span class="legend-item"><span class="dot dot-profit"></span>Net Profit</span>
    </div>`;
}

window.initFinancialsView = loadFinancials;
