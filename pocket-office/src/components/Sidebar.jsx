import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const sections = [
  {
    title: null,
    items: [
      { to: '/', icon: '⌂', label: 'Dashboard' },
    ]
  },
  {
    title: 'Work',
    items: [
      { to: '/quotes', icon: '✎', label: 'Quotes' },
      { to: '/jobs', icon: '⚒', label: 'Jobs' },
      { to: '/clients', icon: '⊕', label: 'Clients' },
      { to: '/invoices', icon: '⊞', label: 'Invoices' },
    ]
  },
  {
    title: 'Tracking',
    items: [
      { to: '/expenses', icon: '\u{1F4B3}', label: 'Expenses' },
      { to: '/mileage', icon: '⊙', label: 'Mileage' },
      { to: '/time-log', icon: '◷', label: 'Time Log' },
    ]
  },
  {
    title: 'Tools',
    items: [
      { to: '/materials', icon: '▦', label: 'Materials' },
      { to: '/supplier-finder', icon: '⊕', label: 'Find Supplier' },
      { to: '/swms', icon: '⚠', label: 'SWMS' },
      { to: '/assets', icon: '⊟', label: 'Assets' },
      { to: '/compliance', icon: '✓', label: 'Compliance' },
    ]
  },
  {
    title: 'Business',
    items: [
      { to: '/reports', icon: '⊞', label: 'Reports' },
      { to: '/data-export', icon: '↓', label: 'Data & Export' },
      { to: '/weather', icon: '☁', label: 'Weather' },
      { to: '/settings', icon: '⚙', label: 'Settings' },
    ]
  },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">PO</span>
        <div>
          <div className="sidebar-title">Pocket Office</div>
          <div className="sidebar-subtitle">by Nesso</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {sections.map((section, i) => (
          <div key={i} className="sidebar-section">
            {section.title && <div className="sidebar-section-title">{section.title}</div>}
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
