let currentLane = "raw";

async function loadSignalCounts() {
  try {
    const summary = await ND.apiGet("/api/signals/summary");
    document.getElementById("count-raw").textContent = summary.raw || 0;
    document.getElementById("count-pending").textContent = summary.pending || 0;
    document.getElementById("count-promoted").textContent = summary.promoted || 0;
  } catch {}
}

async function loadSignals(lane = "raw") {
  currentLane = lane;
  const grid = document.getElementById("signals-grid");
  grid.innerHTML = ND_UI.loadingState();

  try {
    const data = await ND.apiGet(`/api/signals?status=${lane}&limit=48`);
    if (!data.signals.length) {
      grid.innerHTML = ND_UI.emptyState(
        lane === "raw" ? "No new signals yet. OpenClaw runs every 2 hours." : `No ${lane} signals.`
      );
      return;
    }
    grid.innerHTML = data.signals.map((s) => ND_UI.signalCard(s)).join("");
  } catch (err) {
    grid.innerHTML = ND_UI.emptyState(`Error: ${err.message}`);
  }
}

async function signalPromote(id) {
  try {
    await ND.apiPost(`/api/signals/${id}/promote`, {});
    await loadSignals(currentLane);
    await loadSignalCounts();
  } catch (err) {
    alert(`Could not promote: ${err.message}`);
  }
}

async function signalReject(id) {
  try {
    await ND.apiPost(`/api/signals/${id}/reject`, {});
    await loadSignals(currentLane);
    await loadSignalCounts();
  } catch (err) {
    alert(`Could not reject: ${err.message}`);
  }
}

function initSignalsView() {
  document.querySelectorAll(".lane-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lane-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadSignals(btn.dataset.lane);
    });
  });
  loadSignalCounts();
  loadSignals("raw");
}

window.signalPromote = signalPromote;
window.signalReject = signalReject;
window.initSignalsView = initSignalsView;
