import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    async function load() {
      const j = await db.jobs.get(id);
      setJob(j);
      if (j) {
        const exps = await db.expenses.where('jobId').equals(id).toArray();
        setExpenses(exps);
      }
    }
    load();
  }, [id]);

  if (!job) return <div className="page"><p>Loading...</p></div>;

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = (job.totalQuoted || 0) - totalExpenses;

  async function updateStatus(status) {
    const updates = { status, updatedAt: new Date().toISOString() };
    if (status === 'in_progress' && !job.startDate) updates.startDate = new Date().toISOString().slice(0, 10);
    if (status === 'complete') updates.endDate = new Date().toISOString().slice(0, 10);
    await db.jobs.update(id, updates);
    setJob({ ...job, ...updates });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{job.jobNumber}</h1>
          <span className={`badge badge-${job.status === 'in_progress' ? 'active' : job.status}`}>{job.status.replace('_', ' ')}</span>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/jobs')}>Back</button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Quoted</span>
          <span className="stat-card-value money">{formatCents(job.totalQuoted)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Expenses</span>
          <span className="stat-card-value money money-negative">{formatCents(totalExpenses)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Profit</span>
          <span className={`stat-card-value money ${profit >= 0 ? 'money-positive' : 'money-negative'}`}>{formatCents(profit)}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Client</h3>
        <p>{job.clientName}</p>
        <p style={{ color: 'var(--color-text-secondary)' }}>{job.siteAddress}</p>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="page-header">
          <h2>Expenses ({expenses.length})</h2>
          <button className="btn btn-secondary" onClick={() => navigate(`/expenses/new?jobId=${id}`)}>+ Add</button>
        </div>
        {expenses.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No expenses logged for this job</p>
        ) : (
          <div className="list-gap">
            {expenses.map(e => (
              <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.description || e.category}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{e.date}</div>
                </div>
                <span className="money" style={{ fontWeight: 600 }}>{formatCents(e.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        {job.status === 'scheduled' && <button className="btn btn-primary btn-lg" onClick={() => updateStatus('in_progress')}>Start Job</button>}
        {job.status === 'in_progress' && <button className="btn btn-success btn-lg" onClick={() => updateStatus('complete')}>Complete Job</button>}
        {job.quoteId && <button className="btn btn-secondary btn-lg" onClick={() => navigate(`/quotes/${job.quoteId}`)}>View Quote</button>}
      </div>
    </div>
  );
}
