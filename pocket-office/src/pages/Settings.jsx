import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { db, getAllSettings, setSetting } from '../db';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(false);
  const [locations, setLocations] = useState([]);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', address: '', type: 'home', geofenceRadiusM: 100 });

  useEffect(() => {
    getAllSettings().then(setSettings);
    db.savedLocations.toArray().then(setLocations);
  }, []);

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

  async function saveLocation() {
    if (!locForm.name.trim()) { alert('Enter a name'); return; }

    const loc = {
      id: uuid(),
      name: locForm.name,
      address: locForm.address,
      coords: null,
      type: locForm.type,
      geofenceRadiusM: parseInt(locForm.geofenceRadiusM) || 100,
    };

    if (navigator.geolocation && !locForm.address) {
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        loc.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        loc.address = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      } catch { /* skip coords */ }
    }

    await db.savedLocations.add(loc);
    setLocations(await db.savedLocations.toArray());
    setLocForm({ name: '', address: '', type: 'home', geofenceRadiusM: 100 });
    setShowLocationForm(false);
  }

  async function deleteLocation(id) {
    if (!confirm('Delete this location?')) return;
    await db.savedLocations.delete(id);
    setLocations(await db.savedLocations.toArray());
  }

  const LOCATION_TYPES = [
    { value: 'home', label: 'Home' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'supplier', label: 'Supplier' },
    { value: 'job_site', label: 'Job Site' },
  ];

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

        <h3 style={{ margin: '24px 0 12px' }}>Saved Locations</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          Set your home base and workshop for GPS auto-tracking
        </p>

        {locations.length > 0 && (
          <div className="list-gap" style={{ marginBottom: 12 }}>
            {locations.map(loc => (
              <div key={loc.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{loc.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {loc.type} · {loc.address || 'No address'} · {loc.geofenceRadiusM}m radius
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}
                  onClick={() => deleteLocation(loc.id)}>x</button>
              </div>
            ))}
          </div>
        )}

        {showLocationForm ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-group">
              <label>Name</label>
              <input value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Home, Workshop, etc." />
            </div>
            <div className="form-group">
              <label>Address (leave blank to use current GPS)</label>
              <input value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))}
                placeholder="123 Street, Suburb VIC" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select value={locForm.type} onChange={e => setLocForm(f => ({ ...f, type: e.target.value }))}>
                  {LOCATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Geofence Radius (m)</label>
                <input type="number" value={locForm.geofenceRadiusM}
                  onChange={e => setLocForm(f => ({ ...f, geofenceRadiusM: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={saveLocation}>Save Location</button>
              <button className="btn btn-secondary" onClick={() => setShowLocationForm(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn btn-secondary" onClick={() => setShowLocationForm(true)} style={{ marginBottom: 16 }}>
            + Add Location
          </button>
        )}

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
