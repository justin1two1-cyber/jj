import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../db';

const ROLES = ['labourer', 'apprentice', 'tradesman', 'foreman', 'subcontractor'];

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('active');
  const [form, setForm] = useState({
    name: '', phone: '', email: '', role: 'labourer', hourlyRate: '', emergencyContact: '', emergencyPhone: '',
  });

  useEffect(() => { loadEmployees(); }, [filter]);

  async function loadEmployees() {
    let all = await db.employees.toArray();
    if (filter !== 'all') all = all.filter(e => e.status === filter);
    all.sort((a, b) => a.name.localeCompare(b.name));
    setEmployees(all);
  }

  async function saveEmployee() {
    if (!form.name.trim()) { alert('Please enter a name'); return; }
    const now = new Date().toISOString();
    await db.employees.add({
      id: uuid(),
      name: form.name,
      phone: form.phone,
      email: form.email,
      role: form.role,
      hourlyRate: Math.round((parseFloat(form.hourlyRate) || 0) * 100),
      emergencyContact: form.emergencyContact,
      emergencyPhone: form.emergencyPhone,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    setForm({ name: '', phone: '', email: '', role: 'labourer', hourlyRate: '', emergencyContact: '', emergencyPhone: '' });
    setShowForm(false);
    loadEmployees();
  }

  async function toggleStatus(emp) {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    await db.employees.update(emp.id, { status: newStatus, updatedAt: new Date().toISOString() });
    loadEmployees();
  }

  async function deleteEmployee(id) {
    if (!confirm('Delete this employee? Their timesheet records will be kept.')) return;
    await db.employees.delete(id);
    loadEmployees();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Employees</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Employee'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['active', 'inactive', 'all'].map(f => (
          <button key={f} className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>New Employee</h3>
          <div className="form-group">
            <label>Full Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="John Smith" autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="0400 000 000" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="john@email.com" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Hourly Rate ($)</label>
              <input type="number" inputMode="decimal" value={form.hourlyRate}
                onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Emergency Contact</label>
              <input value={form.emergencyContact} onChange={e => setForm(f => ({ ...f, emergencyContact: e.target.value }))}
                placeholder="Name" />
            </div>
            <div className="form-group">
              <label>Emergency Phone</label>
              <input type="tel" value={form.emergencyPhone} onChange={e => setForm(f => ({ ...f, emergencyPhone: e.target.value }))}
                placeholder="0400 000 000" />
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={saveEmployee}>Save Employee</button>
        </div>
      )}

      {employees.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">👷</div>
          <p>No employees added</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Add your crew to track their hours and timesheets</p>
        </div>
      ) : (
        <div className="list-gap">
          {employees.map(emp => (
            <div key={emp.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{emp.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {emp.role.charAt(0).toUpperCase() + emp.role.slice(1)}
                    {emp.hourlyRate ? ` · $${(emp.hourlyRate / 100).toFixed(2)}/hr` : ''}
                    {emp.phone ? ` · ${emp.phone}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${emp.status === 'active' ? 'badge-accepted' : 'badge-declined'}`}>
                    {emp.status}
                  </span>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => toggleStatus(emp)}>
                    {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}
                    onClick={() => deleteEmployee(emp.id)}>x</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
