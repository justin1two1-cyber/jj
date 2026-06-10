// Main app controller — routing, auth, nav

const VIEWS = {
  home:         { init: initHomeView,         label: "Overview" },
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
        <div class="brand">
          <div class="brand-logo">
            <svg width="28" height="32" viewBox="0 0 30 34" fill="none">
              <path d="M15 1C15 1 2 14 2 22a13 13 0 0 0 26 0C28 14 15 1 15 1z" fill="url(#loginGrad)"/>
              <path d="M15 10 L15 28 M9 22 L15 28 L21 22" stroke="rgba(255,255,255,0.55)" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/>
              <defs>
                <linearGradient id="loginGrad" x1="2" y1="1" x2="28" y2="34" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#c084fc"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="brand-name">
            <span class="b1">Nesso Drop</span>
            <span class="b2">Control Plane</span>
          </div>
        </div>
        <h1>Sign In</h1>
        <form id="login-form">
          <label>Email <input type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label>
          <label>Password <input type="password" name="password" required></label>
          <button type="submit" class="btn btn-primary">Sign In</button>
        </form>
        <p id="login-error" class="text-red hidden"></p>
      </div>
    </div>`;

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const result = await ND.apiPost("/api/auth/login", { email, password });
      ND.setToken(result.token);
      window.location.reload();
    } catch (err) {
      const el = document.getElementById("login-error");
      el.textContent = err.message;
      el.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Sign In";
    }
  });
}

// Init
(async function boot() {
  if (!ND.getToken()) {
    showLoginScreen();
    return;
  }

  // Verify token still valid (authenticated endpoint — 401 = token expired/invalid)
  try {
    await ND.apiGet("/api/auth/me");
  } catch {
    showLoginScreen();
    return;
  }

  initNav();

  // Show user email from token
  try {
    const userData = JSON.parse(atob(ND.getToken().split(".")[1]));
    document.getElementById("user-email").textContent = userData.email || "";
  } catch {}

  document.getElementById("btn-logout").addEventListener("click", () => {
    ND.clearToken();
    window.location.reload();
  });

  showView("home");
})();

window.showView = showView;
