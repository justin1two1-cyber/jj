import { useState, useEffect } from 'react';

const STORE_DATA = [
  { name: 'Bunnings Warehouse', types: ['timber', 'fixings', 'concrete', 'roofing', 'fencing', 'general', 'tools', 'paint', 'screws', 'plumbing'] },
  { name: 'Mitre 10', types: ['timber', 'fixings', 'concrete', 'general', 'tools', 'screws'] },
  { name: 'Total Tools', types: ['tools', 'fixings', 'safety'] },
  { name: 'Bowens Timber', types: ['timber', 'decking', 'fencing'] },
  { name: 'Stratco', types: ['roofing', 'fencing', 'steel'] },
  { name: 'Tradelink', types: ['plumbing', 'bathroom'] },
  { name: 'Reece Plumbing', types: ['plumbing', 'bathroom', 'tiles'] },
  { name: 'Beaumont Tiles', types: ['tiles', 'bathroom'] },
  { name: 'Dulux Trade Centre', types: ['paint'] },
  { name: 'Masters Home Improvement', types: ['timber', 'tools', 'general', 'paint', 'concrete'] },
];

export default function SupplierFinder() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('distance');
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocationError('Location access denied. Enable GPS for distance-based results.')
      );
    }
  }, []);

  function matchingStores(query) {
    const q = query.toLowerCase();
    return STORE_DATA.filter(store =>
      store.name.toLowerCase().includes(q) ||
      store.types.some(t => q.includes(t)) ||
      q.includes('hardware') || q.includes('building') || q.includes('supplies')
    );
  }

  function fallbackSearch(query) {
    const matched = matchingStores(query);
    const stores = (matched.length > 0 ? matched : STORE_DATA).map((store, i) => ({
      ...store,
      id: `mock-${i}`,
      distance: location ? (1.5 + Math.random() * 18).toFixed(1) : null,
      address: `${Math.floor(Math.random() * 400) + 1} ${['Main', 'High', 'Station', 'Industrial', 'Trade'][i % 5]} ${['St', 'Rd', 'Ave'][i % 3]}, ${['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide'][i % 5]}`,
      phone: null,
      rating: (3.5 + Math.random() * 1.5).toFixed(1),
      isOpen: true,
      isLive: false,
    }));
    if (sortBy === 'distance' && location) {
      stores.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    } else {
      stores.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    }
    return stores;
  }

  async function searchSuppliers() {
    if (!search.trim()) return;
    setLoading(true);

    if (apiKey && apiKey !== 'your_api_key_here' && location) {
      try {
        const storeNames = matchingStores(search);
        const searchTerm = storeNames.length > 0 ? storeNames[0].name : `${search} building supplies`;
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=25000&keyword=${encodeURIComponent(searchTerm)}&key=${apiKey}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.results?.length > 0) {
          const live = data.results.slice(0, 10).map((place, i) => ({
            id: place.place_id || `live-${i}`,
            name: place.name,
            address: place.vicinity || '',
            distance: location ? calcDistance(location.lat, location.lng, place.geometry.location.lat, place.geometry.location.lng).toFixed(1) : null,
            rating: place.rating || 0,
            phone: null,
            isOpen: place.opening_hours?.open_now ?? true,
            types: place.types || [],
            isLive: true,
          }));
          if (sortBy === 'distance') live.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
          else live.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
          setResults(live);
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to mock data
      }
    }

    setResults(fallbackSearch(search));
    setLoading(false);
  }

  function calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function openDirections(store) {
    const q = encodeURIComponent(`${store.name} ${store.address}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
  }

  function handleQuickSearch(q) {
    setSearch(q);
    setTimeout(() => {
      setSearch(q);
      const input = document.querySelector('input[placeholder*="What do you need"]');
      if (input) input.value = q;
    }, 0);
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
        {['timber', 'screws', 'concrete', 'roofing', 'tools', 'plumbing', 'tiles', 'paint'].map(q => (
          <button key={q} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}
            onClick={() => { setSearch(q); }}>
            {q}
          </button>
        ))}
      </div>

      {results.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {results[0]?.isLive ? 'Live results' : 'Sample results — add Google Places API key for live data'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`btn ${sortBy === 'distance' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setSortBy('distance')}>
                Distance
              </button>
              <button className={`btn ${sortBy === 'rating' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => setSortBy('rating')}>
                Rating
              </button>
            </div>
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
                      {'★'.repeat(Math.floor(parseFloat(store.rating)))} {store.rating}
                      {store.distance && ` · ${store.distance} km`}
                      <span style={{ color: store.isOpen ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {' · '}{store.isOpen ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }}
                      onClick={() => openDirections(store)}>
                      Directions
                    </button>
                    {store.phone && (
                      <a href={`tel:${store.phone}`} className="btn btn-secondary"
                        style={{ padding: '8px 14px', fontSize: 13, textAlign: 'center' }}>
                        Call
                      </a>
                    )}
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
          {(!apiKey || apiKey === 'your_api_key_here') && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Add a Google Places API key in .env for live supplier results
            </p>
          )}
        </div>
      )}
    </div>
  );
}
