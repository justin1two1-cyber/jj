export function calculateGstSummary(invoices, expenses) {
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const gstCollected = paidInvoices.reduce((s, i) => s + (i.gstAmount || 0), 0);
  const gstPaid = expenses.reduce((s, e) => s + (e.gstAmount || 0), 0);
  const totalSalesExGst = paidInvoices.reduce((s, i) => s + (i.subtotal || 0), 0);
  const totalPurchasesExGst = expenses.reduce(
    (s, e) => s + ((e.amount || 0) - (e.gstAmount || 0)), 0
  );

  return {
    gstCollected,
    gstPaid,
    netGst: gstCollected - gstPaid,
    totalSalesExGst,
    totalPurchasesExGst,
  };
}

export function gstSummaryToRows(summary) {
  return [
    { Label: '1A - GST on Sales', Amount: (summary.gstCollected / 100).toFixed(2) },
    { Label: '1B - GST on Purchases', Amount: (summary.gstPaid / 100).toFixed(2) },
    { Label: 'Net GST Payable', Amount: (summary.netGst / 100).toFixed(2) },
    { Label: '', Amount: '' },
    { Label: 'Total Sales (ex GST)', Amount: (summary.totalSalesExGst / 100).toFixed(2) },
    { Label: 'Total Purchases (ex GST)', Amount: (summary.totalPurchasesExGst / 100).toFixed(2) },
  ];
}
