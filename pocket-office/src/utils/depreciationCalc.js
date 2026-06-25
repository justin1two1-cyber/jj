export function calculateCurrentValue(asset) {
  if (asset.depreciationMethod === 'instant_write_off') return 0;

  const purchaseDate = new Date(asset.purchaseDate);
  const now = new Date();
  const yearsOwned = (now - purchaseDate) / (365.25 * 24 * 60 * 60 * 1000);
  const life = asset.effectiveLifeYears || 5;

  if (asset.depreciationMethod === 'prime_cost') {
    const rate = 1 / life;
    const depreciated = asset.purchasePrice * rate * yearsOwned;
    return Math.max(0, asset.purchasePrice - Math.round(depreciated));
  }

  const rate = 2 / life;
  let value = asset.purchasePrice;
  for (let i = 0; i < Math.floor(yearsOwned); i++) {
    value = Math.round(value * (1 - rate));
  }
  const partial = yearsOwned - Math.floor(yearsOwned);
  value = Math.round(value * (1 - rate * partial));
  return Math.max(0, value);
}

export function calculateDepreciation(asset) {
  const currentValue = calculateCurrentValue(asset);
  return {
    ...asset,
    currentValue,
    depreciation: (asset.purchasePrice || 0) - currentValue,
  };
}
