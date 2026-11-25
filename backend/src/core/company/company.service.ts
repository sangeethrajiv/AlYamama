import { QueryTypes } from 'sequelize'
import { sequelize } from '../../orm'
import { AppError, notFound } from '../../common.helper'
import type { RequestEnv } from '../../middleware'
import { createPartner, updatePartner } from '../../contacts/partner/partner.service'

/**
 * res.company for the Company screens (list and read-only form). The address, website, VAT and ZATCA identification
 * live on the company's partner record, as in Odoo, so they are read from there.
 */

type Row = Record<string, unknown>
const q = (sql: string, replacements: Record<string, unknown> = {}) => sequelize.query<Row>(sql, { replacements, type: QueryTypes.SELECT })

/**
 * The companies a request may see. The request header gives a list (stub auth); on top of it the user's own assignments in
 * res_company_users_rel count, so a company the user just created is visible at once and stays so after a reload.
 * An empty header list still means no restriction.
 */
export async function visibleCompanyIds(env: RequestEnv): Promise<number[]> {
  if (!env.allowedCompanyIds.length) return []
  if (env.uid == null) return env.allowedCompanyIds
  const rows = await q('SELECT cid FROM res_company_users_rel WHERE user_id = :uid', { uid: env.uid })
  return [...new Set([...env.allowedCompanyIds, ...rows.map(r => Number(r.cid))])]
}

/** Restricts to the caller's allowed companies; an empty list means no restriction (same rule as GET /companies). */
const scope = (allowed: number[]) => (allowed.length ? 'AND c.id IN (:allowed)' : '')

export function listCompanies(allowed: number[]): Promise<Row[]> {
  return q(`SELECT c.id, c.name, c.sequence, c.parent_id, c.partner_id, p.name AS partner_name
      FROM res_company c JOIN res_partner p ON p.id = c.partner_id
     WHERE true ${scope(allowed)} ORDER BY c.sequence, c.name, c.id`, { allowed })
}

/** The image bytes of a partner as a data URL; the format is read from the file's own header. */
function dataUrl(bytes: Buffer | null): string | null {
  if (!bytes || !bytes.length) return null
  const mime = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : bytes[0] === 0x47 ? 'image/gif' : bytes.slice(0, 4).toString() === 'RIFF' ? 'image/webp' : 'image/png'
  return `data:${mime};base64,${bytes.toString('base64')}`
}

export async function getCompany(id: number, allowed: number[]): Promise<Row> {
  const [row] = await q(`SELECT c.id, c.name, c.sequence, c.parent_id, par.name AS parent_name, c.partner_id, p.name AS partner_name,
      c.l10n_sa_registered_name, c.email, c.phone, c.company_registry, c.currency_id, cur.name AS currency_name,
      c.bank_details_sale_quote, c.cash_invoice, c.credit_invoice, c.division, c.company_representation,
      c.social_twitter, c.social_facebook, c.social_github, c.social_linkedin, c.social_youtube, c.social_googleplus, c.social_instagram,
      p.street, p.street2, p.city, p.zip, p.state_id, st.name AS state_name, p.country_id, co.name AS country_name, co.code AS country_code,
      p.website, p.vat, p.l10n_sa_edi_building_number, p.l10n_sa_edi_plot_identification,
      p.l10n_sa_additional_identification_scheme, p.l10n_sa_additional_identification_number, p.image AS logo,
      c.company_seal, c.company_header_boxed, c.company_footer_boxed,
      c.due_from_account_id, df.code || ' ' || df.name AS due_from_account_name,
      c.due_to_account_id, dt.code || ' ' || dt.name AS due_to_account_name,
      c.due_fromto_payment_journal_id, j.name || ' (' || COALESCE(jcur.name, jcc.name) || ')' AS due_fromto_payment_journal_name
    FROM res_company c
    JOIN res_partner p ON p.id = c.partner_id
    LEFT JOIN res_company par ON par.id = c.parent_id
    LEFT JOIN res_currency cur ON cur.id = c.currency_id
    LEFT JOIN res_country_state st ON st.id = p.state_id
    LEFT JOIN res_country co ON co.id = p.country_id
    LEFT JOIN account_account df ON df.id = c.due_from_account_id
    LEFT JOIN account_account dt ON dt.id = c.due_to_account_id
    LEFT JOIN account_journal j ON j.id = c.due_fromto_payment_journal_id
    LEFT JOIN res_currency jcur ON jcur.id = j.currency_id
    LEFT JOIN res_company jco ON jco.id = j.company_id
    LEFT JOIN res_currency jcc ON jcc.id = jco.currency_id
   WHERE c.id = :id ${scope(allowed)}`, { id, allowed })
  if (!row) throw notFound('Company')
  const img = (k: string) => dataUrl(row[k] as Buffer | null)
  return { ...row, logo: img('logo'), company_seal: img('company_seal'), company_header_boxed: img('company_header_boxed'), company_footer_boxed: img('company_footer_boxed') }
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const flag = (v: unknown) => v === true
const bad = (m: string) => new AppError(m, 400, 'validation_error')

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** An uploaded image arrives as a data URL; it is stored as bytes. Anything else, or too large, is refused. */
function imageBytes(value: unknown, what: string): Buffer | null {
  if (value === undefined || value === null || value === '') return null
  const m = typeof value === 'string' ? /^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value) : null
  if (!m) throw bad(`${what} must be a PNG, JPEG, GIF or WebP image.`)
  const bytes = Buffer.from(m[2], 'base64')
  if (!bytes.length) return null
  if (bytes.length > MAX_IMAGE_BYTES) throw bad(`${what} is larger than 5 MB.`)
  return bytes
}

