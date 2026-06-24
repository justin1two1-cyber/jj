import { useState, useEffect } from 'react';
import { db } from '../db';
import { formatCents, parseDollarsTocents } from '../utils/formatCurrency';

const CATEGORIES = ['all', 'timber', 'fixings', 'concrete', 'roofing', 'fencing', 'general'];

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [editPrice, setEditPrice] = useState('');

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

  return (
    <div className="page">
      <div className="page-header"><h1>Materials</h1></div>

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
                <div style={{ textAlign: 'right' }}>
                  <div className="money" style={{ fontWeight: 600 }}>{formatCents(m.userPrice ?? m.defaultPrice)}</div>
                  {m.userPrice && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>{formatCents(m.defaultPrice)}</div>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
