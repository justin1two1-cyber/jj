import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, getPhoto } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [photoUrls, setPhotoUrls] = useState([]);

  useEffect(() => {
    db.quotes.get(id).then(async (q) => {
      setQuote(q);
      if (q?.photos?.length > 0) {
        const urls = [];
        for (const key of q.photos) {
          const blob = await getPhoto(key);
          if (blob) urls.push(URL.createObjectURL(blob));
        }
        setPhotoUrls(urls);
      }
    });
    return () => { photoUrls.forEach(u => URL.revokeObjectURL(u)); };
  }, [id]);

  if (!quote) return <div className="page"><p>Loading...</p></div>;

  async function updateStatus(status) {
    await db.quotes.update(id, { status, updatedAt: new Date().toISOString() });
    setQuote({ ...quote, status });
  }

  async function convertToJob() {
    const { v4: uuid } = await import('uuid');
    const { getNextNumber } = await import('../db');
    const jobNumber = await getNextNumber('J');
    const now = new Date().toISOString();
    const job = {
      id: uuid(),
      quoteId: id,
      clientId: quote.clientId,
      jobNumber,
      clientName: quote.clientName,
      siteAddress: quote.siteAddress,
      status: 'scheduled',
      startDate: null,
      endDate: null,
      totalQuoted: quote.totalPrice,
      totalVariations: 0,
      totalExpenses: 0,
      totalIncome: 0,
      notes: '',
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };
    await db.jobs.add(job);
    await db.quotes.update(id, { status: 'accepted', jobId: job.id });
    navigate(`/jobs/${job.id}`);
  }

  async function duplicateQuote() {
    const { v4: uuid } = await import('uuid');
    const { getNextNumber } = await import('../db');
    const quoteNumber = await getNextNumber('PO');
    const now = new Date().toISOString();
    const newQuote = {
      ...quote,
      id: uuid(),
      quoteNumber,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };
    await db.quotes.add(newQuote);
    navigate(`/quotes/${newQuote.id}`);
  }

  function shareQuote() {
    const text = [
      `Quote ${quote.quoteNumber}`,
      `Client: ${quote.clientName}`,
      `Site: ${quote.siteAddress}`,
      '',
      ...(quote.materials || []).map(m => `${m.name}: ${m.qty} x ${formatCents(m.unitPrice)} = ${formatCents(m.total)}`),
      '',
      `Total: ${formatCents(quote.totalPrice)} (inc. GST)`,
    ].join('\n');

    if (navigator.share) {
      navigator.share({ title: `Quote ${quote.quoteNumber}`, text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Quote copied to clipboard');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{quote.quoteNumber}</h1>
          <span className={`badge badge-${quote.status}`}>{quote.status}</span>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/quotes')}>Back</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 8 }}>Client</h3>
        <p>{quote.clientName || 'Not specified'}</p>
        {quote.clientPhone && <p style={{ color: 'var(--color-text-secondary)' }}>{quote.clientPhone}</p>}
        {quote.siteAddress && <p style={{ color: 'var(--color-text-secondary)' }}>{quote.siteAddress}</p>}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Materials</h3>
        {(quote.materials || []).map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span>{m.name} x{m.qty}</span>
            <span className="money">{formatCents(m.total)}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span>Labour</span><span className="money">{formatCents(quote.labourHours * quote.labourRate)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span>Travel</span><span className="money">{formatCents(quote.travelCost)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span>Consumables</span><span className="money">{formatCents(quote.consumablesCost)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}><span>GST</span><span className="money">{formatCents(quote.taxAmount)}</span></div>
        <div style={{ borderTop: '2px solid var(--color-primary)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 22 }}>
          <span>TOTAL</span>
          <span className="money">{formatCents(quote.totalPrice)}</span>
        </div>
      </div>

      {quote.notes && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Notes</h3>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>{quote.notes}</p>
        </div>
      )}

      {photoUrls.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 8 }}>Site Photos ({photoUrls.length})</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {photoUrls.map((url, i) => (
              <img key={i} src={url} alt={`Site ${i + 1}`}
                style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
        {quote.status === 'draft' && <button className="btn btn-primary btn-lg" onClick={() => updateStatus('sent')}>Mark as Sent</button>}
        {quote.status === 'sent' && <button className="btn btn-success btn-lg" onClick={convertToJob}>Accept & Create Job</button>}
        {quote.status === 'sent' && <button className="btn btn-danger btn-lg" onClick={() => updateStatus('declined')}>Declined</button>}
        <button className="btn btn-secondary btn-lg" onClick={duplicateQuote}>Duplicate</button>
        <button className="btn btn-secondary btn-lg" onClick={shareQuote}>Share</button>
        {quote.status === 'draft' && (
          <button className="btn btn-danger btn-lg" onClick={async () => {
            if (!confirm('Delete this quote?')) return;
            if (quote.photos?.length) {
              const { deletePhoto } = await import('../db');
              for (const key of quote.photos) await deletePhoto(key);
            }
            await db.quotes.delete(id);
            navigate('/quotes');
          }}>Delete</button>
        )}
      </div>
    </div>
  );
}
