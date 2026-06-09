const INTEGRATION_GROUPS = {
  "Shopify Store": [
    { key: "shopify_store_domain", label: "Store Domain", placeholder: "yourstore.myshopify.com" },
    { key: "shopify_access_token", label: "Admin Access Token", secret: true },
    { key: "shopify_webhook_secret", label: "Webhook Secret", secret: true },
  ],
  "Stripe Payments": [
    { key: "stripe_account_id", label: "Account ID" },
    { key: "stripe_secret_key", label: "Secret Key", secret: true, testable: true },
    { key: "stripe_webhook_secret", label: "Webhook Secret", secret: true },
  ],
  "TikTok Ads": [
    { key: "tiktok_ads_account_id", label: "Ads Account ID" },
    { key: "tiktok_client_key", label: "Client Key" },
    { key: "tiktok_access_token", label: "Access Token", secret: true },
  ],
  "Meta Ads": [
    { key: "meta_ads_account_id", label: "Ads Account ID" },
    { key: "meta_access_token", label: "Access Token", secret: true },
  ],
  "Google Ads": [
    { key: "google_ads_customer_id", label: "Customer ID" },
    { key: "google_ads_developer_token", label: "Developer Token", secret: true },
  ],
  "Primary Supplier": [
    { key: "supplier_api_url", label: "Supplier API URL" },
    { key: "supplier_api_key", label: "API Key", secret: true },
    { key: "supplier_portal_url", label: "Supplier Portal URL" },
    { key: "supplier_fallback_name", label: "Fallback Supplier Name" },
    { key: "supplier_fallback_email", label: "Fallback Email" },
  ],
  "Storefront": [
    { key: "store_public_url", label: "Public Store URL", testable: true },
    { key: "store_admin_url", label: "Store Admin URL" },
  ],
};

async function loadIntegrations() {
  const grid = document.getElementById("integrations-grid");
  grid.innerHTML = ND_UI.loadingState();

  try {
    const data = await ND.apiGet("/api/integrations");
    grid.innerHTML = Object.entries(INTEGRATION_GROUPS).map(([group, fields]) => `
      <div class="integration-card">
        <h3 class="integration-group">${group}</h3>
        ${fields.map((f) => {
          const status = data[f.key];
          const configured = status?.configured;
          return `
            <div class="integration-row">
              <div class="integration-info">
                <span class="integration-label">${f.label}</span>
                <span class="integration-preview">${configured ? status.preview : "Not set"}</span>
              </div>
              <div class="integration-actions">
                <span class="dot ${configured ? "dot-green" : "dot-grey"}"></span>
                <button class="btn btn-ghost btn-sm" onclick="editIntegration('${f.key}', '${f.label}', ${f.secret || false})">
                  ${configured ? "Update" : "Set"}
                </button>
                ${f.testable && configured ? `<button class="btn btn-ghost btn-sm" onclick="testIntegration('${f.key}')">Test</button>` : ""}
              </div>
            </div>`;
        }).join("")}
      </div>`).join("");
  } catch (err) {
    grid.innerHTML = ND_UI.emptyState(`Error: ${err.message}`);
  }
}

function editIntegration(key, label, isSecret) {
  ND_UI.openModal(`
    <h2>Set ${label}</h2>
    <form id="integration-form">
      <label>${label}
        <input type="${isSecret ? "password" : "text"}" name="value" placeholder="${isSecret ? "Enter secret value" : "Enter value"}" autocomplete="off" required>
      </label>
      <button type="submit" class="btn btn-primary">Save</button>
    </form>
  `);

  document.getElementById("integration-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = e.target.querySelector("[name=value]").value;
    try {
      await ND.apiPut(`/api/integrations/${key}`, { value });
      ND_UI.closeModal();
      await loadIntegrations();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

async function testIntegration(key) {
  try {
    const result = await ND.apiGet(`/api/integrations/test/${key}`);
    alert(result.ok ? `✓ ${result.message || "Connection successful"}` : `✗ ${result.message || "Connection failed"}`);
  } catch (err) {
    alert(`Test failed: ${err.message}`);
  }
}

window.editIntegration = editIntegration;
window.testIntegration = testIntegration;
window.initIntegrationsView = loadIntegrations;
