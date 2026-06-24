import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db, storePhoto } from '../db';
import { formatCents, parseDollarsTocents } from '../utils/formatCurrency';
import { getAllSettings } from '../db';
import VoiceInput from '../components/VoiceInput';
import CameraInput from '../components/CameraInput';

export default function Variations() {
  const navigate = useNavigate();
  const { id: jobId } = useParams();
  const [job, setJob] = useState(null);
  const [variations, setVariations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [settings, setSettings] = useState({});
  const [form, setForm] = useState({
    description: '', reason: '', labourHours: '', amount: '',
  });
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    loadData();
  }, [jobId]);

  async function loadData() {
    if (!jobId) return;
    const [j, vars, setts] = await Promise.all([
      db.jobs.get(jobId),
      db.variations.where('jobId').equals(jobId).toArray(),
      getAllSettings(),
    ]);
    setJob(j);
    setVariations(vars.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)));
    setSettings(setts);
  }

  async function saveVariation() {
    if (!form.description.trim()) { alert('Please enter a description'); return; }

    const labourHours = parseFloat(form.labourHours) || 0;
    const labourRate = settings.labourRate || 6500;
    const labourCost = Math.round(labourHours * labourRate);
    const manualAmount = parseDollarsTocents(form.amount);
    const amount = manualAmount || labourCost;
    const taxRate = settings.taxRate || 10;
    const gstAmount = Math.round(amount * (taxRate / 100));

    const varCount = variations.length + 1;
    const now = new Date().toISOString();

    const photoKeys = [];
    for (const blob of photos) {
      if (blob) {
        const key = `variation_${uuid()}`;
        await storePhoto(key, blob);
        photoKeys.push(key);
      }
    }

    const variation = {
      id: uuid(),
      jobId,
      variationNumber: `V-${String(varCount).padStart(3, '0')}`,
      description: form.description,
      reason: form.reason,
      materials: [],
      labourHours,
      labourRate,
      amount,
      gstAmount,
      status: 'proposed',
      approvedBy: '',
      approvedDate: null,
      photos: photoKeys,
      createdAt: now,
      syncedAt: null,
    };

    await db.variations.add(variation);

    const allVars = await db.variations.where('jobId').equals(jobId).toArray();
    const totalVariations = allVars
      .filter(v => v.status === 'approved')
      .reduce((s, v) => s + (v.amount || 0), 0);
    await db.jobs.update(jobId, { totalVariations, updatedAt: now });

    setForm({ description: '', reason: '', labourHours: '', amount: '' });
    setPhotos([]);
    setShowForm(false);
    loadData();
  }

  async function updateStatus(varId, status) {
    const now = new Date().toISOString();
    const updates = { status };
    if (status === 'approved') {
      updates.approvedDate = now;
    }
    await db.variations.update(varId, updates);

    const allVars = await db.variations.where('jobId').equals(jobId).toArray();
    const totalVariations = allVars
      .filter(v => v.status === 'approved' || (v.id === varId && status === 'approved'))
      .reduce((s, v) => s + (v.amount || 0), 0);
    await db.jobs.update(jobId, { totalVariations, updatedAt: now });

    loadData();
  }

  async function shareVariation(v) {
    const text = [
      `Variation ${v.variationNumber}`,
      `Job: ${job?.jobNumber || ''}`,
      `Description: ${v.description}`,
      v.reason ? `Reason: ${v.reason}` : '',
      `Amount: ${formatCents(v.amount)} + GST ${formatCents(v.gstAmount)}`,
      `Total: ${formatCents(v.amount + v.gstAmount)}`,
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      navigator.share({ title: `Variation ${v.variationNumber}`, text });
    } else {
      navigator.clipboard.writeText(text);
      alert('Variation details copied to clipboard');
    }
  }

  if (!jobId) return <div className="page"><p>No job specified</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Variations</h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{job?.jobNumber} - {job?.clientName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Variation'}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/jobs/${jobId}`)}>Back</button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>New Variation</h3>
          <div className="form-group">
            <label>Description</label>
            <VoiceInput
              value={form.description}
              onChange={v => setForm(f => ({ ...f, description: v }))}
              onTranscript={v => setForm(f => ({ ...f, description: v }))}
              placeholder="Describe the scope change..."
            />
          </div>
          <div className="form-group">
            <label>Reason</label>
            <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Why is this needed?" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Labour Hours</label>
              <input type="number" value={form.labourHours} onChange={e => setForm(f => ({ ...f, labourHours: e.target.value }))}
                placeholder="0" />
            </div>
            <div className="form-group">
              <label>Amount ($) (or auto from hours)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="Auto-calculated" />
            </div>
          </div>
          <div className="form-group">
            <label>Photos</label>
            <CameraInput onCapture={(blob) => setPhotos(prev => [...prev, blob])} multiple={true} label="Add Photos" />
          </div>
          <button className="btn btn-primary btn-block" onClick={saveVariation}>Save Variation</button>
        </div>
      )}

      {variations.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p>No variations yet</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Add a variation when the job scope changes</p>
        </div>
      ) : (
        <div className="list-gap">
          {variations.map(v => (
            <div key={v.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{v.variationNumber}: {v.description}</div>
                  {v.reason && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Reason: {v.reason}</div>}
                </div>
                <span className={`badge badge-${v.status === 'proposed' ? 'sent' : v.status === 'approved' ? 'accepted' : 'declined'}`}>
                  {v.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="money" style={{ fontWeight: 600 }}>
                  {formatCents(v.amount)} <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>+ GST {formatCents(v.gstAmount)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {v.status === 'proposed' && (
                    <>
                      <button className="btn btn-success" style={{ padding: '6px 12px', fontSize: 13 }}
                        onClick={() => updateStatus(v.id, 'approved')}>Approve</button>
                      <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 13 }}
                        onClick={() => updateStatus(v.id, 'declined')}>Decline</button>
                    </>
                  )}
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() => shareVariation(v)}>Share</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
