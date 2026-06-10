// Octoparse template output → standard signal shape.
// Each Octoparse template exports different column names; these mappers
// normalise them. They are tolerant: missing columns become null, and
// unrecognised rows are skipped (returned as null) rather than crashing.
//
// Standard signal shape produced:
//   { source, source_product_id, title, description, image_url, source_url,
//     raw_price, currency, category, tags, sales_volume, rating, review_count }

export const OCTOPARSE_PLATFORMS = ["aliexpress", "ebay", "etsy", "tiktok", "amazon"];

// Pull the first present, non-empty value from a row across candidate keys.
// Octoparse column names vary between template versions ("Price" vs "price"
// vs "Product_Price"), so we match case-insensitively with underscores/spaces ignored.
function pick(row, ...keys) {
  const normalised = {};
  for (const [k, v] of Object.entries(row)) {
    normalised[k.toLowerCase().replace(/[\s_-]/g, "")] = v;
  }
  for (const key of keys) {
    const v = normalised[key.toLowerCase().replace(/[\s_-]/g, "")];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
}

// "US $12.34", "£9.99", "1,299.00", "$15.99 - $22.99" (take low end) → 12.34
export function parsePrice(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const first = String(raw).split(/[-–~]/)[0];
  const cleaned = first.replace(/[^0-9.,]/g, "").replace(/,(?=\d{3})/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// "10,000+ sold", "1.2K sold", "500+ orders", "3.4k" → integer
export function parseSalesVolume(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return Math.round(raw);
  const s = String(raw).toLowerCase().replace(/,/g, "");
  const m = s.match(/([\d.]+)\s*([km]?)/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  if (m[2] === "k") n *= 1_000;
  if (m[2] === "m") n *= 1_000_000;
  return Math.round(n);
}

// "4.8 out of 5", "4.8", "96%" → 0–5 scale
export function parseRating(raw) {
  if (raw == null) return null;
  if (typeof raw === "number") return raw <= 5 ? raw : null;
  const s = String(raw);
  if (s.includes("%")) {
    const pct = parseFloat(s);
    return Number.isFinite(pct) ? Math.round((pct / 20) * 100) / 100 : null;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n <= 5 ? n : null;
}

function parseCount(raw) {
  const n = parseSalesVolume(raw);
  return n;
}

function baseSignal(platform, row) {
  return {
    source: `octoparse_${platform}`,
    source_product_id: null,
    title: null,
    description: null,
    image_url: null,
    source_url: null,
    raw_price: null,
    currency: "USD",
    category: null,
    tags: ["octoparse", platform],
    sales_volume: null,
    rating: null,
    review_count: null,
    _raw: row, // kept for supplier matching; stripped before signal insert
  };
}

function mapAliexpress(row) {
  const s = baseSignal("aliexpress", row);
  s.title = pick(row, "title", "product_title", "name", "product_name");
  s.source_product_id = pick(row, "product_id", "productid", "item_id", "id");
  s.source_url = pick(row, "url", "product_url", "link", "page_url", "detail_url");
  s.image_url = pick(row, "image", "image_url", "img", "main_image", "picture");
  s.raw_price = parsePrice(pick(row, "price", "sale_price", "current_price", "product_price"));
  s.sales_volume = parseSalesVolume(pick(row, "sold", "orders", "sales", "sold_count", "trade_amount", "volume"));
  s.rating = parseRating(pick(row, "rating", "stars", "star_rating", "evaluate_rate", "score"));
  s.review_count = parseCount(pick(row, "reviews", "review_count", "feedback", "evaluation_count"));
  s.category = pick(row, "category", "category_name");
  return s.title ? s : null;
}

function mapEbay(row) {
  const s = baseSignal("ebay", row);
  s.title = pick(row, "title", "item_title", "name", "product_title");
  s.source_product_id = pick(row, "item_id", "itemid", "id", "item_number");
  s.source_url = pick(row, "url", "item_url", "link", "page_url");
  s.image_url = pick(row, "image", "image_url", "img", "picture");
  s.raw_price = parsePrice(pick(row, "price", "sold_price", "current_price", "item_price"));
  s.sales_volume = parseSalesVolume(pick(row, "sold", "quantity_sold", "sold_count", "watchers"));
  s.rating = parseRating(pick(row, "rating", "seller_rating", "feedback_percent"));
  s.review_count = parseCount(pick(row, "reviews", "review_count", "feedback_count"));
  s.category = pick(row, "category", "category_name");
  return s.title ? s : null;
}

function mapEtsy(row) {
  const s = baseSignal("etsy", row);
  s.title = pick(row, "title", "listing_title", "name", "product_title");
  s.source_product_id = pick(row, "listing_id", "listingid", "id", "product_id");
  s.source_url = pick(row, "url", "listing_url", "link", "page_url");
  s.image_url = pick(row, "image", "image_url", "img", "picture");
  s.raw_price = parsePrice(pick(row, "price", "sale_price", "current_price"));
  s.sales_volume = parseSalesVolume(pick(row, "sales", "sold", "basket_count", "in_carts"));
  s.rating = parseRating(pick(row, "rating", "stars", "shop_rating"));
  s.review_count = parseCount(pick(row, "reviews", "review_count", "num_reviews"));
  s.category = pick(row, "category", "category_name", "shop_section");
  return s.title ? s : null;
}

function mapTiktok(row) {
  const s = baseSignal("tiktok", row);
  s.title = pick(row, "title", "product_title", "product_name", "name", "video_title", "description");
  s.source_product_id = pick(row, "product_id", "productid", "id", "video_id", "item_id");
  s.source_url = pick(row, "url", "product_url", "link", "video_url", "page_url");
  s.image_url = pick(row, "image", "image_url", "img", "cover", "thumbnail");
  s.raw_price = parsePrice(pick(row, "price", "sale_price", "current_price", "product_price"));
  s.sales_volume = parseSalesVolume(pick(row, "sold", "sales", "sold_count", "units_sold"));
  s.rating = parseRating(pick(row, "rating", "stars", "product_rating"));
  s.review_count = parseCount(pick(row, "reviews", "review_count"));
  s.category = pick(row, "category", "category_name");
  return s.title ? s : null;
}

function mapAmazon(row) {
  const s = baseSignal("amazon", row);
  s.title = pick(row, "title", "product_title", "name", "product_name");
  s.source_product_id = pick(row, "asin", "product_id", "id");
  s.source_url = pick(row, "url", "product_url", "link", "page_url");
  s.image_url = pick(row, "image", "image_url", "img", "main_image");
  s.raw_price = parsePrice(pick(row, "price", "sale_price", "current_price", "product_price"));
  s.sales_volume = parseSalesVolume(pick(row, "bought", "sold", "bought_in_past_month", "sales"));
  s.rating = parseRating(pick(row, "rating", "stars", "star_rating", "average_rating"));
  s.review_count = parseCount(pick(row, "reviews", "review_count", "ratings_count", "num_ratings"));
  s.category = pick(row, "category", "category_name", "department", "rank_category");
  return s.title ? s : null;
}

const MAPPERS = {
  aliexpress: mapAliexpress,
  ebay: mapEbay,
  etsy: mapEtsy,
  tiktok: mapTiktok,
  amazon: mapAmazon,
};

// Map raw Octoparse rows for a platform → normalised signals.
// Returns { signals, skipped } — skipped rows had no recognisable title.
export function mapRows(platform, rows) {
  const mapper = MAPPERS[platform];
  if (!mapper) throw new Error(`Unknown Octoparse platform: ${platform}`);

  const signals = [];
  let skipped = 0;
  for (const row of rows || []) {
    const mapped = mapper(row);
    if (mapped) signals.push(mapped);
    else skipped++;
  }

  if (skipped > 0) {
    const sampleKeys = rows?.[0] ? Object.keys(rows[0]).join(", ") : "none";
    console.warn(
      `[octoparse:${platform}] ${skipped}/${rows.length} rows had no recognisable title. Columns seen: ${sampleKeys}`
    );
  }
  return { signals, skipped };
}

// Minimal CSV parser for Octoparse manual exports (quoted fields, commas, newlines in quotes).
export function parseCsv(text) {
  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.some((f) => f.trim() !== "")) rows.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || record.length) {
    record.push(field);
    if (record.some((f) => f.trim() !== "")) rows.push(record);
  }

  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}
