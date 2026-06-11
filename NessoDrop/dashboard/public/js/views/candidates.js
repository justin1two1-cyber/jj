let currentCandStatus = "";

async function loadCandidates() {
  const grid = document.getElementById("candidates-grid");
  grid.innerHTML = ND_UI.loadingState();

  const priceBand = document.getElementById("filter-price-band").value;
  const intent = document.getElementById("filter-intent").value;
  const topOnly = document.getElementById("toggle-top-only").checked;

  let path;
  if (topOnly) {
    path = "/api/candidates/top?";
  } else {
    // Lane tab selects the status: "" = all, pending = Under Review, approved, live
    path = currentCandStatus
      ? `/api/candidates?status=${currentCandStatus}`
      : "/api/candidates?";
  }
  if (priceBand) path += `&price_band=${priceBand}`;
  if (intent) path += `&intent_category=${intent}`;

  try {
    const data = await ND.apiGet(path);
    const candidates = data.candidates || [];
    if (!candidates.length) {
      const laneMsg = {
        pending: "No products under review.",
        approved: "No approved products yet.",
        live: "No live products yet.",
      }[currentCandStatus] || "No candidates yet. Promote signals from the Signals view to add products here.";
      grid.innerHTML = ND_UI.emptyState(laneMsg);
      return;
    }
    grid.innerHTML = candidates.map((c) => ND_UI.candidateCard(c)).join("");
  } catch (err) {
    grid.innerHTML = ND_UI.emptyState(`Error: ${err.message}`);
  }
}

async function generateCampaign(candidateId) {
  const storeUrl = prompt("Enter your store URL for the CTA (e.g. https://yourstore.com):");
  if (!storeUrl) return;
  try {
    const btn = event.target;
    btn.textContent = "Generating...";
    btn.disabled = true;
    const result = await ND.apiPost("/api/campaigns/generate", {
      candidate_id: candidateId,
      store_url: storeUrl,
    });
    ND_UI.openModal(`
      <h2>Campaign Generated</h2>
      <p><strong>Headline:</strong> ${result.campaign.headline}</p>
      <p><strong>Hook:</strong> ${result.campaign.hook}</p>
      <p><strong>Body:</strong> ${result.campaign.body_copy}</p>
      <p><strong>CTA:</strong> ${result.campaign.cta_text}</p>
      <p><strong>Quality Score:</strong> ${Math.round((result.campaign.quality_score || 0) * 100)}%</p>
      <p><strong>Video:</strong> ${result.video_generation}</p>
      ${result.quality_issues?.length ? `<p class="warning">Issues: ${result.quality_issues.join("; ")}</p>` : ""}
      <p>Campaign status: <strong>${result.campaign.status}</strong></p>
    `);
    btn.textContent = "Generate Ad";
    btn.disabled = false;
  } catch (err) {
    alert(`Campaign generation failed: ${err.message}`);
    event.target.textContent = "Generate Ad";
    event.target.disabled = false;
  }
}

function initCandidatesView() {
  document.getElementById("filter-price-band").addEventListener("change", loadCandidates);
  document.getElementById("filter-intent").addEventListener("change", loadCandidates);
  document.getElementById("toggle-top-only").addEventListener("change", loadCandidates);
  document.querySelectorAll("#candidate-lane-tabs .lane-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#candidate-lane-tabs .lane-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentCandStatus = btn.dataset.candStatus;
      loadCandidates();
    });
  });
  loadCandidates();
}

window.generateCampaign = generateCampaign;
window.initCandidatesView = initCandidatesView;
