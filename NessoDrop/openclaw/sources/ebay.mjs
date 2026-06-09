// eBay completed/sold listings source
// Uses eBay Browse API to find high-velocity sold items

export const SOURCE_ID = "ebay_sold";

const SEARCH_QUERIES = [
  "trending gadget",
  "home improvement tool",
  "fitness equipment",
  "kitchen gadget",
  "outdoor gear",
  "portable electronics",
  "pet accessories",
  "baby products",
];

export async function fetchSignals({ serpApiKey } = {}) {
  // Use SerpAPI to query eBay sold listings if no direct eBay API key
  if (!serpApiKey) {
    console.log("[openclaw:ebay] No SERPAPI_KEY — skipping");
    return [];
  }

  const signals = [];

  for (const q of SEARCH_QUERIES.slice(0, 3)) {
    try {
      const params = new URLSearchParams({
        api_key: serpApiKey,
        engine: "ebay",
        _nkw: q,
        LH_Sold: "1",
        LH_Complete: "1",
        _sop: "12", // sort by most recently sold
      });

      const resp = await fetch(
        `https://serpapi.com/search?${params}`,
        { signal: AbortSignal.timeout(12000) }
      );

      if (!resp.ok) throw new Error(`SerpAPI ${resp.status}`);
      const data = await resp.json();

      const items = data?.organic_results || [];
      for (const item of items.slice(0, 15)) {
        signals.push({
          source: SOURCE_ID,
          source_product_id: item.item_id || null,
          title: item.title,
          description: null,
          image_url: item.thumbnail,
          source_url: item.link,
          raw_price: item.price?.extracted || null,
          currency: "USD",
          category: null,
          tags: ["ebay_sold", q],
        });
      }
    } catch (err) {
      console.error(`[openclaw:ebay] "${q}" failed:`, err.message);
    }
  }

  return signals;
}
