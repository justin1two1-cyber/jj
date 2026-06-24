import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { formatCents, parseDollarsTocents } from '../utils/formatCurrency';
import CameraInput from '../components/CameraInput';

const CATEGORIES = ['all', 'power tools', 'hand tools', 'vehicle', 'equipment'];
const DEPRECIATION_METHODS = [
  { value: 'instant_write_off', label: 'Instant Write-Off' },
  { value: 'diminishing_value', label: 'Diminishing Value' },
  { value: 'prime_cost', label: 'Prime Cost' },
];

export default function Assets() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'power tools', purchaseDate: new Date().toISOString().slice(0, 10),
    purchasePrice: '', depreciationMethod: 'instant_write_off', effectiveLifeYears: '5',
    serialNumber: '', supplier: '',
  });

  useEffect(() => { loadAssets(); }, [filter]);

  async function loadAssets() {
    let all = await db.assets.orderBy('name').toArray();
    if (filter !== 'all') all = all.filter(a => a.category === filter);
    setAssets(all);
  }

  function calculateCurrentValue(asset) {
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

  async function saveAsset() {
    if (!form.name.trim()) { alert('Please enter a name'); return; }
    const price = parseDollarsTocents(form.purchasePrice);
    const now = new Date().toISOString();

    const asset = {
      id: uuid(),
      name: form.name,
      category: form.category,
      purchaseDate: form.purchaseDate,
      purchasePrice: price,
      depreciationMethod: form.depreciationMethod,
      effectiveLifeYears: parseInt(form.effectiveLifeYears) || 5,
      currentValue: form.depreciationMethod === 'instant_write_off' ? 0 : price,
      serialNumber: form.serialNumber,
      supplier: form.supplier,
      photo: null,
      createdAt: now,
      syncedAt: null,
    };

    await db.assets.add(asset);
    setForm({ name: '', category: 'power tools', purchaseDate: new Date().toISOString().slice(0, 10),
      purchasePrice: '', depreciationMethod: 'instant_write_off', effectiveLifeYears: '5',
      serialNumber: '', supplier: '' });
    setShowForm(false);
    loadAssets();
  }

  async function deleteAsset(assetId) {
    if (!confirm('Delete this asset?')) return;
    await db.assets.delete(assetId);
    loadAssets();
  }

  const totalPurchase = assets.reduce((s, a) => s + (a.purchasePrice || 0), 0);
  const totalCurrent = assets.reduce((s, a) => s + calculateCurrentValue(a), 0);
  const totalDepreciation = totalPurchase - totalCurrent;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Asset Register</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Asset'}
        </button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Purchase Value</span>
          <span className="stat-card-value money" style={{ fontSize: 18 }}>{formatCents(totalPurchase)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Current Value</span>
          <span className="stat-card-value money" style={{ fontSize: 18 }}>{formatCents(totalCurrent)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Depreciation</span>
          <span className="stat-card-value money money-negative" style={{ fontSize: 18 }}>{formatCents(totalDepreciation)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {CATEGORIES.map(c => (
          <button key={c} className={`btn ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: 13, flexShrink: 0 }}
            onClick={() => setFilter(c)}>
            {c === 'all' ? 'All' : c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>New Asset</h3>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="DeWalt Circular Saw" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Purchase Price ($)</label>
              <input type="number" value={form.purchasePrice} onChange={e => setForm(f => ({ ...f, purchasePrice: e.target.value }))}
                placeholder="0.00" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Serial Number</label>
              <input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
                placeholder="Optional" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Depreciation Method</label>
              <select value={form.depreciationMethod} onChange={e => setForm(f => ({ ...f, depreciationMethod: e.target.value }))}>
                {DEPRECIATION_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Effective Life (years)</label>
              <input type="number" value={form.effectiveLifeYears}
                onChange={e => setForm(f => ({ ...f, effectiveLifeYears: e.target.value }))} placeholder="5" />
            </div>
          </div>
          <div className="form-group">
            <label>Supplier</label>
            <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
              placeholder="Where purchased" />
          </div>
          <div className="form-group">
            <label>Photo</label>
            <CameraInput onCapture={() => {}} label="Add Photo" />
          </div>
          <button className="btn btn-primary btn-block" onClick={saveAsset}>Save Asset</button>
        </div>
      )}

      {assets.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔧</div>
          <p>No assets registered</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Track your tools and equipment for tax depreciation</p>
        </div>
      ) : (
        <div className="list-gap">
          {assets.map(a => {
            const currentValue = calculateCurrentValue(a);
            return (
              <div key={a.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {a.category} · Purchased {a.purchaseDate}
                      {a.serialNumber ? ` · S/N: ${a.serialNumber}` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {a.depreciationMethod.replace(/_/g, ' ')}
                      {a.depreciationMethod !== 'instant_write_off' && ` · ${a.effectiveLifeYears}yr life`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="money" style={{ fontWeight: 600 }}>{formatCents(currentValue)}</div>
                    {currentValue !== a.purchasePrice && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>
                        {formatCents(a.purchasePrice)}
                      </div>
                    )}
                    <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: 11, marginTop: 4 }}
                      onClick={() => deleteAsset(a.id)}>Delete</button>
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
