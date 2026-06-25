import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { db, storePhoto, getPhoto, deletePhoto as deletePhotoBlob } from '../db';
import CameraInput from '../components/CameraInput';

const PHASES = ['before', 'during', 'after'];

export default function JobPhotos() {
  const navigate = useNavigate();
  const { id: jobId } = useParams();
  const [job, setJob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState('during');
  const [caption, setCaption] = useState('');
  const [filterPhase, setFilterPhase] = useState('all');

  useEffect(() => {
    loadData();
  }, [jobId]);

  async function loadData() {
    if (!jobId) return;
    const [j, p] = await Promise.all([
      db.jobs.get(jobId),
      db.jobPhotos.where('jobId').equals(jobId).toArray(),
    ]);
    setJob(j);
    const withUrls = await Promise.all(p.map(async (photo) => {
      const blob = await getPhoto(photo.photo);
      return { ...photo, blobUrl: blob ? URL.createObjectURL(blob) : null };
    }));
    setPhotos(withUrls.sort((a, b) => (a.takenAt > b.takenAt ? -1 : 1)));
  }

  async function handleCapture(blob) {
    if (!blob) return;
    const now = new Date().toISOString();
    const photoKey = `photo_${uuid()}`;
    await storePhoto(photoKey, blob);
    const photo = {
      id: uuid(),
      jobId,
      photo: photoKey,
      caption,
      phase: selectedPhase,
      takenAt: now,
      syncedAt: null,
    };
    await db.jobPhotos.add(photo);
    setCaption('');
    setShowUpload(false);
    loadData();
  }

  async function handleDeletePhoto(photoId) {
    if (!confirm('Delete this photo?')) return;
    const photo = photos.find(p => p.id === photoId);
    if (photo?.photo) await deletePhotoBlob(photo.photo);
    if (photo?.blobUrl) URL.revokeObjectURL(photo.blobUrl);
    await db.jobPhotos.delete(photoId);
    loadData();
  }

  const filtered = filterPhase === 'all' ? photos : photos.filter(p => p.phase === filterPhase);

  const phaseCounts = {
    before: photos.filter(p => p.phase === 'before').length,
    during: photos.filter(p => p.phase === 'during').length,
    after: photos.filter(p => p.phase === 'after').length,
  };

  if (!jobId) return <div className="page"><p>No job specified</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Photo Timeline</h1>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{job?.jobNumber} - {job?.clientName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? 'Cancel' : '+ Add Photo'}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate(`/jobs/${jobId}`)}>Back</button>
        </div>
      </div>

      {showUpload && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-group">
            <label>Phase</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PHASES.map(p => (
                <button key={p} className={`btn ${selectedPhase === p ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', flex: 1 }}
                  onClick={() => setSelectedPhase(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Caption (optional)</label>
            <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Describe what's in the photo" />
          </div>
          <CameraInput onCapture={handleCapture} label="Take Photo" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', ...PHASES].map(p => (
          <button key={p} className={`btn ${filterPhase === p ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setFilterPhase(p)}>
            {p === 'all' ? `All (${photos.length})` : `${p.charAt(0).toUpperCase() + p.slice(1)} (${phaseCounts[p]})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📸</div>
          <p>No photos yet</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Document your work with before, during, and after shots</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {filtered.map(p => (
            <div key={p.id} className="card" style={{ padding: 8 }}>
              <div style={{
                width: '100%', paddingBottom: '100%',
                background: 'var(--color-surface-hover)',
                marginBottom: 8,
                position: 'relative', overflow: 'hidden',
              }}>
                {p.blobUrl ? (
                  <img src={p.blobUrl} alt={p.caption || 'Job photo'}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 32 }}>
                    📷
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`badge badge-${p.phase === 'before' ? 'sent' : p.phase === 'during' ? 'active' : 'accepted'}`}
                  style={{ fontSize: 10 }}>
                  {p.phase}
                </span>
                <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => handleDeletePhoto(p.id)}>x</button>
              </div>
              {p.caption && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{p.caption}</div>}
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {new Date(p.takenAt).toLocaleDateString('en-AU')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
