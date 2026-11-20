import { z } from 'zod'
import { ID_SCHEMES, PARTNER_TYPES } from './contacts/partner/partner.model'

/**
 * Request shapes for the Contacts endpoints. Keys are the Odoo column names, so
 * a client can post exactly what it reads back.
 *
 * Note: VAT is NOT format-checked here. Odoo 12 base does not validate it and
 * the live data contains values that would fail a 15-digit rule; the UI keeps
 * that check for new input. See docs/SYSTEM_REFERENCE.md.
 */

const str = z.string().trim().max(512)
const nullableStr = str.nullish().transform(v => (v === '' ? null : v ?? null))
const id = z.coerce.number().int().positive()
const nullableId = z.union([id, z.null(), z.literal('')]).transform(v => (v === '' || v === null ? null : (v as number))).nullish()
const bool = z.coerce.boolean()
/** Money and percentages stay as strings so no value passes through a JS float. */
const decimal = z
  .union([z.number(), z.string()])
  .nullish()
  .transform(v => (v === null || v === undefined || v === '' ? null : String(v)))
  .refine(v => v === null || /^-?\d+(\.\d+)?$/.test(v), 'must be a number')
/** An image arrives as base64 (with or without a data: prefix) and is stored as bytes. */
const base64Image = z
  .string()
  .nullish()
  .transform(v => {
    if (v === null || v === undefined || v === '') return v === '' ? null : undefined
    const b64 = v.includes(',') ? v.slice(v.indexOf(',') + 1) : v
    return Buffer.from(b64, 'base64')
  })

export const partnerWritableSchema = z.object({
  // identity
  name: nullableStr,
  title: nullableId,
  function: nullableStr,
  ref: nullableStr,
  barcode: nullableStr,
  date: nullableStr,
  comment: nullableStr,
  // classification
  is_company: bool.nullish(),
  type: z.enum(PARTNER_TYPES).nullish(),
  industry_id: nullableId,
  // hierarchy
  parent_id: nullableId,
  company_name: nullableStr,
  // contact info
  email: nullableStr,
  phone: nullableStr,
  mobile: nullableStr,
  website: nullableStr,
  fax: nullableStr,
  // address
  street: nullableStr,
  street2: nullableStr,
  zip: nullableStr,
  city: nullableStr,
  state_id: nullableId,
  country_id: nullableId,
  // preferences
  lang: nullableStr,
  tz: nullableStr,
  // responsibility
  user_id: nullableId,
  company_id: nullableId,
  // flags and limits
  customer: bool.nullish(),
  supplier: bool.nullish(),
  employee: bool.nullish(),
  vat: nullableStr,
  credit_limit: decimal,
  active: bool.nullish(),
  color: z.coerce.number().int().nullish(),
  // Yamama custom fields
  arabic_name: nullableStr,
  arabic_street2_name: nullableStr,
  arabic_city_name: nullableStr,
  vat_arabic: nullableStr,
  customer_code: nullableStr,
  vandor_number: nullableStr,
  cr_number: nullableStr,
  cash_customer: bool.nullish(),
  discount: decimal,
  customer_discount: decimal,
  company_name_code: nullableStr,
  // ZATCA
  l10n_sa_edi_building_number: nullableStr,
  l10n_sa_edi_plot_identification: nullableStr,
  l10n_sa_additional_identification_scheme: z.enum(ID_SCHEMES).nullish(),
  l10n_sa_additional_identification_number: nullableStr,
  l10n_sa_registered_name: nullableStr,
  // images
  image: base64Image,
  image_sign: base64Image,
  image_seal: base64Image,
  // tags: ids or names; unknown names are created
  tags: z.array(z.union([id, str])).nullish(),
})

export const createPartnerSchema = partnerWritableSchema.refine(
  v => (v.type ?? 'contact') !== 'contact' || !!v.name,
  { message: 'Contacts require a name.', path: ['name'] },
)

export const updatePartnerSchema = partnerWritableSchema

export const listQuerySchema = z.object({
  q: str.optional(),
  field: str.optional(),
  filters: str.optional(),
  active: z.enum(['true', 'false', 'all']).optional(),
  company_id: id.optional(),
  parent_id: id.optional(),
  category_id: id.optional(),
  country_id: id.optional(),
  user_id: id.optional(),
  type: z.enum(PARTNER_TYPES).optional(),
  order: str.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  counts: z.enum(['0', '1']).optional(),
  /** 1 = every column except the images (the Angular master list loads full records). */
  full: z.enum(['0', '1']).optional(),
  group_by: str.optional(),
})

export const partnerBankSchema = z.object({
  acc_number: str.min(1, 'Account number is required'),
  acc_holder_name: nullableStr,
  partner_id: id,
  bank_id: nullableId,
  currency_id: nullableId,
  company_id: nullableId,
  sequence: z.coerce.number().int().nullish(),
  show_in_report: bool.nullish(),
  iban: nullableStr,
})

export const lookupWriteSchema = z.object({
  name: str.min(1, 'Name is required'),
  shortcut: nullableStr,
  full_name: nullableStr,
  color: z.coerce.number().int().nullish(),
  parent_id: nullableId,
  active: bool.nullish(),
})
