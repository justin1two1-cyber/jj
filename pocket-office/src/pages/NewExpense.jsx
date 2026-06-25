import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db, storePhoto } from '../db';
import { parseDollarsTocents } from '../utils/formatCurrency';

const CATEGORIES = ['materials', 'fuel', 'tools', 'subcontractor', 'food', 'insurance', 'rego', 'other'];

export default function NewExpense() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetJobId = searchParams.get('jobId') || '';

  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'materials',
    jobId: presetJobId,
    supplier: '',
    gstIncluded: true,
    taxDeductible: true,
    paymentMethod: 'card',
    date: new Date().toISOString().slice(0, 10),
  });

  const [receiptPhoto, setReceiptPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    db.jobs.where('status').anyOf('in_progress', 'scheduled').toArray().then(setJobs);
  }, []);

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (file) {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      setReceiptPhoto(blob);
      setPhotoPreview(URL.createObjectURL(blob));
    }
  }

  async function save() {
    const amountCents = parseDollarsTocents(form.amount);
    if (!amountCents) { alert('Please enter an amount'); return; }

    const gstAmount = form.gstIncluded ? Math.round(amountCents / 11) : 0;
    const now = new Date().toISOString();

    let receiptKey = null;
    if (receiptPhoto) {
      receiptKey = `receipt_${uuid()}`;
      await storePhoto(receiptKey, receiptPhoto);
    }

    const expense = {
      id: uuid(),
      jobId: form.jobId || null,
      description: form.description,
      amount: amountCents,
      category: form.category,
      gstIncluded: form.gstIncluded,
      gstAmount,
      taxDeductible: form.taxDeductible,
      receiptPhoto: receiptKey,
      date: form.date,
      supplier: form.supplier,
      paymentMethod: form.paymentMethod,
      createdAt: now,
      syncedAt: null,
    };

    await db.expenses.add(expense);

    if (form.jobId) {
      const job = await db.jobs.get(form.jobId);
      if (job) {
        const allExpenses = await db.expenses.where('jobId').equals(form.jobId).toArray();
        const totalExpenses = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);
        await db.jobs.update(form.jobId, { totalExpenses, updatedAt: now });
      }
    }

    navigate(form.jobId ? `/jobs/${form.jobId}` : '/expenses');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Log Expense</h1>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
      </div>

      <div style={{ maxWidth: 500 }}>
        <div className="form-group">
          <label>Receipt Photo</label>
          <label className="btn btn-secondary btn-block" style={{ cursor: 'pointer' }}>
            {receiptPhoto ? 'Change Photo' : 'Take Photo / Upload'}
            <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
          </label>
          {photoPreview && (
            <img src={photoPreview} alt="Receipt" style={{ width: '100%', maxWidth: 200, marginTop: 8, border: '1px solid var(--color-border)' }} />
          )}
        </div>

        <div className="form-group">
          <label>Amount ($)</label>
          <input type="number" inputMode="decimal" value={form.amount} onChange={e => update('amount', e.target.value)}
            placeholder="0.00" style={{ fontSize: 24, textAlign: 'center', padding: 16 }} autoFocus />
        </div>

        <div className="form-group">
          <label>Description</label>
          <input value={form.description} onChange={e => update('description', e.target.value)} placeholder="What was it for?" />
        </div>

        <div className="form-group">
          <label>Category</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => (
              <button key={c} className={`btn ${form.category === c ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 14px', fontSize: 13 }}
                onClick={() => update('category', c)}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => update('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label>Supplier</label>
            <input value={form.supplier} onChange={e => update('supplier', e.target.value)} placeholder="Bunnings, etc." />
          </div>
        </div>

        <div className="form-group">
          <label>Link to Job</label>
          <select value={form.jobId} onChange={e => update('jobId', e.target.value)}>
            <option value="">No job (general expense)</option>
            {jobs.map(j => (
              <option key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Payment</label>
            <select value={form.paymentMethod} onChange={e => update('paymentMethod', e.target.value)}>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="account">Account</option>
            </select>
          </div>
          <div className="form-group">
            <label>&nbsp;</label>
            <div style={{ display: 'flex', gap: 16, padding: '12px 0' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.gstIncluded} onChange={e => update('gstIncluded', e.target.checked)} />
                Inc. GST
              </label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.taxDeductible} onChange={e => update('taxDeductible', e.target.checked)} />
                Deductible
              </label>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg btn-block" onClick={save} style={{ marginTop: 8 }}>
          Save Expense
        </button>
      </div>
    </div>
  );
}
