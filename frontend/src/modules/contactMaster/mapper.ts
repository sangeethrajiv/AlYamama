/**
 * Translation between the API payload and the `ResPartner` shape the screens use.
 *
 * The two are close, because both use the Odoo 12 column names. Three
 * differences are handled here:
 *
 *   1. many2one fields arrive as `{ id, name }` and the screens want a plain id,
 *      so the name is kept aside in `labels`;
 *   2. the API uses `null` for an empty text field, the screens use `''`;
 *   3. money and percentages arrive as strings (the database column is
 *      `numeric`). `credit_limit` is converted to a number because the existing
 *      form binds it to a number input; the two percentage fields stay strings.
 *
 * Every field in the Contacts form maps to one Odoo column. The full table is in
 * docs/SYSTEM_REFERENCE.md.
 */
import type { PartnerDraft, ResPartner } from './types'

type M2O = { id: number; name: string | null } | number | null | undefined

const idOf = (v: M2O): number | null => (v == null ? null : typeof v === 'number' ? v : v.id)
const nameOf = (v: M2O): string | undefined => (v && typeof v === 'object' && v.name ? v.name : undefined)
const s = (v: unknown): string => (v == null ? '' : String(v))
const b = (v: unknown): boolean => v === true
/** '' / null stay empty so the server stores NULL rather than an empty string. */
const orNull = (v: string | undefined): string | null => (v == null || v.trim() === '' ? null : v)

export interface PartnerDto extends Record<string, unknown> {
  id: number
}

/** API record -> the shape the list, detail and form pages read. */
export function toPartner(d: PartnerDto): ResPartner {
  const labels: ResPartner['labels'] = {}
  const put = (key: keyof NonNullable<ResPartner['labels']>, v: M2O) => {
    const n = nameOf(v)
    if (n) labels[key] = n
  }
  put('parent_id', d.parent_id as M2O)
  put('country_id', d.country_id as M2O)
  put('state_id', d.state_id as M2O)
  put('company_id', d.company_id as M2O)
  put('user_id', d.user_id as M2O)
  put('title', d.title as M2O)
  put('industry_id', d.industry_id as M2O)

  return {
    id: d.id,
    name: s(d.name),
    display_name: s(d.display_name) || s(d.name),
    is_company: b(d.is_company),
    type: (d.type as ResPartner['type']) || 'contact',
    title: idOf(d.title as M2O),
    function: s(d.function),
    parent_id: idOf(d.parent_id as M2O),
    commercial_partner_id: (idOf(d.commercial_partner_id as M2O) ?? d.id) as number,
    company_name: s(d.company_name),
    ref: s(d.ref),

    email: s(d.email),
    phone: s(d.phone),
    mobile: s(d.mobile),
    website: s(d.website),

    street: s(d.street),
    street2: s(d.street2),
    city: s(d.city),
    state_id: idOf(d.state_id as M2O),
    zip: s(d.zip),
    country_id: idOf(d.country_id as M2O),

    vat: s(d.vat),
    barcode: s(d.barcode),
    date: s(d.date),
    comment: s(d.comment),
    lang: s(d.lang) || 'en_US',
    tz: s(d.tz),
    industry_id: idOf(d.industry_id as M2O),

    customer: b(d.customer),
    supplier: b(d.supplier),
    employee: b(d.employee),
    credit_limit: d.credit_limit == null ? 0 : Number(d.credit_limit),
    user_id: idOf(d.user_id as M2O),
    company_id: idOf(d.company_id as M2O),
    partner_share: b(d.partner_share),
    color: Number(d.color ?? 0),
    active: d.active !== false,

    // Yamama custom fields
    customer_code: s(d.customer_code),
    vandor_number: s(d.vandor_number),
    cr_number: s(d.cr_number),
    cash_customer: b(d.cash_customer),
    fax: s(d.fax),
    discount: d.discount == null ? '' : String(d.discount),
    customer_discount: d.customer_discount == null ? '' : String(d.customer_discount),
    company_name_code: s(d.company_name_code),

    // ZATCA
    l10n_sa_registered_name: s(d.l10n_sa_registered_name),
    l10n_sa_additional_identification_scheme:
      (d.l10n_sa_additional_identification_scheme as ResPartner['l10n_sa_additional_identification_scheme']) ?? null,
    l10n_sa_additional_identification_number: s(d.l10n_sa_additional_identification_number),
    l10n_sa_edi_building_number: s(d.l10n_sa_edi_building_number),
    l10n_sa_edi_plot_identification: s(d.l10n_sa_edi_plot_identification),

    company_type: b(d.is_company) ? 'company' : 'person',
    tags: (d.tags as ResPartner['tags']) ?? [],
    labels,
    create_date: d.create_date ? String(d.create_date) : undefined,
    write_date: d.write_date ? String(d.write_date) : undefined,
  }
}

/**
 * Form draft -> the API body. Computed and audit columns are left out; the
 * server would refuse them anyway.
 */
export function toPayload(d: PartnerDraft | ResPartner): Record<string, unknown> {
  const v = d as ResPartner
  const payload: Record<string, unknown> = {
    name: orNull(v.name),
    is_company: v.is_company,
    type: v.type || 'contact',
    title: v.title ?? null,
    function: orNull(v.function),
    parent_id: v.parent_id ?? null,
    company_name: orNull(v.company_name),
    ref: orNull(v.ref),

    email: orNull(v.email),
    phone: orNull(v.phone),
    mobile: orNull(v.mobile),
    website: orNull(v.website),

    street: orNull(v.street),
    street2: orNull(v.street2),
    city: orNull(v.city),
    state_id: v.state_id ?? null,
    zip: orNull(v.zip),
    country_id: v.country_id ?? null,

    vat: orNull(v.vat),
    barcode: orNull(v.barcode),
    date: orNull(v.date),
    comment: orNull(v.comment),
    lang: orNull(v.lang),
    tz: orNull(v.tz),
    industry_id: v.industry_id ?? null,

    customer: v.customer,
    supplier: v.supplier,
    employee: v.employee,
    // Sent as a string so the numeric column keeps full precision.
    credit_limit: v.credit_limit == null ? null : String(v.credit_limit),
    user_id: v.user_id ?? null,
    company_id: v.company_id ?? null,
    color: v.color ?? 0,
    active: v.active,
  }

  // Custom and ZATCA fields are only sent when the screen actually holds them,
  // so a form that has no input for one does not wipe the imported value.
  const optional: Array<keyof ResPartner> = [
    'customer_code',
    'vandor_number', 'cr_number', 'fax', 'company_name_code',
    'l10n_sa_registered_name', 'l10n_sa_additional_identification_number',
    'l10n_sa_edi_building_number', 'l10n_sa_edi_plot_identification',
  ]
  for (const key of optional) {
    const value = v[key] as string | undefined
    if (value !== undefined) payload[key] = orNull(value)
  }
  if (v.cash_customer !== undefined) payload.cash_customer = v.cash_customer
  if (v.discount !== undefined) payload.discount = orNull(v.discount)
  if (v.customer_discount !== undefined) payload.customer_discount = orNull(v.customer_discount)
  if (v.l10n_sa_additional_identification_scheme !== undefined) {
    payload.l10n_sa_additional_identification_scheme = v.l10n_sa_additional_identification_scheme || null
  }
  if (v.tags !== undefined) payload.tags = (v.tags || []).map(t => t.id)

  return payload
}
