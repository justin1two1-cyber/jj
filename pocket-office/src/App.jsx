import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useResponsive } from './hooks/useResponsive';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import InstallPrompt from './components/InstallPrompt';
import Dashboard from './pages/Dashboard';
import './App.css';

const QuotesList = lazy(() => import('./pages/QuotesList'));
const NewQuote = lazy(() => import('./pages/NewQuote'));
const QuoteDetail = lazy(() => import('./pages/QuoteDetail'));
const Jobs = lazy(() => import('./pages/Jobs'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const JobDiary = lazy(() => import('./pages/JobDiary'));
const JobPhotos = lazy(() => import('./pages/JobPhotos'));
const Variations = lazy(() => import('./pages/Variations'));
const Expenses = lazy(() => import('./pages/Expenses'));
const NewExpense = lazy(() => import('./pages/NewExpense'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const NewClient = lazy(() => import('./pages/NewClient'));
const Invoices = lazy(() => import('./pages/Invoices'));
const NewInvoice = lazy(() => import('./pages/NewInvoice'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const MileageLog = lazy(() => import('./pages/MileageLog'));
const TimeLog = lazy(() => import('./pages/TimeLog'));
const SupplierFinder = lazy(() => import('./pages/SupplierFinder'));
const Materials = lazy(() => import('./pages/Materials'));
const Assets = lazy(() => import('./pages/Assets'));
const Compliance = lazy(() => import('./pages/Compliance'));
const SWMS = lazy(() => import('./pages/SWMS'));
const WeatherCheck = lazy(() => import('./pages/WeatherCheck'));
const Reports = lazy(() => import('./pages/Reports'));
const DataExport = lazy(() => import('./pages/DataExport'));
const Settings = lazy(() => import('./pages/Settings'));
const MoreMenu = lazy(() => import('./pages/MoreMenu'));

function Loading() {
  return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>Loading...</div>
      </div>
    </div>
  );
}

export default function App() {
  const { isMobile } = useResponsive();

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/quotes" element={<QuotesList />} />
            <Route path="/quotes/new" element={<NewQuote />} />
            <Route path="/quotes/:id" element={<QuoteDetail />} />
            <Route path="/quotes/:id/edit" element={<NewQuote />} />
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
        </Suspense>
      </main>
      {isMobile && <BottomNav />}
      <InstallPrompt />
    </div>
  );
}