/** Each id given must exist: an unknown one is refused, never dropped. */
async function assertRef(table: 'res_currency' | 'res_company' | 'res_country' | 'res_country_state', value: unknown, what: string): Promise<number | null> {
  if (value === undefined || value === null || value === '') return null
  const id = Number(value)
  if (!Number.isInteger(id)) throw bad(`${what} is not valid.`)
  const [row] = await q(`SELECT id FROM ${table} WHERE id = :id`, { id })
  if (!row) throw bad(`${what} not found.`)
  return id
}

/**
 * Creates a company and the partner that represents it (Odoo does the same). The address, website, VAT and ZATCA
 * identification are stored on the partner; the creator is added to the new company's users so it shows up for them.
 */
export async function createCompany(body: Row, env: RequestEnv): Promise<Row> {
  const name = text(body.name)
  if (!name) throw bad('Name is required.')
  const parent = await assertRef('res_company', body.parent_id, 'Parent company')
  const currency = await assertRef('res_currency', body.currency_id, 'Currency')
  const country = await assertRef('res_country', body.country_id, 'Country')
  const state = await assertRef('res_country_state', body.state_id, 'State')
  const seal = imageBytes(body.company_seal, 'Company Seal')
  const header = imageBytes(body.company_header_boxed, 'Company Header Image')
  const footer = imageBytes(body.company_footer_boxed, 'Company Footer Image')
  const [dup] = await q('SELECT id FROM res_company WHERE lower(name) = lower(:name)', { name })
  if (dup) throw new AppError(`A company named "${name}" already exists.`, 409, 'duplicate_company')

  const partner = await createPartner({
    name, is_company: true, type: 'contact', active: true, company_id: null,
    street: text(body.street), street2: text(body.street2), city: text(body.city), zip: text(body.zip), state_id: state, country_id: country,
    website: text(body.website), vat: text(body.vat), email: text(body.email), phone: text(body.phone),
    l10n_sa_edi_building_number: text(body.l10n_sa_edi_building_number), l10n_sa_edi_plot_identification: text(body.l10n_sa_edi_plot_identification),
    l10n_sa_additional_identification_scheme: text(body.l10n_sa_additional_identification_scheme),
    l10n_sa_additional_identification_number: text(body.l10n_sa_additional_identification_number),
    l10n_sa_registered_name: text(body.l10n_sa_registered_name),
  }, env)
  try {
    const [row] = await q(
      `INSERT INTO res_company (name, partner_id, parent_id, currency_id, sequence, email, phone, company_registry, l10n_sa_registered_name,
          bank_details_sale_quote, cash_invoice, credit_invoice, division, company_representation,
          social_twitter, social_facebook, social_github, social_linkedin, social_youtube, social_googleplus, social_instagram,
          company_seal, company_header_boxed, company_footer_boxed, create_uid, write_uid)
       VALUES (:name, :partner, :parent, :currency, 10, :email, :phone, :registry, :zatca, :bank, :cash, :credit, :division, :representation,
          :twitter, :facebook, :github, :linkedin, :youtube, :googleplus, :instagram, :seal, :header, :footer, :uid, :uid) RETURNING id`,
      {
        name, partner: partner.id, parent, currency, email: text(body.email), phone: text(body.phone), registry: text(body.company_registry),
        zatca: text(body.l10n_sa_registered_name), bank: flag(body.bank_details_sale_quote), cash: flag(body.cash_invoice), credit: flag(body.credit_invoice),
        division: text(body.division), representation: text(body.company_representation),
        twitter: text(body.social_twitter), facebook: text(body.social_facebook), github: text(body.social_github), linkedin: text(body.social_linkedin),
        youtube: text(body.social_youtube), googleplus: text(body.social_googleplus), instagram: text(body.social_instagram), seal, header, footer, uid: env.uid,
      },
    )
    const id = Number(row.id)
    if (env.uid != null) await q('INSERT INTO res_company_users_rel (cid, user_id) SELECT :id, id FROM res_users WHERE id = :uid ON CONFLICT DO NOTHING', { id, uid: env.uid })
    return getCompany(id, [])
  } catch (e) {
    // The partner was created first; do not leave an orphan behind when the company could not be.
    await sequelize.query('DELETE FROM res_partner WHERE id = :id', { replacements: { id: partner.id } })
    throw e
  }
}

