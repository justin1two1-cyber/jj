import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import CameraInput from '../components/CameraInput';

const TYPES = [
  { value: 'builders_licence', label: "Builder's Licence" },
  { value: 'public_liability', label: 'Public Liability Insurance' },
  { value: 'workers_comp', label: "Workers' Comp Insurance" },
  { value: 'vehicle_rego', label: 'Vehicle Registration' },
  { value: 'electrical_licence', label: 'Electrical Licence' },
  { value: 'plumbing_licence', label: 'Plumbing Licence' },
  { value: 'other', label: 'Other' },
];

export default function Compliance() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    type: 'builders_licence', name: '', number: '', provider: '',
    expiryDate: '', reminderDays: '30',
  });

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    const all = await db.compliance.orderBy('expiryDate').toArray();
    setItems(all);
  }

  async function saveItem() {
    if (!form.name.trim()) { alert('Please enter a name'); return; }
    const now = new Date().toISOString();

    const item = {
      id: uuid(),
      type: form.type,
      name: form.name,
      number: form.number,
      provider: form.provider,
      expiryDate: form.expiryDate,
      reminderDays: parseInt(form.reminderDays) || 30,
      documentPhoto: null,
      createdAt: now,
      syncedAt: null,
    };

    await db.compliance.add(item);
    setForm({ type: 'builders_licence', name: '', number: '', provider: '', expiryDate: '', reminderDays: '30' });
    setShowForm(false);
    loadItems();
  }

  async function deleteItem(itemId) {
    if (!confirm('Delete this compliance item?')) return;
    await db.compliance.delete(itemId);
    loadItems();
  }

  function getDaysUntilExpiry(dateStr) {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const now = new Date();
    return Math.ceil((expiry - now) / (24 * 60 * 60 * 1000));
  }

  function getExpiryStatus(dateStr, reminderDays) {
    const days = getDaysUntilExpiry(dateStr);
    if (days === null) return 'none';
    if (days < 0) return 'expired';
    if (days <= reminderDays) return 'warning';
    return 'valid';
  }

  const expired = items.filter(i => getExpiryStatus(i.expiryDate, i.reminderDays) === 'expired');
  const warning = items.filter(i => getExpiryStatus(i.expiryDate, i.reminderDays) === 'warning');

  return (
    <div className="page">
      <div className="page-header">
        <h1>Compliance</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {(expired.length > 0 || warning.length > 0) && (
        <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
          {expired.length > 0 && (
            <div className="stat-card" style={{ borderColor: 'var(--color-danger)' }}>
              <span className="stat-card-label" style={{ color: 'var(--color-danger)' }}>EXPIRED</span>
              <span className="stat-card-value" style={{ color: 'var(--color-danger)' }}>{expired.length}</span>
            </div>
          )}
          {warning.length > 0 && (
            <div className="stat-card" style={{ borderColor: 'var(--color-warning)' }}>
              <span className="stat-card-label" style={{ color: 'var(--color-warning)' }}>EXPIRING SOON</span>
              <span className="stat-card-value" style={{ color: 'var(--color-warning)' }}>{warning.length}</span>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Add Compliance Item</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Name / Description</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Builder Reg DB-12345" autoFocus />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Number / Reference</label>
              <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                placeholder="Licence/Policy number" />
            </div>
            <div className="form-group">
              <label>Provider</label>
              <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                placeholder="Insurance company, etc." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Reminder (days before)</label>
              <input type="number" value={form.reminderDays} onChange={e => setForm(f => ({ ...f, reminderDays: e.target.value }))}
                placeholder="30" />
            </div>
          </div>
          <div className="form-group">
            <label>Document Photo</label>
            <CameraInput onCapture={() => {}} label="Upload Document" />
          </div>
          <button className="btn btn-primary btn-block" onClick={saveItem}>Save</button>
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No compliance items</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Track licences, insurance, and rego expiry dates</p>
        </div>
      ) : (
        <div className="list-gap">
          {items.map(item => {
            const status = getExpiryStatus(item.expiryDate, item.reminderDays);
            const days = getDaysUntilExpiry(item.expiryDate);
            const typeLabel = TYPES.find(t => t.value === item.type)?.label || item.type;
            return (
              <div key={item.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {typeLabel}
                      {item.number ? ` · #${item.number}` : ''}
                      {item.provider ? ` · ${item.provider}` : ''}
                    </div>
                    {item.expiryDate && (
                      <div style={{
                        fontSize: 13, marginTop: 4,
                        color: status === 'expired' ? 'var(--color-danger)' :
                               status === 'warning' ? 'var(--color-warning)' : 'var(--color-success)',
                        fontWeight: 600,
                      }}>
                        {status === 'expired' ? `EXPIRED ${Math.abs(days)} days ago` :
                         status === 'warning' ? `Expires in ${days} days` :
                         `Valid until ${item.expiryDate}`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {status === 'expired' && <span className="badge badge-declined">EXPIRED</span>}
                    {status === 'warning' && <span className="badge badge-active">RENEW</span>}
                    {status === 'valid' && <span className="badge badge-accepted">VALID</span>}
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}
                      onClick={() => deleteItem(item.id)}>x</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
