import { Op, type WhereOptions, type Order } from 'sequelize'
import { sequelize } from '../../orm'
import { likeEscape } from '../../common.helper'
import type { RequestEnv } from '../../middleware'
import { companyScope } from '../../contacts/partner/partner.service'
import { categoryAndDescendantIds } from '../category/product-category.service'
import { ProductTemplate } from './product.model'

/**
 * The Products search view, modelled on Odoo's `product_template_search_view`:
 * search fields, named filters and group-by, served to the UI by
 * GET /products/search-view. Same-group filters are OR-ed, different groups AND-ed.
 */

interface SearchField {
  key: string
  label: string
  /** Columns on product_template. */
  columns: string[]
  /** Also match the variant barcode / reference. */
  variant?: boolean
}

export const SEARCH_FIELDS: SearchField[] = [
  { key: 'all', label: 'Name / Reference / Barcode', columns: ['name', 'default_code', 'internal_short_code'], variant: true },
  { key: 'name', label: 'Name', columns: ['name'] },
  { key: 'default_code', label: 'Internal reference', columns: ['default_code', 'internal_short_code'] },
  { key: 'barcode', label: 'Barcode', columns: [], variant: true },
]

interface Filter {
  key: string
  label: string
  group: string
  where: WhereOptions
}

export const FILTERS: Filter[] = [
  { key: 'storable', label: 'Storable Products', group: 'type', where: { type: 'product' } },
  { key: 'consumable', label: 'Consumable', group: 'type', where: { type: 'consu' } },
  { key: 'service', label: 'Services', group: 'type', where: { type: 'service' } },
  { key: 'can_sell', label: 'Can be Sold', group: 'sale', where: { sale_ok: true } },
  { key: 'can_purchase', label: 'Can be Purchased', group: 'purchase', where: { purchase_ok: true } },
  { key: 'lot_tracked', label: 'Tracked by lot', group: 'tracking', where: { tracking: 'lot' } },
  { key: 'serial_tracked', label: 'Tracked by serial', group: 'tracking', where: { tracking: 'serial' } },
]

export interface GroupBy {
  key: string
  label: string
  column: string
  labelSql: string
}

export const GROUP_BYS: GroupBy[] = [
  { key: 'type', label: 'Product Type', column: 'type', labelSql: `CASE "ProductTemplate"."type" WHEN 'product' THEN 'Storable Product' WHEN 'consu' THEN 'Consumable' WHEN 'service' THEN 'Service' END` },
  { key: 'categ_id', label: 'Product Category', column: 'categ_id', labelSql: `(SELECT c.complete_name FROM product_category c WHERE c.id = "ProductTemplate"."categ_id")` },
  { key: 'uom_id', label: 'Unit of Measure', column: 'uom_id', labelSql: `(SELECT u.name FROM uom_uom u WHERE u.id = "ProductTemplate"."uom_id")` },
  { key: 'tracking', label: 'Tracking', column: 'tracking', labelSql: `CASE "ProductTemplate"."tracking" WHEN 'none' THEN 'No tracking' WHEN 'lot' THEN 'By lot' WHEN 'serial' THEN 'By unique serial number' END` },
]

export const SORTABLE: Record<string, string> = {
  name: 'name', default_code: 'default_code', list_price: 'list_price', type: 'type',
  create_date: 'create_date', write_date: 'write_date', id: 'id', sequence: 'sequence',
}

export const searchViewDefinition = () => ({
  search_fields: SEARCH_FIELDS.map(({ key, label }) => ({ key, label })),
  filters: FILTERS.map(({ key, label, group }) => ({ key, label, group })),
  group_bys: GROUP_BYS.map(({ key, label }) => ({ key, label })),
  sortable: Object.keys(SORTABLE),
  default_columns: ['default_code', 'name', 'categ_id', 'type', 'uom_id', 'list_price', 'active'],
  active_values: ['true', 'false', 'all'],
})

export interface ProductSearch {
  q?: string
  field?: string
  filters?: string
  active?: string
  categ_id?: number
  uom_id?: number
  type?: string
  company_id?: number
}

