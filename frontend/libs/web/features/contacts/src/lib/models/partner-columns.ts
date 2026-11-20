import type { GridColumn } from '@erp/web/ui';
import type { ContactLookups, ResPartner } from '@erp/shared/contracts';
import { ID_SCHEMES, PARTNER_TYPES, nameOf } from './options';

/** Columns of the contact-master list (res.partner), with the default set visible. */
export function partnerColumns(l: ContactLookups, byId: Map<number, ResPartner>, t: (k: string) => string): GridColumn<ResPartner>[] {
  const ref = (id: number | null) => (id == null ? '' : (byId.get(id)?.display_name ?? `#${id}`));
  const type = (x: ResPartner) => t(PARTNER_TYPES.find(p => p.id === x.type)?.labelKey ?? '');
  const tags = (x: ResPartner) => x.category_id.map(i => nameOf(l.tags, i)).join(', ');
  const scheme = (code: string) => { const s = ID_SCHEMES.find(i => i.code === code); return s ? t(s.labelKey) : code; };
  const g = (k: string) => `contacts.cm.col.group.${k}`;
  return [
    { key: 'id', label: 'contacts.cm.col.id', group: g('main'), on: false, text: c => c.id },
    { key: 'name', label: 'contacts.cm.col.name', group: g('main'), kind: 'name', fixed: true, text: c => c.name, avatar: c => ({ name: c.name, round: !c.is_company }) },
    { key: 'display_name', label: 'contacts.cm.col.displayName', group: g('main'), on: false, text: c => c.display_name },
    { key: 'is_company', label: 'contacts.cm.col.isCompany', group: g('main'), kind: 'pill', text: c => t(c.is_company ? 'contacts.cm.kind.company' : 'contacts.cm.kind.individual'), tone: c => (c.is_company ? 'blue' : 'slate') },
    { key: 'type', label: 'contacts.cm.col.type', group: g('main'), on: false, text: type },
    { key: 'email', label: 'contacts.cm.col.email', group: g('contact'), text: c => c.email },
    { key: 'phone', label: 'contacts.cm.col.phone', group: g('contact'), text: c => c.phone },
    { key: 'mobile', label: 'contacts.cm.col.mobile', group: g('contact'), on: false, text: c => c.mobile },
    { key: 'street', label: 'contacts.cm.col.street', group: g('address'), on: false, text: c => c.street },
    { key: 'street2', label: 'contacts.cm.col.street2', group: g('address'), on: false, text: c => c.street2 },
    { key: 'city', label: 'contacts.cm.col.city', group: g('address'), on: false, text: c => c.city },
    { key: 'state_id', label: 'contacts.cm.col.state', group: g('address'), on: false, text: c => nameOf(l.states, c.state_id) },
    { key: 'zip', label: 'contacts.cm.col.zip', group: g('address'), on: false, text: c => c.zip },
    { key: 'country_id', label: 'contacts.cm.col.country', group: g('address'), on: false, text: c => nameOf(l.countries, c.country_id) },
    { key: 'parent_id', label: 'contacts.cm.col.parent', group: g('relations'), on: false, text: c => ref(c.parent_id) },
    { key: 'commercial_partner_id', label: 'contacts.cm.col.commercial', group: g('relations'), on: false, text: c => ref(c.commercial_partner_id) },
    { key: 'customer', label: 'contacts.cm.col.customer', group: g('business'), kind: 'yes', text: c => c.customer },
    { key: 'supplier', label: 'contacts.cm.col.supplier', group: g('business'), kind: 'yes', text: c => c.supplier },
    { key: 'employee', label: 'contacts.cm.col.employee', group: g('business'), kind: 'yes', text: c => c.employee },
    { key: 'active', label: 'contacts.cm.col.status', group: g('main'), kind: 'active', text: c => c.active },
    { key: 'vat', label: 'contacts.cm.col.vat', group: g('tax'), on: false, text: c => c.vat },
    { key: 'website', label: 'contacts.cm.col.website', group: g('contact'), on: false, text: c => c.website },
    { key: 'company_id', label: 'contacts.cm.col.company', group: g('relations'), on: false, text: c => nameOf(l.companies, c.company_id) },
    { key: 'arabic_name', label: 'contacts.cm.col.arabicName', group: g('main'), on: false, text: c => c.arabic_name },
    { key: 'fax', label: 'contacts.cm.col.fax', group: g('contact'), on: false, text: c => c.fax },
    { key: 'category_id', label: 'contacts.cm.col.tags', group: g('main'), on: false, text: tags },
    { key: 'arabic_street2_name', label: 'contacts.cm.col.arabicStreet2', group: g('address'), on: false, text: c => c.arabic_street2_name },
    { key: 'arabic_city_name', label: 'contacts.cm.col.arabicCity', group: g('address'), on: false, text: c => c.arabic_city_name },
    { key: 'l10n_sa_edi_building_number', label: 'contacts.cm.col.building', group: g('address'), on: false, text: c => c.l10n_sa_edi_building_number },
    { key: 'l10n_sa_edi_plot_identification', label: 'contacts.cm.col.plot', group: g('address'), on: false, text: c => c.l10n_sa_edi_plot_identification },
    { key: 'l10n_sa_registered_name', label: 'contacts.cm.col.zatcaName', group: g('tax'), on: false, text: c => c.l10n_sa_registered_name },
    { key: 'l10n_sa_additional_identification_scheme', label: 'contacts.cm.col.idScheme', group: g('tax'), on: false, text: c => scheme(c.l10n_sa_additional_identification_scheme) },
    { key: 'l10n_sa_additional_identification_number', label: 'contacts.cm.col.idNumber', group: g('tax'), on: false, text: c => c.l10n_sa_additional_identification_number },
    { key: 'vat_arabic', label: 'contacts.cm.col.vatArabic', group: g('tax'), on: false, text: c => c.vat_arabic },
    { key: 'cr_number', label: 'contacts.cm.col.crNumber', group: g('tax'), on: false, text: c => c.cr_number },
    { key: 'cash_customer', label: 'contacts.cm.col.cashCustomer', group: g('business'), on: false, kind: 'yes', text: c => c.cash_customer },
    { key: 'customer_discount', label: 'contacts.cm.col.customerDiscount', group: g('business'), on: false, right: true, text: c => c.customer_discount, sortValue: c => Number(c.customer_discount) },
    { key: 'discount', label: 'contacts.cm.col.discount', group: g('business'), on: false, right: true, text: c => c.discount, sortValue: c => Number(c.discount) },
    { key: 'customer_code', label: 'contacts.cm.col.customerCode', group: g('business'), on: false, text: c => c.customer_code },
    { key: 'vandor_number', label: 'contacts.cm.col.vendorNo', group: g('business'), on: false, text: c => c.vandor_number },
    { key: 'company_name_code', label: 'contacts.cm.col.companyCode', group: g('business'), on: false, text: c => c.company_name_code },
    { key: 'ext_res_id', label: 'contacts.cm.col.girfalco', group: g('business'), on: false, text: c => c.ext_res_id ?? '' },
  ];
}
