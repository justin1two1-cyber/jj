// eBay trending-products source.
// Primary: official eBay Browse API — FREE developer tier (5,000 calls/day).
//   Register at https://developer.ebay.com → create app → client ID + secret.
//   OAuth2 client-credentials flow; token cached ~2h.
// Fallback: SerpAPI sold-listings scrape (paid) if only SERPAPI_KEY is set.

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

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";

let _ebayToken = null;
let _ebayTokenExpiry = 0;

async function getEbayToken(clientId, clientSecret) {
  if (_ebayToken && Date.now() < _ebayTokenExpiry) return _ebayToken;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`eBay OAuth HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data.access_token) throw new Error("eBay OAuth response missing access_token");

  _ebayToken = data.access_token;
  _ebayTokenExpiry = Date.now() + (Number(data.expires_in || 7200) - 300) * 1000;
  return _ebayToken;
}

async function fetchOfficialQuery(token, q) {
  const params = new URLSearchParams({
    q,
    limit: "25",
    sort: "-price", // include higher-priced items — fills the $200+ bands
    filter: "buyingOptions:{FIXED_PRICE},itemLocationCountry:US",
  });
  const resp = await fetch(`${EBAY_BROWSE_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`eBay Browse HTTP ${resp.status}`);
  const data = await resp.json();

  return (data.itemSummaries || []).map((item) => ({
    source: SOURCE_ID,
    source_product_id: item.itemId || null,
    title: item.title,
    description: null,
    image_url: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || null,
    source_url: item.itemWebUrl,
    raw_price: item.price?.value ? parseFloat(item.price.value) : null,
    currency: item.price?.currency || "USD",
    category: item.categories?.[0]?.categoryName || null,
    tags: ["ebay", q],
    sales_volume: null,
    rating: null,
    review_count: null,
  }));
}

async function fetchViaSerpApi(serpApiKey) {
  const signals = [];
  for (const q of SEARCH_QUERIES.slice(0, 3)) {
    try {
      const params = new URLSearchParams({
        api_key: serpApiKey,
        engine: "ebay",
        _nkw: q,
        LH_Sold: "1",
        LH_Complete: "1",
        _sop: "12", // most recently sold
      });
      const resp = await fetch(`https://serpapi.com/search?${params}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!resp.ok) throw new Error(`SerpAPI ${resp.status}`);
      const data = await resp.json();

      for (const item of (data?.organic_results || []).slice(0, 15)) {
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
          sales_volume: null,
          rating: null,
          review_count: null,
        });
      }
    } catch (err) {
      console.error(`[openclaw:ebay] SerpAPI "${q}" failed:`, err.message);
    }
  }
  return signals;
}

export async function fetchSignals({ ebayClientId, ebayClientSecret, serpApiKey } = {}) {
  // Preferred: official free eBay API
  if (ebayClientId && ebayClientSecret) {
    try {
      const token = await getEbayToken(ebayClientId, ebayClientSecret);
      const results = await Promise.allSettled(
        SEARCH_QUERIES.map((q) => fetchOfficialQuery(token, q))
      );
      const signals = [];
      for (const [i, r] of results.entries()) {
        if (r.status === "fulfilled") signals.push(...r.value);
        else console.error(`[openclaw:ebay] "${SEARCH_QUERIES[i]}" failed:`, r.reason.message);
      }
      return signals;
    } catch (err) {
      console.error("[openclaw:ebay] Official API failed:", err.message);
      // fall through to SerpAPI if configured
    }
  }

  if (serpApiKey) return fetchViaSerpApi(serpApiKey);

  console.log("[openclaw:ebay] No EBAY_CLIENT_ID/SECRET or SERPAPI_KEY — skipping");
  return [];
}
