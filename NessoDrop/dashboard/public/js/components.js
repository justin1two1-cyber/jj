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

function signalCard(signal, onPromote, onReject) {
  const score = Math.round((signal.commercial_intent_score || 0) * 100);
  const scoreColor = score >= 70 ? "green" : score >= 50 ? "yellow" : "red";
  return `
    <div class="card signal-card">
      ${signal.image_url ? `<img src="${signal.image_url}" class="card-img" alt="" loading="lazy">` : '<div class="card-img-placeholder"></div>'}
      <div class="card-body">
        <p class="card-source">${signal.source.replace(/_/g, " ")}</p>
        <h3 class="card-title">${signal.title}</h3>
        ${signal.raw_price ? `<p class="card-price">${formatCurrency(signal.raw_price)}</p>` : ""}
        <p class="card-score">
          Intent score: <span class="score-${scoreColor}">${score}%</span>
        </p>
        ${signal.status === "raw" ? `
          <div class="card-actions">
            <button class="btn btn-primary" onclick="signalPromote('${signal.id}')">Promote</button>
            <button class="btn btn-ghost" onclick="signalReject('${signal.id}')">Reject</button>
          </div>` : statusBadge(signal.status)}
      </div>
    </div>`;
}

function candidateCard(c) {
  const margin = c.landed_cost && c.target_sale_price
    ? Math.round(((c.target_sale_price - c.landed_cost) / c.target_sale_price) * 100)
    : null;
  return `
    <div class="card candidate-card">
      ${c.image_url ? `<img src="${c.image_url}" class="card-img" alt="" loading="lazy">` : '<div class="card-img-placeholder"></div>'}
      <div class="card-body">
        <div class="card-meta-row">
          ${c.price_band ? `<span class="badge badge-grey">${c.price_band.replace(/_/g, " ")}</span>` : ""}
          ${c.intent_category ? `<span class="badge badge-blue">${c.intent_category.replace(/_/g, " ")}</span>` : ""}
          ${statusBadge(c.status)}
        </div>
        <h3 class="card-title">${c.title}</h3>
        <div class="card-price-row">
          ${c.target_sale_price ? `<span class="sale-price">${formatCurrency(c.target_sale_price)}</span>` : ""}
          ${c.landed_cost ? `<span class="cost-price">Cost: ${formatCurrency(c.landed_cost)}</span>` : ""}
          ${margin !== null ? `<span class="margin ${margin >= 40 ? "margin-good" : margin >= 20 ? "margin-ok" : "margin-low"}">${margin}% margin</span>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn btn-secondary" onclick="viewSuppliers('${c.id}', '${c.title}')">Suppliers</button>
          <button class="btn btn-primary" onclick="generateCampaign('${c.id}')">Generate Ad</button>
        </div>
      </div>
    </div>`;
}

function campaignCard(c) {
  return `
    <div class="card campaign-card">
      ${c.product_image ? `<img src="${c.product_image}" class="card-img" alt="" loading="lazy">` : '<div class="card-img-placeholder"></div>'}
      <div class="card-body">
        <div class="card-meta-row">
          ${statusBadge(c.status)}
          ${c.quality_score != null ? `<span class="badge badge-grey">QS: ${Math.round(c.quality_score * 100)}%</span>` : ""}
        </div>
        <p class="card-source">${c.product_title}</p>
        <h3 class="card-title">${c.headline || "—"}</h3>
        <p class="card-body-text">${c.hook || ""}</p>
        ${c.cta_text ? `<p class="card-cta">${c.cta_text}</p>` : ""}
        ${c.video_url ? `<p class="badge badge-teal">Video ready</p>` : `<p class="badge badge-grey">Video pending</p>`}
        <div class="card-actions">
          <button class="btn btn-secondary" onclick="previewCampaign('${c.id}')">Preview</button>
        </div>
      </div>
    </div>`;
}

function emptyState(message, action = "") {
  return `<div class="empty-state"><p>${message}</p>${action}</div>`;
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
