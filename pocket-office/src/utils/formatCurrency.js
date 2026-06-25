export function formatCents(cents) {
  if (cents == null) return '$0.00';
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const formatted = `$${dollars.toLocaleString('en-AU')}.${String(remainder).padStart(2, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

export function parseDollarsTocents(str) {
  const cleaned = String(str).replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function formatCentsShort(cents) {
  if (cents == null) return '$0';
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return formatCents(cents);
}
