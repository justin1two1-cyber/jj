import { NavLink } from 'react-router-dom';
import './BottomNav.css';

const tabs = [
  { to: '/', icon: '⌂', label: 'Home' },
  { to: '/quotes', icon: '✎', label: 'Quotes' },
  { to: '/jobs', icon: '⚒', label: 'Jobs' },
  { to: '/expenses', icon: '\u{1F4B3}', label: 'Expenses' },
  { to: '/more', icon: '☰', label: 'More' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="bottom-nav-icon">{t.icon}</span>
          <span className="bottom-nav-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
