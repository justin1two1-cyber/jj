import { downloadFile, formatDateAu, centsToStr } from './csvHelpers';

export function exportMyobExpenses(expenses) {
  const headers = ['Co./Last Name', 'Date', 'Memo', 'Amount Inc Tax', 'Tax Code', 'Account No.', 'Payment Method'];
  const rows = expenses.map(e => [
    e.supplier || 'Unknown',
    formatDateAu(e.date),
    e.description || e.category,
    centsToStr(e.amount),
    e.gstIncluded ? 'GST' : 'FRE',
    getCategoryAccount(e.category),
    e.paymentMethod === 'card' ? 'VISA' : e.paymentMethod === 'cash' ? 'Cash' : 'EFT',
  ]);

  const content = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
  downloadFile(content, `myob-expenses-${new Date().toISOString().slice(0, 10)}.txt`, 'text/tab-separated-values');
}

export function exportMyobInvoices(invoices, clients) {
  const clientMap = {};
  clients.forEach(c => { clientMap[c.id] = c; });

  const headers = ['Co./Last Name', 'Invoice #', 'Date', 'Total Including Tax', 'Tax Code', 'Description', 'Account No.'];
  const rows = invoices.map(inv => {
    const client = clientMap[inv.clientId] || {};
    return [
      client.name || inv.clientName || 'Unknown',
      inv.invoiceNumber,
      formatDateAu(inv.dateSent || inv.createdAt),
      centsToStr(inv.totalAmount),
      'GST',
      `Invoice ${inv.invoiceNumber}`,
      '4-1100',
    ];
  });

  const content = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
  downloadFile(content, `myob-invoices-${new Date().toISOString().slice(0, 10)}.txt`, 'text/tab-separated-values');
}

function getCategoryAccount(category) {
  const map = {
    materials: '5-1100', fuel: '6-2400', tools: '6-3100',
    subcontractor: '5-1200', food: '6-2100', insurance: '6-4100',
    rego: '6-4200', other: '6-5000',
  };
  return map[category] || '6-5000';
}
