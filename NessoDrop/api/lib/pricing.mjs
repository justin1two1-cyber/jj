export function priceBandFromRaw(rawPrice) {
  const price = Number(rawPrice || 0);
  if (price < 200) return "under_200";
  if (price < 600) return "band_200_600";
  if (price < 1000) return "band_600_1000";
  return "over_1000";
}

// Stripe fee: 2.9% + $0.30 — computed in integer cents to avoid float drift
export function calcStripeFeeDollars(amountDollars) {
  const cents = Math.round(Number(amountDollars) * 100);
  return (Math.round(cents * 0.029) + 30) / 100;
}
