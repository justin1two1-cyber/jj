import { toCsv, downloadFile, formatDateAu, centsToStr } from './csvHelpers';

export function exportQboExpenses(expenses) {
  const rows = expenses.map(e => ({
    'Date': formatDateAu(e.date),
    'Payee': e.supplier || 'Unknown Supplier',
    'Category': mapCategory(e.category),
    'Description': e.description || e.category,
    'Amount': centsToStr(e.amount),
    'Tax Amount': centsToStr(e.gstAmount || 0),
    'Tax Code': e.gstIncluded ? 'GST on Expenses' : 'GST Free Expenses',
    'Payment Method': e.paymentMethod || '',
  }));

  const csv = toCsv(rows);
  downloadFile(csv, `qbo-expenses-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportQboInvoices(invoices, clients) {
  const clientMap = {};
  clients.forEach(c => { clientMap[c.id] = c; });

  const rows = [];
  invoices.forEach(inv => {
    const client = clientMap[inv.clientId] || {};
    (inv.lineItems || [{ description: `Invoice ${inv.invoiceNumber}`, amount: inv.totalAmount }]).forEach(item => {
      rows.push({
        '*InvoiceNo': inv.invoiceNumber,
        '*Customer': client.name || inv.clientName || 'Unknown',
        '*InvoiceDate': formatDateAu(inv.dateSent || inv.createdAt),
        '*DueDate': formatDateAu(inv.dateDue),
        '*Item(Product/Service)': 'Services',
        'ItemDescription': item.description || '',
        '*ItemQuantity': item.quantity || 1,
        '*ItemRate': centsToStr(item.amount || inv.subtotal),
        '*ItemTaxCode': 'GST on Income',
        'ItemTaxAmount': centsToStr(item.gstAmount || inv.gstAmount),
      });
    });
  });

  const csv = toCsv(rows);
  downloadFile(csv, `qbo-invoices-${new Date().toISOString().slice(0, 10)}.csv`);
}

function mapCategory(category) {
  const map = {
    materials: 'Cost of Goods Sold:Materials',
    fuel: 'Automobile:Fuel',
    tools: 'Equipment Rental',
    subcontractor: 'Cost of Goods Sold:Subcontractors',
    food: 'Meals and Entertainment',
    insurance: 'Insurance',
    rego: 'Automobile:Registration',
    other: 'Other Expense',
  };
  return map[category] || 'Other Expense';
}
