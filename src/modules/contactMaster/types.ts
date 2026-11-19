/**
 * res.partner record for the Contact module. Keys are the Odoo 12 res.partner column names.
 * Many2one fields hold the related record id (null when empty); text fields use '' when empty.
 */
export type PartnerType = 'contact' | 'invoice' | 'delivery' | 'other' | 'private'

export interface ResPartner {
  id: number
  name: string
  display_name: string
  is_company: boolean
  type: PartnerType
  title: number | null
  function: string
  parent_id: number | null
  commercial_partner_id: number
  company_name: string
  ref: string

  email: string
  phone: string
  mobile: string
  website: string

  fax: string
  category_id: number[] // many2many res.partner.category (Tags)

  street: string
  street2: string // labelled "Neighborhood" in the Odoo form
  arabic_street2_name: string
  city: string
  arabic_city_name: string
  l10n_sa_edi_building_number: string
  l10n_sa_edi_plot_identification: string
  state_id: number | null
  zip: string
  country_id: number | null

  vat: string
  barcode: string
  date: string
  comment: string
  lang: string
  tz: string
  industry_id: number | null

  arabic_name: string
  l10n_sa_registered_name: string
  l10n_sa_additional_identification_scheme: string
  l10n_sa_additional_identification_number: string
  vat_arabic: string
  cr_number: string

  customer: boolean
  supplier: boolean
  employee: boolean
  cash_customer: boolean
  customer_discount: number
  discount: number
  customer_code: string
  vandor_number: string // sic: the real column name
  company_name_code: string
  ext_res_id: number | null // "External Resource ID", shown as Girfalco ID (read-only)
  credit_limit: number
  user_id: number | null
  company_id: number | null
  partner_share: boolean
  color: number
  active: boolean
}

/** Fields the user edits; display_name and commercial_partner_id are computed by the store. */
export type PartnerDraft = Omit<ResPartner, 'id' | 'display_name' | 'commercial_partner_id'>
