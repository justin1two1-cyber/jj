import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import { formatCents, parseDollarsTocents } from '../utils/formatCurrency';

const CATEGORIES = ['all', 'timber', 'fixings', 'concrete', 'roofing', 'fencing', 'general'];
const UNITS = ['each', 'linear_m', 'sq_m', 'kg', 'box', 'bag'];

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'general', unit: 'each', defaultPrice: '', wasteFactor: '1.1', supplierNotes: '',
  });

  useEffect(() => { loadMaterials(); }, [filter, search]);

  async function loadMaterials() {
    let all = await db.materials.toArray();
    if (filter !== 'all') all = all.filter(m => m.category === filter);
    if (search) all = all.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    all.sort((a, b) => a.name.localeCompare(b.name));
    setMaterials(all);
  }

  async function savePrice(id) {
    const cents = parseDollarsTocents(editPrice);
    await db.materials.update(id, { userPrice: cents || null });
    setEditing(null);
    loadMaterials();
  }

  async function addMaterial() {
    if (!form.name.trim()) { alert('Please enter a name'); return; }
    const price = parseDollarsTocents(form.defaultPrice);
    await db.materials.add({
      id: uuid(),
      name: form.name,
      category: form.category,
      unit: form.unit,
      defaultPrice: price,
      userPrice: null,
      supplier: '',
      wasteFactor: parseFloat(form.wasteFactor) || 1.1,
      supplierNotes: form.supplierNotes,
      isCustom: true,
    });
    setForm({ name: '', category: 'general', unit: 'each', defaultPrice: '', wasteFactor: '1.1', supplierNotes: '' });
    setShowForm(false);
    loadMaterials();
  }

  async function deleteMaterial(id) {
    if (!confirm('Delete this custom material?')) return;
    await db.materials.delete(id);
    loadMaterials();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Materials</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Material'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>New Material</h3>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 90x45 Treated Pine" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                {UNITS.map(u => <option key={u} value={u}>{u.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Price ($)</label>
              <input type="number" value={form.defaultPrice} onChange={e => setForm(f => ({ ...f, defaultPrice: e.target.value }))}
                placeholder="0.00" />
            </div>
            <div className="form-group">
              <label>Waste Factor</label>
              <select value={form.wasteFactor} onChange={e => setForm(f => ({ ...f, wasteFactor: e.target.value }))}>
                <option value="1.0">0%</option>
                <option value="1.05">5%</option>
                <option value="1.1">10%</option>
                <option value="1.15">15%</option>
                <option value="1.2">20%</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Supplier Notes</label>
            <input value={form.supplierNotes} onChange={e => setForm(f => ({ ...f, supplierNotes: e.target.value }))}
              placeholder="e.g. Cheapest at Bunnings" />
          </div>
          <button className="btn btn-primary btn-block" onClick={addMaterial}>Save Material</button>
        </div>
      )}

      <div className="form-group">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search materials..." />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {CATEGORIES.map(c => (
          <button key={c} className={`btn ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: 13, flexShrink: 0 }}
            onClick={() => setFilter(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      <div className="list-gap">
        {materials.map(m => (
          <div key={m.id} className="card card-clickable" onClick={() => { setEditing(m.id); setEditPrice(((m.userPrice ?? m.defaultPrice) / 100).toFixed(2)); }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{m.category} &middot; per {m.unit.replace('_', ' ')}</div>
                {m.supplierNotes && <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 2 }}>{m.supplierNotes}</div>}
              </div>
              {editing === m.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                    style={{ width: 100, textAlign: 'right', fontSize: 16 }} autoFocus
                    onKeyDown={e => e.key === 'Enter' && savePrice(m.id)} />
                  <button className="btn btn-primary" style={{ padding: '8px 12px' }} onClick={() => savePrice(m.id)}>Save</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="money" style={{ fontWeight: 600 }}>{formatCents(m.userPrice ?? m.defaultPrice)}</div>
                    {m.userPrice && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>{formatCents(m.defaultPrice)}</div>}
                  </div>
                  {m.isCustom && (
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); deleteMaterial(m.id); }}>x</button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
