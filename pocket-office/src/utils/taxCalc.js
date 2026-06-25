const DEFAULT_GST_RATE = 10;

export function calculateGst(amountExGst, rate = DEFAULT_GST_RATE) {
  return Math.round(amountExGst * (rate / 100));
}

export function extractGst(amountIncGst, rate = DEFAULT_GST_RATE) {
  return Math.round(amountIncGst - amountIncGst / (1 + rate / 100));
}

export function addGst(amountExGst, rate = DEFAULT_GST_RATE) {
  return amountExGst + calculateGst(amountExGst, rate);
}

export function removeGst(amountIncGst, rate = DEFAULT_GST_RATE) {
  return Math.round(amountIncGst / (1 + rate / 100));
}

export const TAX_CATEGORIES = {
  GST: 'GST',
  GST_FREE: 'GST-Free',
  INPUT_TAXED: 'Input Taxed',
  BAS_EXCLUDED: 'BAS Excluded',
};
