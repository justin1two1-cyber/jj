// Commercial intent classifier.
// Returns a score 0–1. Signals below 0.5 are filtered out before DB write.
// This avoids the issue of news/sports/entertainment polluting the signal feed.

// Category blocklist — signals matching these are non-product
const BLOCKED_CATEGORIES = new Set([
  "news", "politics", "sports", "entertainment", "celebrity", "music",
  "movies", "tv", "gaming", "finance", "stocks", "crypto", "weather",
  "health_news", "world_news", "local_news",
]);

// Words that indicate the signal is product/commerce-focused
const PRODUCT_SIGNALS = [
  "buy", "price", "sale", "discount", "shipping", "order", "review", "rating",
  "product", "shop", "store", "deal", "offer", "best seller", "trending product",
  "sold", "purchase", "checkout", "cart", "delivery", "supplier", "wholesale",
  "dropship", "ecommerce", "amazon", "aliexpress", "ebay", "shopify",
];

// Words that indicate news/entertainment — strong negative signal
const NON_PRODUCT_SIGNALS = [
  "election", "war", "president", "minister", "celebrity", "actor", "singer",
  "match", "game", "score", "championship", "nba", "nfl", "fifa",
  "earthquake", "hurricane", "flood", "breaking news", "report",
];

// Word-boundary-aware match: prevents "purchase" matching "repurchase", etc.
function hasPhrase(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(text);
}

export function scoreCommercialIntent(signal) {
  const text = `${signal.title || ""} ${signal.description || ""} ${signal.category || ""}`.toLowerCase();

  // Hard block on non-product categories
  if (signal.category && BLOCKED_CATEGORIES.has(signal.category.toLowerCase())) {
    return 0.05;
  }

  // Hard block on non-product language
  for (const term of NON_PRODUCT_SIGNALS) {
    if (hasPhrase(text, term)) return 0.08;
  }

  let score = 0.3; // base

  // Boost for product language
  let hits = 0;
  for (const term of PRODUCT_SIGNALS) {
    if (hasPhrase(text, term)) hits++;
  }
  score += Math.min(hits * 0.08, 0.4);

  // Boost if price data present
  if (signal.raw_price && Number(signal.raw_price) > 0) score += 0.15;

  // Boost for commerce-native sources (scraped product listings are products by construction)
  const COMMERCE_SOURCES = [
    "aliexpress_bsr", "amazon_movers", "tiktok_shop", "ebay_sold", "cj_trending",
    "octoparse_aliexpress", "octoparse_ebay", "octoparse_etsy", "octoparse_tiktok", "octoparse_amazon",
  ];
  if (COMMERCE_SOURCES.includes(signal.source)) {
    score += 0.2;
  }

  // Proof of actual sales — the strongest commercial evidence available
  if (signal.sales_volume && Number(signal.sales_volume) > 0) score += 0.15;

  return Math.min(Math.round(score * 1000) / 1000, 1.0);
}

export function isCommerciallyViable(signal) {
  return scoreCommercialIntent(signal) >= 0.5;
}
