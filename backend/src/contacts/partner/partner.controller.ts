import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { sequelize } from '../../orm'
import { notFound, ok, paging } from '../../common.helper'
import { Partner } from './partner.model'
import { PartnerCategory } from '../category/category.model'
import { PartnerBank } from '../partner-bank/partner-bank.model'
import { Bank } from '../bank/bank.model'
import { PartnerTitle } from '../title/title.model'
import { PartnerIndustry } from '../industry/industry.model'
import { Country } from '../../core/country/country.model'
import { CountryState } from '../../core/country/state.model'
import { Company } from '../../core/company/company.model'
import { User } from '../../core/user/user.model'
import { archivePartner, createPartner, deletePartner, updatePartner, companyScope } from './partner.service'
import { buildOrder, buildWhere, filterCounts, readGroup, searchViewDefinition } from './partner.search'
import { createPartnerSchema, listQuerySchema, updatePartnerSchema } from '../../requestValidator'

/** m2o values are returned as {id, name} so the UI can show a label without a second call. */
const m2o = (id: number | null | undefined, name: string | null | undefined) =>
  id == null ? null : { id, name: name ?? null }

const LIST_ATTRS = [
  'id', 'name', 'display_name', 'is_company', 'type', 'function', 'parent_id', 'ref',
  'email', 'phone', 'mobile', 'city', 'country_id', 'state_id', 'user_id', 'company_id',
  'vat', 'cr_number', 'customer_code', 'customer', 'supplier', 'employee', 'active',
  'credit_limit', 'create_date', 'write_date',
]

/** Kept in the database, not exposed for now (the English name is the main name). */
const ARABIC = ['arabic_name', 'arabic_street2_name', 'arabic_city_name', 'vat_arabic']
const dropArabic = (j: Record<string, unknown>) => { for (const k of ARABIC) delete j[k]; return j }

const INCLUDES = [
  { model: Partner, as: 'parent', attributes: ['id', 'display_name'], required: false },
  { model: Country, as: 'country', attributes: ['id', 'name'], required: false },
  { model: CountryState, as: 'state', attributes: ['id', 'name'], required: false },
  { model: Company, as: 'company', attributes: ['id', 'name'], required: false },
  { model: PartnerCategory, as: 'categories', attributes: ['id', 'name', 'color'], through: { attributes: [] }, required: false },
]

/** Salesperson labels come from the user's own partner record. */
async function salespersonNames(ids: Array<number | null>): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((x): x is number => x != null))]
  if (!unique.length) return new Map()
  const rows = await User.findAll({
    where: { id: { [Op.in]: unique } },
    attributes: ['id', 'partner_id'],
    include: [{ model: Partner, as: 'partner', attributes: ['display_name'], required: false }],
  }).catch(() => [] as User[])
  const map = new Map<number, string>()
  // The association is not declared on User, so read the partner names separately.
  const partnerIds = rows.map(r => r.partner_id).filter(Boolean)
  const partners = partnerIds.length
    ? await Partner.findAll({ where: { id: { [Op.in]: partnerIds } }, attributes: ['id', 'display_name'] })
    : []
  const byPartner = new Map(partners.map(p => [p.id, p.display_name || '']))
  rows.forEach(r => map.set(r.id, byPartner.get(r.partner_id) || ''))
  return map
}

const listRow = (p: Partner, sales: Map<number, string>) => {
  const j = dropArabic(p.toJSON() as unknown as Record<string, unknown>)
  return {
    ...j,
    company_type: p.is_company ? 'company' : 'person',
    parent_id: m2o(p.parent_id, (p.parent as Partner | undefined)?.display_name),
    country_id: m2o(p.country_id, (p.country as Country | undefined)?.name),
    state_id: m2o(p.state_id, (p.state as CountryState | undefined)?.name),
    company_id: m2o(p.company_id, (p.company as Company | undefined)?.name),
    user_id: m2o(p.user_id, p.user_id != null ? sales.get(p.user_id) ?? null : null),
    tags: (p.categories || []).map(c => ({ id: c.id, name: c.name, color: c.color })),
    parent: undefined, country: undefined, state: undefined, company: undefined, categories: undefined,
  }
}

/** GET /contacts - the Contacts list (search view applied). */
export async function list(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query)
  const { limit, offset, page } = paging(q as Record<string, unknown>)
  const where = buildWhere(q, req.env)

  const { rows, count } = await Partner.findAndCountAll({
    where,
    attributes: LIST_ATTRS,
    include: INCLUDES,
    order: buildOrder(q.order),
    limit,
    offset,
    distinct: true,
    col: 'id',
    subQuery: false,
  })

  const sales = await salespersonNames(rows.map(r => r.user_id))
  const payload: Record<string, unknown> = {
    records: rows.map(r => listRow(r, sales)),
    total: count,
    page,
    limit,
  }
  if (q.counts === '1') payload.counts = await filterCounts(q, req.env)
  if (q.group_by) payload.groups = await readGroup(q.group_by, q, req.env)
  return ok(res, payload)
}

/** GET /contacts/search-view - the search view definition for the UI. */
export async function searchView(_req: Request, res: Response) {
  return ok(res, searchViewDefinition())
}

/** GET /contacts/read-group - groups with counts. */
export async function group(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query)
  const key = q.group_by || 'user_id'
  return ok(res, { group_by: key, groups: await readGroup(key, q, req.env) })
}

