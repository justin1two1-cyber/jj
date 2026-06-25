import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [variations, setVariations] = useState([]);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [photoCount, setPhotoCount] = useState(0);

  useEffect(() => {
    loadJob();
  }, [id]);

  async function loadJob() {
    const j = await db.jobs.get(id);
    setJob(j);
    if (j) {
      const [exps, vars, diary, photos] = await Promise.all([
        db.expenses.where('jobId').equals(id).toArray(),
        db.variations.where('jobId').equals(id).toArray(),
        db.jobDiary.where('jobId').equals(id).toArray(),
        db.jobPhotos.where('jobId').equals(id).count(),
      ]);
      setExpenses(exps);
      setVariations(vars);
      setDiaryEntries(diary.sort((a, b) => (a.date > b.date ? -1 : 1)));
      setPhotoCount(photos);
    }
  }

  if (!job) return <div className="page"><p>Loading...</p></div>;

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const approvedVariations = variations.filter(v => v.status === 'approved');
  const totalVariations = approvedVariations.reduce((s, v) => s + (v.amount || 0), 0);
  const totalIncome = (job.totalQuoted || 0) + totalVariations;
  const profit = totalIncome - totalExpenses;

  async function updateStatus(status) {
    const updates = { status, updatedAt: new Date().toISOString() };
    if (status === 'in_progress' && !job.startDate) updates.startDate = new Date().toISOString().slice(0, 10);
    if (status === 'complete') updates.endDate = new Date().toISOString().slice(0, 10);
    await db.jobs.update(id, updates);
    setJob({ ...job, ...updates });
  }

  const totalDiaryHours = diaryEntries.reduce((s, e) => s + (e.hoursWorked || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{job.jobNumber}</h1>
          <span className={`badge badge-${job.status === 'in_progress' ? 'active' : job.status}`}>
            {job.status.replace('_', ' ')}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/jobs')}>Back</button>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Quoted</span>
          <span className="stat-card-value money" style={{ fontSize: 20 }}>{formatCents(job.totalQuoted)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Variations</span>
          <span className="stat-card-value money" style={{ fontSize: 20 }}>{formatCents(totalVariations)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Expenses</span>
          <span className="stat-card-value money money-negative" style={{ fontSize: 20 }}>{formatCents(totalExpenses)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Profit</span>
          <span className={`stat-card-value money ${profit >= 0 ? 'money-positive' : 'money-negative'}`} style={{ fontSize: 20 }}>
            {formatCents(profit)}
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Client</h3>
        <p>{job.clientName}</p>
        <p style={{ color: 'var(--color-text-secondary)' }}>{job.siteAddress}</p>
        {job.startDate && <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>Started: {job.startDate}</p>}
        {job.endDate && <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Completed: {job.endDate}</p>}
        {totalDiaryHours > 0 && <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Total Hours Logged: {totalDiaryHours.toFixed(1)}</p>}
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
        <div className="card card-clickable" onClick={() => navigate(`/jobs/${id}/variations`)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📋</div>
            <div style={{ fontWeight: 600 }}>Variations</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{variations.length} total</div>
          </div>
        </div>
        <div className="card card-clickable" onClick={() => navigate(`/jobs/${id}/diary`)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📝</div>
            <div style={{ fontWeight: 600 }}>Daily Diary</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{diaryEntries.length} entries</div>
          </div>
        </div>
        <div className="card card-clickable" onClick={() => navigate(`/jobs/${id}/photos`)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📸</div>
            <div style={{ fontWeight: 600 }}>Photos</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{photoCount} photos</div>
          </div>
        </div>
        <div className="card card-clickable" onClick={() => navigate(`/expenses/new?jobId=${id}`)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>💳</div>
            <div style={{ fontWeight: 600 }}>Add Expense</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{expenses.length} logged</div>
          </div>
        </div>
        <div className="card card-clickable" onClick={() => navigate(`/swms?jobId=${id}`)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>⚠</div>
            <div style={{ fontWeight: 600 }}>SWMS</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Safety docs</div>
          </div>
        </div>
      </div>

      {expenses.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 12 }}>Recent Expenses</h2>
          <div className="list-gap">
            {expenses.slice(0, 5).map(e => (
              <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.description || e.category}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{e.date}</div>
                </div>
                <span className="money" style={{ fontWeight: 600 }}>{formatCents(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {diaryEntries.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 12 }}>Recent Diary</h2>
          <div className="list-gap">
            {diaryEntries.slice(0, 3).map(e => (
              <div key={e.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{e.date}</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {e.hoursWorked > 0 ? `${e.hoursWorked}hrs` : ''}
                    {e.weatherConditions ? ` · ${e.weatherConditions}` : ''}
                  </span>
                </div>
                {e.notes && <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{e.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        {job.status === 'scheduled' && <button className="btn btn-primary btn-lg" onClick={() => updateStatus('in_progress')}>Start Job</button>}
        {job.status === 'in_progress' && <button className="btn btn-success btn-lg" onClick={() => updateStatus('complete')}>Complete Job</button>}
        {(job.status === 'complete' || job.status === 'in_progress') && (
          <button className="btn btn-primary btn-lg" onClick={() => navigate(`/invoices/new?jobId=${id}`)}>Create Invoice</button>
        )}
        {job.quoteId && <button className="btn btn-secondary btn-lg" onClick={() => navigate(`/quotes/${job.quoteId}`)}>View Quote</button>}
      </div>
    </div>
  );
}
