import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db } from '../db';

export default function NewClient() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '', notes: '',
  });

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function save() {
    if (!form.name.trim()) { alert('Please enter a name'); return; }
    const now = new Date().toISOString();
    const client = {
      id: uuid(),
      ...form,
      isRepeatClient: false,
      preferredRates: null,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };
    await db.clients.add(client);
    navigate(`/clients/${client.id}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Add Client</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>
      <div style={{ maxWidth: 500 }}>
        <div className="form-group">
          <label>Name</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Client name" autoFocus />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="0400 000 000" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@example.com" />
          </div>
        </div>
        <div className="form-group">
          <label>Address</label>
          <input value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Builder St, Melbourne VIC" />
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
            placeholder="Any notes about this client..." style={{ width: '100%', resize: 'vertical' }} />
        </div>
        <button className="btn btn-primary btn-lg btn-block" onClick={save}>Save Client</button>
      </div>
    </div>
  );
}
