// Reusable UI components

function formatCurrency(v) {
  return Number(v || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function statusBadge(status) {
  const colors = {
    raw: "badge-grey", pending: "badge-yellow", promoted: "badge-blue",
    approved: "badge-green", live: "badge-teal", rejected: "badge-red",
    draft: "badge-grey", quality_check: "badge-yellow", pending_approval: "badge-orange",
    paid: "badge-blue", processing: "badge-yellow", dispatched_to_supplier: "badge-purple",
    shipped: "badge-teal", delivered: "badge-green", cancelled: "badge-red", refunded: "badge-red",
  };
  return `<span class="badge ${colors[status] || "badge-grey"}">${status.replace(/_/g, " ")}</span>`;
}

// Product image placeholder SVG
const IMG_PLACEHOLDER = `
  <div class="card-img-placeholder">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="3" y="3" width="18" height="18"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="M21 15l-5-5L5 21"/>
    </svg>
  </div>`;

function signalCard(signal) {
  const score = Math.round((signal.commercial_intent_score || 0) * 100);
  const scoreColor = score >= 70 ? "green" : score >= 50 ? "yellow" : "red";
  const seenCount = signal.seen_count || 1;

  // Price display — show range if same product has appeared with different prices
  let priceHtml = "";
  if (signal.price_min != null && signal.price_max != null && signal.price_min !== signal.price_max) {
    priceHtml = `<p class="card-price">${formatCurrency(signal.price_min)} – ${formatCurrency(signal.price_max)}</p>
                 <p class="card-price-note">Source price range across ${seenCount} scans</p>`;
  } else if (signal.raw_price != null) {
    priceHtml = `<p class="card-price">${formatCurrency(signal.raw_price)}</p>
                 <p class="card-price-note">Source price</p>`;
  }

  // Sales evidence — scraped sold counts and ratings ("how much it's selling")
  function fmtVolume(n) {
    n = Number(n);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
    return String(n);
  }
  let salesHtml = "";
  const salesBits = [];
  if (signal.sales_volume > 0) salesBits.push(`<strong>${fmtVolume(signal.sales_volume)}</strong> sold`);
  if (signal.rating > 0) salesBits.push(`★ ${Number(signal.rating).toFixed(1)}`);
  if (signal.review_count > 0) salesBits.push(`${fmtVolume(signal.review_count)} reviews`);
  if (salesBits.length) salesHtml = `<p class="card-score sales-evidence">${salesBits.join(" · ")}</p>`;

  // Relevance score tooltip
  const scoreTitle = "Relevance score: 0–100% based on commercial keywords, price data, sales volume, and source. Below 50% = non-sellable content filtered out.";

  return `
    <div class="card signal-card" style="position:relative">
      ${seenCount > 1 ? `<div class="seen-badge">${seenCount}× scans</div>` : ""}
      ${signal.image_url ? `<img src="${signal.image_url}" class="card-img" alt="" loading="lazy">` : IMG_PLACEHOLDER}
      <div class="card-body">
        <p class="card-source">${(signal.source || "").replace(/_/g, " ")}</p>
        <h3 class="card-title">${signal.title}</h3>
        ${priceHtml}
        ${salesHtml}
        <p class="card-score" title="${scoreTitle}">
          Relevance: <span class="score-${scoreColor}">${score}%</span>
        </p>
        ${signal.category ? `<p class="card-score">Category: ${signal.category}</p>` : ""}
        ${signal.status === "raw" ? `
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="signalPromote('${signal.id}')">Promote</button>
            <button class="btn btn-ghost btn-sm" onclick="signalReject('${signal.id}')">Reject</button>
          </div>` : statusBadge(signal.status)}
      </div>
    </div>`;
}

function candidateCard(c) {
  // Margin is only shown when there is a real supplier cost (landed_cost from supplier_options table)
  const hasRealCost = c.landed_cost != null && Number(c.landed_cost) > 0;
  const hasRealSalePrice = c.target_sale_price != null && Number(c.target_sale_price) > 0;
  const margin = hasRealCost && hasRealSalePrice
    ? Math.round(((Number(c.target_sale_price) - Number(c.landed_cost)) / Number(c.target_sale_price)) * 100)
    : null;

  return `
    <div class="card candidate-card">
      ${c.image_url ? `<img src="${c.image_url}" class="card-img" alt="" loading="lazy">` : IMG_PLACEHOLDER}
      <div class="card-body">
        <div class="card-meta-row">
          ${c.price_band ? `<span class="badge badge-grey">${c.price_band.replace(/_/g, " ")}</span>` : ""}
          ${c.intent_category ? `<span class="badge badge-blue">${c.intent_category.replace(/_/g, " ")}</span>` : ""}
          ${statusBadge(c.status)}
        </div>
        <h3 class="card-title">${c.title}</h3>
        <div class="card-price-row">
          ${hasRealSalePrice ? `<span class="sale-price">${formatCurrency(c.target_sale_price)}</span>` : ""}
          ${hasRealCost ? `<span class="cost-price">Supplier cost: ${formatCurrency(c.landed_cost)}</span>` : '<span class="cost-price">No supplier yet</span>'}
          ${margin !== null ? `<span class="margin ${margin >= 40 ? "margin-good" : margin >= 20 ? "margin-ok" : "margin-low"}">${margin}% margin</span>` : ""}
        </div>
        ${!hasRealCost ? `<p class="card-score">Add a supplier to see real cost &amp; margin</p>` : ""}
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="viewSuppliers('${c.id}', '${c.title.replace(/'/g, "\\'")}')">Suppliers</button>
          <button class="btn btn-primary btn-sm" onclick="generateCampaign('${c.id}')">Generate Ad</button>
        </div>
      </div>
    </div>`;
}

function campaignCard(c) {
  const qs = c.quality_score != null ? Math.round(c.quality_score * 100) : null;
  return `
    <div class="card campaign-card">
      ${c.product_image ? `<img src="${c.product_image}" class="card-img" alt="" loading="lazy">` : IMG_PLACEHOLDER}
      <div class="card-body">
        <div class="card-meta-row">
          ${statusBadge(c.status)}
          ${qs !== null ? `<span class="badge badge-grey" title="AI quality check score — 70%+ auto-approved for review">QS ${qs}%</span>` : ""}
        </div>
        <p class="card-source">${c.product_title}</p>
        <h3 class="card-title">${c.headline || "—"}</h3>
        <p class="card-body-text">${c.hook || ""}</p>
        ${c.cta_text ? `<p class="card-cta">${c.cta_text}</p>` : ""}
        ${c.video_url
          ? `<span class="badge badge-teal">Video ready</span>`
          : `<span class="badge badge-grey">Video pending</span>`}
        <div class="card-actions">
          <button class="btn btn-secondary btn-sm" onclick="previewCampaign('${c.id}')">Preview</button>
        </div>
      </div>
    </div>`;
}

function emptyState(message) {
  return `<div class="empty-state"><p>${message}</p></div>`;
}

function loadingState() {
  return `<div class="loading-state"><div class="spinner"></div> Loading...</div>`;
}

// Modal helpers
function openModal(html) {
  document.getElementById("modal-content").innerHTML = html;
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});

window.ND_UI = {
  formatCurrency, formatDate, statusBadge,
  signalCard, candidateCard, campaignCard,
  emptyState, loadingState, openModal, closeModal,
};
