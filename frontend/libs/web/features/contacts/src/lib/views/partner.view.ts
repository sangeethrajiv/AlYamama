import type { Option, ViewDef } from '@erp/web/metadata-forms';
import type { PartnerDraft } from '@erp/shared/contracts';
import { ID_SCHEMES, PARTNER_TYPES } from '../models/options';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[0-9\s().-]{6,20}$/;
export const SITE_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

export const BLANK_PARTNER: PartnerDraft = {
  name: '', is_company: false, type: 'contact', title: null, function: '', parent_id: null, company_name: '', ref: '',
  email: '', phone: '', mobile: '', website: '', fax: '', category_id: [],
  street: '', street2: '', arabic_street2_name: '', city: '', arabic_city_name: '', l10n_sa_edi_building_number: '', l10n_sa_edi_plot_identification: '', state_id: null, zip: '', country_id: null,
  arabic_name: '', l10n_sa_registered_name: '', l10n_sa_additional_identification_scheme: 'OTH', l10n_sa_additional_identification_number: '', vat_arabic: '', cr_number: '',
  vat: '', barcode: '', date: '', comment: '', lang: 'en_US', tz: 'Asia/Riyadh', industry_id: null,
  customer: false, supplier: false, employee: false, cash_customer: false, customer_discount: '0.00', discount: '0.00', customer_code: '', vandor_number: '', company_name_code: '', ext_res_id: null, credit_limit: '0.00', user_id: null, company_id: 1, partner_share: true, color: 0, active: true,
};

const company = (v: Record<string, unknown>) => v['is_company'] === true;
const states = (v: Record<string, unknown>, l: Record<string, Option[]>): Option[] => (l['states'] ?? []).filter(o => o.group === v['country_id']);

