import { useState } from 'react';

const WMO_CODES = {
  0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime Fog',
  51: 'Light Drizzle', 53: 'Moderate Drizzle', 55: 'Dense Drizzle',
  61: 'Light Rain', 63: 'Moderate Rain', 65: 'Heavy Rain',
  71: 'Light Snow', 73: 'Moderate Snow', 75: 'Heavy Snow',
  80: 'Light Showers', 81: 'Moderate Showers', 82: 'Heavy Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + Hail', 99: 'Thunderstorm + Heavy Hail',
};

function getWeatherIcon(code) {
  if (code <= 1) return '☀';
  if (code === 2) return '⛅';
  if (code === 3) return '☁';
  if (code <= 48) return '🌫';
  if (code <= 55) return '🌦';
  if (code <= 65) return '🌧';
  if (code <= 75) return '❄';
  if (code <= 82) return '🌧';
  return '⛈';
}

async function geocode(query) {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
  );
  const data = await res.json();
  if (!data.results?.length) return null;
  const r = data.results[0];
  return { lat: r.latitude, lng: r.longitude, name: r.name + (r.admin1 ? `, ${r.admin1}` : '') };
}

async function fetchForecast(lat, lng) {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=3`
  );
  return res.json();
}

export default function WeatherCheck() {
  const [location, setLocation] = useState('');
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function checkWeather() {
    setError('');
    setLoading(true);

    try {
      let lat, lng, locName;

      if (!location.trim()) {
        if (!navigator.geolocation) {
          setError('Please enter a location');
          setLoading(false);
          return;
        }
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        locName = `${lat.toFixed(2)}°S, ${lng.toFixed(2)}°E`;
      } else {
        const geo = await geocode(location);
        if (!geo) {
          setError('Location not found. Try a city or suburb name.');
          setLoading(false);
          return;
        }
        lat = geo.lat;
        lng = geo.lng;
        locName = geo.name;
      }

      const data = await fetchForecast(lat, lng);
      const days = data.daily.time.map((date, i) => {
        const code = data.daily.weather_code[i];
        const wind = data.daily.wind_speed_10m_max[i];
        const condition = WMO_CODES[code] || 'Unknown';
        return {
          date: new Date(date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
          code,
          condition,
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
          rainChance: data.daily.precipitation_probability_max[i],
          wind: Math.round(wind),
          workSafe: code < 95 && wind < 40,
        };
      });

      setForecast({ location: locName, days });
    } catch {
      setError('Could not fetch weather. Check your connection and try again.');
    }
    setLoading(false);
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
          placeholder="Enter suburb or city, or use GPS"
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
                <div style={{ fontSize: 48, marginBottom: 8 }}>{getWeatherIcon(day.code)}</div>
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
                  marginTop: 8, padding: '4px 12px',
                  background: day.workSafe ? '#e8f0ea' : '#f5e8e8',
                  color: day.workSafe ? 'var(--color-success)' : 'var(--color-danger)',
                  border: day.workSafe ? '1px solid var(--color-success)' : '1px solid var(--color-danger)',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-block',
                }}>
                  {day.workSafe ? 'Good to work' : 'Check conditions'}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Powered by Open-Meteo. Always check conditions on-site before starting work,
              especially for heights, roofing, and outdoor concrete pours.
            </p>
          </div>
        </>
      )}

      {!forecast && !loading && (
        <div className="empty-state">
          <div className="empty-state-icon">🌤</div>
          <p>Check the weather before heading to site</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>Enter a suburb name or use GPS for your current location</p>
        </div>
      )}
    </div>
  );
}
