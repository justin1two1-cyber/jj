// TikTok Shop trending products source
// Uses TikTok Business API when access_token is configured

export const SOURCE_ID = "tiktok_shop";

export async function fetchSignals({ accessToken, clientKey } = {}) {
  if (!accessToken || !clientKey) {
    console.log("[openclaw:tiktok] No TikTok credentials — skipping");
    return [];
  }

  try {
    // TikTok Shop API — trending/hot products
    const resp = await fetch(
      "https://open-api.tiktokglobalshop.com/product/202312/products/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tts-access-token": accessToken,
          "x-tts-app-key": clientKey,
        },
        body: JSON.stringify({
          page_size: 50,
          sort_by: "SALE_COUNT",
          sort_order: "DESC",
          status: "ACTIVATE",
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!resp.ok) throw new Error(`TikTok API ${resp.status}`);
    const data = await resp.json();

    const products = data?.data?.products || [];
    return products.map((p) => ({
      source: SOURCE_ID,
      source_product_id: p.id,
      title: p.title,
      description: p.description,
      image_url: p.main_images?.[0]?.urls?.[0] || null,
      source_url: null,
      raw_price: p.skus?.[0]?.original_price?.amount
        ? Number(p.skus[0].original_price.amount) / 1000000
        : null,
      currency: "USD",
      category: p.category_chains?.[0]?.name || null,
      tags: ["tiktok_trending"],
    }));
  } catch (err) {
    console.error("[openclaw:tiktok] Fetch failed:", err.message);
    return [];
  }
}
