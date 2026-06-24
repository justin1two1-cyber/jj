import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

export default function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    db.jobs.orderBy('createdAt').reverse().toArray().then(setJobs);
  }, []);

  return (
    <div className="page">
      <div className="page-header"><h1>Jobs</h1></div>
      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚒</div>
          <p>No jobs yet</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Accept a quote to create a job</p>
        </div>
      ) : (
        <div className="list-gap">
          {jobs.map(j => (
            <div key={j.id} className="card card-clickable" onClick={() => navigate(`/jobs/${j.id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{j.clientName || 'Untitled Job'}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{j.jobNumber} &middot; {j.siteAddress || 'No address'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="money" style={{ fontWeight: 600 }}>{formatCents(j.totalQuoted)}</div>
                  <span className={`badge badge-${j.status === 'in_progress' ? 'active' : j.status}`}>{j.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
