import type { Request, Response } from 'express'
import { Op } from 'sequelize'
import { notFound, ok, paging } from '../../common.helper'
import { ProductCategory } from '../category/product-category.model'
import { Uom } from '../uom/uom.model'
import { ProductProduct, ProductTemplate } from './product.model'
import { archiveProduct, createProduct, deleteProduct, updateProduct } from './product.service'
import { buildOrder, buildWhere, filterCounts, readGroup, searchViewDefinition } from './product.search'
import { productListSchema, productSchema } from '../inventory.validator'
import { companyScope } from '../../contacts/partner/partner.service'

const m2o = (id: number | null | undefined, name: string | null | undefined) =>
  id == null ? null : { id, name: name ?? null }

const INCLUDES = [
  { model: ProductCategory, as: 'category', attributes: ['id', 'name', 'complete_name'], required: false },
  { model: Uom, as: 'uom', attributes: ['id', 'name'], required: false },
  { model: Uom, as: 'uomPo', attributes: ['id', 'name'], required: false },
]

/** The arabic_* columns are kept in the database but not exposed for now. */
const HIDDEN = ['arabic_name', 'create_uid', 'write_uid']

const shape = (t: ProductTemplate, barcode: string | null, variantId: number | null) => {
  const j = t.toJSON() as unknown as Record<string, unknown>
  for (const k of HIDDEN) delete j[k]
  return {
    ...j,
    categ_id: m2o(t.categ_id, (t.category as ProductCategory | undefined)?.complete_name ?? (t.category as ProductCategory | undefined)?.name),
    uom_id: m2o(t.uom_id, (t.uom as Uom | undefined)?.name),
    uom_po_id: m2o(t.uom_po_id, (t.uomPo as Uom | undefined)?.name),
    barcode,
    product_variant_id: variantId,
    category: undefined, uom: undefined, uomPo: undefined, variants: undefined,
  }
}

/** Barcodes live on the variant: fetch them for a page of templates in one query. */
async function variantsFor(ids: number[]) {
  const rows = ids.length ? await ProductProduct.findAll({ where: { product_tmpl_id: { [Op.in]: ids } }, attributes: ['id', 'product_tmpl_id', 'barcode'] }) : []
  return new Map(rows.map(v => [v.product_tmpl_id, v]))
}

/** GET /products */
export async function list(req: Request, res: Response) {
  const q = productListSchema.parse(req.query)
  const { limit, offset, page } = paging(q as Record<string, unknown>)
  const { rows, count } = await ProductTemplate.findAndCountAll({
    where: await buildWhere(q, req.env),
    include: INCLUDES,
    order: buildOrder(q.order),
    limit,
    offset,
    distinct: true,
    col: 'id',
    subQuery: false,
  })
  const variants = await variantsFor(rows.map(r => r.id))
  const payload: Record<string, unknown> = {
    records: rows.map(r => shape(r, variants.get(r.id)?.barcode ?? null, variants.get(r.id)?.id ?? null)),
    total: count, page, limit,
  }
  if (q.counts === '1') payload.counts = await filterCounts(q, req.env)
  if (q.group_by) payload.groups = await readGroup(q.group_by, q, req.env)
  return ok(res, payload)
}

export const searchView = async (_req: Request, res: Response) => ok(res, searchViewDefinition())

export async function group(req: Request, res: Response) {
  const q = productListSchema.parse(req.query)
  const key = q.group_by || 'type'
  return ok(res, { group_by: key, groups: await readGroup(key, q, req.env) })
}

/** GET /products/name-search - autocomplete for pickers. */
export async function nameSearch(req: Request, res: Response) {
  const q = productListSchema.parse(req.query)
  const rows = await ProductTemplate.findAll({
    where: await buildWhere({ ...q, field: q.field || 'all' }, req.env),
    attributes: ['id', 'name', 'default_code', 'type', 'uom_id'],
    order: [['name', 'ASC']],
    limit: Math.min(q.limit ?? 20, 100),
  })
  return ok(res, rows.map(r => ({ id: r.id, name: r.default_code ? `[${r.default_code}] ${r.name}` : r.name, type: r.type, uom_id: r.uom_id })))
}

/** GET /products/:id */
export async function detail(req: Request, res: Response) {
  const id = Number(req.params.id)
  const t = await ProductTemplate.findOne({ where: { id, ...companyScope(req.env) }, include: INCLUDES })
  if (!t) throw notFound('Product')
  const v = await ProductProduct.findOne({ where: { product_tmpl_id: id }, attributes: ['id', 'barcode'] })
  return ok(res, shape(t, v?.barcode ?? null, v?.id ?? null))
}

export async function create(req: Request, res: Response) {
  const t = await createProduct(productSchema.parse(req.body) as never, req.env)
  return ok(res, { id: t.id, name: t.name }, 'Product created', 201)
}

export async function update(req: Request, res: Response) {
  const t = await updateProduct(Number(req.params.id), productSchema.parse(req.body) as never, req.env)
  return ok(res, { id: t.id, name: t.name }, 'Product updated')
}

export async function archive(req: Request, res: Response) {
  const t = await archiveProduct(Number(req.params.id), false, req.env)
  return ok(res, { id: t.id, active: t.active }, 'Product archived')
}

export async function unarchive(req: Request, res: Response) {
  const t = await archiveProduct(Number(req.params.id), true, req.env)
  return ok(res, { id: t.id, active: t.active }, 'Product restored')
}

export async function remove(req: Request, res: Response) {
  await deleteProduct(Number(req.params.id))
  return ok(res, { id: Number(req.params.id) }, 'Product deleted')
}
