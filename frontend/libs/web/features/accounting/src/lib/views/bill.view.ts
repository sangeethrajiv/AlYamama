import type { ViewDef } from '@erp/web/metadata-forms';
import { PAYMENT_TERMS } from './invoice.views';

export const BILL_VIEW: ViewDef = {
  entity: 'vendor-bill', type: 'form',
  sections: [
    { id: 'vendor', title: 'accounting.bill.sec.vendor', columns: 2, fields: [
      { key: 'vendor', type: 'text', label: 'accounting.bill.f.vendor', required: true, suggestions: 'vendors', span: 'full' },
      { key: 'vendorVat', type: 'text', label: 'accounting.bill.f.vendorVat', mono: true },
      { key: 'supplierInvoiceNumber', type: 'text', label: 'accounting.bill.f.supplierRef', required: true, mono: true },
    ] },
    { id: 'dates', column: 2, title: 'accounting.bill.sec.document', columns: 2, fields: [
      { key: 'dateBill', type: 'date', label: 'accounting.bill.f.dateBill', required: true },
      { key: 'dateDue', type: 'date', label: 'accounting.bill.f.dateDue' },
      { key: 'paymentTerms', type: 'select', label: 'accounting.invoice.f.paymentTerms', options: PAYMENT_TERMS, emptyOption: false },
      { key: 'currency', type: 'many2one', label: 'accounting.invoice.f.currency', resource: 'currencies', emptyOption: false },
    ] },
  ],
};
