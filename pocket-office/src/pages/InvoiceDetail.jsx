import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, getAllSettings } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState({});

  useEffect(() => {
    Promise.all([db.invoices.get(id), getAllSettings()]).then(([inv, setts]) => {
      setInvoice(inv);
      setSettings(setts);
    });
  }, [id]);

  if (!invoice) return <div className="page"><p>Loading...</p></div>;

  async function updateStatus(status) {
    const updates = { status };
    if (status === 'sent') updates.dateSent = new Date().toISOString().slice(0, 10);
    if (status === 'paid') updates.datePaid = new Date().toISOString().slice(0, 10);
    await db.invoices.update(id, updates);
    setInvoice({ ...invoice, ...updates });
  }

  function generateReminder() {
    const daysOverdue = Math.ceil((new Date() - new Date(invoice.dateDue)) / (24 * 60 * 60 * 1000));
    const businessName = settings.businessName || 'Pocket Office';

    const text = daysOverdue > 0
      ? `Hi ${invoice.clientName || 'there'},\n\nJust a friendly reminder that invoice ${invoice.invoiceNumber} for ${formatCents(invoice.totalAmount)} was due on ${invoice.dateDue} (${daysOverdue} days ago).\n\nPlease arrange payment at your earliest convenience.\n\nThanks,\n${businessName}`
      : `Hi ${invoice.clientName || 'there'},\n\nPlease find invoice ${invoice.invoiceNumber} for ${formatCents(invoice.totalAmount)}, due ${invoice.dateDue}.\n\nThanks,\n${businessName}`;

    if (navigator.share) {
      navigator.share({ title: `Invoice ${invoice.invoiceNumber}`, text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Reminder text copied to clipboard');
    }

    db.invoices.update(id, {
      remindersSent: (invoice.remindersSent || 0) + 1,
      lastReminderDate: new Date().toISOString().slice(0, 10),
    });
  }

  function shareInvoice() {
    const lines = [
      `INVOICE ${invoice.invoiceNumber}`,
      `From: ${settings.businessName || 'Pocket Office'}`,
      settings.abn ? `ABN: ${settings.abn}` : '',
      '',
      `To: ${invoice.clientName || 'Client'}`,
      `Date: ${invoice.dateSent || new Date().toISOString().slice(0, 10)}`,
      `Due: ${invoice.dateDue}`,
      '',
      '--- Items ---',
      ...(invoice.lineItems || []).map(item =>
        `${item.description}: ${item.quantity} x ${formatCents(item.amount)} = ${formatCents(item.amount * item.quantity)}`
      ),
      '',
      `Subtotal: ${formatCents(invoice.subtotal)}`,
      `GST: ${formatCents(invoice.gstAmount)}`,
      `TOTAL: ${formatCents(invoice.totalAmount)}`,
      '',
      `Payment terms: ${settings.paymentTermsDays || 14} days`,
    ].filter(l => l !== undefined).join('\n');

    if (navigator.share) {
      navigator.share({ title: `Invoice ${invoice.invoiceNumber}`, text: lines });
    } else {
      navigator.clipboard.writeText(lines);
      alert('Invoice copied to clipboard');
    }
  }

  const isOverdue = invoice.status === 'sent' && invoice.dateDue && new Date(invoice.dateDue) < new Date();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{invoice.invoiceNumber}</h1>
          <span className={`badge badge-${isOverdue ? 'overdue' : invoice.status}`}>
            {isOverdue ? 'overdue' : invoice.status}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/invoices')}>Back</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <h3>Bill To</h3>
            <p>{invoice.clientName || 'Not specified'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {invoice.dateSent && <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Sent: {invoice.dateSent}</p>}
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Due: {invoice.dateDue}</p>
            {invoice.datePaid && <p style={{ fontSize: 13, color: 'var(--color-success)' }}>Paid: {invoice.datePaid}</p>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Items</h3>
        {(invoice.lineItems || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <span>{item.description}</span>
              {item.quantity > 1 && <span style={{ color: 'var(--color-text-muted)' }}> x{item.quantity}</span>}
            </div>
            <span className="money">{formatCents(item.amount * (item.quantity || 1))}</span>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>Subtotal</span>
            <span className="money">{formatCents(invoice.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>GST</span>
            <span className="money">{formatCents(invoice.gstAmount)}</span>
          </div>
          <div style={{ borderTop: '2px solid var(--color-primary)', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 22 }}>
            <span>TOTAL</span>
            <span className="money">{formatCents(invoice.totalAmount)}</span>
          </div>
        </div>
      </div>

      {invoice.remindersSent > 0 && (
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          {invoice.remindersSent} reminder{invoice.remindersSent > 1 ? 's' : ''} sent
          {invoice.lastReminderDate ? ` (last: ${invoice.lastReminderDate})` : ''}
        </p>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        {invoice.status === 'draft' && <button className="btn btn-primary btn-lg" onClick={() => updateStatus('sent')}>Mark as Sent</button>}
        {(invoice.status === 'sent' || isOverdue) && <button className="btn btn-success btn-lg" onClick={() => updateStatus('paid')}>Mark as Paid</button>}
        {(invoice.status === 'sent' || isOverdue) && <button className="btn btn-secondary btn-lg" onClick={generateReminder}>Send Reminder</button>}
        <button className="btn btn-secondary btn-lg" onClick={shareInvoice}>Share Invoice</button>
      </div>
    </div>
  );
}
