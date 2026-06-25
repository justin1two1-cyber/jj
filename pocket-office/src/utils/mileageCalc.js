export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateDeduction(distanceKm, atoRatePerKm) {
  return Math.round(distanceKm * atoRatePerKm);
}

export function totalRouteDistance(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng,
    );
  }
  return total;
}

export function getFyDateRange() {
  const now = new Date();
  const start = new Date();
  start.setMonth(now.getMonth() >= 6 ? 6 : -6);
  start.setDate(1);
  return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
}