const has = (body: Row, k: string) => body[k] !== undefined

/** Plain text columns of res_company that the form edits (a blank value clears the column). */
const COMPANY_TEXT = ['company_registry', 'l10n_sa_registered_name', 'division', 'company_representation', 'email', 'phone',
  'social_twitter', 'social_facebook', 'social_github', 'social_linkedin', 'social_youtube', 'social_googleplus', 'social_instagram'] as const
const COMPANY_FLAGS = ['bank_details_sale_quote', 'cash_invoice', 'credit_invoice'] as const
const COMPANY_IMAGES = ['company_seal', 'company_header_boxed', 'company_footer_boxed'] as const
const IMAGE_LABELS: Record<string, string> = { company_seal: 'Company Seal', company_header_boxed: 'Company Header Image', company_footer_boxed: 'Company Footer Image' }
/** Fields stored on the company's partner record. */
const PARTNER_TEXT = ['street', 'street2', 'city', 'zip', 'website', 'vat', 'email', 'phone', 'l10n_sa_edi_building_number', 'l10n_sa_edi_plot_identification',
  'l10n_sa_additional_identification_scheme', 'l10n_sa_additional_identification_number', 'l10n_sa_registered_name'] as const

/** Walks up from the proposed parent: a company may not become its own ancestor. */
async function assertNoCycle(id: number, parent: number | null) {
  const seen = new Set<number>()
  for (let cur = parent; cur !== null; ) {
    if (cur === id) throw bad('A company cannot be its own parent.')
    if (seen.has(cur)) break
    seen.add(cur)
    const [row] = await q('SELECT parent_id FROM res_company WHERE id = :cur', { cur })
    cur = row && row.parent_id != null ? Number(row.parent_id) : null
  }
}

/**
 * Edits a company and its partner. Only the fields present in the request change: leaving one out keeps it, an empty
 * value clears it, and an image keeps its picture unless a new one (or an empty value to remove it) is sent.
 */
export async function updateCompany(id: number, body: Row, env: RequestEnv, allowed: number[]): Promise<Row> {
  const cur = await getCompany(id, allowed)
  const sets: string[] = ['write_date = now()', 'write_uid = :uid']
  const rep: Row = { id, uid: env.uid }

  if (has(body, 'name')) {
    const name = text(body.name)
    if (!name) throw bad('Name is required.')
    const [dup] = await q('SELECT id FROM res_company WHERE lower(name) = lower(:name) AND id <> :id', { name, id })
    if (dup) throw new AppError(`A company named "${name}" already exists.`, 409, 'duplicate_company')
    sets.push('name = :name'); rep.name = name
  }
  if (has(body, 'parent_id')) {
    const parent = await assertRef('res_company', body.parent_id, 'Parent company')
    await assertNoCycle(id, parent)
    sets.push('parent_id = :parent'); rep.parent = parent
  }
  if (has(body, 'currency_id')) { sets.push('currency_id = :currency'); rep.currency = await assertRef('res_currency', body.currency_id, 'Currency') }
  const partnerVals: Row = {}
  if (has(body, 'country_id')) partnerVals.country_id = await assertRef('res_country', body.country_id, 'Country')
  if (has(body, 'state_id')) partnerVals.state_id = await assertRef('res_country_state', body.state_id, 'State')
  for (const k of COMPANY_TEXT) if (has(body, k)) { sets.push(`${k} = :${k}`); rep[k] = text(body[k]) }
  for (const k of COMPANY_FLAGS) if (has(body, k)) { sets.push(`${k} = :${k}`); rep[k] = flag(body[k]) }
  for (const k of COMPANY_IMAGES) if (has(body, k)) { sets.push(`${k} = :${k}`); rep[k] = imageBytes(body[k], IMAGE_LABELS[k]) }
  for (const k of PARTNER_TEXT) if (has(body, k)) partnerVals[k] = text(body[k])
  if (rep.name !== undefined) partnerVals.name = rep.name

  await sequelize.query(`UPDATE res_company SET ${sets.join(', ')} WHERE id = :id`, { replacements: rep as Record<string, unknown>, type: QueryTypes.UPDATE })
  if (Object.keys(partnerVals).length) await updatePartner(Number(cur.partner_id), partnerVals, env)
  return getCompany(id, [])
}
