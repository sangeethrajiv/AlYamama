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
}

/** Fields the user edits; display_name and commercial_partner_id are computed by the store. */
export type PartnerDraft = Omit<ResPartner, 'id' | 'display_name' | 'commercial_partner_id'>
