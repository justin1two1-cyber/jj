let currentLane = "raw";

// Deduplicate by source_product_id or normalised title.
// Groups duplicates into one card with a "Seen N×" badge.
// Collects all prices seen for the same product so we can show a range.
function deduplicateSignals(signals) {
  const seen = new Map();

  for (const s of signals) {
    // Key: prefer source_product_id (exact), fall back to normalised title
    const key = s.source_product_id
      ? `id:${s.source_product_id}`
      : `title:${(s.title || "").toLowerCase().trim().replace(/\s+/g, " ").slice(0, 80)}`;

    if (!seen.has(key)) {
      seen.set(key, {
        ...s,
        seen_count: 1,
        _prices: s.raw_price != null ? [Number(s.raw_price)] : [],
      });
    } else {
      const entry = seen.get(key);
      entry.seen_count++;
      if (s.raw_price != null) entry._prices.push(Number(s.raw_price));
      // Prefer the entry with the highest commercial intent score
      if ((s.commercial_intent_score || 0) > (entry.commercial_intent_score || 0)) {
        seen.set(key, {
          ...s,
          seen_count: entry.seen_count,
          _prices: entry._prices,
        });
      }
    }
  }

  return Array.from(seen.values()).map((s) => {
    if (s._prices.length > 0) {
      s.price_min = Math.min(...s._prices);
      s.price_max = Math.max(...s._prices);
    }
    return s;
  });
}

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
  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div> Loading...</div>`;

  try {
    const data = await ND.apiGet(`/api/signals?status=${lane}&limit=200`);
    if (!data.signals.length) {
      grid.innerHTML = ND_UI.emptyState(
        lane === "raw"
          ? "No signals yet. Discovery runs at 08:00 and 20:00 daily."
          : `No ${lane} signals.`
      );
      return;
    }

    const deduped = lane === "raw" ? deduplicateSignals(data.signals) : data.signals;
    grid.innerHTML = deduped.map((s) => ND_UI.signalCard(s)).join("");

    if (lane === "raw" && data.signals.length !== deduped.length) {
      const dupeCount = data.signals.length - deduped.length;
      const note = document.createElement("p");
      note.className = "helper-text";
      note.style.gridColumn = "1/-1";
      note.style.marginBottom = "0";
      note.textContent = `${deduped.length} unique products shown. ${dupeCount} duplicate entr${dupeCount === 1 ? "y" : "ies"} merged.`;
      grid.insertBefore(note, grid.firstChild);
    }
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
