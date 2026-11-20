import type { ViewDef } from '@erp/web/metadata-forms';

export const PAYMENT_TERMS = ['Immediate Payment', '15 Days Net', '30 Days Net', '45 Days Net', '60 Days Net', 'On Completion', 'Advance / Proforma'].map(v => ({ value: v, label: v }));
const FREQ = ['One Year', 'Six Months', 'Quarterly', 'Monthly', 'One Time'].map(v => ({ value: v, label: v }));
const SUB_TYPES = ['Vehicle Subscription', 'Service Subscription', 'Maintenance Contract'].map(v => ({ value: v, label: v }));

/** Header of a standard (cash / credit) customer invoice. Keys are Invoice properties. */
export const STANDARD_INVOICE_VIEW: ViewDef = {
  entity: 'customer-invoice', type: 'form',
  sections: [
    { id: 'customer', title: 'accounting.invoice.sec.customer', columns: 2, fields: [
      { key: 'partner', type: 'text', label: 'accounting.invoice.f.partner', required: true, suggestions: 'customers', span: 'full' },
      { key: 'customerVat', type: 'text', label: 'accounting.invoice.f.vat', mono: true },
      { key: 'contactPerson', type: 'text', label: 'accounting.invoice.f.contactPerson' },
      { key: 'customerAddress', type: 'textarea', label: 'accounting.invoice.f.address', span: 'full' },
      { key: 'project', type: 'text', label: 'accounting.invoice.f.project' },
      { key: 'paymentTerms', type: 'select', label: 'accounting.invoice.f.paymentTerms', options: PAYMENT_TERMS, emptyOption: false },
      { key: 'vendorProjectName', type: 'text', label: 'accounting.invoice.f.vendorProject' },
      { key: 'prNumber', type: 'text', label: 'accounting.invoice.f.prNumber' },
      { key: 'poNumber', type: 'text', label: 'accounting.invoice.f.poNumber' },
      { key: 'showDiscount', type: 'boolean', label: 'accounting.invoice.f.showDiscount' },
    ] },
    { id: 'dates', column: 2, title: 'accounting.invoice.sec.document', columns: 2, fields: [
      { key: 'invoiceDateWithTime', type: 'text', label: 'accounting.invoice.f.dateWithTime', placeholder: 'accounting.invoice.f.dateWithTimePh' },
      { key: 'dateInvoice', type: 'date', label: 'accounting.invoice.f.dateInvoice', required: true },
      { key: 'dateDue', type: 'date', label: 'accounting.invoice.f.dateDue' },
      { key: 'salesperson', type: 'text', label: 'accounting.invoice.f.salesperson' },
      { key: 'equipmentGroupTask', type: 'text', label: 'accounting.invoice.f.equipmentGroupTask' },
      { key: 'sourceDocument', type: 'text', label: 'accounting.invoice.f.sourceDocument' },
      { key: 'salesTeam', type: 'text', label: 'accounting.invoice.f.salesTeam' },
      { key: 'currency', type: 'many2one', label: 'accounting.invoice.f.currency', resource: 'currencies', emptyOption: false },
      { key: 'currencyRate', type: 'readonly', label: 'accounting.invoice.f.currencyRate', mono: true },
      { key: 'companySeal', type: 'boolean', label: 'accounting.invoice.f.companySeal' },
      { key: 'showOutFromStock', type: 'boolean', label: 'accounting.invoice.f.showOutFromStock' },
      { key: 'isProgressive', type: 'boolean', label: 'accounting.invoice.f.isProgressive' },
    ] },
    { id: 'subscription', column: 2, title: 'accounting.invoice.sec.subscription', columns: 2, fields: [
      { key: 'isSubscriptionInvoice', type: 'boolean', label: 'accounting.invoice.f.isSubscription', span: 'full' },
      { key: 'noOfSubscriptionItems', type: 'number', label: 'accounting.invoice.f.noOfSubscriptionItems', min: 0, visible: v => v['isSubscriptionInvoice'] === true },
      { key: 'subscriptionFrequency', type: 'select', label: 'accounting.invoice.f.subscriptionFrequency', options: FREQ, emptyOption: false, visible: v => v['isSubscriptionInvoice'] === true },
      { key: 'subscriptionType', type: 'select', label: 'accounting.invoice.f.subscriptionType', options: SUB_TYPES, emptyOption: false, visible: v => v['isSubscriptionInvoice'] === true },
      { key: 'subscriptionStartDate', type: 'date', label: 'accounting.invoice.f.subscriptionStart', visible: v => v['isSubscriptionInvoice'] === true },
      { key: 'subscriptionEndDate', type: 'date', label: 'accounting.invoice.f.subscriptionEnd', visible: v => v['isSubscriptionInvoice'] === true },
      { key: 'subscriptionAlertDate', type: 'date', label: 'accounting.invoice.f.subscriptionAlert', visible: v => v['isSubscriptionInvoice'] === true },
    ] },
  ],
};

