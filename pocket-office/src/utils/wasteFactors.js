export const DEFAULT_WASTE_FACTORS = {
  timber: 1.10,
  decking: 1.10,
  roofing: 1.05,
  concrete: 1.05,
  plumbing: 1.02,
  electrical: 1.05,
  fixings: 1.0,
  paint: 1.10,
  tiles: 1.15,
  insulation: 1.10,
};

export function applyWasteFactor(quantity, wasteFactor) {
  return Math.ceil(quantity * (wasteFactor ?? 1.0));
}

export function getWastePercent(wasteFactor) {
  return Math.round((wasteFactor - 1) * 100);
}

export function wasteFactorFromPercent(percent) {
  return 1 + percent / 100;
}
