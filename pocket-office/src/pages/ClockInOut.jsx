import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../db';

export default function ClockInOut() {
  const [employees, setEmployees] = useState([]);
  const [activeShifts, setActiveShifts] = useState({});
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [breakNote, setBreakNote] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [emps, allJobs, todaySheets] = await Promise.all([
      db.employees.where('status').equals('active').toArray(),
      db.jobs.where('status').anyOf('scheduled', 'in_progress').toArray(),
      db.timesheets.where('date').equals(new Date().toISOString().slice(0, 10)).toArray(),
    ]);
    emps.sort((a, b) => a.name.localeCompare(b.name));
    setEmployees(emps);
    setJobs(allJobs);

    const active = {};
    todaySheets.forEach(ts => {
      if (ts.status === 'clocked_in' || ts.status === 'on_break') {
        active[ts.employeeId] = ts;
      }
    });
    setActiveShifts(active);
  }

  async function clockIn(empId) {
    const now = new Date();
    const entry = {
      id: uuid(),
      employeeId: empId,
      date: now.toISOString().slice(0, 10),
      clockIn: now.toISOString(),
      clockOut: null,
      breaks: [],
      jobId: selectedJob || null,
      totalMinutes: 0,
      breakMinutes: 0,
      workedMinutes: 0,
      status: 'clocked_in',
      notes: '',
      createdAt: now.toISOString(),
    };
    await db.timesheets.add(entry);
    loadData();
  }

  async function clockOut(empId) {
    const shift = activeShifts[empId];
    if (!shift) return;

    const now = new Date();
    const clockInTime = new Date(shift.clockIn);
    const totalMinutes = Math.round((now - clockInTime) / 60000);
    const breakMinutes = (shift.breaks || []).reduce((sum, b) => {
      if (b.end) return sum + Math.round((new Date(b.end) - new Date(b.start)) / 60000);
      return sum + Math.round((now - new Date(b.start)) / 60000);
    }, 0);

    let breaks = shift.breaks || [];
    if (shift.status === 'on_break') {
      breaks = breaks.map((b, i) => i === breaks.length - 1 && !b.end ? { ...b, end: now.toISOString() } : b);
    }

    await db.timesheets.update(shift.id, {
      clockOut: now.toISOString(),
      breaks,
      totalMinutes,
      breakMinutes,
      workedMinutes: totalMinutes - breakMinutes,
      status: 'completed',
    });
    loadData();
  }

  async function startBreak(empId) {
    const shift = activeShifts[empId];
    if (!shift) return;
    const breaks = [...(shift.breaks || []), { start: new Date().toISOString(), end: null, note: breakNote }];
    await db.timesheets.update(shift.id, { breaks, status: 'on_break' });
    setBreakNote('');
    loadData();
  }

  async function endBreak(empId) {
    const shift = activeShifts[empId];
    if (!shift) return;
    const breaks = (shift.breaks || []).map((b, i) =>
      i === shift.breaks.length - 1 && !b.end ? { ...b, end: new Date().toISOString() } : b
    );
    await db.timesheets.update(shift.id, { breaks, status: 'clocked_in' });
    loadData();
  }

  function getElapsedTime(shift) {
    if (!shift?.clockIn) return '0h 0m';
    const start = new Date(shift.clockIn);
    const now = new Date();
    const mins = Math.round((now - start) / 60000);
    const breakMins = (shift.breaks || []).reduce((sum, b) => {
      if (b.end) return sum + Math.round((new Date(b.end) - new Date(b.start)) / 60000);
      return sum + Math.round((now - new Date(b.start)) / 60000);
    }, 0);
    const worked = mins - breakMins;
    return `${Math.floor(worked / 60)}h ${worked % 60}m`;
  }

  function formatTime(iso) {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Clock In / Out</h1>
      </div>

      <div className="form-group" style={{ maxWidth: 300, marginBottom: 20 }}>
        <label>Assign to Job (optional)</label>
        <select value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>
          <option value="">No job</option>
          {jobs.map(j => (
            <option key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</option>
          ))}
        </select>
      </div>

      {employees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👷</div>
          <p>No active employees</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Add employees in the Employees page first</p>
        </div>
      ) : (
        <div className="list-gap">
          {employees.map(emp => {
            const shift = activeShifts[emp.id];
            const isIn = !!shift;
            const onBreak = shift?.status === 'on_break';

            return (
              <div key={emp.id} className="card" style={{
                borderLeft: isIn ? `4px solid ${onBreak ? 'var(--color-warning)' : 'var(--color-success)'}` : '4px solid var(--color-border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{emp.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}
                      {isIn && (
                        <span style={{ marginLeft: 8, color: onBreak ? 'var(--color-warning)' : 'var(--color-success)', fontWeight: 600 }}>
                          {onBreak ? 'ON BREAK' : 'WORKING'} — {getElapsedTime(shift)} worked
                        </span>
                      )}
                    </div>
                    {isIn && (
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Clocked in: {formatTime(shift.clockIn)}
                        {shift.breaks?.length > 0 && ` · ${shift.breaks.length} break${shift.breaks.length > 1 ? 's' : ''}`}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!isIn ? (
                      <button className="btn btn-success" style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700 }}
                        onClick={() => clockIn(emp.id)}>
                        CLOCK IN
                      </button>
                    ) : (
                      <>
                        {!onBreak ? (
                          <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}
                            onClick={() => startBreak(emp.id)}>Break</button>
                        ) : (
                          <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13, borderColor: 'var(--color-warning)' }}
                            onClick={() => endBreak(emp.id)}>End Break</button>
                        )}
                        <button className="btn btn-danger" style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700 }}
                          onClick={() => clockOut(emp.id)}>
                          CLOCK OUT
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          Employees clock in when they start, take breaks, and clock out when done.
          All records appear in the Timesheets page for review.
        </p>
      </div>
    </div>
  );
}
