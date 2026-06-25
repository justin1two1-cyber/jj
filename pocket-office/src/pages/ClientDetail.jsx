import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    loadClient();
  }, [id]);

  async function loadClient() {
    const c = await db.clients.get(id);
    if (!c) return;
    setClient(c);
    setForm(c);

    const [q, j, inv] = await Promise.all([
      db.quotes.where('clientId').equals(id).toArray(),
      db.jobs.where('clientId').equals(id).toArray(),
      db.invoices.where('clientId').equals(id).toArray(),
    ]);
    setQuotes(q);
    setJobs(j);
    setInvoices(inv.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)));

    const jobIds = j.map(jb => jb.id);
    if (jobIds.length > 0) {
      const exps = await db.expenses.toArray();
      setExpenses(exps.filter(e => jobIds.includes(e.jobId)));
    }
  }

  async function saveClient() {
    const now = new Date().toISOString();
    await db.clients.update(id, { ...form, updatedAt: now });
    setClient({ ...form, updatedAt: now });
    setEditing(false);
  }

  async function toggleRepeat() {
    const isRepeat = !client.isRepeatClient;
    await db.clients.update(id, { isRepeatClient: isRepeat, updatedAt: new Date().toISOString() });
    setClient({ ...client, isRepeatClient: isRepeat });
    setForm({ ...form, isRepeatClient: isRepeat });
  }

  async function deleteClient() {
    if (!confirm('Delete this client? This will not delete their quotes or jobs.')) return;
    await db.clients.delete(id);
    navigate('/clients');
  }

  if (!client) return <div className="page"><p>Loading...</p></div>;

  const totalQuoted = quotes.reduce((s, q) => s + (q.totalPrice || 0), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>{client.name}</h1>
        <button className="btn btn-secondary" onClick={() => navigate('/clients')}>Back</button>
      </div>

      {!editing ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {client.phone && <p>📞 <a href={`tel:${client.phone}`}>{client.phone}</a></p>}
              {client.email && <p>✉ <a href={`mailto:${client.email}`}>{client.email}</a></p>}
              {client.address && <p>📍 {client.address}</p>}
              {client.notes && <p style={{ marginTop: 8, color: 'var(--color-text-secondary)' }}>{client.notes}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" style={{ padding: '8px 14px' }} onClick={() => setEditing(true)}>Edit</button>
              <button className={`btn ${client.isRepeatClient ? 'btn-success' : 'btn-secondary'}`}
                style={{ padding: '8px 14px' }} onClick={toggleRepeat}>
                {client.isRepeatClient ? 'Repeat ✓' : 'Mark Repeat'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label>Name</label>
            <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3}
              style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveClient}>Save</button>
            <button className="btn btn-secondary" onClick={() => { setEditing(false); setForm(client); }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Quotes</span>
          <span className="stat-card-value">{quotes.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Total Quoted</span>
          <span className="stat-card-value money" style={{ fontSize: 18 }}>{formatCents(totalQuoted)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Jobs</span>
          <span className="stat-card-value">{jobs.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Paid</span>
          <span className="stat-card-value money money-positive" style={{ fontSize: 18 }}>{formatCents(totalPaid)}</span>
        </div>
      </div>

      {quotes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 12 }}>Quotes</h2>
          <div className="list-gap">
            {quotes.map(q => (
              <div key={q.id} className="card card-clickable" onClick={() => navigate(`/quotes/${q.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{q.quoteNumber}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{q.siteAddress}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="money">{formatCents(q.totalPrice)}</div>
                    <span className={`badge badge-${q.status}`}>{q.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {jobs.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 12 }}>Jobs</h2>
          <div className="list-gap">
            {jobs.map(j => (
              <div key={j.id} className="card card-clickable" onClick={() => navigate(`/jobs/${j.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{j.jobNumber}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{j.siteAddress}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="money">{formatCents(j.totalQuoted)}</div>
                    <span className={`badge badge-${j.status === 'in_progress' ? 'active' : j.status}`}>{j.status.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {invoices.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 12 }}>Invoices</h2>
          <div className="list-gap">
            {invoices.map(inv => (
              <div key={inv.id} className="card card-clickable" onClick={() => navigate(`/invoices/${inv.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{inv.invoiceNumber}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {inv.dateSent || 'Not sent'} · Due: {inv.dateDue || 'N/A'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="money">{formatCents(inv.totalAmount)}</div>
                    <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button className="btn btn-primary" onClick={() => navigate('/quotes/new')}>New Quote</button>
        <button className="btn btn-secondary" onClick={() => navigate(`/invoices/new`)}>New Invoice</button>
        <button className="btn btn-danger" onClick={deleteClient}>Delete Client</button>
      </div>
    </div>
  );
}
