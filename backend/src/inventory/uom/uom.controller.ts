import type { Request, Response } from 'express'
import { Router } from 'express'
import { Op, type WhereOptions } from 'sequelize'
import { AppError, handle, likeEscape, notFound, ok, paging } from '../../common.helper'
import { simpleListSchema, uomCategorySchema, uomSchema } from '../inventory.validator'
import { Uom, UomCategory } from './uom.model'
import {
  archiveUom, createUom, createUomCategory, deleteUom, deleteUomCategory,
  factorInv, updateUom, updateUomCategory,
} from './uom.service'

const m2o = (id: number | null | undefined, name: string | null | undefined) => (id == null ? null : { id, name: name ?? null })

const uomRow = (u: Uom, categoryName?: string | null) => {
  const j = u.toJSON() as unknown as Record<string, unknown>
  delete j.create_uid; delete j.write_uid
  return {
    ...j,
    category_id: m2o(u.category_id, categoryName),
    // factor_inv is not stored: it is 1 / factor, as in Odoo.
    factor_inv: factorInv(u.factor),
  }
}

// ----------------------------------------------------------- categories ---
const catList = async (req: Request, res: Response) => {
  const q = simpleListSchema.parse(req.query)
  const { limit, offset, page } = paging(q as Record<string, unknown>, 200)
  const where: WhereOptions = q.q ? { name: { [Op.iLike]: `%${likeEscape(q.q)}%` } } : {}
  const { rows, count } = await UomCategory.findAndCountAll({ where, order: [['id', 'ASC']], limit, offset })
  const units = await Uom.findAll({ attributes: ['category_id'], where: { active: true } })
  const per = new Map<number, number>()
  units.forEach(u => per.set(u.category_id, (per.get(u.category_id) ?? 0) + 1))
  return ok(res, { records: rows.map(r => ({ id: r.id, name: r.name, measure_type: r.measure_type, active: r.active, uom_count: per.get(r.id) ?? 0 })), total: count, page, limit })
}
const catDetail = async (req: Request, res: Response) => {
  const row = await UomCategory.findByPk(Number(req.params.id))
  if (!row) throw notFound('UoM category')
  const uoms = await Uom.findAll({ where: { category_id: row.id }, order: [['uom_type', 'DESC'], ['factor', 'ASC']] })
  return ok(res, { id: row.id, name: row.name, measure_type: row.measure_type, active: row.active, uoms: uoms.map(u => uomRow(u, row.name)) })
}
const catCreate = async (req: Request, res: Response) => {
  const row = await createUomCategory(uomCategorySchema.parse(req.body), req.env)
  return ok(res, { id: row.id, name: row.name }, 'UoM category created', 201)
}
const catUpdate = async (req: Request, res: Response) => {
  const row = await updateUomCategory(Number(req.params.id), uomCategorySchema.parse(req.body), req.env)
  return ok(res, { id: row.id, name: row.name }, 'UoM category updated')
}
const catRemove = async (req: Request, res: Response) => {
  await deleteUomCategory(Number(req.params.id))
  return ok(res, { id: Number(req.params.id) }, 'UoM category deleted')
}

// ----------------------------------------------------------------- uoms ---
const uomList = async (req: Request, res: Response) => {
  const q = simpleListSchema.parse(req.query)
  const { limit, offset, page } = paging(q as Record<string, unknown>, 200)
  const where: WhereOptions[] = []
  if (q.q) where.push({ name: { [Op.iLike]: `%${likeEscape(q.q)}%` } })
  if (q.category_id) where.push({ category_id: q.category_id })
  const active = q.active ?? 'true'
  if (active !== 'all') where.push({ active: active === 'true' })
  const { rows, count } = await Uom.findAndCountAll({ where: { [Op.and]: where }, order: [['name', 'ASC']], limit, offset })
  const cats = new Map((await UomCategory.findAll({ attributes: ['id', 'name'] })).map(c => [c.id, c.name]))
  return ok(res, { records: rows.map(u => uomRow(u, cats.get(u.category_id))), total: count, page, limit })
}
const uomDetail = async (req: Request, res: Response) => {
  const u = await Uom.findByPk(Number(req.params.id))
  if (!u) throw notFound('Unit of measure')
  const cat = await UomCategory.findByPk(u.category_id)
  return ok(res, uomRow(u, cat?.name))
}
const uomCreate = async (req: Request, res: Response) => {
  const u = await createUom(uomSchema.parse(req.body) as never, req.env)
  return ok(res, { id: u.id, name: u.name }, 'Unit of measure created', 201)
}
const uomUpdate = async (req: Request, res: Response) => {
  const u = await updateUom(Number(req.params.id), uomSchema.parse(req.body) as never, req.env)
  return ok(res, { id: u.id, name: u.name }, 'Unit of measure updated')
}
const uomArchive = (active: boolean) => async (req: Request, res: Response) => {
  const u = await archiveUom(Number(req.params.id), active, req.env)
  return ok(res, { id: u.id, active: u.active }, active ? 'Unit restored' : 'Unit archived')
}
const uomRemove = async (req: Request, res: Response) => {
  await deleteUom(Number(req.params.id))
  return ok(res, { id: Number(req.params.id) }, 'Unit of measure deleted')
}

const guard = (label: string) => (_r: Request, _s: Response, next: (e?: unknown) => void, v: string) =>
  next(/^\d+$/.test(String(v)) ? undefined : new AppError(`${label} not found`, 404, 'not_found'))

export const uomCategoryRouter = Router()
uomCategoryRouter.param('id', guard('UoM category'))
uomCategoryRouter.get('/', handle(catList))
uomCategoryRouter.post('/', handle(catCreate))
uomCategoryRouter.get('/:id', handle(catDetail))
uomCategoryRouter.put('/:id', handle(catUpdate))
uomCategoryRouter.delete('/:id', handle(catRemove))

export const uomRouter = Router()
uomRouter.param('id', guard('Unit of measure'))
uomRouter.get('/', handle(uomList))
uomRouter.post('/', handle(uomCreate))
uomRouter.get('/:id', handle(uomDetail))
uomRouter.put('/:id', handle(uomUpdate))
uomRouter.post('/:id/archive', handle(uomArchive(false)))
uomRouter.post('/:id/unarchive', handle(uomArchive(true)))
uomRouter.delete('/:id', handle(uomRemove))