/** Odoo's default `_order` for product.template is `name`. */
export function buildOrder(order?: string): Order {
  if (!order) return [['name', 'ASC']]
  const out: Order = []
  for (const part of order.split(',')) {
    const [col, dir] = part.trim().split(/\s+/)
    const column = SORTABLE[col]
    if (!column) continue
    out.push([sequelize.literal(`"ProductTemplate"."${column}" ${(dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC'} NULLS LAST`)] as never)
  }
  return out.length ? out : [['name', 'ASC']]
}

export async function buildWhere(q: ProductSearch, env: RequestEnv): Promise<WhereOptions> {
  const and: WhereOptions[] = [companyScope(env) as WhereOptions]

  const active = (q.active || 'true').toLowerCase()
  if (active === 'true') and.push({ active: true })
  else if (active === 'false') and.push({ active: false })

  const text = (q.q || '').trim()
  if (text) {
    const field = SEARCH_FIELDS.find(f => f.key === (q.field || 'all')) || SEARCH_FIELDS[0]
    const pattern = `%${likeEscape(text)}%`
    const ors: WhereOptions[] = field.columns.map(col =>
      col === 'name'
        ? (sequelize.where(sequelize.fn('erp_unaccent', sequelize.col('ProductTemplate.name')), { [Op.iLike]: sequelize.fn('erp_unaccent', pattern) }) as unknown as WhereOptions)
        : { [col]: { [Op.iLike]: pattern } },
    )
    if (field.variant) {
      ors.push(
        sequelize.literal(
          `EXISTS (SELECT 1 FROM product_product pp WHERE pp.product_tmpl_id = "ProductTemplate"."id" AND (pp.barcode ILIKE ${sequelize.escape(pattern)} OR pp.default_code ILIKE ${sequelize.escape(pattern)}))`,
        ) as unknown as WhereOptions,
      )
    }
    and.push({ [Op.or]: ors })
  }

  const keys = (q.filters || '').split(',').map(s => s.trim()).filter(Boolean)
  const byGroup = new Map<string, WhereOptions[]>()
  for (const key of keys) {
    const f = FILTERS.find(x => x.key === key)
    if (f) byGroup.set(f.group, [...(byGroup.get(f.group) || []), f.where])
  }
  for (const group of byGroup.values()) and.push(group.length === 1 ? group[0] : { [Op.or]: group })

  if (q.type) and.push({ type: q.type })
  if (q.uom_id) and.push({ uom_id: q.uom_id })
  if (q.company_id) and.push({ company_id: q.company_id })
  // Odoo's `child_of`: a category filter includes its sub-categories.
  if (q.categ_id) and.push({ categ_id: { [Op.in]: await categoryAndDescendantIds(q.categ_id) } })

  return { [Op.and]: and }
}

export async function filterCounts(q: ProductSearch, env: RequestEnv): Promise<Record<string, number>> {
  const base = await buildWhere({ ...q, filters: '' }, env)
  const out: Record<string, number> = { all: await ProductTemplate.count({ where: base }) }
  await Promise.all(
    FILTERS.map(async f => {
      out[f.key] = await ProductTemplate.count({ where: { [Op.and]: [base, f.where] } })
    }),
  )
  out.archived = await ProductTemplate.count({ where: await buildWhere({ ...q, filters: '', active: 'false' }, env) })
  return out
}

export async function readGroup(groupKey: string, q: ProductSearch, env: RequestEnv) {
  const g = GROUP_BYS.find(x => x.key === groupKey)
  if (!g) throw new Error(`unknown group_by: ${groupKey}`)
  const rows = await ProductTemplate.findAll({
    attributes: [
      [sequelize.col(`ProductTemplate.${g.column}`), 'value'],
      [sequelize.literal(g.labelSql), 'label'],
      [sequelize.fn('COUNT', sequelize.col('ProductTemplate.id')), 'count'],
    ],
    where: await buildWhere(q, env),
    group: [sequelize.col(`ProductTemplate.${g.column}`), sequelize.literal(g.labelSql)] as never,
    order: [[sequelize.literal('2'), 'ASC NULLS LAST']],
    raw: true,
  })
  return (rows as unknown as Array<{ value: unknown; label: string | null; count: string }>).map(r => ({
    value: r.value ?? null,
    label: r.label ?? 'None',
    count: Number(r.count),
  }))
}
