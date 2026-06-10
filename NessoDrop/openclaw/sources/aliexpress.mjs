// AliExpress Best Sellers source — official Affiliate API (free with an
// AliExpress affiliate account: https://portals.aliexpress.com).
// Auth: every request is signed with HMAC-SHA256 over the sorted parameter
// string, keyed by the app secret (TOP protocol, sign_method=hmac-sha256).

import { createHmac } from "node:crypto";

export const SOURCE_ID = "aliexpress_bsr";

const GATEWAY = "https://api-sg.aliexpress.com/sync";

// TOP-protocol signature: sort params by key, concatenate key+value pairs,
// HMAC-SHA256 with the app secret, uppercase hex.
function signParams(params, appSecret) {
  const sorted = Object.keys(params).sort();
  const joined = sorted.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", appSecret).update(joined, "utf8").digest("hex").toUpperCase();
}

export async function fetchSignals({ appKey, appSecret } = {}) {
  if (!appKey || !appSecret) {
    console.log("[openclaw:aliexpress] No credentials — skipping");
    return [];
  }

  try {
    const params = {
      app_key: appKey,
      method: "aliexpress.affiliate.hotproduct.query",
      sign_method: "hmac-sha256",
      timestamp: String(Date.now()),
      format: "json",
      v: "2.0",
      fields: "product_id,product_title,product_main_image_url,target_sale_price,target_original_price,second_level_category_name,product_detail_url,evaluate_rate,lastest_volume",
      page_no: "1",
      page_size: "50",
      target_currency: "USD",
      target_language: "EN",
      sort: "LAST_VOLUME_DESC",
    };
    params.sign = signParams(params, appSecret);

    const resp = await fetch(
      `${GATEWAY}?${new URLSearchParams(params)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!resp.ok) throw new Error(`AliExpress API HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.error_response) {
      throw new Error(`AliExpress API error: ${data.error_response.msg || data.error_response.code}`);
    }

    const products =
      data?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result?.products?.product || [];

    return products.map((p) => ({
      source: SOURCE_ID,
      source_product_id: String(p.product_id),
      title: p.product_title,
      description: null,
      image_url: p.product_main_image_url,
      source_url: p.product_detail_url,
      raw_price: parseFloat(p.target_sale_price || p.target_original_price) || null,
      currency: "USD",
      category: p.second_level_category_name || null,
      tags: ["aliexpress", "hot_product"],
      sales_volume: Number(p.lastest_volume) || null,
      rating: p.evaluate_rate ? Math.round((parseFloat(p.evaluate_rate) / 20) * 100) / 100 : null,
      review_count: null,
    }));
  } catch (err) {
    console.error("[openclaw:aliexpress] Fetch failed:", err.message);
    return [];
  }
}
