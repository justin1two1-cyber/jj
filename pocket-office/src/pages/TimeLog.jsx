import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../db';

export default function TimeLog() {
  const [logs, setLogs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
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
    const saved = localStorage.getItem('po_active_timer');
    if (saved) {
      try { setActiveTimer(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (!activeTimer) return;
    const tick = () => {
      const start = new Date(activeTimer.arrivedTime || activeTimer.travelStartTime).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeTimer]);

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

  function clockIn(jobId) {
    if (!jobId) { alert('Please select a job'); return; }
    const now = new Date();
    const timer = {
      jobId,
      travelStartTime: now.toISOString(),
      arrivedTime: null,
      coords: null,
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          timer.startCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setActiveTimer({ ...timer });
          localStorage.setItem('po_active_timer', JSON.stringify(timer));
        },
        () => {
          setActiveTimer(timer);
          localStorage.setItem('po_active_timer', JSON.stringify(timer));
        }
      );
    } else {
      setActiveTimer(timer);
      localStorage.setItem('po_active_timer', JSON.stringify(timer));
    }
  }

  function markArrived() {
    const updated = { ...activeTimer, arrivedTime: new Date().toISOString() };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updated.siteCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setActiveTimer({ ...updated });
          localStorage.setItem('po_active_timer', JSON.stringify(updated));
        },
        () => {
          setActiveTimer(updated);
          localStorage.setItem('po_active_timer', JSON.stringify(updated));
        }
      );
    } else {
      setActiveTimer(updated);
      localStorage.setItem('po_active_timer', JSON.stringify(updated));
    }
  }

  async function clockOut() {
    const now = new Date();
    const travelStart = activeTimer.travelStartTime ? new Date(activeTimer.travelStartTime) : null;
    const arrived = activeTimer.arrivedTime ? new Date(activeTimer.arrivedTime) : travelStart;
    const travelMinutes = travelStart && arrived && activeTimer.arrivedTime
      ? Math.max(0, Math.round((arrived - travelStart) / 60000))
      : 0;
    const onSiteMinutes = arrived ? Math.max(0, Math.round((now - arrived) / 60000)) : 0;

    const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const log = {
      id: uuid(),
      jobId: activeTimer.jobId,
      date: now.toISOString().slice(0, 10),
      travelStartTime: travelStart ? fmt(travelStart) : '',
      arrivedTime: arrived ? fmt(arrived) : '',
      departedTime: fmt(now),
      travelMinutes,
      onSiteMinutes,
      startCoords: activeTimer.startCoords || null,
      siteCoords: activeTimer.siteCoords || null,
      distanceKm: 0,
      autoDetected: true,
      notes: '',
      createdAt: now.toISOString(),
      syncedAt: null,
    };

    await db.timeLog.add(log);
    setActiveTimer(null);
    localStorage.removeItem('po_active_timer');
    loadData();
  }

  function cancelTimer() {
    setActiveTimer(null);
    localStorage.removeItem('po_active_timer');
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

  function formatSeconds(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const jobMap = {};
  jobs.forEach(j => { jobMap[j.id] = j; });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Time Log</h1>
        {!activeTimer && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Manual'}
            </button>
          </div>
        )}
      </div>

      {!activeTimer && !showForm && (
        <div className="card" style={{ marginBottom: 20, textAlign: 'center', padding: 24 }}>
          <h3 style={{ marginBottom: 12 }}>Clock In</h3>
          <div className="form-group" style={{ maxWidth: 300, margin: '0 auto' }}>
            <select value={form.jobId} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}>
              <option value="">Select job...</option>
              {jobs.filter(j => j.status === 'in_progress' || j.status === 'scheduled').map(j => (
                <option key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-success btn-lg" onClick={() => clockIn(form.jobId)} style={{ minWidth: 200 }}>
            Start Travel
          </button>
        </div>
      )}

      {activeTimer && (
        <div className="card" style={{ marginBottom: 20, textAlign: 'center', borderColor: 'var(--color-success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 10, height: 10, background: 'var(--color-success)', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
              {activeTimer.arrivedTime ? 'On Site' : 'Travelling'}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
            {jobMap[activeTimer.jobId] ? `${jobMap[activeTimer.jobId].jobNumber} - ${jobMap[activeTimer.jobId].clientName}` : 'Unknown Job'}
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: 'tabular-nums', marginBottom: 16 }}>
            {formatSeconds(elapsed)}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {!activeTimer.arrivedTime && (
              <button className="btn btn-primary btn-lg" onClick={markArrived}>Arrived on Site</button>
            )}
            <button className="btn btn-danger btn-lg" onClick={clockOut}>Clock Out</button>
            <button className="btn btn-secondary" onClick={cancelTimer} style={{ padding: '8px 12px' }}>Cancel</button>
          </div>
        </div>
      )}

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
          <h3 style={{ marginBottom: 12 }}>Manual Entry</h3>
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

      {logs.length === 0 && !showForm && !activeTimer ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏱</div>
          <p>No time entries yet</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Clock in when you leave home, mark arrival on site, clock out when done</p>
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