/** Add / edit form of the contact master (res.partner). Validation messages are translation keys. */
export const PARTNER_VIEW: ViewDef = {
  entity: 'partner', type: 'form',
  sections: [
    { id: 'general', title: 'contacts.cm.section.general', fields: [
      { key: 'is_company', type: 'select', label: 'contacts.cm.f.kind', options: [{ value: false, label: 'contacts.cm.kind.individual' }, { value: true, label: 'contacts.cm.kind.company' }], translateOptions: true, emptyOption: false, span: 'full' },
      { key: 'name', type: 'text', label: 'contacts.cm.f.name', required: true, span: 'full' },
      { key: 'arabic_name', type: 'text', label: 'contacts.cm.f.arabicName', rtl: true, span: 'full' },
      { key: 'display_name', type: 'readonly', label: 'contacts.cm.f.displayName' },
      { key: 'type', type: 'select', label: 'contacts.cm.f.type', options: PARTNER_TYPES.map(t => ({ value: t.id, label: t.labelKey })), translateOptions: true, emptyOption: false },
      { key: 'parent_id', type: 'many2one', label: 'contacts.cm.f.parent', resource: 'parents' },
      { key: 'title', type: 'many2one', label: 'contacts.cm.f.title', resource: 'titles', visible: v => !company(v) },
      { key: 'function', type: 'text', label: 'contacts.cm.f.function', visible: v => !company(v) },
      { key: 'company_name', type: 'text', label: 'contacts.cm.f.companyName', hint: 'contacts.cm.hint.companyName', visible: v => !company(v) && !v['parent_id'] },
      { key: 'ref', type: 'text', label: 'contacts.cm.f.ref' },
    ] },
    { id: 'address', title: 'contacts.cm.section.address', fields: [
      { key: 'street', type: 'text', label: 'contacts.cm.f.street' }, { key: 'street2', type: 'text', label: 'contacts.cm.f.street2' },
      { key: 'arabic_street2_name', type: 'text', label: 'contacts.cm.f.arabicStreet2', rtl: true }, { key: 'arabic_city_name', type: 'text', label: 'contacts.cm.f.arabicCity', rtl: true },
      { key: 'city', type: 'text', label: 'contacts.cm.f.city' }, { key: 'zip', type: 'text', label: 'contacts.cm.f.zip' },
      { key: 'country_id', type: 'many2one', label: 'contacts.cm.f.country', resource: 'countries', clears: ['state_id'] },
      { key: 'state_id', type: 'many2one', label: 'contacts.cm.f.state', options: states, disabled: v => !v['country_id'] },
      { key: 'l10n_sa_edi_building_number', type: 'text', label: 'contacts.cm.f.building', pattern: /^\d{4}$/, patternMessage: 'contacts.cm.err.building', placeholder: 'contacts.cm.f.buildingPlaceholder' },
      { key: 'l10n_sa_edi_plot_identification', type: 'text', label: 'contacts.cm.f.plot' },
    ] },
    { id: 'business', title: 'contacts.cm.section.business', fields: [
      { key: 'customer', type: 'boolean', label: 'contacts.cm.f.customer' }, { key: 'supplier', type: 'boolean', label: 'contacts.cm.f.supplier' },
      { key: 'employee', type: 'boolean', label: 'contacts.cm.f.employee' }, { key: 'cash_customer', type: 'boolean', label: 'contacts.cm.f.cashCustomer' },
      { key: 'customer_discount', type: 'money', label: 'contacts.cm.f.customerDiscount', min: 0, max: 100 },
      { key: 'discount', type: 'money', label: 'contacts.cm.f.discount', min: 0, max: 100 },
      { key: 'customer_code', type: 'text', label: 'contacts.cm.f.customerCode' }, { key: 'vandor_number', type: 'text', label: 'contacts.cm.f.vendorNo' },
      { key: 'company_name_code', type: 'text', label: 'contacts.cm.f.companyCode' },
      { key: 'ext_res_id', type: 'readonly', label: 'contacts.cm.f.girfalco', hint: 'contacts.cm.hint.girfalco' },
      { key: 'active', type: 'boolean', label: 'contacts.cm.f.active', hint: 'contacts.cm.hint.active', span: 'full' },
    ] },
    { id: 'contact', column: 2, title: 'contacts.cm.section.contact', fields: [
      { key: 'email', type: 'text', label: 'contacts.cm.f.email', pattern: EMAIL_RE, patternMessage: 'contacts.cm.err.email', placeholder: 'contacts.cm.f.emailPlaceholder' },
      { key: 'website', type: 'text', label: 'contacts.cm.f.website', pattern: SITE_RE, patternMessage: 'contacts.cm.err.website', placeholder: 'contacts.cm.f.websitePlaceholder' },
      { key: 'phone', type: 'tel', label: 'contacts.cm.f.phone', pattern: PHONE_RE, patternMessage: 'contacts.cm.err.phone' },
      { key: 'mobile', type: 'tel', label: 'contacts.cm.f.mobile', pattern: PHONE_RE, patternMessage: 'contacts.cm.err.mobile' },
      { key: 'fax', type: 'tel', label: 'contacts.cm.f.fax', pattern: PHONE_RE, patternMessage: 'contacts.cm.err.fax' },
    ] },
    { id: 'zatca', column: 2, title: 'contacts.cm.section.zatca', fields: [
      { key: 'l10n_sa_registered_name', type: 'text', label: 'contacts.cm.f.zatcaName', span: 'full' },
      { key: 'l10n_sa_additional_identification_scheme', type: 'select', label: 'contacts.cm.f.idScheme', options: ID_SCHEMES.map(s => ({ value: s.code, label: s.labelKey })), translateOptions: true, emptyOption: false },
      { key: 'l10n_sa_additional_identification_number', type: 'text', label: 'contacts.cm.f.idNumber' },
      { key: 'vat_arabic', type: 'text', label: 'contacts.cm.f.vatArabic', rtl: true }, { key: 'cr_number', type: 'text', label: 'contacts.cm.f.crNumber' },
    ] },
    { id: 'additional', column: 2, title: 'contacts.cm.section.additional', fields: [
      { key: 'vat', type: 'text', label: 'contacts.cm.f.vat' },
      { key: 'lang', type: 'many2one', label: 'contacts.cm.f.lang', resource: 'languages', emptyOption: false },
      { key: 'category_id', type: 'many2many', label: 'contacts.cm.f.tags', resource: 'tags', span: 'full' },
    ] },
  ],
};
