import { useState } from 'react';

export default function WeatherCheck() {
  const [location, setLocation] = useState('');
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkWeather() {
    if (!location.trim()) {
      if (navigator.geolocation) {
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => generateMockForecast(`Lat ${pos.coords.latitude.toFixed(2)}, Lng ${pos.coords.longitude.toFixed(2)}`),
          () => { setError('Enable GPS or enter a location'); setLoading(false); }
        );
      } else {
        setError('Please enter a location');
      }
      return;
    }
    setLoading(true);
    generateMockForecast(location);
  }

  function generateMockForecast(loc) {
    const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Heavy Rain', 'Storms', 'Windy'];
    const days = [];
    for (let i = 0; i < 3; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      const high = Math.floor(Math.random() * 15) + 18;
      const low = high - Math.floor(Math.random() * 8) - 5;
      const rainChance = condition.includes('Rain') || condition.includes('Storm') ? Math.floor(Math.random() * 50) + 50 : Math.floor(Math.random() * 30);
      const wind = Math.floor(Math.random() * 30) + 5;

      days.push({
        date: date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
        condition,
        high,
        low,
        rainChance,
        wind,
        workSafe: !condition.includes('Storm') && !condition.includes('Heavy') && wind < 40,
      });
    }

    setForecast({ location: loc, days });
    setLoading(false);
    setError('');
  }

  function getWeatherIcon(condition) {
    if (condition.includes('Sunny')) return '☀';
    if (condition.includes('Partly')) return '⛅';
    if (condition.includes('Cloudy')) return '☁';
    if (condition.includes('Light Rain')) return '🌦';
    if (condition.includes('Heavy Rain')) return '🌧';
    if (condition.includes('Storm')) return '⛈';
    if (condition.includes('Windy')) return '💨';
    return '☀';
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Weather Check</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Enter job site address or use GPS"
          onKeyDown={e => e.key === 'Enter' && checkWeather()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={checkWeather} disabled={loading}>
          {loading ? '...' : 'Check'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--color-warning)' }}>
          <p style={{ color: 'var(--color-warning)' }}>{error}</p>
        </div>
      )}

      {forecast && (
        <>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: 13 }}>
            3-day forecast for {forecast.location}
          </p>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {forecast.days.map((day, i) => (
              <div key={i} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{day.date}</div>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{getWeatherIcon(day.condition)}</div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{day.condition}</div>
                <div style={{ margin: '12px 0', display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>High</div>
                    <div style={{ fontWeight: 600, fontSize: 20 }}>{day.high}°</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Low</div>
                    <div style={{ fontWeight: 600, fontSize: 20, color: 'var(--color-text-secondary)' }}>{day.low}°</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Rain: {day.rainChance}% · Wind: {day.wind}km/h
                </div>
                <div style={{
                  marginTop: 8, padding: '4px 12px', borderRadius: 100,
                  background: day.workSafe ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: day.workSafe ? 'var(--color-success)' : 'var(--color-danger)',
                  fontSize: 13, fontWeight: 600, display: 'inline-block',
                }}>
                  {day.workSafe ? 'Good to work' : 'Check conditions'}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Weather data is simulated. Connect a weather API key in settings for live forecasts.
              Always check conditions on-site before starting work, especially for heights, roofing, and outdoor concrete pours.
            </p>
          </div>
        </>
      )}

      {!forecast && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">🌤</div>
          <p>Check the weather before heading to site</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Enter a job site address or use your GPS location</p>
        </div>
      )}
    </div>
  );
}
