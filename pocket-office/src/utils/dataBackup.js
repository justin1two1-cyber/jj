import { db } from '../db';

const TABLE_NAMES = [
  'settings', 'clients', 'templates', 'materials', 'quotes', 'jobs',
  'variations', 'expenses', 'invoices', 'jobDiary', 'jobPhotos',
  'mileageLog', 'timeLog', 'savedLocations', 'assets', 'compliance',
  'swmsDocs', 'swmsTemplates', 'counters', 'photoBlobs',
  'employees', 'timesheets'
];

export async function exportDatabase() {
  const data = {};
  for (const name of TABLE_NAMES) {
    data[name] = await db[name].toArray();
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pocket-office-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDatabase(file) {
  const text = await file.text();
  const data = JSON.parse(text);

  await db.transaction('rw', TABLE_NAMES.map(n => db[n]), async () => {
    for (const name of TABLE_NAMES) {
      if (data[name] && Array.isArray(data[name])) {
        await db[name].clear();
        await db[name].bulkAdd(data[name]);
      }
    }
  });
}
