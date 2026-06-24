import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db, getNextNumber, getAllSettings, storePhoto } from '../db';
import { calculateQuote } from '../utils/quoteEngine';
import { formatCents } from '../utils/formatCurrency';
import CameraInput from '../components/CameraInput';
import VoiceInput from '../components/VoiceInput';

const STEPS = ['Template', 'Client', 'Measurements', 'Materials', 'Costs', 'Summary'];

export default function NewQuote() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [materials, setMaterials] = useState({});
  const [settings, setSettings] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [clientInfo, setClientInfo] = useState({ clientName: '', clientPhone: '', clientEmail: '', siteAddress: '' });
  const [measurements, setMeasurements] = useState({});
  const [calculation, setCalculation] = useState(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [existingClients, setExistingClients] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [wasteOverrides, setWasteOverrides] = useState({});

  useEffect(() => {
    async function load() {
      const [tmpls, mats, setts, clients] = await Promise.all([
        db.templates.toArray(),
        db.materials.toArray(),
        getAllSettings(),
        db.clients.toArray(),
      ]);
      setTemplates(tmpls);
      const matMap = {};
      mats.forEach(m => { matMap[m.id] = m; });
      setMaterials(matMap);
      setSettings(setts);
      setExistingClients(clients);
    }
    load();
  }, []);

  function selectTemplate(tmpl) {
    setSelectedTemplate(tmpl);
    const defaultMeasurements = {};
    (tmpl.measurementFields || []).forEach(f => {
      defaultMeasurements[f.name] = f.default ?? '';
    });
    setMeasurements(defaultMeasurements);
    setStep(1);
  }

  function handleClientNameChange(name) {
    setClientInfo({ ...clientInfo, clientName: name });
    if (name.length >= 2) {
      const matches = existingClients.filter(c =>
        c.name.toLowerCase().includes(name.toLowerCase())
      );
      setClientSuggestions(matches.slice(0, 5));
    } else {
      setClientSuggestions([]);
    }
  }

  function selectExistingClient(client) {
    setClientInfo({
      clientName: client.name,
      clientPhone: client.phone || '',
      clientEmail: client.email || '',
      siteAddress: client.address || '',
    });
    setClientSuggestions([]);

    if (client.isRepeatClient && client.preferredRates) {
      const rates = client.preferredRates;
      if (rates.labourRate) setSettings(s => ({ ...s, labourRate: rates.labourRate }));
      if (rates.markupPercent != null) setSettings(s => ({ ...s, markupPercent: rates.markupPercent }));
    }
  }

  function recalculate() {
    if (!selectedTemplate) return;
    const numMeasurements = {};
    Object.entries(measurements).forEach(([k, v]) => {
      numMeasurements[k] = parseFloat(v) || 0;
    });

    const templateWithOverrides = { ...selectedTemplate };
    if (Object.keys(wasteOverrides).length > 0) {
      templateWithOverrides.defaultMaterials = selectedTemplate.defaultMaterials.map(mat => ({
        ...mat,
        wasteFactor: wasteOverrides[mat.materialId] ?? mat.wasteFactor,
      }));
    }

    const result = calculateQuote(templateWithOverrides, numMeasurements, materials, settings);
    setCalculation(result);
  }

  useEffect(() => {
    if (step >= 3 && selectedTemplate) recalculate();
  }, [step, measurements, wasteOverrides]);

  function handlePhotoCapture(blob, isMultiple) {
    if (isMultiple && Array.isArray(blob)) {
      setPhotos(prev => [...prev, ...blob]);
    } else if (blob) {
      setPhotos(prev => [...prev, blob]);
    }
  }

  async function saveQuote() {
    const quoteNumber = await getNextNumber('PO');
    const now = new Date().toISOString();

    const photoKeys = photos.map(() => `quote_photo_${uuid()}`);

    for (let i = 0; i < photos.length; i++) {
      await storePhoto(photoKeys[i], photos[i]);
    }

    const quote = {
      id: uuid(),
      clientId: null,
      templateId: selectedTemplate?.id || null,
      quoteNumber,
      ...clientInfo,
      measurements,
      materials: calculation?.materials || [],
      labourHours: calculation?.labourHours || 0,
      labourRate: calculation?.labourRate || 0,
      travelCost: calculation?.travelCost || 0,
      consumablesCost: calculation?.consumablesCost || 0,
      subtotal: calculation?.subtotal || 0,
      markupPercent: calculation?.markupPercent || 0,
      taxRate: calculation?.taxRate || 0,
      taxAmount: calculation?.taxAmount || 0,
      totalPrice: calculation?.totalPrice || 0,
      status: 'draft',
      validUntil: settings.quoteValidDays
        ? new Date(Date.now() + settings.quoteValidDays * 86400000).toISOString().slice(0, 10)
        : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      notes,
      photos: photoKeys,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
    };
    await db.quotes.add(quote);

    if (clientInfo.clientName) {
      const existing = await db.clients.where('name').equals(clientInfo.clientName).first();
      if (!existing) {
        await db.clients.add({
          id: uuid(),
          name: clientInfo.clientName,
          phone: clientInfo.clientPhone,
          email: clientInfo.clientEmail,
          address: clientInfo.siteAddress,
          notes: '',
          isRepeatClient: false,
          preferredRates: null,
          createdAt: now,
          updatedAt: now,
          syncedAt: null,
        });
      } else {
        quote.clientId = existing.id;
        await db.quotes.update(quote.id, { clientId: existing.id });
      }
    }

    navigate(`/quotes/${quote.id}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>New Quote</h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 0 && (
            <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </div>

      {step === 0 && (
        <div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>Pick a template or start blank</p>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {templates.map(t => (
              <div key={t.id} className="card card-clickable" onClick={() => selectTemplate(t)}
                style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>
                  {t.category === 'decking' ? '🪵' : t.category === 'fencing' ? '🏗' : t.category === 'roofing' ? '🏠' :
                   t.category === 'renovation' ? '🛁' : t.category === 'painting' ? '🎨' : t.category === 'concrete' ? '🧱' :
                   t.category === 'landscaping' ? '🌿' : t.category === 'outdoor' ? '☀' : '🔨'}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{t.category}</div>
              </div>
            ))}
            <div className="card card-clickable" onClick={() => { setSelectedTemplate({ id: null, name: 'Custom', measurementFields: [], defaultMaterials: [], labourFormula: '0', consumablesPercent: 0 }); setStep(1); }}
              style={{ textAlign: 'center', padding: 20, borderStyle: 'dashed' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>+</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Blank Quote</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>Start from scratch</div>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ maxWidth: 500 }}>
          <div className="form-group" style={{ position: 'relative' }}>
            <label>Client Name</label>
            <input
              value={clientInfo.clientName}
              onChange={e => handleClientNameChange(e.target.value)}
              placeholder="John Smith"
              autoComplete="off"
            />
            {clientSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)', overflow: 'hidden',
              }}>
                {clientSuggestions.map(c => (
                  <div key={c.id} onClick={() => selectExistingClient(c)}
                    style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                    onMouseOver={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.phone && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{c.phone}</div>}
                    {c.isRepeatClient && <span className="badge badge-accepted" style={{ fontSize: 10, marginTop: 4 }}>Repeat Client</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" value={clientInfo.clientPhone} onChange={e => setClientInfo({ ...clientInfo, clientPhone: e.target.value })} placeholder="0400 000 000" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={clientInfo.clientEmail} onChange={e => setClientInfo({ ...clientInfo, clientEmail: e.target.value })} placeholder="john@example.com" />
          </div>
          <div className="form-group">
            <label>Site Address</label>
            <input value={clientInfo.siteAddress} onChange={e => setClientInfo({ ...clientInfo, siteAddress: e.target.value })} placeholder="123 Builder St, Melbourne VIC" />
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(2)}>Next: Measurements</button>
        </div>
      )}

      {step === 2 && (
        <div style={{ maxWidth: 500 }}>
          {(selectedTemplate?.measurementFields || []).length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <p>No measurements needed for this template</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setStep(3)}>Next</button>
            </div>
          ) : (
            <>
              {selectedTemplate.measurementFields.map(field => (
                <div className="form-group" key={field.name}>
                  <label>{field.label} ({field.unit})</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={measurements[field.name] ?? ''}
                    onChange={e => setMeasurements({ ...measurements, [field.name]: e.target.value })}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    style={{ fontSize: 20, padding: 16, textAlign: 'center' }}
                  />
                </div>
              ))}
              <div className="form-group">
                <label>Site Photos</label>
                <CameraInput onCapture={handlePhotoCapture} multiple={true} label="Add Site Photos" />
              </div>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(3)}>
                Calculate Materials
              </button>
            </>
          )}
        </div>
      )}

      {step === 3 && calculation && (
        <div>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>Review auto-calculated materials. Adjust waste factors as needed.</p>
          <div className="list-gap">
            {calculation.materials.map((mat, i) => {
              const tmplMat = selectedTemplate.defaultMaterials[i];
              const currentWaste = wasteOverrides[mat.materialId] ?? tmplMat?.wasteFactor ?? 1.0;
              return (
                <div key={i} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{mat.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {mat.qty} x {formatCents(mat.unitPrice)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {tmplMat && currentWaste > 1 && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 2 }}>Waste</div>
                          <select
                            value={currentWaste}
                            onChange={e => {
                              setWasteOverrides(prev => ({ ...prev, [mat.materialId]: parseFloat(e.target.value) }));
                            }}
                            style={{ width: 70, padding: '4px 6px', fontSize: 13, textAlign: 'center' }}
                          >
                            <option value="1.0">0%</option>
                            <option value="1.05">5%</option>
                            <option value="1.1">10%</option>
                            <option value="1.15">15%</option>
                            <option value="1.2">20%</option>
                          </select>
                        </div>
                      )}
                      <div className="money" style={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{formatCents(mat.total)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Materials Subtotal</span>
            <span className="money">{formatCents(calculation.materialsTotal)}</span>
          </div>
          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 16 }} onClick={() => setStep(4)}>
            Next: Costs
          </button>
        </div>
      )}

      {step === 4 && calculation && (
        <div style={{ maxWidth: 500 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span>Labour ({calculation.labourHours} hrs x {formatCents(calculation.labourRate)}/hr)</span>
              <span className="money" style={{ fontWeight: 600 }}>{formatCents(calculation.labourCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span>Travel</span>
              <span className="money" style={{ fontWeight: 600 }}>{formatCents(calculation.travelCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span>Consumables ({calculation.consumablesPercent}%)</span>
              <span className="money" style={{ fontWeight: 600 }}>{formatCents(calculation.consumablesCost)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Subtotal</span>
              <span className="money">{formatCents(calculation.subtotal)}</span>
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span>Markup ({calculation.markupPercent}%)</span>
              <span className="money" style={{ fontWeight: 600 }}>{formatCents(calculation.markup)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span>GST ({calculation.taxRate}%)</span>
              <span className="money" style={{ fontWeight: 600 }}>{formatCents(calculation.taxAmount)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 20 }}>
              <span>Total</span>
              <span className="money">{formatCents(calculation.totalPrice)}</span>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <VoiceInput
              value={notes}
              onChange={setNotes}
              onTranscript={setNotes}
              placeholder="Add notes about the job (tap mic for voice)..."
            />
          </div>

          <button className="btn btn-primary btn-lg btn-block" onClick={() => setStep(5)}>
            Review Summary
          </button>
        </div>
      )}

      {step === 5 && calculation && (
        <div style={{ maxWidth: 600 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 12 }}>Quote Summary</h3>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
              <p><strong>Client:</strong> {clientInfo.clientName || 'Not specified'}</p>
              <p><strong>Site:</strong> {clientInfo.siteAddress || 'Not specified'}</p>
              <p><strong>Template:</strong> {selectedTemplate?.name}</p>
              {Object.entries(measurements).filter(([, v]) => v).map(([k, v]) => (
                <p key={k}><strong>{k}:</strong> {v}</p>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Materials ({calculation.materials.length} items)</span>
              <span className="money">{formatCents(calculation.materialsTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Labour ({calculation.labourHours} hrs)</span>
              <span className="money">{formatCents(calculation.labourCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Travel</span>
              <span className="money">{formatCents(calculation.travelCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Consumables</span>
              <span className="money">{formatCents(calculation.consumablesCost)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Markup</span>
              <span className="money">{formatCents(calculation.markup)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>GST</span>
              <span className="money">{formatCents(calculation.taxAmount)}</span>
            </div>
            <div style={{ borderTop: '2px solid var(--color-primary)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 24 }}>
              <span>TOTAL</span>
              <span className="money">{formatCents(calculation.totalPrice)}</span>
            </div>
          </div>

          {notes && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Notes</h3>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>{notes}</p>
            </div>
          )}

          {photos.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>Site Photos ({photos.length})</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {photos.map((p, i) => (
                  <img key={i} src={URL.createObjectURL(p)} alt={`Site photo ${i + 1}`}
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary btn-lg" style={{ flex: 1 }} onClick={() => setStep(0)}>
              Start Over
            </button>
            <button className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={saveQuote}>
              Save Quote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
