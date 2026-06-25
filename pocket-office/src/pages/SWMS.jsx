import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db, getAllSettings } from '../db';

export default function SWMS() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetJobId = searchParams.get('jobId') || '';
  const [tab, setTab] = useState('docs');
  const [docs, setDocs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState({});
  const [showNew, setShowNew] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form, setForm] = useState({
    jobId: presetJobId,
    title: '',
    siteAddress: '',
    hazards: [],
    controls: [],
    ppe: [],
    emergencyProcedures: 'Call 000 for emergencies.\nNearest hospital: [enter address]\nFirst aid kit location: On site vehicle\nFire extinguisher location: On site vehicle\nAssembly point: Front of property',
    customHazard: '',
    customControl: '',
    customPpe: '',
    signedBy: '',
  });

  useEffect(() => {
    async function load() {
      const [allDocs, allTemplates, allJobs, setts] = await Promise.all([
        db.swmsDocs.orderBy('createdAt').reverse().toArray(),
        db.swmsTemplates.toArray(),
        db.jobs.toArray(),
        getAllSettings(),
      ]);
      setDocs(allDocs);
      setTemplates(allTemplates);
      setJobs(allJobs);
      setSettings(setts);
    }
    load();
  }, []);

  function selectTemplate(template) {
    setSelectedTemplate(template);
    setForm(f => ({
      ...f,
      title: template.name,
      hazards: template.hazards.map(h => ({ ...h, included: true })),
      controls: template.controls.map(c => ({ text: c, included: true })),
      ppe: template.ppe.map(p => ({ text: p, included: true })),
    }));
    setShowNew(true);
  }

  function toggleHazard(index) {
    setForm(f => ({
      ...f,
      hazards: f.hazards.map((h, i) => i === index ? { ...h, included: !h.included } : h),
    }));
  }

  function toggleControl(index) {
    setForm(f => ({
      ...f,
      controls: f.controls.map((c, i) => i === index ? { ...c, included: !c.included } : c),
    }));
  }

  function togglePpe(index) {
    setForm(f => ({
      ...f,
      ppe: f.ppe.map((p, i) => i === index ? { ...p, included: !p.included } : p),
    }));
  }

  function addCustomHazard() {
    if (!form.customHazard.trim()) return;
    setForm(f => ({
      ...f,
      hazards: [...f.hazards, { hazard: f.customHazard.trim(), risk: 'medium', consequence: '', included: true }],
      customHazard: '',
    }));
  }

  function addCustomControl() {
    if (!form.customControl.trim()) return;
    setForm(f => ({
      ...f,
      controls: [...f.controls, { text: f.customControl.trim(), included: true }],
      customControl: '',
    }));
  }

  function addCustomPpe() {
    if (!form.customPpe.trim()) return;
    setForm(f => ({
      ...f,
      ppe: [...f.ppe, { text: f.customPpe.trim(), included: true }],
      customPpe: '',
    }));
  }

  async function saveDoc() {
    if (!form.title.trim()) { alert('Please enter a title'); return; }

    const now = new Date().toISOString();
    const doc = {
      id: uuid(),
      jobId: form.jobId || null,
      templateId: selectedTemplate?.id || null,
      title: form.title,
      hazards: form.hazards.filter(h => h.included).map(h => ({
        hazard: h.hazard,
        risk: h.risk,
        consequence: h.consequence,
      })),
      controls: form.controls.filter(c => c.included).map(c => c.text),
      ppe: form.ppe.filter(p => p.included).map(p => p.text),
      emergencyProcedures: form.emergencyProcedures,
      signedBy: form.signedBy || null,
      signedDate: form.signedBy ? now.slice(0, 10) : null,
      status: form.signedBy ? 'signed' : 'draft',
      createdAt: now,
      syncedAt: null,
    };

    await db.swmsDocs.add(doc);
    setDocs(prev => [doc, ...prev]);
    setShowNew(false);
    setSelectedTemplate(null);
    setForm({
      jobId: '', title: '', siteAddress: '', hazards: [], controls: [], ppe: [],
      emergencyProcedures: form.emergencyProcedures, customHazard: '', customControl: '', customPpe: '', signedBy: '',
    });
  }

  function shareDoc(doc) {
    const riskLabel = { high: 'HIGH', medium: 'MED', low: 'LOW' };
    const lines = [
      '═══════════════════════════════',
      'SAFE WORK METHOD STATEMENT (SWMS)',
      '═══════════════════════════════',
      '',
      `Title: ${doc.title}`,
      `Date: ${doc.createdAt?.slice(0, 10) || 'N/A'}`,
      `Business: ${settings.businessName || 'Pocket Office'}`,
      settings.abn ? `ABN: ${settings.abn}` : '',
      '',
      '--- HAZARDS & RISKS ---',
      ...doc.hazards.map((h, i) => `${i + 1}. [${riskLabel[h.risk] || h.risk}] ${h.hazard}${h.consequence ? ` → ${h.consequence}` : ''}`),
      '',
      '--- CONTROL MEASURES ---',
      ...doc.controls.map((c, i) => `${i + 1}. ${c}`),
      '',
      '--- PPE REQUIRED ---',
      doc.ppe.join(', '),
      '',
      '--- EMERGENCY PROCEDURES ---',
      doc.emergencyProcedures || 'N/A',
      '',
      doc.signedBy ? `Signed by: ${doc.signedBy} on ${doc.signedDate}` : 'Status: UNSIGNED',
      '',
      '═══════════════════════════════',
    ].filter(l => l !== undefined).join('\n');

    if (navigator.share) {
      navigator.share({ title: `SWMS - ${doc.title}`, text: lines });
    } else {
      navigator.clipboard.writeText(lines);
      alert('SWMS copied to clipboard');
    }
  }

  async function signDoc(doc) {
    const name = prompt('Enter signer name:');
    if (!name) return;
    const now = new Date().toISOString().slice(0, 10);
    await db.swmsDocs.update(doc.id, { signedBy: name, signedDate: now, status: 'signed' });
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, signedBy: name, signedDate: now, status: 'signed' } : d));
  }

  async function deleteDoc(doc) {
    if (!confirm(`Delete SWMS "${doc.title}"?`)) return;
    await db.swmsDocs.delete(doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  }

  if (showNew) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>{selectedTemplate ? 'Customise SWMS' : 'New SWMS'}</h1>
          <button className="btn btn-secondary" onClick={() => { setShowNew(false); setSelectedTemplate(null); }}>Cancel</button>
        </div>

        <div style={{ maxWidth: 600 }}>
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="SWMS title" />
          </div>

          <div className="form-group">
            <label>Link to Job</label>
            <select value={form.jobId} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}>
              <option value="">No job</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</option>
              ))}
            </select>
          </div>

          <h3 style={{ margin: '20px 0 12px' }}>Hazards & Risks</h3>
          {form.hazards.map((h, i) => (
            <div key={i} className="card" style={{ marginBottom: 8, opacity: h.included ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <input type="checkbox" checked={h.included} onChange={() => toggleHazard(i)} />
                  <div>
                    <span style={{ fontWeight: 600 }}>{h.hazard}</span>
                    <span className={`badge badge-${h.risk === 'high' ? 'overdue' : h.risk === 'medium' ? 'sent' : 'paid'}`}
                      style={{ marginLeft: 8, fontSize: 11 }}>
                      {h.risk.toUpperCase()}
                    </span>
                    {h.consequence && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{h.consequence}</div>}
                  </div>
                </label>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input value={form.customHazard} onChange={e => setForm(f => ({ ...f, customHazard: e.target.value }))}
              placeholder="Add custom hazard" style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addCustomHazard()} />
            <button className="btn btn-secondary" onClick={addCustomHazard}>Add</button>
          </div>

          <h3 style={{ margin: '20px 0 12px' }}>Control Measures</h3>
          {form.controls.map((c, i) => (
            <div key={i} style={{ marginBottom: 6, opacity: c.included ? 1 : 0.5 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <input type="checkbox" checked={c.included} onChange={() => toggleControl(i)} style={{ marginTop: 3 }} />
                <span>{c.text}</span>
              </label>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, marginTop: 8 }}>
            <input value={form.customControl} onChange={e => setForm(f => ({ ...f, customControl: e.target.value }))}
              placeholder="Add custom control measure" style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addCustomControl()} />
            <button className="btn btn-secondary" onClick={addCustomControl}>Add</button>
          </div>

          <h3 style={{ margin: '20px 0 12px' }}>PPE Required</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {form.ppe.map((p, i) => (
              <label key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', 
                background: p.included ? 'var(--color-primary)' : 'var(--color-surface)',
                color: p.included ? '#fff' : 'var(--color-text)',
                cursor: 'pointer', fontSize: 14,
              }}>
                <input type="checkbox" checked={p.included} onChange={() => togglePpe(i)} style={{ display: 'none' }} />
                {p.text}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <input value={form.customPpe} onChange={e => setForm(f => ({ ...f, customPpe: e.target.value }))}
              placeholder="Add PPE item" style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addCustomPpe()} />
            <button className="btn btn-secondary" onClick={addCustomPpe}>Add</button>
          </div>

          <h3 style={{ margin: '20px 0 12px' }}>Emergency Procedures</h3>
          <div className="form-group">
            <textarea value={form.emergencyProcedures}
              onChange={e => setForm(f => ({ ...f, emergencyProcedures: e.target.value }))}
              rows={5} placeholder="Emergency procedures..." />
          </div>

          <h3 style={{ margin: '20px 0 12px' }}>Sign Off</h3>
          <div className="form-group">
            <label>Signed By (leave blank to save as draft)</label>
            <input value={form.signedBy} onChange={e => setForm(f => ({ ...f, signedBy: e.target.value }))}
              placeholder="Full name" />
          </div>

          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 20 }} onClick={saveDoc}>
            {form.signedBy ? 'Sign & Save SWMS' : 'Save as Draft'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>SWMS</h1>
        <button className="btn btn-primary" onClick={() => setTab('templates')}>+ New SWMS</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${tab === 'docs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setTab('docs')}>
          My Documents ({docs.length})
        </button>
        <button className={`btn ${tab === 'templates' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setTab('templates')}>
          Templates
        </button>
      </div>

      {tab === 'templates' && (
        <div>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: 14 }}>
            Select a template to create a SWMS. Customise hazards, controls, and PPE for your specific job.
          </p>
          <div className="list-gap">
            {templates.map(t => (
              <div key={t.id} className="card card-clickable" onClick={() => selectTemplate(t)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {t.hazards.length} hazards · {t.controls.length} controls · {t.ppe.length} PPE items
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{t.category}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'docs' && (
        <div>
          {docs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚠</div>
              <p>No SWMS documents yet</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setTab('templates')}>
                Create from Template
              </button>
            </div>
          ) : (
            <div className="list-gap">
              {docs.map(doc => (
                <div key={doc.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{doc.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {doc.createdAt?.slice(0, 10)} · {doc.hazards?.length || 0} hazards
                      </div>
                      {doc.signedBy && (
                        <div style={{ fontSize: 13, color: 'var(--color-success)' }}>
                          Signed by {doc.signedBy} on {doc.signedDate}
                        </div>
                      )}
                    </div>
                    <span className={`badge badge-${doc.status === 'signed' ? 'paid' : 'draft'}`}>
                      {doc.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 12px' }}
                      onClick={() => shareDoc(doc)}>Share</button>
                    {doc.status !== 'signed' && (
                      <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 12px' }}
                        onClick={() => signDoc(doc)}>Sign</button>
                    )}
                    <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 12px', marginLeft: 'auto' }}
                      onClick={() => deleteDoc(doc)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
