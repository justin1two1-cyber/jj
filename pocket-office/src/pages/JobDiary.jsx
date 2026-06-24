import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db } from '../db';
import VoiceInput from '../components/VoiceInput';
import CameraInput from '../components/CameraInput';

export default function JobDiary() {
  const navigate = useNavigate();
  const { id: jobId } = useParams();
  const [job, setJob] = useState(null);
  const [entries, setEntries] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    notes: '',
    hoursWorked: '',
    crewCount: '1',
    weatherConditions: '',
    date: new Date().toISOString().slice(0, 10),
  });
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    loadData();
  }, [jobId]);

  async function loadData() {
    if (!jobId) return;
    const [j, diary] = await Promise.all([
      db.jobs.get(jobId),
      db.jobDiary.where('jobId').equals(jobId).toArray(),
    ]);
    setJob(j);
    setEntries(diary.sort((a, b) => (a.date > b.date ? -1 : 1)));
  }

  async function saveEntry() {
    if (!form.notes.trim() && !form.hoursWorked) {
      alert('Please add some notes or hours');
      return;
    }

    const now = new Date().toISOString();
    const entry = {
      id: uuid(),
      jobId,
      date: form.date,
      notes: form.notes,
      hoursWorked: parseFloat(form.hoursWorked) || 0,
      crewCount: parseInt(form.crewCount) || 1,
      weatherConditions: form.weatherConditions,
      photos: [],
      createdAt: now,
      syncedAt: null,
    };

    await db.jobDiary.add(entry);
    setForm({
      notes: '',
      hoursWorked: '',
      crewCount: '1',
      weatherConditions: '',
      date: new Date().toISOString().slice(0, 10),
    });
    setPhotos([]);
    setShowForm(false);
    loadData();
  }

  async function deleteEntry(entryId) {
    if (!confirm('Delete this diary entry?')) return;
    await db.jobDiary.delete(entryId);
    loadData();
  }

  const totalHours = entries.reduce((s, e) => s + (e.hoursWorked || 0), 0);
  const totalManHours = entries.reduce((s, e) => s + (e.hoursWorked || 0) * (e.crewCount || 1), 0);

  if (!jobId) return <div className="page"><p>No job specified</p></div>;

  const WEATHER_OPTIONS = ['Sunny', 'Cloudy', 'Rain', 'Hot', 'Cold', 'Windy', 'Storm'];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Job Diary</h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{job?.jobNumber} - {job?.clientName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/jobs/${jobId}`)}>Back</button>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-card-label">Entries</span>
          <span className="stat-card-value">{entries.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Total Hours</span>
          <span className="stat-card-value">{totalHours.toFixed(1)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Man-Hours</span>
          <span className="stat-card-value">{totalManHours.toFixed(1)}</span>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>New Entry</h3>
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>What was done today?</label>
            <VoiceInput
              value={form.notes}
              onChange={v => setForm(f => ({ ...f, notes: v }))}
              onTranscript={v => setForm(f => ({ ...f, notes: v }))}
              placeholder="Describe today's work (tap mic for voice)..."
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Hours Worked</label>
              <input type="number" inputMode="decimal" value={form.hoursWorked}
                onChange={e => setForm(f => ({ ...f, hoursWorked: e.target.value }))} placeholder="8" />
            </div>
            <div className="form-group">
              <label>Crew Size</label>
              <input type="number" value={form.crewCount}
                onChange={e => setForm(f => ({ ...f, crewCount: e.target.value }))} placeholder="1" />
            </div>
          </div>
          <div className="form-group">
            <label>Weather</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {WEATHER_OPTIONS.map(w => (
                <button key={w} className={`btn ${form.weatherConditions === w ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: 13 }}
                  onClick={() => setForm(f => ({ ...f, weatherConditions: w }))}>
                  {w}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Photos</label>
            <CameraInput onCapture={(blob) => setPhotos(prev => [...prev, blob])} multiple={true} label="Add Site Photos" />
          </div>
          <button className="btn btn-primary btn-block" onClick={saveEntry}>Save Entry</button>
        </div>
      )}

      {entries.length === 0 && !showForm ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <p>No diary entries yet</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Log what you did each day on site</p>
        </div>
      ) : (
        <div className="list-gap">
          {entries.map(e => (
            <div key={e.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{e.date}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {e.weatherConditions && (
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{e.weatherConditions}</span>
                  )}
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => deleteEntry(e.id)}>x</button>
                </div>
              </div>
              {e.notes && <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', marginBottom: 8 }}>{e.notes}</p>}
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {e.hoursWorked > 0 && `${e.hoursWorked}hrs`}
                {e.crewCount > 1 && ` · ${e.crewCount} crew`}
                {e.hoursWorked > 0 && e.crewCount > 1 && ` · ${(e.hoursWorked * e.crewCount).toFixed(1)} man-hours`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
