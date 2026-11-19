import type { PartnerDraft, ResPartner } from './types'

/** Shared by the contact form and the child-contact dialog. */
export const BLANK: PartnerDraft = {
  name: '', is_company: false, type: 'contact', title: null, function: '', parent_id: null, company_name: '', ref: '',
  email: '', phone: '', mobile: '', website: '', fax: '', category_id: [],
  street: '', street2: '', arabic_street2_name: '', city: '', arabic_city_name: '', l10n_sa_edi_building_number: '', l10n_sa_edi_plot_identification: '', state_id: null, zip: '', country_id: null,
  arabic_name: '', l10n_sa_registered_name: '', l10n_sa_additional_identification_scheme: 'OTH', l10n_sa_additional_identification_number: '', vat_arabic: '', cr_number: '',
  vat: '', barcode: '', date: '', comment: '', lang: 'en_US', tz: 'Asia/Riyadh', industry_id: null,
  customer: false, supplier: false, employee: false, cash_customer: false, customer_discount: 0, discount: 0, customer_code: '', vandor_number: '', company_name_code: '', ext_res_id: null, credit_limit: 0, user_id: null, company_id: 1, partner_share: true, color: 0, active: true,
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const PHONE_RE = /^\+?[0-9\s().-]{6,20}$/
export const SITE_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i

export const toDraft = (c?: ResPartner): PartnerDraft => {
  if (!c) return BLANK
  const { id: _i, display_name: _d, commercial_partner_id: _c, ...rest } = c
  return rest
}
