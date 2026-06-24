import { useState, useEffect } from 'react';
import { db } from '../db';
import { formatCents } from '../utils/formatCurrency';

const REPORT_TYPES = ['overview', 'profit_loss', 'expenses', 'gst', 'mileage', 'time'];

export default function Reports() {
  const [reportType, setReportType] = useState('overview');
  const [period, setPeriod] = useState('this_month');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReport(); }, [reportType, period]);

  function getDateRange() {
    const now = new Date();
    let start, end;
    switch (period) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_quarter':
        const qStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), qStart, 1);
        end = new Date(now.getFullYear(), qStart + 3, 0);
        break;
      case 'this_fy':
        start = new Date(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1, 6, 1);
        end = new Date(start.getFullYear() + 1, 5, 30);
        break;
      case 'all_time':
        start = new Date(2000, 0, 1);
        end = new Date(2099, 11, 31);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
    }
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  async function loadReport() {
    setLoading(true);
    const { start, end } = getDateRange();

    const [expenses, jobs, quotes, invoices, mileage, timeLogs] = await Promise.all([
      db.expenses.toArray(),
      db.jobs.toArray(),
      db.quotes.toArray(),
      db.invoices.toArray(),
      db.mileageLog.toArray(),
      db.timeLog.toArray(),
    ]);

    const filteredExpenses = expenses.filter(e => e.date >= start && e.date <= end);
    const filteredMileage = mileage.filter(m => m.date >= start && m.date <= end);
    const filteredTime = timeLogs.filter(t => t.date >= start && t.date <= end);
    const filteredInvoices = invoices.filter(i => (i.datePaid || i.dateSent || '') >= start);

    const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalGstPaid = filteredExpenses.reduce((s, e) => s + (e.gstAmount || 0), 0);
    const totalIncome = filteredInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0);
    const totalGstCollected = filteredInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.gstAmount || 0), 0);

    const expenseByCategory = {};
    filteredExpenses.forEach(e => {
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + (e.amount || 0);
    });

    const totalKm = filteredMileage.reduce((s, m) => s + (m.distanceKm || 0), 0);
    const totalDeduction = filteredMileage.reduce((s, m) => s + (m.deductionAmount || 0), 0);

    const totalOnSite = filteredTime.reduce((s, t) => s + (t.onSiteMinutes || 0), 0);
    const totalTravel = filteredTime.reduce((s, t) => s + (t.travelMinutes || 0), 0);

    const jobPnL = jobs.map(j => {
      const jobExps = expenses.filter(e => e.jobId === j.id);
      const jobExpTotal = jobExps.reduce((s, e) => s + (e.amount || 0), 0);
      return {
        ...j,
        expenses: jobExpTotal,
        profit: (j.totalQuoted || 0) + (j.totalVariations || 0) - jobExpTotal,
      };
    });

    const timeByJob = {};
    filteredTime.forEach(t => {
      if (!timeByJob[t.jobId]) timeByJob[t.jobId] = { onSite: 0, travel: 0 };
      timeByJob[t.jobId].onSite += t.onSiteMinutes || 0;
      timeByJob[t.jobId].travel += t.travelMinutes || 0;
    });

    const jobTimeBreakdown = Object.entries(timeByJob).map(([jobId, times]) => {
      const job = jobs.find(j => j.id === jobId);
      return { jobId, jobNumber: job?.jobNumber || '?', clientName: job?.clientName || 'Unknown', ...times };
    }).sort((a, b) => (b.onSite + b.travel) - (a.onSite + a.travel));

    setData({
      totalExpenses, totalGstPaid, totalIncome, totalGstCollected,
      expenseByCategory, totalKm, totalDeduction,
      totalOnSite, totalTravel, jobPnL,
      filteredExpenses, filteredMileage, filteredTime,
      jobTimeBreakdown,
      netGst: totalGstCollected - totalGstPaid,
      profit: totalIncome - totalExpenses,
      activeJobs: jobs.filter(j => j.status === 'in_progress').length,
      pendingQuotes: quotes.filter(q => q.status === 'sent').length,
    });
    setLoading(false);
  }

  function exportCsv(rows, filename) {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const val = r[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportExpensesCsv() {
    const rows = (data.filteredExpenses || []).map(e => ({
      Date: e.date,
      Description: e.description || '',
      Category: e.category,
      Amount: ((e.amount || 0) / 100).toFixed(2),
      GST: ((e.gstAmount || 0) / 100).toFixed(2),
      Supplier: e.supplier || '',
      Payment: e.paymentMethod || '',
      Deductible: e.taxDeductible ? 'Yes' : 'No',
    }));
    exportCsv(rows, `expenses-${period}.csv`);
  }

  function exportMileageCsv() {
    const rows = (data.filteredMileage || []).map(m => ({
      Date: m.date,
      From: m.startAddress || '',
      To: m.endAddress || '',
      'Distance (km)': m.distanceKm,
      Purpose: m.purpose || '',
      'ATO Rate (c/km)': m.atoRatePerKm,
      'Deduction ($)': ((m.deductionAmount || 0) / 100).toFixed(2),
    }));
    exportCsv(rows, `mileage-${period}.csv`);
  }

  if (loading) return <div className="page"><p>Loading report...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {[
          { v: 'this_month', l: 'This Month' }, { v: 'last_month', l: 'Last Month' },
          { v: 'this_quarter', l: 'Quarter' }, { v: 'this_fy', l: 'Financial Year' },
          { v: 'all_time', l: 'All Time' },
        ].map(p => (
          <button key={p.v} className={`btn ${period === p.v ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: 13, flexShrink: 0 }}
            onClick={() => setPeriod(p.v)}>
            {p.l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
        {REPORT_TYPES.map(t => (
          <button key={t} className={`btn ${reportType === t ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0 }}
            onClick={() => setReportType(t)}>
            {t.replace('_', '/').split('/').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      {reportType === 'overview' && (
        <div>
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <span className="stat-card-label">Income</span>
              <span className="stat-card-value money money-positive" style={{ fontSize: 22 }}>{formatCents(data.totalIncome)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Expenses</span>
              <span className="stat-card-value money money-negative" style={{ fontSize: 22 }}>{formatCents(data.totalExpenses)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Net Profit</span>
              <span className={`stat-card-value money ${data.profit >= 0 ? 'money-positive' : 'money-negative'}`} style={{ fontSize: 22 }}>
                {formatCents(data.profit)}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">GST Owing</span>
              <span className="stat-card-value money" style={{ fontSize: 22 }}>{formatCents(data.netGst)}</span>
            </div>
          </div>
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="stat-card">
              <span className="stat-card-label">Active Jobs</span>
              <span className="stat-card-value">{data.activeJobs}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Pending Quotes</span>
              <span className="stat-card-value">{data.pendingQuotes}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Mileage Deduction</span>
              <span className="stat-card-value money money-positive" style={{ fontSize: 18 }}>{formatCents(data.totalDeduction)}</span>
            </div>
          </div>
        </div>
      )}

      {reportType === 'profit_loss' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontWeight: 600 }}>Income</span>
              <span className="money money-positive" style={{ fontWeight: 600 }}>{formatCents(data.totalIncome)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontWeight: 600 }}>Expenses</span>
              <span className="money money-negative" style={{ fontWeight: 600 }}>{formatCents(data.totalExpenses)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 18 }}>
              <span>Net Profit</span>
              <span className={`money ${data.profit >= 0 ? 'money-positive' : 'money-negative'}`}>{formatCents(data.profit)}</span>
            </div>
          </div>

          <h3 style={{ marginBottom: 12 }}>By Job</h3>
          <div className="list-gap">
            {data.jobPnL.map(j => (
              <div key={j.id} className="card" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{j.jobNumber} - {j.clientName}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    Quoted: {formatCents(j.totalQuoted)} · Expenses: {formatCents(j.expenses)}
                  </div>
                </div>
                <span className={`money ${j.profit >= 0 ? 'money-positive' : 'money-negative'}`} style={{ fontWeight: 600 }}>
                  {formatCents(j.profit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportType === 'expenses' && (() => {
        const entries = Object.entries(data.expenseByCategory || {}).sort((a, b) => b[1] - a[1]);
        const maxAmount = entries.length > 0 ? Math.max(...entries.map(([, a]) => a)) : 1;
        const catColors = { materials: '#3b82f6', fuel: '#f59e0b', tools: '#8b5cf6', subcontractor: '#06b6d4', food: '#f97316', insurance: '#22c55e', rego: '#ec4899', other: '#64748b' };
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3>Expense Breakdown</h3>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}
                onClick={exportExpensesCsv}>Export CSV</button>
            </div>
            {entries.length > 0 && (
              <div className="card" style={{ marginBottom: 16, padding: 20 }}>
                {entries.map(([cat, amount]) => (
                  <div key={cat} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                      <span className="money">{formatCents(amount)}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--color-surface-hover)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: `${(amount / maxAmount) * 100}%`,
                        background: catColors[cat] || '#64748b',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total</span>
              <span className="money">{formatCents(data.totalExpenses)}</span>
            </div>
          </div>
        );
      })()}

      {reportType === 'gst' && (
        <div>
          <h3 style={{ marginBottom: 12 }}>GST Summary (BAS Ready)</h3>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>1A: GST on Sales</span>
              <span className="money" style={{ fontWeight: 600 }}>{formatCents(data.totalGstCollected)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>1B: GST on Purchases</span>
              <span className="money" style={{ fontWeight: 600 }}>{formatCents(data.totalGstPaid)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontWeight: 700, fontSize: 18 }}>
              <span>Net GST {data.netGst >= 0 ? 'Payable' : 'Refund'}</span>
              <span className={`money ${data.netGst >= 0 ? 'money-negative' : 'money-positive'}`}>
                {formatCents(Math.abs(data.netGst))}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Export your expenses to your accounting software for BAS lodgement.
          </p>
        </div>
      )}

      {reportType === 'mileage' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3>Mileage Summary</h3>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 13 }}
              onClick={exportMileageCsv}>Export CSV</button>
          </div>
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="stat-card">
              <span className="stat-card-label">Trips</span>
              <span className="stat-card-value">{(data.filteredMileage || []).length}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Total KMs</span>
              <span className="stat-card-value">{data.totalKm.toFixed(1)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">Tax Deduction</span>
              <span className="stat-card-value money money-positive" style={{ fontSize: 18 }}>{formatCents(data.totalDeduction)}</span>
            </div>
          </div>
        </div>
      )}

      {reportType === 'time' && (() => {
        const fmtMins = (mins) => { const h = Math.floor(mins / 60); const m = mins % 60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
        return (
          <div>
            <h3 style={{ marginBottom: 12 }}>Time Analysis</h3>
            <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 20 }}>
              <div className="stat-card">
                <span className="stat-card-label">Entries</span>
                <span className="stat-card-value">{(data.filteredTime || []).length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">On-Site Hours</span>
                <span className="stat-card-value">{(data.totalOnSite / 60).toFixed(1)}</span>
              </div>
              <div className="stat-card">
                <span className="stat-card-label">Travel Hours</span>
                <span className="stat-card-value">{(data.totalTravel / 60).toFixed(1)}</span>
              </div>
            </div>
            {(data.jobTimeBreakdown || []).length > 0 && (
              <>
                <h3 style={{ marginBottom: 12 }}>Time by Job</h3>
                <div className="list-gap">
                  {data.jobTimeBreakdown.map(j => (
                    <div key={j.jobId} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{j.jobNumber} - {j.clientName}</div>
                          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                            On-site: {fmtMins(j.onSite)} · Travel: {fmtMins(j.travel)}
                          </div>
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 18 }}>{fmtMins(j.onSite + j.travel)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}
