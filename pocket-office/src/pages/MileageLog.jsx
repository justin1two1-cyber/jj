import { useState, useEffect, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { db, getSetting } from '../db';
import { formatCents } from '../utils/formatCurrency';

function calcDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MileageLog() {
  const [trips, setTrips] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [atoRate, setAtoRate] = useState(85);
  const [showForm, setShowForm] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [liveDistance, setLiveDistance] = useState(0);
  const watchRef = useRef(null);
  const pointsRef = useRef([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startAddress: '',
    endAddress: '',
    distanceKm: '',
    purpose: '',
    jobId: '',
  });

  useEffect(() => {
    loadData();
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  async function loadData() {
    const [allTrips, allJobs, rate] = await Promise.all([
      db.mileageLog.orderBy('date').reverse().toArray(),
      db.jobs.toArray(),
      getSetting('atoMileageRate'),
    ]);
    setTrips(allTrips);
    setJobs(allJobs);
    if (rate) setAtoRate(rate);
  }

  function startTracking() {
    if (!navigator.geolocation) { alert('GPS not available'); return; }
    pointsRef.current = [];
    setLiveDistance(0);
    setTracking({ startTime: new Date().toISOString(), jobId: form.jobId });

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, time: Date.now() };
        const pts = pointsRef.current;
        if (pts.length > 0) {
          const last = pts[pts.length - 1];
          const d = calcDistance(last.lat, last.lng, point.lat, point.lng);
          if (d > 0.01) {
            pts.push(point);
            const total = pts.reduce((sum, p, i) => {
              if (i === 0) return 0;
              return sum + calcDistance(pts[i - 1].lat, pts[i - 1].lng, p.lat, p.lng);
            }, 0);
            setLiveDistance(total);
          }
        } else {
          pts.push(point);
        }
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  async function stopTracking() {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    const pts = pointsRef.current;
    const km = liveDistance;
    if (km < 0.1) {
      setTracking(null);
      return;
    }

    const deductionAmount = Math.round(km * atoRate);
    const now = new Date().toISOString();
    const trip = {
      id: uuid(),
      jobId: tracking?.jobId || null,
      date: new Date().toISOString().slice(0, 10),
      startAddress: 'GPS Start',
      endAddress: 'GPS End',
      startCoords: pts.length > 0 ? { lat: pts[0].lat, lng: pts[0].lng } : null,
      endCoords: pts.length > 0 ? { lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng } : null,
      distanceKm: parseFloat(km.toFixed(1)),
      purpose: 'GPS tracked trip',
      atoRatePerKm: atoRate,
      deductionAmount,
      autoDetected: true,
      createdAt: now,
      syncedAt: null,
    };
    await db.mileageLog.add(trip);
    setTracking(null);
    setLiveDistance(0);
    pointsRef.current = [];
    loadData();
  }

  async function saveTrip() {
    const km = parseFloat(form.distanceKm);
    if (!km || km <= 0) { alert('Please enter distance'); return; }

    const deductionAmount = Math.round(km * atoRate);
    const now = new Date().toISOString();

    const trip = {
      id: uuid(),
      jobId: form.jobId || null,
      date: form.date,
      startAddress: form.startAddress,
      endAddress: form.endAddress,
      startCoords: null,
      endCoords: null,
      distanceKm: km,
      purpose: form.purpose,
      atoRatePerKm: atoRate,
      deductionAmount,
      autoDetected: false,
      createdAt: now,
      syncedAt: null,
    };

    await db.mileageLog.add(trip);
    setForm({ date: new Date().toISOString().slice(0, 10), startAddress: '', endAddress: '', distanceKm: '', purpose: '', jobId: '' });
    setShowForm(false);
    loadData();
  }

  async function deleteTrip(tripId) {
    if (!confirm('Delete this trip?')) return;
    await db.mileageLog.delete(tripId);
    loadData();
  }

  const totalKm = trips.reduce((s, t) => s + (t.distanceKm || 0), 0);
  const totalDeduction = trips.reduce((s, t) => s + (t.deductionAmount || 0), 0);

  const fyStart = new Date();
  fyStart.setMonth(fyStart.getMonth() >= 6 ? 6 : -6);
  fyStart.setDate(1);
  const fyStartStr = fyStart.toISOString().slice(0, 10);
  const fyTrips = trips.filter(t => t.date >= fyStartStr);
  const fyKm = fyTrips.reduce((s, t) => s + (t.distanceKm || 0), 0);
  const fyDeduction = fyTrips.reduce((s, t) => s + (t.deductionAmount || 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Mileage Log</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {!tracking && (
            <button className="btn btn-success" onClick={startTracking}>
              GPS Track
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Manual'}
          </button>
        </div>
      </div>

      {tracking && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--color-success)', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 10, height: 10, background: 'var(--color-success)', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>Tracking Trip</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 4 }}>{liveDistance.toFixed(1)} km</div>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Deduction: {formatCents(Math.round(liveDistance * atoRate))}
          </div>
          <div className="form-group" style={{ maxWidth: 300, margin: '0 auto 12px' }}>
            <select value={tracking.jobId || ''} onChange={e => setTracking(t => ({ ...t, jobId: e.target.value }))}>
              <option value="">Link to job (optional)</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.jobNumber} - {j.clientName}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-danger btn-lg" onClick={stopTracking}>Stop & Save</button>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Total Trips</span>
          <span className="stat-card-value">{trips.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Total KMs</span>
          <span className="stat-card-value">{totalKm.toFixed(1)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">FY KMs</span>
          <span className="stat-card-value">{fyKm.toFixed(1)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">FY Deduction</span>
          <span className="stat-card-value money money-positive" style={{ fontSize: 20 }}>{formatCents(fyDeduction)}</span>
        </div>
      </div>

      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        ATO rate: {atoRate}c/km · Total deduction: {formatCents(totalDeduction)}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>Manual Trip</h3>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>From</label>
              <input value={form.startAddress} onChange={e => setForm(f => ({ ...f, startAddress: e.target.value }))}
                placeholder="Home / Workshop" />
            </div>
            <div className="form-group">
              <label>To</label>
              <input value={form.endAddress} onChange={e => setForm(f => ({ ...f, endAddress: e.target.value }))}
                placeholder="Job site address" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Distance (km)</label>
              <input type="number" inputMode="decimal" value={form.distanceKm}
                onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))}
                placeholder="0.0" style={{ fontSize: 20, textAlign: 'center' }} />
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
          </div>
          <div className="form-group">
            <label>Purpose</label>
            <input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              placeholder="Travel to site, material pickup, etc." />
          </div>
          {form.distanceKm && (
            <div style={{ fontSize: 14, color: 'var(--color-success)', marginBottom: 12 }}>
              Deduction: {formatCents(Math.round(parseFloat(form.distanceKm) * atoRate))}
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={saveTrip}>Save Trip</button>
        </div>
      )}

      {trips.length === 0 && !showForm && !tracking ? (
        <div className="empty-state">
          <div className="empty-state-icon">🚗</div>
          <p>No trips logged</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Use GPS Track for automatic distance or log manually</p>
        </div>
      ) : (
        <div className="list-gap">
          {trips.map(t => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {t.startAddress || 'Start'} → {t.endAddress || 'End'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {t.date} · {t.distanceKm}km {t.purpose ? `· ${t.purpose}` : ''}
                    {t.autoDetected && ' · GPS'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="money money-positive" style={{ fontWeight: 600 }}>
                    {formatCents(t.deductionAmount)}
                  </div>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => deleteTrip(t.id)}>x</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
