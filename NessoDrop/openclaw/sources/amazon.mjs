// Amazon Best Sellers / Movers & Shakers source
// Uses Rainforest API (real product data, commercially-licensed)
// https://www.rainforestapi.com/docs

export const SOURCE_ID = "amazon_movers";

const CATEGORIES = [
  "bestsellers_electronics",
  "bestsellers_home",
  "bestsellers_kitchen",
  "bestsellers_toys",
  "bestsellers_sports",
  "bestsellers_tools",
  "bestsellers_beauty",
];

export async function fetchSignals({ apiKey } = {}) {
  if (!apiKey) {
    console.log("[openclaw:amazon] No RAINFOREST_API_KEY — skipping");
    return [];
  }

  const signals = [];

  for (const category of CATEGORIES.slice(0, 3)) { // limit API calls per run
    try {
      const params = new URLSearchParams({
        api_key: apiKey,
        type: "bestsellers",
        category_id: category,
        amazon_domain: "amazon.com",
      });

      const resp = await fetch(
        `https://api.rainforestapi.com/request?${params}`,
        { signal: AbortSignal.timeout(12000) }
      );

      if (!resp.ok) throw new Error(`Rainforest API ${resp.status}`);
      const data = await resp.json();

      const items = data?.bestsellers || [];
      for (const item of items.slice(0, 20)) {
        signals.push({
          source: SOURCE_ID,
          source_product_id: item.asin,
          title: item.title,
          description: null,
          image_url: item.image,
          source_url: item.link,
          raw_price: item.price?.value || null,
          currency: "USD",
          category: item.category?.name || category,
          tags: ["bestseller", "amazon"],
        });
      }
    } catch (err) {
      console.error(`[openclaw:amazon] ${category} failed:`, err.message);
    }
  }

  return signals;
}
