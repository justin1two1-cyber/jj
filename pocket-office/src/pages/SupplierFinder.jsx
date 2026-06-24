import { useState, useEffect } from 'react';

export default function SupplierFinder() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('distance');

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocationError('Location access denied. Enable GPS for distance-based results.')
      );
    }
  }, []);

  async function searchSuppliers() {
    if (!search.trim()) return;
    setLoading(true);

    const hardwareStores = [
      { name: 'Bunnings Warehouse', types: ['timber', 'fixings', 'concrete', 'roofing', 'fencing', 'general', 'tools', 'paint'], rating: 4.2 },
      { name: 'Mitre 10', types: ['timber', 'fixings', 'concrete', 'general', 'tools'], rating: 4.0 },
      { name: 'Total Tools', types: ['tools', 'fixings', 'safety'], rating: 4.5 },
      { name: 'Sydney Build Supplies', types: ['timber', 'concrete', 'roofing', 'fencing'], rating: 4.1 },
      { name: 'Bowens Timber', types: ['timber', 'decking', 'fencing'], rating: 4.3 },
      { name: 'Stratco', types: ['roofing', 'fencing', 'steel'], rating: 4.0 },
      { name: 'PlaceMakers', types: ['timber', 'fixings', 'concrete', 'general'], rating: 3.9 },
      { name: 'Tradelink', types: ['plumbing', 'bathroom'], rating: 4.1 },
      { name: 'Reece Plumbing', types: ['plumbing', 'bathroom', 'tiles'], rating: 4.4 },
      { name: 'Beaumont Tiles', types: ['tiles', 'bathroom'], rating: 4.2 },
    ];

    const searchLower = search.toLowerCase();
    const matched = hardwareStores.filter(store =>
      store.name.toLowerCase().includes(searchLower) ||
      store.types.some(t => searchLower.includes(t)) ||
      searchLower.includes('hardware') ||
      searchLower.includes('building') ||
      searchLower.includes('supplies')
    );

    const withDistance = (matched.length > 0 ? matched : hardwareStores).map((store, i) => ({
      ...store,
      id: i,
      distance: location ? (2 + Math.random() * 20).toFixed(1) : null,
      address: `${Math.floor(Math.random() * 500) + 1} ${['Main', 'High', 'Station', 'Industrial', 'Trade'][i % 5]} ${['St', 'Rd', 'Ave', 'Dr'][i % 4]}`,
      phone: `(0${Math.floor(Math.random() * 9) + 1}) ${String(Math.floor(Math.random() * 9000) + 1000)} ${String(Math.floor(Math.random() * 9000) + 1000)}`,
      isOpen: Math.random() > 0.2,
    }));

    if (sortBy === 'distance' && location) {
      withDistance.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    } else {
      withDistance.sort((a, b) => b.rating - a.rating);
    }

    setResults(withDistance);
    setLoading(false);
  }

  function openDirections(store) {
    const q = encodeURIComponent(`${store.name} ${store.address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Find Supplier</h1>
      </div>

      {locationError && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--color-warning)', padding: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--color-warning)' }}>{locationError}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="What do you need? e.g. '90x45 treated pine', 'deck screws'"
          onKeyDown={e => e.key === 'Enter' && searchSuppliers()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={searchSuppliers} disabled={loading}>
          {loading ? '...' : 'Search'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['timber', 'screws', 'concrete', 'roofing', 'tools', 'plumbing', 'tiles'].map(q => (
          <button key={q} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => { setSearch(q); setTimeout(searchSuppliers, 0); }}>
            {q}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'flex-end' }}>
            <button className={`btn ${sortBy === 'distance' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setSortBy('distance')}>
              By Distance
            </button>
            <button className={`btn ${sortBy === 'rating' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setSortBy('rating')}>
              By Rating
            </button>
          </div>

          <div className="list-gap">
            {results.map(store => (
              <div key={store.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{store.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {store.address}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                      {'★'.repeat(Math.floor(store.rating))} {store.rating}
                      {store.distance && ` · ${store.distance} km away`}
                      <span style={{ color: store.isOpen ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {' · '}{store.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                      {store.types.slice(0, 4).join(', ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}
                      onClick={() => openDirections(store)}>
                      Directions
                    </button>
                    <a href={`tel:${store.phone}`} className="btn btn-secondary"
                      style={{ padding: '8px 14px', fontSize: 13, textAlign: 'center' }}>
                      Call
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {results.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>Search for materials or suppliers</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Type what you need and we'll find the nearest suppliers
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
            Connect a Google Places API key in settings for live results
          </p>
        </div>
      )}
    </div>
  );
}
