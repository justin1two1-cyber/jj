import Dexie from 'dexie';
import { v4 as uuid } from 'uuid';
import seedMaterials from './seed/materials.json';
import seedTemplates from './seed/templates.json';
import seedSwmsTemplates from './seed/swmsTemplates.json';

export const db = new Dexie('PocketOffice');

db.version(1).stores({
  settings: 'key',
  clients: 'id, name, phone, isRepeatClient, updatedAt',
  templates: 'id, name, category, isCustom',
  materials: 'id, name, category, isCustom',
  quotes: 'id, clientId, templateId, quoteNumber, status, createdAt, updatedAt',
  jobs: 'id, quoteId, clientId, jobNumber, status, createdAt, updatedAt',
  variations: 'id, jobId, variationNumber, status, createdAt',
  expenses: 'id, jobId, category, date, createdAt',
  invoices: 'id, jobId, clientId, invoiceNumber, status, createdAt',
  jobDiary: 'id, jobId, date, createdAt',
  jobPhotos: 'id, jobId, phase, takenAt',
  mileageLog: 'id, jobId, date, createdAt',
  timeLog: 'id, jobId, date, createdAt',
  savedLocations: 'id, name, type',
  assets: 'id, name, category, createdAt',
  compliance: 'id, type, expiryDate, createdAt',
  swmsDocs: 'id, jobId, status, createdAt',
  swmsTemplates: 'id, name, category, isCustom',
  counters: 'key',
  photoBlobs: 'key',
});

export async function storePhoto(key, blob) {
  await db.photoBlobs.put({ key, blob, storedAt: new Date().toISOString() });
}

export async function getPhoto(key) {
  const row = await db.photoBlobs.get(key);
  return row?.blob || null;
}

export async function deletePhoto(key) {
  await db.photoBlobs.delete(key);
}

export async function getNextNumber(prefix) {
  const key = `counter_${prefix}`;
  const existing = await db.counters.get(key);
  const next = (existing?.value ?? 0) + 1;
  await db.counters.put({ key, value: next });
  const padded = String(next).padStart(4, '0');
  return `${prefix}-${padded}`;
}

export async function seedDatabase() {
  const materialCount = await db.materials.count();
  if (materialCount === 0) {
    const materials = seedMaterials.map(m => ({ ...m, id: m.id || uuid(), isCustom: false }));
    await db.materials.bulkAdd(materials);
  }

  const templateCount = await db.templates.count();
  if (templateCount === 0) {
    const templates = seedTemplates.map(t => ({ ...t, id: t.id || uuid(), isCustom: false }));
    await db.templates.bulkAdd(templates);
  }

  const swmsCount = await db.swmsTemplates.count();
  if (swmsCount === 0) {
    const swms = seedSwmsTemplates.map(s => ({ ...s, id: s.id || uuid(), isCustom: false }));
    await db.swmsTemplates.bulkAdd(swms);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.bulkAdd([
      { key: 'businessName', value: '' },
      { key: 'abn', value: '' },
      { key: 'phone', value: '' },
      { key: 'email', value: '' },
      { key: 'labourRate', value: 6500 },
      { key: 'markupPercent', value: 20 },
      { key: 'taxRate', value: 10 },
      { key: 'defaultTravelCost', value: 5000 },
      { key: 'atoMileageRate', value: 85 },
      { key: 'quoteValidDays', value: 30 },
      { key: 'paymentTermsDays', value: 14 },
    ]);
  }
}

export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

export async function getAllSettings() {
  const rows = await db.settings.toArray();
  const obj = {};
  for (const r of rows) obj[r.key] = r.value;
  return obj;
}
