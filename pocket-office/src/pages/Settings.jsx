import { useState, useEffect } from 'react';
import { getAllSettings, setSetting } from '../db';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => { getAllSettings().then(setSettings); }, []);

  function update(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
    setSaved(false);
  }

  async function save() {
    const numericKeys = ['labourRate', 'markupPercent', 'taxRate', 'defaultTravelCost', 'atoMileageRate', 'quoteValidDays', 'paymentTermsDays'];
    for (const key of Object.keys(settings)) {
      const val = numericKeys.includes(key) ? Number(settings[key]) : settings[key];
      await setSetting(key, val);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <button className={`btn ${saved ? 'btn-success' : 'btn-primary'}`} onClick={save}>
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div style={{ maxWidth: 500 }}>
        <h3 style={{ marginBottom: 12 }}>Business Details</h3>
        <div className="form-group">
          <label>Business Name</label>
          <input value={settings.businessName || ''} onChange={e => update('businessName', e.target.value)} placeholder="Your Business Name" />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>ABN</label>
            <input value={settings.abn || ''} onChange={e => update('abn', e.target.value)} placeholder="12 345 678 901" />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={settings.phone || ''} onChange={e => update('phone', e.target.value)} placeholder="0400 000 000" />
          </div>
        </div>
        <div className="form-group">
          <label>Email</label>
          <input value={settings.email || ''} onChange={e => update('email', e.target.value)} placeholder="you@business.com.au" />
        </div>

        <h3 style={{ margin: '24px 0 12px' }}>Quoting Defaults</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Labour Rate ($/hr)</label>
            <input type="number" value={settings.labourRate != null ? settings.labourRate / 100 : ''} onChange={e => update('labourRate', Math.round(parseFloat(e.target.value || 0) * 100))} />
          </div>
          <div className="form-group">
            <label>Markup (%)</label>
            <input type="number" value={settings.markupPercent ?? ''} onChange={e => update('markupPercent', parseFloat(e.target.value || 0))} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>GST Rate (%)</label>
            <input type="number" value={settings.taxRate ?? ''} onChange={e => update('taxRate', parseFloat(e.target.value || 0))} />
          </div>
          <div className="form-group">
            <label>Default Travel Cost ($)</label>
            <input type="number" value={settings.defaultTravelCost != null ? settings.defaultTravelCost / 100 : ''} onChange={e => update('defaultTravelCost', Math.round(parseFloat(e.target.value || 0) * 100))} />
          </div>
        </div>

        <h3 style={{ margin: '24px 0 12px' }}>Tax & Mileage</h3>
        <div className="form-row">
          <div className="form-group">
            <label>ATO Mileage Rate (c/km)</label>
            <input type="number" value={settings.atoMileageRate ?? ''} onChange={e => update('atoMileageRate', parseFloat(e.target.value || 0))} />
          </div>
          <div className="form-group">
            <label>Quote Valid Days</label>
            <input type="number" value={settings.quoteValidDays ?? ''} onChange={e => update('quoteValidDays', parseInt(e.target.value || 0))} />
          </div>
        </div>
        <div className="form-group">
          <label>Payment Terms (days)</label>
          <input type="number" value={settings.paymentTermsDays ?? ''} onChange={e => update('paymentTermsDays', parseInt(e.target.value || 0))} />
        </div>

        <h3 style={{ margin: '24px 0 12px' }}>Data</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={async () => {
            const { exportDatabase } = await import('../utils/dataBackup');
            exportDatabase();
          }}>Export Backup</button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            Import Backup
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                const { importDatabase } = await import('../utils/dataBackup');
                await importDatabase(file);
                window.location.reload();
              }
            }} />
          </label>
        </div>
      </div>
    </div>
  );
}
