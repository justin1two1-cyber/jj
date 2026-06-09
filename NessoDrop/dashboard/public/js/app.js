// Main app controller — routing, auth, nav

const VIEWS = {
  signals:      { init: initSignalsView,      label: "Signals" },
  candidates:   { init: initCandidatesView,   label: "Products" },
  suppliers:    { init: initSuppliersView,    label: "Suppliers" },
  campaigns:    { init: initCampaignsView,    label: "Campaigns" },
  orders:       { init: initOrdersView,       label: "Orders" },
  financials:   { init: initFinancialsView,   label: "Financials" },
  integrations: { init: initIntegrationsView, label: "Integrations" },
};

let currentView = null;

function showView(name) {
  if (!VIEWS[name]) return;

  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.classList.toggle("active", a.dataset.view === name);
  });

  currentView = name;
  VIEWS[name].init();
}

function initNav() {
  document.querySelectorAll(".nav-links a[data-view]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      showView(link.dataset.view);
    });
  });
}

function showLoginScreen() {
  document.body.innerHTML = `
    <div class="login-wrap">
      <div class="login-card">
        <div class="brand"><span class="brand-mark">N</span> Nesso Drop</div>
        <h1>Sign In</h1>
        <form id="login-form">
          <label>Email <input type="email" name="email" required autocomplete="email"></label>
          <label>Password <input type="password" name="password" required></label>
          <button type="submit" class="btn btn-primary">Sign In</button>
        </form>
        <p id="login-error" class="text-red hidden"></p>
      </div>
    </div>`;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(e.target));
    try {
      const result = await ND.apiPost("/api/auth/login", { email, password });
      ND.setToken(result.token);
      window.location.reload();
    } catch (err) {
      const el = document.getElementById("login-error");
      el.textContent = err.message;
      el.classList.remove("hidden");
    }
  });
}

// Init
(async function boot() {
  if (!ND.getToken()) {
    showLoginScreen();
    return;
  }

  // Verify token still valid
  try {
    await ND.apiGet("/api/admin/health");
  } catch {
    showLoginScreen();
    return;
  }

  initNav();
  initSuppliersView();

  // Show user info
  try {
    const userData = JSON.parse(atob(ND.getToken().split(".")[1]));
    document.getElementById("user-email").textContent = userData.email || "";
  } catch {}

  document.getElementById("btn-logout").addEventListener("click", () => {
    ND.clearToken();
    window.location.reload();
  });

  showView("signals");
})();
