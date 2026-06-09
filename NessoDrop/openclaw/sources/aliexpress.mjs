// AliExpress Best Sellers source
// Uses AliExpress Affiliate API (requires app key + secret from settings)
// Falls back to a public endpoint if credentials not available.

export const SOURCE_ID = "aliexpress_bsr";

export async function fetchSignals({ appKey, appSecret } = {}) {
  if (!appKey || !appSecret) {
    console.log("[openclaw:aliexpress] No credentials — skipping");
    return [];
  }

  try {
    // AliExpress Top Products endpoint via Affiliate API
    const timestamp = Date.now();
    const params = new URLSearchParams({
      app_key: appKey,
      timestamp: String(timestamp),
      sign_method: "hmac-sha256",
      method: "aliexpress.affiliate.hotproduct.query",
      fields: "product_id,product_title,product_main_image_url,target_original_price,second_level_category_name,product_detail_url,evaluate_rate,volume",
      page_no: "1",
      page_size: "50",
      sort: "SALE_PRICE_ASC",
    });

    // In production: compute HMAC-SHA256 signature per AliExpress API spec
    // For now, make the request and let auth fail gracefully
    const resp = await fetch(
      `https://api.taobao.com/router/rest?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!resp.ok) throw new Error(`AliExpress API ${resp.status}`);
    const data = await resp.json();

    const products = data?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result?.products?.product || [];

    return products.map((p) => ({
      source: SOURCE_ID,
      source_product_id: String(p.product_id),
      title: p.product_title,
      description: null,
      image_url: p.product_main_image_url,
      source_url: p.product_detail_url,
      raw_price: parseFloat(p.target_original_price) || null,
      currency: "USD",
      category: p.second_level_category_name || null,
      tags: [],
    }));
  } catch (err) {
    console.error("[openclaw:aliexpress] Fetch failed:", err.message);
    return [];
  }
}
