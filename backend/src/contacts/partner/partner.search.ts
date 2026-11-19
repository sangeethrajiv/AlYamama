import { Op, type WhereOptions, type Order } from 'sequelize'
import { sequelize } from '../../orm'
import { likeEscape } from '../../common.helper'
import type { RequestEnv } from '../../middleware'
import { companyScope } from './partner.service'

/**
 * The Contacts search view, modelled on Odoo's `view_res_partner_filter`:
 * search fields, named filters and group-by. The definition is served to the
 * client by GET /contacts/search-view so the UI does not hard-code the list.
 *
 * Odoo's rule for combining: filters inside the same group are OR-ed,
 * different groups are AND-ed.
 */

export interface SearchField {
  key: string
  label: string
  /** Columns searched when this field is picked. */
  columns: string[]
  /** `accent` uses unaccent() on both sides; `plain` is a straight ILIKE. */
  mode: 'accent' | 'plain'
}

export const SEARCH_FIELDS: SearchField[] = [
  { key: 'all', label: 'Name / Email / Phone / Tax ID', mode: 'accent', columns: ['display_name', 'name', 'ref', 'email', 'phone', 'mobile', 'vat', 'cr_number', 'customer_code'] },
  { key: 'name', label: 'Name', mode: 'accent', columns: ['display_name', 'name'] },
  { key: 'email', label: 'Email', mode: 'accent', columns: ['email'] },
  { key: 'phone', label: 'Phone / Mobile', mode: 'plain', columns: ['phone', 'mobile', 'fax'] },
  { key: 'vat', label: 'Tax ID (VAT)', mode: 'plain', columns: ['vat'] },
  { key: 'cr_number', label: 'CR number', mode: 'plain', columns: ['cr_number'] },
  { key: 'customer_code', label: 'Customer code', mode: 'plain', columns: ['customer_code', 'vandor_number'] },
  { key: 'ref', label: 'Internal reference', mode: 'accent', columns: ['ref'] },
  { key: 'city', label: 'City', mode: 'accent', columns: ['city'] },
]

export interface SearchFilter {
  key: string
  label: string
  /** Filters sharing a group are OR-ed together. */
  group: string
  where: WhereOptions
}

export const FILTERS: SearchFilter[] = [
  { key: 'customers', label: 'Customers', group: 'role', where: { customer: true } },
  { key: 'vendors', label: 'Vendors', group: 'role', where: { supplier: true } },
  { key: 'employees', label: 'Employees', group: 'role', where: { employee: true } },
  { key: 'companies', label: 'Companies', group: 'kind', where: { is_company: true } },
  { key: 'individuals', label: 'Individuals', group: 'kind', where: { is_company: { [Op.not]: true } } },
  { key: 'parents', label: 'Parent records only', group: 'tree', where: { parent_id: null } },
  { key: 'children', label: 'Child contacts only', group: 'tree', where: { parent_id: { [Op.ne]: null } } },
  { key: 'has_email', label: 'Has email', group: 'data', where: { email: { [Op.ne]: null } } },
  { key: 'no_vat', label: 'Missing Tax ID', group: 'data', where: { vat: null } },
  { key: 'cash_customers', label: 'Cash customers', group: 'data', where: { cash_customer: true } },
]

export interface GroupBy {
  key: string
  label: string
  /** Column holding the value. */
  column: string
  /** SQL expression giving the label of the group. */
  labelSql: string
}

export const GROUP_BYS: GroupBy[] = [
  { key: 'user_id', label: 'Salesperson', column: 'user_id', labelSql: `(SELECT up.display_name FROM res_users u JOIN res_partner up ON up.id = u.partner_id WHERE u.id = p.user_id)` },
  { key: 'company_id', label: 'Company', column: 'company_id', labelSql: `(SELECT c.name FROM res_company c WHERE c.id = p.company_id)` },
  { key: 'country_id', label: 'Country', column: 'country_id', labelSql: `(SELECT co.name FROM res_country co WHERE co.id = p.country_id)` },
  { key: 'state_id', label: 'State', column: 'state_id', labelSql: `(SELECT st.name FROM res_country_state st WHERE st.id = p.state_id)` },
  { key: 'parent_id', label: 'Related company', column: 'parent_id', labelSql: `(SELECT pa.display_name FROM res_partner pa WHERE pa.id = p.parent_id)` },
  { key: 'industry_id', label: 'Industry', column: 'industry_id', labelSql: `(SELECT i.name FROM res_partner_industry i WHERE i.id = p.industry_id)` },
  { key: 'is_company', label: 'Contact type', column: 'is_company', labelSql: `CASE WHEN p.is_company THEN 'Company' ELSE 'Individual' END` },
  { key: 'type', label: 'Address type', column: 'type', labelSql: `p.type` },
  { key: 'city', label: 'City', column: 'city', labelSql: `p.city` },
]

/** The sortable list columns, mapped to SQL so a client cannot inject an ORDER BY. */
export const SORTABLE: Record<string, string> = {
  display_name: 'display_name', name: 'name', email: 'email', phone: 'phone', mobile: 'mobile',
  city: 'city', vat: 'vat', ref: 'ref', customer_code: 'customer_code', cr_number: 'cr_number',
  create_date: 'create_date', write_date: 'write_date', id: 'id',
}

