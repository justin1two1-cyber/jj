import { toCsv, downloadFile, formatDateAu, centsToStr } from './csvHelpers';

export function exportXeroInvoices(invoices, clients) {
  const clientMap = {};
  clients.forEach(c => { clientMap[c.id] = c; });

  const rows = [];
  invoices.forEach(inv => {
    const client = clientMap[inv.clientId] || {};
    (inv.lineItems || []).forEach(item => {
      rows.push({
        '*ContactName': client.name || inv.clientName || 'Unknown',
        'EmailAddress': client.email || '',
        '*InvoiceNumber': inv.invoiceNumber,
        '*InvoiceDate': formatDateAu(inv.dateSent || inv.createdAt),
        '*DueDate': formatDateAu(inv.dateDue),
        'Total': centsToStr(inv.totalAmount),
        'InventoryItemCode': '',
        '*Description': item.description || '',
        '*Quantity': item.quantity || 1,
        '*UnitAmount': centsToStr(item.amount),
        '*AccountCode': '200',
        '*TaxType': 'OUTPUT',
        'TaxAmount': centsToStr(item.gstAmount || 0),
      });
    });
  });

  const csv = toCsv(rows);
  downloadFile(csv, `xero-invoices-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportXeroBills(expenses) {
  const rows = expenses.map(e => ({
    '*ContactName': e.supplier || 'Unknown Supplier',
    '*InvoiceNumber': e.id.slice(0, 8),
    '*InvoiceDate': formatDateAu(e.date),
    '*DueDate': formatDateAu(e.date),
    'Total': centsToStr(e.amount),
    '*Description': e.description || e.category,
    '*Quantity': 1,
    '*UnitAmount': centsToStr(e.amount - (e.gstAmount || 0)),
    '*AccountCode': getCategoryAccount(e.category),
    '*TaxType': e.gstIncluded ? 'INPUT' : 'BASEXCLUDED',
    'TaxAmount': centsToStr(e.gstAmount || 0),
  }));

  const csv = toCsv(rows);
  downloadFile(csv, `xero-expenses-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportXeroContacts(clients) {
  const rows = clients.map(c => ({
    '*ContactName': c.name,
    'EmailAddress': c.email || '',
    'PhoneNumber': c.phone || '',
    'StreetAddress': c.address || '',
  }));

  const csv = toCsv(rows);
  downloadFile(csv, `xero-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
}

function getCategoryAccount(category) {
  const map = {
    materials: '300', fuel: '449', tools: '720',
    subcontractor: '310', food: '420', insurance: '700',
    rego: '710', other: '400',
  };
  return map[category] || '400';
}
