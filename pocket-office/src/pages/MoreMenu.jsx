import { useNavigate } from 'react-router-dom';

const menuItems = [
  { to: '/employees', icon: '👷', label: 'Employees', desc: 'Manage your crew' },
  { to: '/clock', icon: '⏱', label: 'Clock In / Out', desc: 'Employee clock on and off' },
  { to: '/timesheets', icon: '📋', label: 'Timesheets', desc: 'Review employee hours and shifts' },
  { to: '/materials', icon: '▦', label: 'Materials Database', desc: 'View and update material prices' },
  { to: '/clients', icon: '⊕', label: 'Clients', desc: 'Client contact book' },
  { to: '/invoices', icon: '⊞', label: 'Invoices', desc: 'Create and track invoices' },
  { to: '/mileage', icon: '⊙', label: 'Mileage Log', desc: 'Track trips and ATO deductions' },
  { to: '/time-log', icon: '◷', label: 'Time Log', desc: 'Job time tracking' },
  { to: '/supplier-finder', icon: '⊕', label: 'Find Supplier', desc: 'Find nearby material suppliers' },
  { to: '/swms', icon: '⚠', label: 'SWMS', desc: 'Safety documents' },
  { to: '/assets', icon: '⊟', label: 'Asset Register', desc: 'Tools and equipment' },
  { to: '/compliance', icon: '✓', label: 'Compliance', desc: 'Licences and insurance' },
  { to: '/weather', icon: '☁', label: 'Weather Check', desc: '3-day forecast for job sites' },
  { to: '/reports', icon: '⊞', label: 'Reports', desc: 'Business reports and exports' },
  { to: '/data-export', icon: '↓', label: 'Data & Export', desc: 'Accounting export, backup & restore' },
  { to: '/settings', icon: '⚙', label: 'Settings', desc: 'Business details and defaults' },
];

export default function MoreMenu() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-header"><h1>More</h1></div>
      <div className="list-gap">
        {menuItems.map(item => (
          <div key={item.to} className="card card-clickable" onClick={() => navigate(item.to)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 22, width: 32, textAlign: 'center' }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{item.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
