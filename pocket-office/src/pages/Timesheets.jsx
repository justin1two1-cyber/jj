import { useState, useEffect } from 'react';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function Timesheets() {
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('this_week');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { loadData(); }, [filterEmployee, filterPeriod]);

  function getDateRange() {
    const now = new Date();
    let start;
    switch (filterPeriod) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'this_week': {
        const day = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
        break;
      }
      case 'last_week': {
        const day = now.getDay();
        const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
        start = new Date(thisMonday);
        start.setDate(start.getDate() - 7);
        const end = new Date(thisMonday);
        end.setDate(end.getDate() - 1);
        return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
      }
      case 'this_fortnight': {
        const day = now.getDay();
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1) - 7);
        break;
      }
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        start = new Date(2000, 0, 1);
    }
    return { start: start.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
  }

  async function loadData() {
    const [allEntries, allEmployees, allJobs] = await Promise.all([
      db.timesheets.toArray(),
      db.employees.toArray(),
      db.jobs.toArray(),
    ]);
    setEmployees(allEmployees);
    setJobs(allJobs);

    const { start, end } = getDateRange();
    let filtered = allEntries.filter(e => e.date >= start && e.date <= end);
    if (filterEmployee !== 'all') filtered = filtered.filter(e => e.employeeId === filterEmployee);
    filtered.sort((a, b) => b.date.localeCompare(a.date) || b.clockIn?.localeCompare(a.clockIn));
    setEntries(filtered);
  }

  function getEmployeeName(id) {
    return employees.find(e => e.id === id)?.name || 'Unknown';
  }

  function getJobLabel(id) {
    if (!id) return null;
    const job = jobs.find(j => j.id === id);
    return job ? `${job.jobNumber} - ${job.clientName}` : null;
  }

  function fmtMins(mins) {
    if (!mins) return '0h 0m';
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function formatTime(iso) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  }

  const empMap = {};
  entries.forEach(e => {
    if (!empMap[e.employeeId]) empMap[e.employeeId] = { worked: 0, breaks: 0, total: 0, days: new Set(), entries: 0 };
    empMap[e.employeeId].worked += e.workedMinutes || 0;
    empMap[e.employeeId].breaks += e.breakMinutes || 0;
    empMap[e.employeeId].total += e.totalMinutes || 0;
    empMap[e.employeeId].days.add(e.date);
    empMap[e.employeeId].entries += 1;
  });

  const totalWorked = entries.reduce((s, e) => s + (e.workedMinutes || 0), 0);
  const totalBreak = entries.reduce((s, e) => s + (e.breakMinutes || 0), 0);

  const empSummaries = Object.entries(empMap).map(([empId, data]) => {
    const emp = employees.find(e => e.id === empId);
    const cost = emp?.hourlyRate ? Math.round((data.worked / 60) * emp.hourlyRate) : 0;
    return { empId, name: emp?.name || 'Unknown', role: emp?.role || '', ...data, daysCount: data.days.size, cost };
  }).sort((a, b) => b.worked - a.worked);

  const totalCost = empSummaries.reduce((s, e) => s + e.cost, 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Timesheets</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto' }}>
        {[
          { v: 'today', l: 'Today' }, { v: 'this_week', l: 'This Week' },
          { v: 'last_week', l: 'Last Week' }, { v: 'this_fortnight', l: 'Fortnight' },
          { v: 'this_month', l: 'This Month' }, { v: 'all', l: 'All Time' },
        ].map(p => (
          <button key={p.v} className={`btn ${filterPeriod === p.v ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: 13, flexShrink: 0 }}
            onClick={() => setFilterPeriod(p.v)}>
            {p.l}
          </button>
        ))}
      </div>

      <div className="form-group" style={{ maxWidth: 250, marginBottom: 16 }}>
        <label>Employee</label>
        <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
          <option value="all">All Employees</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Total Worked</span>
          <span className="stat-card-value" style={{ fontSize: 20 }}>{fmtMins(totalWorked)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Breaks</span>
          <span className="stat-card-value" style={{ fontSize: 20 }}>{fmtMins(totalBreak)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Entries</span>
          <span className="stat-card-value">{entries.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Labour Cost</span>
          <span className="stat-card-value money" style={{ fontSize: 20 }}>{formatCents(totalCost)}</span>
        </div>
      </div>

      {empSummaries.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 8 }}>By Employee</h3>
          <div className="list-gap">
            {empSummaries.map(s => (
              <div key={s.empId} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {s.role} · {s.daysCount} day{s.daysCount !== 1 ? 's' : ''} · {s.entries} shift{s.entries !== 1 ? 's' : ''}
                    {s.breaks > 0 ? ` · ${fmtMins(s.breaks)} break` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{fmtMins(s.worked)}</div>
                  {s.cost > 0 && <div className="money" style={{ fontSize: 13 }}>{formatCents(s.cost)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: 8 }}>Shift Details</h3>
      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No timesheet entries for this period</p>
        </div>
      ) : (
        <div className="list-gap">
          {entries.map(entry => {
            const expanded = expandedId === entry.id;
            const jobLabel = getJobLabel(entry.jobId);
            return (
              <div key={entry.id} className="card card-clickable" onClick={() => setExpandedId(expanded ? null : entry.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{getEmployeeName(entry.employeeId)}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {entry.date} · {formatTime(entry.clockIn)} → {formatTime(entry.clockOut)}
                      {jobLabel && ` · ${jobLabel}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700 }}>{fmtMins(entry.workedMinutes)}</div>
                    <span className={`badge ${entry.status === 'completed' ? 'badge-accepted' : entry.status === 'clocked_in' ? 'badge-sent' : 'badge-draft'}`}>
                      {entry.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                {expanded && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)', fontSize: 13 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div>
                        <div style={{ color: 'var(--color-text-muted)' }}>Total Time</div>
                        <div style={{ fontWeight: 600 }}>{fmtMins(entry.totalMinutes)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-muted)' }}>Worked</div>
                        <div style={{ fontWeight: 600, color: 'var(--color-success)' }}>{fmtMins(entry.workedMinutes)}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--color-text-muted)' }}>Breaks</div>
                        <div style={{ fontWeight: 600 }}>{fmtMins(entry.breakMinutes)}</div>
                      </div>
                    </div>
                    {(entry.breaks || []).length > 0 && (
                      <div>
                        <div style={{ color: 'var(--color-text-muted)', marginBottom: 4 }}>Break Log:</div>
                        {entry.breaks.map((b, i) => (
                          <div key={i} style={{ marginBottom: 2, paddingLeft: 8, borderLeft: '2px solid var(--color-border)' }}>
                            {formatTime(b.start)} → {formatTime(b.end)}
                            {b.note && <span style={{ color: 'var(--color-text-muted)' }}> — {b.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {entry.notes && (
                      <div style={{ marginTop: 8, color: 'var(--color-text-secondary)' }}>{entry.notes}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
