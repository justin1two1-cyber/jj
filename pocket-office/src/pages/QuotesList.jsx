import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function QuotesList() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { loadQuotes(); }, [filter]);

  async function loadQuotes() {
    let query = db.quotes.orderBy('createdAt').reverse();
    const all = await query.toArray();
    setQuotes(filter === 'all' ? all : all.filter(q => q.status === filter));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Quotes</h1>
        <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}>+ New Quote</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {['all', 'draft', 'sent', 'accepted', 'declined'].map(f => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {quotes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✎</div>
          <p>{filter === 'all' ? 'No quotes yet' : `No ${filter} quotes`}</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/quotes/new')}>
            Create Your First Quote
          </button>
        </div>
      ) : (
        <div className="list-gap">
          {quotes.map(q => (
            <div key={q.id} className="card card-clickable" onClick={() => navigate(`/quotes/${q.id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{q.clientName || 'Untitled Quote'}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {q.quoteNumber} &middot; {q.siteAddress || 'No address'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="money" style={{ fontWeight: 700, fontSize: 18 }}>{formatCents(q.totalPrice)}</div>
                  <span className={`badge badge-${q.status}`}>{q.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => navigate('/quotes/new')} title="New Quote">+</button>
    </div>
  );
}
