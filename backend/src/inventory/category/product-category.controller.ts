import type { Request, Response } from 'express'
import { Op, type WhereOptions } from 'sequelize'
import { sequelize } from '../../orm'
import { AppError, handle, likeEscape, notFound, ok, paging } from '../../common.helper'
import { Router } from 'express'
import { categorySchema, simpleListSchema } from '../inventory.validator'
import { ProductCategory } from './product-category.model'
import { createCategory, deleteCategory, updateCategory } from './product-category.service'

const m2o = (id: number | null | undefined, name: string | null | undefined) => (id == null ? null : { id, name: name ?? null })

/** arabic_name is stored but not exposed for now. */
const ATTRS = ['id', 'name', 'complete_name', 'parent_id', 'parent_path', 'sequence_code', 'create_date', 'write_date']

/** Product counts per category, including sub-categories (Odoo's `product_count`). */
async function productCounts(): Promise<Map<number, number>> {
  const [rows] = await sequelize.query(`
    SELECT c.id, count(t.id)::int AS n
      FROM product_category c
      LEFT JOIN product_category d ON d.parent_path LIKE c.parent_path || '%'
      LEFT JOIN product_template t ON t.categ_id = d.id
     GROUP BY c.id`)
  return new Map((rows as Array<{ id: number; n: number }>).map(r => [r.id, r.n]))
}

async function list(req: Request, res: Response) {
  const q = simpleListSchema.parse(req.query)
  const { limit, offset, page } = paging(q as Record<string, unknown>, 500)
  const where: WhereOptions[] = []
  if (q.q) where.push({ complete_name: { [Op.iLike]: `%${likeEscape(q.q)}%` } })
  if (q.parent_id) where.push({ parent_id: q.parent_id })
  const { rows, count } = await ProductCategory.findAndCountAll({
    where: { [Op.and]: where }, attributes: ATTRS, order: [['complete_name', 'ASC']], limit, offset,
  })
  const counts = await productCounts()
  const names = new Map(rows.map(r => [r.id, r.complete_name]))
  return ok(res, {
    records: rows.map(r => ({ ...(r.toJSON() as object), parent_id: m2o(r.parent_id, r.parent_id != null ? names.get(r.parent_id) : null), product_count: counts.get(r.id) ?? 0 })),
    total: count, page, limit,
  })
}

async function detail(req: Request, res: Response) {
  const row = await ProductCategory.findByPk(Number(req.params.id), { attributes: ATTRS })
  if (!row) throw notFound('Category')
  const parent = row.parent_id ? await ProductCategory.findByPk(row.parent_id, { attributes: ['id', 'complete_name'] }) : null
  const counts = await productCounts()
  return ok(res, { ...(row.toJSON() as object), parent_id: m2o(row.parent_id, parent?.complete_name), product_count: counts.get(row.id) ?? 0 })
}

const create = async (req: Request, res: Response) => {
  const row = await createCategory(categorySchema.parse(req.body) as never, req.env)
  return ok(res, { id: row.id, complete_name: row.complete_name }, 'Category created', 201)
}
const update = async (req: Request, res: Response) => {
  const row = await updateCategory(Number(req.params.id), categorySchema.parse(req.body) as never, req.env)
  return ok(res, { id: row.id, complete_name: row.complete_name }, 'Category updated')
}
const remove = async (req: Request, res: Response) => {
  await deleteCategory(Number(req.params.id))
  return ok(res, { id: Number(req.params.id) }, 'Category deleted')
}

const router = Router()
router.param('id', (_r, _s, next, v) => next(/^\d+$/.test(String(v)) ? undefined : new AppError('Category not found', 404, 'not_found')))
router.get('/', handle(list))
router.post('/', handle(create))
router.get('/:id', handle(detail))
router.put('/:id', handle(update))
router.delete('/:id', handle(remove))
export default router
