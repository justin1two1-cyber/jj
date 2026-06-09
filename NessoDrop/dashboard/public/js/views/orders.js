async function loadOrders(status = "") {
  const tbody = document.getElementById("orders-tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Loading...</td></tr>`;

  const path = `/api/orders${status ? `?status=${status}` : ""}`;
  try {
    const data = await ND.apiGet(path);
    if (!data.orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No orders yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.orders.map((o) => `
      <tr onclick="viewOrder('${o.id}')" style="cursor:pointer">
        <td class="mono">${o.id.slice(0, 8)}…</td>
        <td>${o.customer_email}</td>
        <td>${ND_UI.statusBadge(o.status)}</td>
        <td>${o.item_count}</td>
        <td>${ND_UI.formatCurrency(o.total)}</td>
        <td>${ND_UI.formatDate(o.created_at)}</td>
      </tr>`).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error: ${err.message}</td></tr>`;
  }
}

async function viewOrder(id) {
  try {
    const o = await ND.apiGet(`/api/orders/${id}`);
    ND_UI.openModal(`
      <h2>Order ${o.id.slice(0, 8)}…</h2>
      <p>Customer: <strong>${o.customer_email}</strong></p>
      <p>Status: ${ND_UI.statusBadge(o.status)}</p>
      ${o.tracking_number ? `<p>Tracking: <strong>${o.tracking_number}</strong></p>` : ""}
      <h3>Items</h3>
      <table class="data-table">
        <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Cost</th></tr></thead>
        <tbody>
          ${(o.items || []).map((i) => `
            <tr>
              <td>${i.title}</td>
              <td>${i.qty}</td>
              <td>${ND_UI.formatCurrency(i.unit_sale_price)}</td>
              <td>${ND_UI.formatCurrency(i.unit_cost_price)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <div class="order-actions">
        <button class="btn btn-ghost" onclick="updateOrderStatus('${o.id}')">Update Status</button>
      </div>
    `);
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

async function updateOrderStatus(orderId) {
  const status = prompt("New status (paid/processing/shipped/delivered/cancelled):");
  const tracking = prompt("Tracking number (optional):");
  if (!status) return;
  try {
    await ND.apiPatch(`/api/orders/${orderId}/status`, { status, tracking_number: tracking || undefined });
    ND_UI.closeModal();
    loadOrders();
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

function initOrdersView() {
  loadOrders();
}

window.viewOrder = viewOrder;
window.updateOrderStatus = updateOrderStatus;
window.initOrdersView = initOrdersView;
