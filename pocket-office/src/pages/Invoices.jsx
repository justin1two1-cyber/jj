import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    db.invoices.orderBy('createdAt').reverse().toArray().then(async (all) => {
      const today = new Date().toISOString().slice(0, 10);
      const updated = [];
      for (const inv of all) {
        if (inv.status === 'sent' && inv.dateDue && inv.dateDue < today) {
          await db.invoices.update(inv.id, { status: 'overdue' });
          updated.push({ ...inv, status: 'overdue' });
        } else {
          updated.push(inv);
        }
      }
      setInvoices(filter === 'all' ? updated : updated.filter(i => i.status === filter));
    });
  }, [filter]);

  const totalOutstanding = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalPaid = invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Invoices</h1>
        <button className="btn btn-primary" onClick={() => navigate('/invoices/new')}>+ New Invoice</button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Outstanding</span>
          <span className="stat-card-value money money-negative" style={{ fontSize: 20 }}>{formatCents(totalOutstanding)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Paid</span>
          <span className="stat-card-value money money-positive" style={{ fontSize: 20 }}>{formatCents(totalPaid)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {['all', 'draft', 'sent', 'paid', 'overdue'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: 13 }}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <p>{filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/invoices/new')}>
            Create Invoice
          </button>
        </div>
      ) : (
        <div className="list-gap">
          {invoices.map(inv => (
            <div key={inv.id} className="card card-clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {inv.clientName || 'Unknown'} {inv.dateDue ? `· Due ${inv.dateDue}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="money" style={{ fontWeight: 700, fontSize: 18 }}>{formatCents(inv.totalAmount)}</div>
                  <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => navigate('/invoices/new')} title="New Invoice">+</button>
    </div>
  );
}
