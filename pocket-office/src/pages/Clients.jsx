import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadClients();
  }, [search]);

  async function loadClients() {
    let all = await db.clients.orderBy('name').toArray();
    if (search) {
      all = all.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
      );
    }
    setClients(all);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clients</h1>
        <button className="btn btn-primary" onClick={() => navigate('/clients/new')}>+ Add Client</button>
      </div>

      <div className="form-group">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." />
      </div>

      {clients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <p>{search ? 'No clients match your search' : 'No clients yet'}</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Clients are auto-created when you save quotes</p>
        </div>
      ) : (
        <div className="list-gap">
          {clients.map(c => (
            <div key={c.id} className="card card-clickable" onClick={() => navigate(`/clients/${c.id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {c.phone || 'No phone'} {c.email ? ` · ${c.email}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {c.isRepeatClient && <span className="badge badge-accepted" style={{ fontSize: 10 }}>Repeat</span>}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} onClick={e => e.stopPropagation()}
                      className="btn btn-icon" style={{ width: 36, height: 36, fontSize: 16 }}>
                      📞
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
