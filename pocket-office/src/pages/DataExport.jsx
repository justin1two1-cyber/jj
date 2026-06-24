import { useState } from 'react';
import { db } from '../db';

export default function DataExport() {
  const [exporting, setExporting] = useState('');

  async function handleExport(platform, dataType) {
    setExporting(`${platform}-${dataType}`);
    try {
      const [expenses, invoices, clients] = await Promise.all([
        db.expenses.toArray(),
        db.invoices.toArray(),
        db.clients.toArray(),
      ]);

      if (platform === 'xero') {
        const xero = await import('../utils/exports/xeroExport');
        if (dataType === 'expenses') xero.exportXeroBills(expenses);
        else if (dataType === 'invoices') xero.exportXeroInvoices(invoices, clients);
        else if (dataType === 'contacts') xero.exportXeroContacts(clients);
      } else if (platform === 'myob') {
        const myob = await import('../utils/exports/myobExport');
        if (dataType === 'expenses') myob.exportMyobExpenses(expenses);
        else if (dataType === 'invoices') myob.exportMyobInvoices(invoices, clients);
      } else if (platform === 'qbo') {
        const qbo = await import('../utils/exports/qboExport');
        if (dataType === 'expenses') qbo.exportQboExpenses(expenses);
        else if (dataType === 'invoices') qbo.exportQboInvoices(invoices, clients);
      } else if (platform === 'backup') {
        const { exportDatabase } = await import('../utils/dataBackup');
        exportDatabase();
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
    setExporting('');
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { importDatabase } = await import('../utils/dataBackup');
      await importDatabase(file);
      alert('Data restored successfully!');
      window.location.reload();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  }

  async function clearAllData() {
    if (!confirm('This will DELETE ALL your data. Are you sure?')) return;
    if (!confirm('This cannot be undone. Export a backup first. Continue?')) return;

    const tables = ['settings', 'clients', 'templates', 'materials', 'quotes', 'jobs',
      'variations', 'expenses', 'invoices', 'jobDiary', 'jobPhotos',
      'mileageLog', 'timeLog', 'savedLocations', 'assets', 'compliance',
      'swmsDocs', 'swmsTemplates', 'counters'];

    for (const name of tables) {
      await db[name].clear();
    }
    window.location.reload();
  }

  const platforms = [
    {
      name: 'Xero', id: 'xero',
      exports: [
        { type: 'expenses', label: 'Bills/Expenses (CSV)', desc: 'Xero-formatted bill import' },
        { type: 'invoices', label: 'Invoices (CSV)', desc: 'Xero invoice import format' },
        { type: 'contacts', label: 'Contacts (CSV)', desc: 'Client contact import' },
      ],
    },
    {
      name: 'MYOB', id: 'myob',
      exports: [
        { type: 'expenses', label: 'Purchases (TXT)', desc: 'MYOB AccountRight format' },
        { type: 'invoices', label: 'Sales (TXT)', desc: 'MYOB invoice format' },
      ],
    },
    {
      name: 'QuickBooks Online', id: 'qbo',
      exports: [
        { type: 'expenses', label: 'Expenses (CSV)', desc: 'QBO expense import format' },
        { type: 'invoices', label: 'Invoices (CSV)', desc: 'QBO invoice import format' },
      ],
    },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Data & Export</h1>
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 16 }}>Accounting Software Export</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: 14 }}>
          Download files formatted for import into your accounting software.
        </p>

        {platforms.map(platform => (
          <div key={platform.id} className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>{platform.name}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {platform.exports.map(exp => (
                <button
                  key={exp.type}
                  className="btn btn-secondary"
                  style={{ padding: '10px 16px', fontSize: 13 }}
                  onClick={() => handleExport(platform.id, exp.type)}
                  disabled={exporting === `${platform.id}-${exp.type}`}
                >
                  {exporting === `${platform.id}-${exp.type}` ? 'Exporting...' : exp.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 16 }}>Backup & Restore</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => handleExport('backup', '')}
            disabled={exporting === 'backup-'}>
            {exporting === 'backup-' ? 'Exporting...' : 'Export Full Backup (JSON)'}
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            Import Backup
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
          Backup contains all your data. Save it to Google Drive, iCloud, or email it to yourself.
        </p>
      </section>

      <section>
        <h2 style={{ marginBottom: 16, color: 'var(--color-danger)' }}>Danger Zone</h2>
        <button className="btn btn-danger" onClick={clearAllData}>
          Clear All Data
        </button>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
          Permanently delete all data from this device. Export a backup first!
        </p>
      </section>
    </div>
  );
}
