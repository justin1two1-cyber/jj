import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db, getNextNumber, getAllSettings } from '../db';
import { formatCents, parseDollarsTocents } from '../utils/formatCurrency';

export default function NewInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetJobId = searchParams.get('jobId') || '';
  const [settings, setSettings] = useState({});
  const [jobs, setJobs] = useState([]);
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    jobId: presetJobId,
    clientName: '',
    clientEmail: '',
    lineItems: [{ description: '', quantity: 1, amount: '' }],
  });

  useEffect(() => {
    async function load() {
      const [setts, allJobs, allClients] = await Promise.all([
        getAllSettings(),
        db.jobs.toArray(),
        db.clients.toArray(),
      ]);
      setSettings(setts);
      setJobs(allJobs);
      setClients(allClients);

      if (presetJobId) {
        const job = allJobs.find(j => j.id === presetJobId);
        if (job) {
          const variations = await db.variations.where('jobId').equals(presetJobId).toArray();
          const approvedVars = variations.filter(v => v.status === 'approved');
          const items = [
            { description: `${job.jobNumber} - ${job.clientName} (quoted work)`, quantity: 1, amount: ((job.totalQuoted || 0) / 100).toFixed(2) },
          ];
          approvedVars.forEach(v => {
            items.push({ description: `Variation ${v.variationNumber}: ${v.description}`, quantity: 1, amount: ((v.amount || 0) / 100).toFixed(2) });
          });
          setForm(f => ({
            ...f,
            clientName: job.clientName || '',
            lineItems: items,
          }));
        }
      }
    }
    load();
  }, [presetJobId]);

  function addLineItem() {
    setForm(f => ({ ...f, lineItems: [...f.lineItems, { description: '', quantity: 1, amount: '' }] }));
  }

  function updateLineItem(index, field, value) {
    setForm(f => ({
      ...f,
      lineItems: f.lineItems.map((item, i) => i === index ? { ...item, [field]: value } : item),
    }));
  }

  function removeLineItem(index) {
    setForm(f => ({ ...f, lineItems: f.lineItems.filter((_, i) => i !== index) }));
  }

  function selectJob(jobId) {
    setForm(f => ({ ...f, jobId }));
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      setForm(f => ({ ...f, clientName: job.clientName || f.clientName }));
    }
  }

  const subtotal = form.lineItems.reduce((s, item) => s + parseDollarsTocents(item.amount) * (parseInt(item.quantity) || 1), 0);
  const taxRate = settings.taxRate || 10;
  const gstAmount = Math.round(subtotal * (taxRate / 100));
  const totalAmount = subtotal + gstAmount;

  async function save() {
    if (subtotal <= 0) { alert('Please add at least one line item with an amount'); return; }

    const invoiceNumber = await getNextNumber('INV');
    const now = new Date().toISOString();
    const paymentTerms = settings.paymentTermsDays || 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentTerms);

    const client = clients.find(c => c.name === form.clientName);

    const invoice = {
      id: uuid(),
      jobId: form.jobId || null,
      clientId: client?.id || null,
      quoteId: null,
      invoiceNumber,
      clientName: form.clientName,
      lineItems: form.lineItems.map(item => ({
        description: item.description,
        quantity: parseInt(item.quantity) || 1,
        amount: parseDollarsTocents(item.amount),
        gstAmount: Math.round(parseDollarsTocents(item.amount) * (parseInt(item.quantity) || 1) * (taxRate / 100)),
      })),
      subtotal,
      gstAmount,
      totalAmount,
      status: 'draft',
      dateSent: null,
      dateDue: dueDate.toISOString().slice(0, 10),
      datePaid: null,
      remindersSent: 0,
      lastReminderDate: null,
      notes: '',
      createdAt: now,
      syncedAt: null,
    };

    await db.invoices.add(invoice);

    if (form.jobId) {
      await db.jobs.update(form.jobId, { totalIncome: totalAmount, updatedAt: now });
    }

    navigate(`/invoices/${invoice.id}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>New Invoice</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>

      <div style={{ maxWidth: 600 }}>
        <div className="form-row">
          <div className="form-group">
            <label>Client Name</label>
            <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              placeholder="Client name" />
          </div>
          <div className="form-group">
            <label>Link to Job</label>
            <select value={form.jobId} onChange={e => selectJob(e.target.value)}>
              <option value="">No job</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</option>
              ))}
            </select>
          </div>
        </div>

        <h3 style={{ margin: '20px 0 12px' }}>Line Items</h3>
        {form.lineItems.map((item, i) => (
          <div key={i} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input value={item.description} onChange={e => updateLineItem(i, 'description', e.target.value)}
                  placeholder="Description" style={{ marginBottom: 8 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" value={item.quantity} onChange={e => updateLineItem(i, 'quantity', e.target.value)}
                    placeholder="Qty" style={{ width: 80 }} />
                  <input type="number" value={item.amount} onChange={e => updateLineItem(i, 'amount', e.target.value)}
                    placeholder="Amount ($)" style={{ flex: 1 }} />
                </div>
              </div>
              {form.lineItems.length > 1 && (
                <button className="btn btn-secondary" style={{ padding: '8px', fontSize: 14 }}
                  onClick={() => removeLineItem(i)}>x</button>
              )}
            </div>
          </div>
        ))}
        <button className="btn btn-secondary btn-block" style={{ marginBottom: 20 }} onClick={addLineItem}>
          + Add Line Item
        </button>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Subtotal</span>
            <span className="money">{formatCents(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>GST ({taxRate}%)</span>
            <span className="money">{formatCents(gstAmount)}</span>
          </div>
          <div style={{ borderTop: '2px solid var(--color-primary)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 22 }}>
            <span>TOTAL</span>
            <span className="money">{formatCents(totalAmount)}</span>
          </div>
        </div>

        <button className="btn btn-primary btn-lg btn-block" onClick={save}>Save Invoice</button>
      </div>
    </div>
  );
}
