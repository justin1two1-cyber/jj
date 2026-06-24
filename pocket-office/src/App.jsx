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
import JobDiary from './pages/JobDiary';
import JobPhotos from './pages/JobPhotos';
import Variations from './pages/Variations';
import Expenses from './pages/Expenses';
import NewExpense from './pages/NewExpense';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import NewClient from './pages/NewClient';
import Invoices from './pages/Invoices';
import NewInvoice from './pages/NewInvoice';
import InvoiceDetail from './pages/InvoiceDetail';
import MileageLog from './pages/MileageLog';
import TimeLog from './pages/TimeLog';
import SupplierFinder from './pages/SupplierFinder';
import Materials from './pages/Materials';
import Assets from './pages/Assets';
import Compliance from './pages/Compliance';
import SWMS from './pages/SWMS';
import WeatherCheck from './pages/WeatherCheck';
import Reports from './pages/Reports';
import DataExport from './pages/DataExport';
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
          <Route path="/jobs/:id/diary" element={<JobDiary />} />
          <Route path="/jobs/:id/photos" element={<JobPhotos />} />
          <Route path="/jobs/:id/variations" element={<Variations />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/expenses/new" element={<NewExpense />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/new" element={<NewClient />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/new" element={<NewInvoice />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/mileage" element={<MileageLog />} />
          <Route path="/time-log" element={<TimeLog />} />
          <Route path="/supplier-finder" element={<SupplierFinder />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/compliance" element={<Compliance />} />
          <Route path="/swms" element={<SWMS />} />
          <Route path="/weather" element={<WeatherCheck />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/data-export" element={<DataExport />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/more" element={<MoreMenu />} />
        </Routes>
      </main>
      {isMobile && <BottomNav />}
    </div>
  );
}
