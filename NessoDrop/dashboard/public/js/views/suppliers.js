let currentCandidateId = null;
let currentSupplierView = "best_value";

async function viewSuppliers(candidateId, productTitle) {
  currentCandidateId = candidateId;

  // Switch to suppliers view
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.getElementById("view-suppliers").classList.remove("hidden");
  document.querySelectorAll(".nav-links a").forEach((a) => a.classList.remove("active"));
  document.querySelector('[data-view="suppliers"]').classList.add("active");

  await loadSuppliers(candidateId, currentSupplierView);
}

async function loadSuppliers(candidateId, view = "best_value") {
  if (!candidateId) return;
  const wrap = document.getElementById("suppliers-table-wrap");
  wrap.innerHTML = ND_UI.loadingState();

  try {
    const data = await ND.apiGet(`/api/suppliers/${candidateId}?view=${view}`);
    const suppliers = data.suppliers;

    if (!suppliers.length) {
      wrap.innerHTML = ND_UI.emptyState(
        "No supplier options yet.",
        `<button class="btn btn-primary" onclick="addSupplierManually('${candidateId}')">Add Supplier</button>`
      );
      return;
    }

    wrap.innerHTML = `
      <h3>Suppliers for selected product — View: <em>${view.replace(/_/g, " ")}</em></h3>
      <table class="data-table">
        <thead><tr>
          <th>Supplier</th>
          <th>Platform</th>
          <th>Cost</th>
          <th>Shipping</th>
          <th>Landed Cost</th>
          <th>Delivery</th>
          <th>Rating</th>
          <th>Margin</th>
          <th>Action</th>
        </tr></thead>
        <tbody>
          ${suppliers.map((s) => `
            <tr class="${s.is_chosen ? "row-chosen" : ""}">
              <td>${s.supplier_name || s.platform}</td>
              <td>${s.platform}</td>
              <td>${ND_UI.formatCurrency(s.cost_price)}</td>
              <td>${ND_UI.formatCurrency(s.shipping_cost)}</td>
              <td><strong>${ND_UI.formatCurrency(s.landed_cost)}</strong></td>
              <td>${s.shipping_days_min}–${s.shipping_days_max}d</td>
              <td>${s.rating || "—"}</td>
              <td><span class="${Number(s.margin_pct) >= 40 ? "text-green" : Number(s.margin_pct) >= 20 ? "text-yellow" : "text-red"}">${s.margin_pct != null ? s.margin_pct + "%" : "—"}</span></td>
              <td>
                ${s.is_chosen
                  ? '<span class="badge badge-green">Selected</span>'
                  : `<button class="btn btn-primary btn-sm" onclick="chooseSupplier('${candidateId}', '${s.id}')">Choose</button>`}
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="table-actions">
        <button class="btn btn-ghost" onclick="addSupplierManually('${candidateId}')">+ Add Supplier</button>
        <button class="btn btn-ghost" onclick="syncSuppliers('${candidateId}')">Refresh Prices</button>
      </div>`;
  } catch (err) {
    wrap.innerHTML = ND_UI.emptyState(`Error: ${err.message}`);
  }
}

async function chooseSupplier(candidateId, supplierId) {
  try {
    await ND.apiPatch(`/api/candidates/${candidateId}/choose-supplier`, {
      supplier_option_id: supplierId,
    });
    await loadSuppliers(candidateId, currentSupplierView);
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

async function syncSuppliers(candidateId) {
  try {
    await ND.apiPost(`/api/suppliers/${candidateId}/sync`, {});
    alert("Supplier sync queued — prices will update shortly.");
  } catch (err) {
    alert(`Sync failed: ${err.message}`);
  }
}

async function addSupplierManually(candidateId) {
  ND_UI.openModal(`
    <h2>Add Supplier</h2>
    <form id="add-supplier-form">
      <label>Platform
        <select name="platform"><option value="aliexpress">AliExpress</option><option value="cjdropshipping">CJDropshipping</option><option value="spocket">Spocket</option><option value="manual">Manual</option></select>
      </label>
      <label>Supplier Name <input name="supplier_name" placeholder="e.g. Supplier Co."></label>
      <label>Product URL <input name="product_url" placeholder="https://..."></label>
      <label>Cost Price ($) <input name="cost_price" type="number" step="0.01" required></label>
      <label>Shipping Cost ($) <input name="shipping_cost" type="number" step="0.01" value="0"></label>
      <label>Delivery Days Min <input name="shipping_days_min" type="number" value="7"></label>
      <label>Delivery Days Max <input name="shipping_days_max" type="number" value="21"></label>
      <label>Rating (1-5) <input name="rating" type="number" step="0.1" min="1" max="5"></label>
      <button type="submit" class="btn btn-primary">Add</button>
    </form>
  `);

  document.getElementById("add-supplier-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await ND.apiPost(`/api/suppliers/${candidateId}`, body);
      ND_UI.closeModal();
      await loadSuppliers(candidateId, currentSupplierView);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

function initSuppliersView() {
  document.querySelectorAll(".view-tab[data-supplier-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-tab[data-supplier-view]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentSupplierView = btn.dataset.supplierView;
      if (currentCandidateId) loadSuppliers(currentCandidateId, currentSupplierView);
    });
  });
}

window.viewSuppliers = viewSuppliers;
window.chooseSupplier = chooseSupplier;
window.syncSuppliers = syncSuppliers;
window.addSupplierManually = addSupplierManually;
window.initSuppliersView = initSuppliersView;
