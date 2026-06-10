// Amazon Best Sellers / Movers & Shakers source
// Uses Rainforest API (real product data, commercially-licensed)
// https://www.rainforestapi.com/docs

export const SOURCE_ID = "amazon_movers";

// Ordered to cover all price bands — electronics/computers/cameras hit $200–$2000+;
// home/kitchen/tools cover $50–$500; beauty/toys tend to be under $50.
const CATEGORIES = [
  "bestsellers_electronics",      // $20–$2000 — headphones, phones, smart home
  "bestsellers_computers",        // $200–$2000 — laptops, monitors, peripherals
  "bestsellers_camera_photo",     // $100–$2000 — cameras, lenses, drones
  "bestsellers_major_appliances", // $200–$1000 — kitchen appliances, vacuums
  "bestsellers_tools",            // $30–$600 — power tools, hand tools
  "bestsellers_home",             // $20–$500 — home goods, furniture
  "bestsellers_kitchen",          // $15–$400 — cookware, gadgets
  "bestsellers_sports",           // $15–$500 — fitness, outdoor
  "bestsellers_beauty",           // $5–$150 — beauty, hair
];

async function fetchCategory(apiKey, category) {
  const params = new URLSearchParams({
    api_key: apiKey,
    type: "bestsellers",
    category_id: category,
    amazon_domain: "amazon.com",
  });
  const resp = await fetch(
    `https://api.rainforestapi.com/request?${params}`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return (data?.bestsellers || []).slice(0, 25).map((item) => ({
    source: SOURCE_ID,
    source_product_id: item.asin,
    title: item.title,
    description: null,
    image_url: item.image,
    source_url: item.link,
    raw_price: item.price?.value ?? null,
    currency: "USD",
    category: item.category?.name || category,
    tags: ["bestseller", "amazon"],
  }));
}

export async function fetchSignals({ apiKey } = {}) {
  if (!apiKey) {
    console.log("[openclaw:amazon] No RAINFOREST_API_KEY — skipping");
    return [];
  }

  // All categories fetched in parallel — failed ones are logged and skipped
  const results = await Promise.allSettled(
    CATEGORIES.map((cat) => fetchCategory(apiKey, cat))
  );

  const signals = [];
  for (const [i, result] of results.entries()) {
    if (result.status === "fulfilled") {
      signals.push(...result.value);
    } else {
      console.error(`[openclaw:amazon] ${CATEGORIES[i]} failed:`, result.reason.message);
    }
  }
  return signals;
}
