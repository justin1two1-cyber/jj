import { Routes, Route } from 'react-router-dom';
import { useResponsive } from './hooks/useResponsive';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import QuotesList from './pages/QuotesList';
import NewQuote from './pages/NewQuote';
import QuoteDetail from './pages/QuoteDetail';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Expenses from './pages/Expenses';
import NewExpense from './pages/NewExpense';
import Materials from './pages/Materials';
import Settings from './pages/Settings';
import MoreMenu from './pages/MoreMenu';
import './App.css';

export default function App() {
  const { isMobile } = useResponsive();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/quotes" element={<QuotesList />} />
          <Route path="/quotes/new" element={<NewQuote />} />
          <Route path="/quotes/:id" element={<QuoteDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/expenses/new" element={<NewExpense />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/more" element={<MoreMenu />} />
        </Routes>
      </main>
      {isMobile && <BottomNav />}
    </div>
  );
}
