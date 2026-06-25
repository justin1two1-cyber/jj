export function toCsv(rows, headers) {
  if (rows.length === 0) return '';
  const keys = headers || Object.keys(rows[0]);
  const lines = [
    keys.join(','),
    ...rows.map(r => keys.map(k => {
      const val = r[k];
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','))
  ];
  return lines.join('\n');
}

export function downloadFile(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatDateAu(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function centsToStr(cents) {
  return ((cents || 0) / 100).toFixed(2);
}
