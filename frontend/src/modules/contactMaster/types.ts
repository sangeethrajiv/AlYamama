/**
 * res.partner record for the Contact module. Keys are the Odoo 12 res.partner column names.
 * Many2one fields hold the related record id (null when empty); text fields use '' when empty.
 */
export type PartnerType = 'contact' | 'invoice' | 'delivery' | 'other' | 'private' | 'child_company' | 'manager'

/** ZATCA buyer identification schemes (l10n_sa_edi). */
export type IdScheme = 'TIN' | 'CRN' | 'MOM' | 'MLS' | '700' | 'SAG' | 'NAT' | 'GCC' | 'IQA' | 'PAS' | 'OTH'

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

  street: string
  street2: string
  city: string
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

  customer: boolean
  supplier: boolean
  employee: boolean
  credit_limit: number
  user_id: number | null
  company_id: number | null
  partner_share: boolean
  color: number
  active: boolean

  // --- Yamama custom fields (sale_custom, att_customer_pricelist, delivery_order_custom).
  // Optional so the sample data in data.ts stays valid; the API always sends them.
  customer_code?: string
  /** Vendor number. The misspelling is Odoo's. */
  vandor_number?: string
  /** Commercial registration number. */
  cr_number?: string
  cash_customer?: boolean
  fax?: string
  /** Percentages, kept as strings so no value passes through a float. */
  discount?: string
  customer_discount?: string
  /** Unique across all contacts. */
  company_name_code?: string

  // --- ZATCA buyer identification (l10n_sa_edi)
  l10n_sa_registered_name?: string
  l10n_sa_additional_identification_scheme?: IdScheme | null
  l10n_sa_additional_identification_number?: string
  l10n_sa_edi_building_number?: string
  l10n_sa_edi_plot_identification?: string

  // --- read-only extras the API provides
  /** 'company' or 'person', derived from is_company. */
  company_type?: 'company' | 'person'
  /** Tags (res.partner.category). */
  tags?: Array<{ id: number; name: string; color?: number | null }>
  /** Labels for the many2one fields, so a screen can show a name without a lookup table. */
  labels?: Partial<Record<'parent_id' | 'country_id' | 'state_id' | 'company_id' | 'user_id' | 'title' | 'industry_id', string>>
  create_date?: string
  write_date?: string
}

/** Fields the user edits; display_name and commercial_partner_id are computed by the store. */
export type PartnerDraft = Omit<ResPartner, 'id' | 'display_name' | 'commercial_partner_id'>
