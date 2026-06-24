import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db } from '../db';

export default function TimeLog() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    jobId: '',
    date: new Date().toISOString().slice(0, 10),
    travelStartTime: '',
    arrivedTime: '',
    departedTime: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [allLogs, allJobs] = await Promise.all([
      db.timeLog.orderBy('date').reverse().toArray(),
      db.jobs.toArray(),
    ]);
    setLogs(allLogs);
    setJobs(allJobs);
  }

  function calcMinutes(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  async function saveLog() {
    if (!form.jobId) { alert('Please select a job'); return; }

    const travelMinutes = calcMinutes(form.travelStartTime, form.arrivedTime);
    const onSiteMinutes = calcMinutes(form.arrivedTime, form.departedTime);
    const now = new Date().toISOString();

    const log = {
      id: uuid(),
      jobId: form.jobId,
      date: form.date,
      travelStartTime: form.travelStartTime,
      arrivedTime: form.arrivedTime,
      departedTime: form.departedTime,
      travelMinutes: Math.max(0, travelMinutes),
      onSiteMinutes: Math.max(0, onSiteMinutes),
      startCoords: null,
      siteCoords: null,
      distanceKm: 0,
      autoDetected: false,
      notes: form.notes,
      createdAt: now,
      syncedAt: null,
    };

    await db.timeLog.add(log);
    setForm({ jobId: '', date: new Date().toISOString().slice(0, 10), travelStartTime: '', arrivedTime: '', departedTime: '', notes: '' });
    setShowForm(false);
    loadData();
  }

  async function deleteLog(logId) {
    if (!confirm('Delete this time entry?')) return;
    await db.timeLog.delete(logId);
    loadData();
  }

  const totalOnSite = logs.reduce((s, l) => s + (l.onSiteMinutes || 0), 0);
  const totalTravel = logs.reduce((s, l) => s + (l.travelMinutes || 0), 0);

  function formatMinutes(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  const jobMap = {};
  jobs.forEach(j => { jobMap[j.id] = j; });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Time Log</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Log Time'}
        </button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Entries</span>
          <span className="stat-card-value">{logs.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">On-Site</span>
          <span className="stat-card-value" style={{ fontSize: 20 }}>{formatMinutes(totalOnSite)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Travel</span>
          <span className="stat-card-value" style={{ fontSize: 20 }}>{formatMinutes(totalTravel)}</span>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Log Time</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Job</label>
              <select value={form.jobId} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}>
                <option value="">Select job...</option>
                {jobs.map(j => (
                  <option key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Left Home</label>
              <input type="time" value={form.travelStartTime}
                onChange={e => setForm(f => ({ ...f, travelStartTime: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Arrived Site</label>
              <input type="time" value={form.arrivedTime}
                onChange={e => setForm(f => ({ ...f, arrivedTime: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Left Site</label>
              <input type="time" value={form.departedTime}
                onChange={e => setForm(f => ({ ...f, departedTime: e.target.value }))} />
            </div>
          </div>
          {form.travelStartTime && form.arrivedTime && (
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Travel: {formatMinutes(calcMinutes(form.travelStartTime, form.arrivedTime))}
              {form.departedTime && ` · On-site: ${formatMinutes(calcMinutes(form.arrivedTime, form.departedTime))}`}
            </div>
          )}
          <div className="form-group">
            <label>Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes" />
          </div>
          <button className="btn btn-primary btn-block" onClick={saveLog}>Save</button>
        </div>
      )}

      {logs.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏱</div>
          <p>No time entries yet</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Log when you arrive and leave job sites</p>
        </div>
      ) : (
        <div className="list-gap">
          {logs.map(l => {
            const job = jobMap[l.jobId];
            return (
              <div key={l.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{job ? `${job.jobNumber} - ${job.clientName}` : 'Unknown Job'}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {l.date}
                      {l.travelStartTime && ` · Left ${l.travelStartTime}`}
                      {l.arrivedTime && ` · Arrived ${l.arrivedTime}`}
                      {l.departedTime && ` · Left ${l.departedTime}`}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {l.travelMinutes > 0 && `Travel: ${formatMinutes(l.travelMinutes)}`}
                      {l.onSiteMinutes > 0 && ` · On-site: ${formatMinutes(l.onSiteMinutes)}`}
                      {l.autoDetected && ' · GPS'}
                    </div>
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => deleteLog(l.id)}>x</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
