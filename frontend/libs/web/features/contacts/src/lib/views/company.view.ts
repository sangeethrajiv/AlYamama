import type { Option, ViewDef } from '@erp/web/metadata-forms';
import { ID_SCHEME_OPTIONS } from '../models/company-options';
import { EMAIL_RE } from './partner.view';

const states = (v: Record<string, unknown>, l: Record<string, Option[]>): Option[] => (l['states'] ?? []).filter(o => o.group === v['country_id']);

/** New Company form (res.company), in the same two columns as the company page. Labels are the Odoo 12 strings. */
export const COMPANY_VIEW: ViewDef = {
  entity: 'company', type: 'form',
  sections: [
    { id: 'general', title: 'contacts.co.tab.general', fields: [
      { key: 'name', type: 'text', label: 'contacts.co.c.name', required: true, span: 'full' },
      { key: 'l10n_sa_registered_name', type: 'text', label: 'contacts.co.f.zatca', span: 'full' },
      { key: 'street', type: 'text', label: 'contacts.co.f.street' }, { key: 'street2', type: 'text', label: 'contacts.co.f.street2' },
      { key: 'city', type: 'text', label: 'contacts.co.f.city' }, { key: 'zip', type: 'text', label: 'contacts.co.f.zip' },
      { key: 'country_id', type: 'many2one', label: 'contacts.co.f.country', resource: 'countries', clears: ['state_id'] },
      { key: 'state_id', type: 'many2one', label: 'contacts.co.f.state', options: states, disabled: v => !v['country_id'] },
      { key: 'l10n_sa_edi_building_number', type: 'text', label: 'contacts.co.f.building' },
      { key: 'l10n_sa_edi_plot_identification', type: 'text', label: 'contacts.co.f.plot' },
      { key: 'parent_id', type: 'many2one', label: 'contacts.co.f.parent', resource: 'companies' },
      { key: 'currency_id', type: 'many2one', label: 'contacts.co.f.currency', resource: 'currencies' },
      { key: 'division', type: 'text', label: 'contacts.co.f.division' },
      { key: 'company_representation', type: 'text', label: 'contacts.co.f.representation' },
    ] },
    { id: 'contact', column: 2, title: 'contacts.co.f.contact', fields: [
      { key: 'website', type: 'text', label: 'contacts.co.f.website' },
      { key: 'phone', type: 'tel', label: 'contacts.co.f.phone' },
      { key: 'email', type: 'text', label: 'contacts.co.f.email', pattern: EMAIL_RE, patternMessage: 'contacts.cm.err.email' },
      { key: 'l10n_sa_additional_identification_scheme', type: 'select', label: 'contacts.co.f.idScheme', options: ID_SCHEME_OPTIONS },
      { key: 'l10n_sa_additional_identification_number', type: 'text', label: 'contacts.co.f.idNumber', visible: v => v['l10n_sa_additional_identification_scheme'] !== 'TIN' },
      { key: 'vat', type: 'text', label: 'contacts.co.f.vat' },
      { key: 'company_registry', type: 'text', label: 'contacts.co.f.registry' },
      { key: 'bank_details_sale_quote', type: 'boolean', label: 'contacts.co.f.bankDetails' },
      { key: 'cash_invoice', type: 'boolean', label: 'contacts.co.f.cashInvoice' },
      { key: 'credit_invoice', type: 'boolean', label: 'contacts.co.f.creditInvoice' },
      { key: 'company_seal', type: 'image', label: 'contacts.co.f.seal', span: 'full' },
    ] },
    { id: 'report', column: 2, title: 'contacts.co.tab.report', fields: [
      { key: 'company_header_boxed', type: 'image', label: 'contacts.co.f.header', span: 'full' },
      { key: 'company_footer_boxed', type: 'image', label: 'contacts.co.f.footer', span: 'full' },
    ] },
  ],
};

export const BLANK_COMPANY = { name: '', credit_invoice: true } as const;