/** GET /contacts/name-search - autocomplete for other screens. */
export async function nameSearch(req: Request, res: Response) {
  const q = listQuerySchema.parse(req.query)
  const rows = await Partner.findAll({
    where: buildWhere({ ...q, field: q.field || 'name' }, req.env),
    attributes: ['id', 'display_name', 'name', 'is_company', 'vat', 'email', 'phone', 'city'],
    order: [['display_name', 'ASC']],
    limit: Math.min(q.limit ?? 20, 100),
  })
  return ok(res, rows.map(r => ({ id: r.id, name: r.display_name || r.name, is_company: r.is_company, vat: r.vat, email: r.email, phone: r.phone, city: r.city })))
}

/** GET /contacts/:id - one contact with children, banks and tags. */
export async function detail(req: Request, res: Response) {
  const id = Number(req.params.id)
  const p = await Partner.findOne({
    where: { id, ...companyScope(req.env) },
    include: [
      ...INCLUDES,
      { model: PartnerTitle, as: 'titleRec', attributes: ['id', 'name'], required: false },
      { model: PartnerIndustry, as: 'industry', attributes: ['id', 'name'], required: false },
      { model: PartnerBank, as: 'banks', include: [{ model: Bank, as: 'bank', attributes: ['id', 'name', 'bic'], required: false }], required: false },
    ],
  })
  if (!p) throw notFound('Contact')

  const children = await Partner.findAll({
    where: { parent_id: id },
    attributes: ['id', 'display_name', 'name', 'type', 'is_company', 'function', 'email', 'phone', 'mobile', 'street', 'city', 'zip', 'country_id', 'state_id', 'active'],
    order: [['is_company', 'DESC'], ['display_name', 'ASC']],
  })
  const sales = await salespersonNames([p.user_id])

  const j = dropArabic(p.toJSON() as unknown as Record<string, unknown>)
  return ok(res, {
    ...j,
    company_type: p.is_company ? 'company' : 'person',
    parent_id: m2o(p.parent_id, (p.parent as Partner | undefined)?.display_name),
    country_id: m2o(p.country_id, (p.country as Country | undefined)?.name),
    state_id: m2o(p.state_id, (p.state as CountryState | undefined)?.name),
    company_id: m2o(p.company_id, (p.company as Company | undefined)?.name),
    user_id: m2o(p.user_id, p.user_id != null ? sales.get(p.user_id) ?? null : null),
    title: m2o(p.title, (p.titleRec as PartnerTitle | undefined)?.name),
    industry_id: m2o(p.industry_id, (p.industry as PartnerIndustry | undefined)?.name),
    tags: (p.categories || []).map(c => ({ id: c.id, name: c.name, color: c.color })),
    image: p.image ? p.image.toString('base64') : null,
    image_sign: p.image_sign ? p.image_sign.toString('base64') : null,
    image_seal: p.image_seal ? p.image_seal.toString('base64') : null,
    banks: (p.banks || []).map(b => ({
      id: b.id, acc_number: b.acc_number, sanitized_acc_number: b.sanitized_acc_number,
      acc_holder_name: b.acc_holder_name, iban: b.iban, show_in_report: b.show_in_report,
      sequence: b.sequence, currency_id: b.currency_id, company_id: b.company_id,
      bank_id: m2o(b.bank_id, (b.bank as Bank | undefined)?.name),
      bic: (b.bank as Bank | undefined)?.bic ?? null,
    })),
    children: children.map(c => c.toJSON()),
    parent: undefined, country: undefined, state: undefined, company: undefined,
    categories: undefined, titleRec: undefined, industry: undefined,
  })
}

export async function create(req: Request, res: Response) {
  const values = createPartnerSchema.parse(req.body)
  const p = await createPartner(values as Record<string, unknown>, req.env)
  return ok(res, { id: p.id, display_name: p.display_name }, 'Contact created', 201)
}

export async function update(req: Request, res: Response) {
  const values = updatePartnerSchema.parse(req.body)
  const p = await updatePartner(Number(req.params.id), values as Record<string, unknown>, req.env)
  return ok(res, { id: p.id, display_name: p.display_name }, 'Contact updated')
}

export async function archive(req: Request, res: Response) {
  const p = await archivePartner(Number(req.params.id), false, req.env)
  return ok(res, { id: p.id, active: p.active }, 'Contact archived')
}

export async function unarchive(req: Request, res: Response) {
  const p = await archivePartner(Number(req.params.id), true, req.env)
  return ok(res, { id: p.id, active: p.active }, 'Contact restored')
}

export async function remove(req: Request, res: Response) {
  await deletePartner(Number(req.params.id), req.env)
  return ok(res, { id: Number(req.params.id) }, 'Contact deleted')
}

/** GET /contacts/:id/stats - counts used by the form header. */
export async function stats(req: Request, res: Response) {
  const id = Number(req.params.id)
  const [children, banks] = await Promise.all([
    Partner.count({ where: { parent_id: id } }),
    PartnerBank.count({ where: { partner_id: id } }),
  ])
  const tagRows = (await sequelize.query(
    'SELECT count(*)::int AS n FROM res_partner_res_partner_category_rel WHERE partner_id = $1',
    { bind: [id], type: 'SELECT' } as never,
  )) as unknown as Array<{ n: number }>
  return ok(res, { children, banks, tags: tagRows[0]?.n ?? 0 })
}
