async function loadCampaigns(status = "") {
  const grid = document.getElementById("campaigns-grid");
  grid.innerHTML = ND_UI.loadingState();

  const path = `/api/campaigns${status ? `?status=${status}` : ""}`;
  try {
    const data = await ND.apiGet(path);
    if (!data.campaigns.length) {
      grid.innerHTML = ND_UI.emptyState(
        "No campaigns yet. Go to Products and click \"Generate Ad\" on a candidate."
      );
      return;
    }
    grid.innerHTML = data.campaigns.map((c) => ND_UI.campaignCard(c)).join("");
  } catch (err) {
    grid.innerHTML = ND_UI.emptyState(`Error: ${err.message}`);
  }
}

function previewCampaign(id) {
  ND.apiGet(`/api/campaigns?status=`)
    .then((data) => {
      const c = data.campaigns.find((x) => x.id === id);
      if (!c) return;
      ND_UI.openModal(`
        <div class="campaign-preview">
          ${c.product_image ? `<img src="${c.product_image}" class="preview-image" alt="">` : ""}
          <div class="preview-body">
            <h2>${c.headline}</h2>
            <p class="preview-hook">${c.hook}</p>
            <p>${c.body_copy}</p>
            <div class="preview-cta">
              <a href="${c.store_cta_url || "#"}" target="_blank" rel="noopener" class="btn btn-primary">
                ${c.cta_text || "Buy Now"}
              </a>
            </div>
            ${c.video_url ? `<p class="badge badge-teal">Video: ${c.video_url}</p>` : ""}
            <div class="preview-meta">
              <span>Status: ${ND_UI.statusBadge(c.status)}</span>
              <span>Quality: ${Math.round((c.quality_score || 0) * 100)}%</span>
            </div>
          </div>
        </div>
      `);
    });
}

function initCampaignsView() {
  document.querySelectorAll(".status-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".status-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadCampaigns(btn.dataset.status);
    });
  });
  loadCampaigns();
}

window.previewCampaign = previewCampaign;
window.initCampaignsView = initCampaignsView;