/** The definition served to the UI. */
export const searchViewDefinition = () => ({
  search_fields: SEARCH_FIELDS.map(({ key, label }) => ({ key, label })),
  filters: FILTERS.map(({ key, label, group }) => ({ key, label, group })),
  group_bys: GROUP_BYS.map(({ key, label }) => ({ key, label })),
  sortable: Object.keys(SORTABLE),
  /** Default visible columns, from migration_analysis/13 section 6. */
  default_columns: ['display_name', 'is_company', 'function', 'parent_id', 'email', 'phone', 'mobile', 'city', 'country_id', 'user_id', 'tags', 'active'],
  active_values: ['true', 'false', 'all'],
})

export interface SearchQuery {
  q?: string
  field?: string
  filters?: string
  active?: string
  company_id?: number
  parent_id?: number
  category_id?: number
  country_id?: number
  user_id?: number
  type?: string
}

/** Builds the Sequelize `where` for a search request. */
export function buildWhere(q: SearchQuery, env: RequestEnv): WhereOptions {
  const and: WhereOptions[] = [companyScope(env)]

  // active: true (default) | false | all
  const active = (q.active || 'true').toLowerCase()
  if (active === 'true') and.push({ active: true })
  else if (active === 'false') and.push({ active: false })

  // Free text over the chosen search field.
  const text = (q.q || '').trim()
  if (text) {
    const field = SEARCH_FIELDS.find(f => f.key === (q.field || 'all')) || SEARCH_FIELDS[0]
    const pattern = `%${likeEscape(text)}%`
    const ors = field.columns.map(col =>
      field.mode === 'accent'
        ? sequelize.where(sequelize.fn('erp_unaccent', sequelize.col(`Partner.${col}`)), { [Op.iLike]: sequelize.fn('erp_unaccent', pattern) })
        : sequelize.where(sequelize.col(`Partner.${col}`), { [Op.iLike]: pattern }),
    )
    and.push({ [Op.or]: ors } as WhereOptions)
  }

  // Named filters: same group OR-ed, different groups AND-ed (Odoo's rule).
  const keys = (q.filters || '').split(',').map(s => s.trim()).filter(Boolean)
  if (keys.length) {
    const byGroup = new Map<string, WhereOptions[]>()
    for (const key of keys) {
      const f = FILTERS.find(x => x.key === key)
      if (!f) continue
      byGroup.set(f.group, [...(byGroup.get(f.group) || []), f.where])
    }
    for (const group of byGroup.values()) and.push(group.length === 1 ? group[0] : ({ [Op.or]: group } as WhereOptions))
  }

  // Exact-match narrowing used by the UI's dropdowns.
  for (const key of ['company_id', 'parent_id', 'country_id', 'user_id', 'type'] as const) {
    const v = q[key]
    if (v !== undefined && v !== null && String(v) !== '') and.push({ [key]: v } as WhereOptions)
  }
  if (q.category_id) {
    and.push(
      sequelize.literal(
        `EXISTS (SELECT 1 FROM res_partner_res_partner_category_rel r WHERE r.partner_id = "Partner"."id" AND r.category_id = ${Number(q.category_id)})`,
      ) as unknown as WhereOptions,
    )
  }

  return { [Op.and]: and.filter(w => Object.keys(w).length || true) }
}

export function buildOrder(order?: string): Order {
  // Odoo's default _order for res.partner is display_name.
  if (!order) return [['display_name', 'ASC']]
  const out: Order = []
  for (const part of order.split(',')) {
    const [rawCol, rawDir] = part.trim().split(/\s+/)
    const col = SORTABLE[rawCol]
    if (!col) continue
    const dir = (rawDir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'
    // Empty values last, as the prototype list does.
    out.push([sequelize.literal(`"Partner"."${col}" ${dir} NULLS LAST`)] as never)
  }
  return out.length ? out : [['display_name', 'ASC']]
}

/**
 * Counts per filter, for the chips in the UI. One query per filter group kept
 * cheap by reusing the same base where.
 */
export async function filterCounts(q: SearchQuery, env: RequestEnv): Promise<Record<string, number>> {
  const { Partner } = await import('./partner.model')
  const base = buildWhere({ ...q, filters: '' }, env)
  const out: Record<string, number> = {}
  out.all = await Partner.count({ where: base })
  await Promise.all(
    FILTERS.map(async f => {
      out[f.key] = await Partner.count({ where: { [Op.and]: [base, f.where] } })
    }),
  )
  out.archived = await Partner.count({ where: buildWhere({ ...q, filters: '', active: 'false' }, env) })
  return out
}

/** read_group: the groups of a group-by with their record counts. */
export async function readGroup(groupKey: string, q: SearchQuery, env: RequestEnv) {
  const g = GROUP_BYS.find(x => x.key === groupKey)
  if (!g) throw new Error(`unknown group_by: ${groupKey}`)
  const { Partner } = await import('./partner.model')
  const where = buildWhere(q, env)
  const rows = await Partner.findAll({
    attributes: [
      [sequelize.col(`Partner.${g.column}`), 'value'],
      [sequelize.literal(g.labelSql.replace(/\bp\./g, '"Partner".')), 'label'],
      [sequelize.fn('COUNT', sequelize.col('Partner.id')), 'count'],
    ],
    where,
    group: [sequelize.col(`Partner.${g.column}`), sequelize.literal(g.labelSql.replace(/\bp\./g, '"Partner".'))] as never,
    order: [[sequelize.literal('2'), 'ASC NULLS LAST']],
    raw: true,
  })
  return (rows as unknown as Array<{ value: unknown; label: string | null; count: string }>).map(r => ({
    value: r.value ?? null,
    label: r.label ?? 'None',
    count: Number(r.count),
  }))
}