/** Proforma header and partner information. */
export const PROFORMA_INVOICE_VIEW: ViewDef = {
  entity: 'proforma-invoice', type: 'form',
  sections: [
    { id: 'left', title: 'accounting.invoice.sec.proformaHeader', columns: 2, fields: [
      { key: 'dateInvoice', type: 'date', label: 'accounting.invoice.f.dateInvoice', required: true },
      { key: 'partner', type: 'text', label: 'accounting.invoice.f.partner', required: true, suggestions: 'customers' },
      { key: 'salesperson', type: 'text', label: 'accounting.invoice.f.salesperson' },
      { key: 'currency', type: 'many2one', label: 'accounting.invoice.f.currency', resource: 'currencies', emptyOption: false },
      { key: 'linkedInvoice', type: 'readonly', label: 'accounting.invoice.f.linkedInvoice', mono: true },
      { key: 'billingEmail', type: 'email', label: 'accounting.invoice.f.billingEmail', placeholder: 'accounting.invoice.f.billingEmailPh' },
      { key: 'poNumber', type: 'text', label: 'accounting.invoice.f.poNumber' }, { key: 'prNumber', type: 'text', label: 'accounting.invoice.f.prNumber' },
      { key: 'vendorProjectName', type: 'text', label: 'accounting.invoice.f.vendorProject' },
      { key: 'subscriptionFrequency', type: 'select', label: 'accounting.lines.frequency', options: FREQ, emptyOption: false },
      { key: 'advPercentage', type: 'money', label: 'accounting.invoice.f.advPercentage', min: 0, max: 100 },
    ] },
  ],
};

/** Progressive invoicing purchase order. */
export const PROGRESSIVE_INVOICE_VIEW: ViewDef = {
  entity: 'progressive-po', type: 'form',
  sections: [
    { id: 'po', title: 'accounting.invoice.sec.progressivePo', columns: 2, fields: [
      { key: 'poName', type: 'text', label: 'accounting.invoice.f.poName', required: true, placeholder: 'accounting.invoice.f.poNamePh', span: 'full' },
      { key: 'dateInvoice', type: 'date', label: 'accounting.invoice.f.poDate', required: true },
      { key: 'partner', type: 'text', label: 'accounting.invoice.f.partner', required: true, suggestions: 'customers' },
      { key: 'currency', type: 'many2one', label: 'accounting.invoice.f.currency', resource: 'currencies', emptyOption: false },
      { key: 'contractAmount', type: 'money', label: 'accounting.invoice.f.poTotal', required: true, min: 0.01 },
      { key: 'poDescription', type: 'textarea', label: 'accounting.invoice.f.poDescription', span: 'full' },
    ] },
  ],
};

export const VEHICLES_VIEW: ViewDef = {
  entity: 'invoice-vehicles', type: 'form',
  sections: [{ id: 'v', fields: [{ key: 'vehicles', type: 'one2many', label: 'accounting.invoice.sec.vehicles', span: 'full',
    columns: [
      { key: 'plateNumber', label: 'accounting.invoice.veh.plate', mono: true }, { key: 'chassisNumber', label: 'accounting.invoice.veh.chassis', mono: true },
      { key: 'model', label: 'accounting.invoice.veh.model' }, { key: 'gpsDeviceId', label: 'accounting.invoice.veh.gps' }, { key: 'simNumber', label: 'accounting.invoice.veh.sim', mono: true },
    ],
    newRow: () => ({ id: `veh_${Date.now()}`, plateNumber: '', chassisNumber: '', model: '', gpsDeviceId: '', simNumber: '' }) }] }],
};
