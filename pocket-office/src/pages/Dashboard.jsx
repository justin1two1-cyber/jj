import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeJobs: 0,
    pendingQuotes: 0,
    monthExpenses: 0,
    monthIncome: 0,
  });
  const [recentQuotes, setRecentQuotes] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [activeJobs, pendingQuotes, expenses, quotes] = await Promise.all([
      db.jobs.where('status').anyOf('in_progress', 'scheduled').count(),
      db.quotes.where('status').equals('sent').count(),
      db.expenses.where('date').aboveOrEqual(monthStart.slice(0, 10)).toArray(),
      db.quotes.orderBy('createdAt').reverse().limit(5).toArray(),
    ]);

    const monthExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const paidInvoices = await db.invoices
      .where('status').equals('paid')
      .toArray();
    const monthIncome = paidInvoices
      .filter(inv => inv.datePaid && inv.datePaid >= monthStart.slice(0, 10))
      .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    setStats({ activeJobs, pendingQuotes, monthExpenses, monthIncome });
    setRecentQuotes(quotes);

    const recentExp = await db.expenses.orderBy('createdAt').reverse().limit(5).toArray();
    setRecentExpenses(recentExp);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-card-label">Active Jobs</span>
          <span className="stat-card-value">{stats.activeJobs}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Pending Quotes</span>
          <span className="stat-card-value">{stats.pendingQuotes}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">This Month Expenses</span>
          <span className="stat-card-value money">{formatCents(stats.monthExpenses)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">This Month Income</span>
          <span className="stat-card-value money money-positive">{formatCents(stats.monthIncome)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '24px', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <section>
          <div className="page-header">
            <h2>Recent Quotes</h2>
            <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}>+ New Quote</button>
          </div>
          {recentQuotes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✎</div>
              <p>No quotes yet</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>Tap "New Quote" to create your first quote</p>
            </div>
          ) : (
            <div className="list-gap">
              {recentQuotes.map(q => (
                <div key={q.id} className="card card-clickable" onClick={() => navigate(`/quotes/${q.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{q.clientName || 'Untitled'}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{q.quoteNumber}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="money" style={{ fontWeight: 600 }}>{formatCents(q.totalPrice)}</div>
                      <span className={`badge badge-${q.status}`}>{q.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="page-header">
            <h2>Recent Expenses</h2>
            <button className="btn btn-secondary" onClick={() => navigate('/expenses/new')}>+ Log Expense</button>
          </div>
          {recentExpenses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{'\u{1F4B3}'}</div>
              <p>No expenses logged</p>
              <p style={{ fontSize: 14, marginTop: 8 }}>Snap a receipt to get started</p>
            </div>
          ) : (
            <div className="list-gap">
              {recentExpenses.map(e => (
                <div key={e.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{e.description || e.category}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{e.date}</div>
                    </div>
                    <div className="money" style={{ fontWeight: 600 }}>{formatCents(e.amount)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <button className="fab" onClick={() => navigate('/quotes/new')} title="New Quote">+</button>
    </div>
  );
}
