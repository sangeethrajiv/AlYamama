import type { Option, ViewDef } from '@erp/web/metadata-forms';
import { ID_SCHEMES, TITLE_OPTIONS } from '../models/options';

export const EMAIL_RE = /^\S+@\S+\.\S+$/;

const KIND: Option[] = [{ value: 'company', label: 'contacts.kind.company' }, { value: 'individual', label: 'contacts.kind.individual' }];
const OTHER: Option[] = [
  { value: null, label: 'contacts.other.none' }, { value: 'own_company', label: 'contacts.other.own_company' },
  { value: 'bank', label: 'contacts.other.bank' }, { value: 'other', label: 'contacts.other.other' },
];
const individual = (v: Record<string, unknown>) => v['kind'] === 'individual';

/** Form for one contact of the directory (customers, vendors, staff, banks). */
export const CONTACT_VIEW: ViewDef = {
  entity: 'contact',
  type: 'form',
  sections: [
    {
      id: 'profile', columns: 2,
      fields: [
        { key: 'image', type: 'image', label: 'contacts.f.photo', span: 'full' },
        { key: 'name', type: 'text', label: 'contacts.f.name', required: true, span: 'full' },
        { key: 'kind', type: 'select', label: 'contacts.f.kind', options: KIND, translateOptions: true, emptyOption: false },
        { key: 'otherKind', type: 'select', label: 'contacts.f.otherKind', options: OTHER, translateOptions: true, emptyOption: false },
        { key: 'isCustomer', type: 'boolean', label: 'contacts.f.isCustomer' },
        { key: 'isVendor', type: 'boolean', label: 'contacts.f.isVendor' },
        { key: 'isEmployee', type: 'boolean', label: 'contacts.f.isEmployee' },
        { key: 'isLogin', type: 'boolean', label: 'contacts.f.isLogin' },
      ],
    },
    {
      id: 'tax', title: 'contacts.section.tax', columns: 2,
      fields: [
        { key: 'legalName', type: 'text', label: 'contacts.f.legalName', span: 'full' },
        { key: 'idScheme', type: 'select', label: 'contacts.f.idScheme', options: ID_SCHEMES.map(s => ({ value: s.code, label: s.labelKey })), translateOptions: true, emptyOption: false },
        { key: 'idNumber', type: 'text', label: 'contacts.f.idNumber', mono: true },
        { key: 'vat', type: 'text', label: 'contacts.f.vat', mono: true, placeholder: 'contacts.f.vatPlaceholder', pattern: /^\d{15}$/, patternMessage: 'contacts.err.vat' },
        { key: 'crNumber', type: 'text', label: 'contacts.f.crNumber', mono: true },
        { key: 'taxIdArabic', type: 'text', label: 'contacts.f.taxIdArabic', rtl: true },
        { key: 'customerCode', type: 'text', label: 'contacts.f.customerCode', mono: true },
        { key: 'vendorNo', type: 'text', label: 'contacts.f.vendorNo', mono: true },
        { key: 'discountPct', type: 'money', label: 'contacts.f.discountPct', min: 0, max: 100 },
        { key: 'discount', type: 'money', label: 'contacts.f.discount', min: 0, max: 100 },
        { key: 'cashCustomer', type: 'boolean', label: 'contacts.f.cashCustomer' },
      ],
    },
    {
      id: 'contact', title: 'contacts.section.contact', columns: 2,
      fields: [
        { key: 'jobTitle', type: 'text', label: 'contacts.f.jobTitle', placeholder: 'contacts.f.jobTitlePlaceholder', visible: individual },
        { key: 'companyCode', type: 'text', label: 'contacts.f.companyCode', mono: true, visible: individual },
        { key: 'parentId', type: 'many2one', label: 'contacts.f.worksFor', resource: 'companyContacts', span: 'full', visible: individual },
        { key: 'phone', type: 'tel', label: 'contacts.f.phone' },
        { key: 'mobile', type: 'tel', label: 'contacts.f.mobile' },
        { key: 'email', type: 'text', label: 'contacts.f.email', pattern: EMAIL_RE, patternMessage: 'contacts.err.email' },
        { key: 'website', type: 'text', label: 'contacts.f.website', placeholder: 'contacts.f.websitePlaceholder' },
        { key: 'fax', type: 'tel', label: 'contacts.f.fax' },
        { key: 'title', type: 'select', label: 'contacts.f.title', options: TITLE_OPTIONS.map(t => ({ value: t, label: t })) },
        { key: 'language', type: 'select', label: 'contacts.f.language', options: [{ value: 'English', label: 'English' }, { value: 'Arabic', label: 'Arabic' }], emptyOption: false },
        { key: 'girfalcoId', type: 'text', label: 'contacts.f.girfalcoId' },
        { key: 'tagsText', type: 'text', label: 'contacts.f.tags', placeholder: 'contacts.f.tagsPlaceholder', span: 'full' },
      ],
    },
  ],
};

export const blankContact = (patch: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: '', kind: 'company', name: '', isCustomer: true, isVendor: false, email: '', phone: '', mobile: '', website: '', vat: '', crNumber: '',
  taxRegime: 'VAT registered', paymentTerms: 'Immediate', creditLimit: '0.00', currency: 'SAR', addresses: [], tags: [], notes: '', active: true,
  createdAt: new Date().toISOString().slice(0, 10), idScheme: 'OTH', language: 'English', ...patch,
});
