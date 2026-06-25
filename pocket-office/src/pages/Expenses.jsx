import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, getPhoto } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function Expenses() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [filter, setFilter] = useState('all');
  const [viewingReceipt, setViewingReceipt] = useState(null);

  useEffect(() => {
    db.expenses.orderBy('createdAt').reverse().toArray().then(all => {
      setExpenses(filter === 'all' ? all : all.filter(e => e.category === filter));
    });
  }, [filter]);

  async function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    const exp = expenses.find(e => e.id === id);
    await db.expenses.delete(id);
    if (exp?.jobId) {
      const remaining = await db.expenses.where('jobId').equals(exp.jobId).toArray();
      const total = remaining.reduce((s, e) => s + (e.amount || 0), 0);
      await db.jobs.update(exp.jobId, { totalExpenses: total, updatedAt: new Date().toISOString() });
    }
    setExpenses(prev => prev.filter(e => e.id !== id));
  }

  async function viewReceipt(receiptKey) {
    if (!receiptKey) return;
    const blob = await getPhoto(receiptKey);
    if (blob) {
      setViewingReceipt(URL.createObjectURL(blob));
    } else {
      alert('Receipt photo not found');
    }
  }

  const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const gstTotal = expenses.reduce((sum, e) => sum + (e.gstAmount || 0), 0);

  const categories = ['all', 'materials', 'fuel', 'tools', 'subcontractor', 'food', 'insurance', 'rego', 'other'];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Expenses</h1>
        <button className="btn btn-primary" onClick={() => navigate('/expenses/new')}>+ Log Expense</button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="stat-card">
          <span className="stat-card-label">Total</span>
          <span className="stat-card-value money">{formatCents(total)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">GST Claimed</span>
          <span className="stat-card-value money">{formatCents(gstTotal)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {categories.map(c => (
          <button key={c} className={`btn ${filter === c ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: 13, flexShrink: 0 }}
            onClick={() => setFilter(c)}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {expenses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{'\u{1F4B3}'}</div>
          <p>No expenses logged</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/expenses/new')}>
            Log Your First Expense
          </button>
        </div>
      ) : (
        <div className="list-gap">
          {expenses.map(e => (
            <div key={e.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{e.description || e.category}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {e.date} &middot; {e.category} {e.supplier ? `· ${e.supplier}` : ''}
                  </div>
                  {e.receiptPhoto && (
                    <button onClick={() => viewReceipt(e.receiptPhoto)}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 12, padding: 0, marginTop: 4, cursor: 'pointer' }}>
                      View Receipt
                    </button>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <div className="money" style={{ fontWeight: 600 }}>{formatCents(e.amount)}</div>
                    {e.gstIncluded && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>inc. GST {formatCents(e.gstAmount)}</div>}
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => deleteExpense(e.id)}>x</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={() => navigate('/expenses/new')} title="Log Expense">+</button>

      {viewingReceipt && (
        <div onClick={() => { URL.revokeObjectURL(viewingReceipt); setViewingReceipt(null); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'pointer',
          }}>
          <img src={viewingReceipt} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
