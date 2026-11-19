import type { Request, Response } from 'express'
import { Router } from 'express'
import { Op, type WhereOptions } from 'sequelize'
import { sequelize } from '../../orm'
import { AppError, handle, likeEscape, notFound, ok, paging } from '../../common.helper'
import { locationSchema, pickingTypeSchema, simpleListSchema, warehouseSchema } from '../inventory.validator'
import { Company } from '../../core/company/company.model'
import { Location, LOCATION_USAGE_LABELS, PICKING_CODE_LABELS, PickingType, Warehouse, type LocationUsage } from './stock.model'
import { createLocation, deleteLocation, updateLocation } from './location.service'
import { updatePickingType, updateWarehouse } from './warehouse.service'

const m2o = (id: number | null | undefined, name: string | null | undefined) => (id == null ? null : { id, name: name ?? null })
const guard = (label: string) => (_r: Request, _s: Response, next: (e?: unknown) => void, v: string) =>
  next(/^\d+$/.test(String(v)) ? undefined : new AppError(`${label} not found`, 404, 'not_found'))
const stripAudit = <T extends object>(row: T) => {
  const j = { ...(row as Record<string, unknown>) }
  delete j.create_uid; delete j.write_uid
  return j
}

const companyNames = async () => new Map((await Company.findAll({ attributes: ['id', 'name'] })).map(c => [c.id, c.name]))
const locationNames = async (ids: Array<number | null>) => {
  const unique = [...new Set(ids.filter((x): x is number => x != null))]
  const rows = unique.length ? await Location.findAll({ where: { id: { [Op.in]: unique } }, attributes: ['id', 'complete_name'] }) : []
  return new Map(rows.map(l => [l.id, l.complete_name]))
}

// ------------------------------------------------------------ warehouses ---
const whList = async (req: Request, res: Response) => {
  const q = simpleListSchema.parse(req.query)
  const where: WhereOptions[] = []
  if (q.q) where.push({ [Op.or]: [{ name: { [Op.iLike]: `%${likeEscape(q.q)}%` } }, { code: { [Op.iLike]: `%${likeEscape(q.q)}%` } }] })
  if (q.company_id) where.push({ company_id: q.company_id })
  const active = q.active ?? 'true'
  if (active !== 'all') where.push({ active: active === 'true' })
  const rows = await Warehouse.findAll({ where: { [Op.and]: where }, order: [['id', 'ASC']] })
  const [companies, locs] = await Promise.all([companyNames(), locationNames(rows.flatMap(r => [r.view_location_id, r.lot_stock_id]))])
  return ok(res, {
    records: rows.map(w => ({
      ...stripAudit(w.toJSON()),
      company_id: m2o(w.company_id, companies.get(w.company_id)),
      view_location_id: m2o(w.view_location_id, locs.get(w.view_location_id)),
      lot_stock_id: m2o(w.lot_stock_id, locs.get(w.lot_stock_id)),
    })),
    total: rows.length,
  })
}
const whDetail = async (req: Request, res: Response) => {
  const w = await Warehouse.findByPk(Number(req.params.id))
  if (!w) throw notFound('Warehouse')
  const [companies, locs, types, locCount] = await Promise.all([
    companyNames(),
    locationNames([w.view_location_id, w.lot_stock_id, w.wh_input_stock_loc_id, w.wh_qc_stock_loc_id, w.wh_output_stock_loc_id, w.wh_pack_stock_loc_id]),
    PickingType.findAll({ where: { warehouse_id: w.id }, order: [['sequence', 'ASC'], ['id', 'ASC']] }),
    sequelize.query(`SELECT count(*)::int AS n FROM stock_location WHERE parent_path LIKE (SELECT parent_path FROM stock_location WHERE id = :v) || '%'`, { replacements: { v: w.view_location_id }, type: 'SELECT' } as never),
  ])
  const j = stripAudit(w.toJSON())
  return ok(res, {
    ...j,
    company_id: m2o(w.company_id, companies.get(w.company_id)),
    view_location_id: m2o(w.view_location_id, locs.get(w.view_location_id)),
    lot_stock_id: m2o(w.lot_stock_id, locs.get(w.lot_stock_id)),
    wh_input_stock_loc_id: m2o(w.wh_input_stock_loc_id, locs.get(w.wh_input_stock_loc_id as number)),
    wh_qc_stock_loc_id: m2o(w.wh_qc_stock_loc_id, locs.get(w.wh_qc_stock_loc_id as number)),
    wh_output_stock_loc_id: m2o(w.wh_output_stock_loc_id, locs.get(w.wh_output_stock_loc_id as number)),
    wh_pack_stock_loc_id: m2o(w.wh_pack_stock_loc_id, locs.get(w.wh_pack_stock_loc_id as number)),
    operation_types: types.map(t => ({ id: t.id, name: t.name, code: t.code, active: t.active })),
    location_count: (locCount as unknown as Array<{ n: number }>)[0]?.n ?? 0,
  })
}
const whUpdate = async (req: Request, res: Response) => {
  const w = await updateWarehouse(Number(req.params.id), warehouseSchema.parse(req.body) as never, req.env)
  return ok(res, { id: w.id, name: w.name, code: w.code }, 'Warehouse updated')
}

// ------------------------------------------------------------- locations ---
const locJson = (l: Location, names: Map<number, string | null>, companies: Map<number, string>) => ({
  ...stripAudit(l.toJSON()),
  usage_label: LOCATION_USAGE_LABELS[l.usage as LocationUsage] ?? l.usage,
  location_id: m2o(l.location_id, l.location_id != null ? names.get(l.location_id) : null),
  company_id: m2o(l.company_id, l.company_id != null ? companies.get(l.company_id) : null),
})

const locList = async (req: Request, res: Response) => {
  const q = simpleListSchema.parse(req.query)
  const { limit, offset, page } = paging(q as Record<string, unknown>, 200)
  const where: WhereOptions[] = []
  if (q.q) {
    const p = `%${likeEscape(q.q)}%`
    where.push({ [Op.or]: [{ complete_name: { [Op.iLike]: p } }, { barcode: { [Op.iLike]: p } }] })
  }
  if (q.usage) where.push({ usage: q.usage })
  if (q.parent_id) where.push({ location_id: q.parent_id })
  if (q.company_id) where.push({ company_id: q.company_id })
  if (q.warehouse_id) {
    const wh = await Warehouse.findByPk(q.warehouse_id, { attributes: ['view_location_id'] })
    const view = wh ? await Location.findByPk(wh.view_location_id, { attributes: ['parent_path'] }) : null
    where.push(view?.parent_path ? { parent_path: { [Op.like]: `${view.parent_path}%` } } : { id: 0 })
  }
  const active = q.active ?? 'true'
  if (active !== 'all') where.push({ active: active === 'true' })
  const { rows, count } = await Location.findAndCountAll({ where: { [Op.and]: where }, order: [['complete_name', 'ASC']], limit, offset })
  const [names, companies] = await Promise.all([locationNames(rows.map(r => r.location_id)), companyNames()])
  return ok(res, { records: rows.map(l => locJson(l, names, companies)), total: count, page, limit })
}
const locDetail = async (req: Request, res: Response) => {
  const l = await Location.findByPk(Number(req.params.id))
  if (!l) throw notFound('Location')
  const [names, companies] = await Promise.all([locationNames([l.location_id]), companyNames()])
  return ok(res, locJson(l, names, companies))
}
const locCreate = async (req: Request, res: Response) => {
  const l = await createLocation(locationSchema.parse(req.body) as never, req.env)
  return ok(res, { id: l.id, complete_name: l.complete_name }, 'Location created', 201)
}
const locUpdate = async (req: Request, res: Response) => {
  const l = await updateLocation(Number(req.params.id), locationSchema.parse(req.body) as never, req.env)
  return ok(res, { id: l.id, complete_name: l.complete_name }, 'Location updated')
}
const locArchive = (active: boolean) => async (req: Request, res: Response) => {
  const l = await updateLocation(Number(req.params.id), { active }, req.env)
  return ok(res, { id: l.id, active: l.active }, active ? 'Location restored' : 'Location archived')
}
const locRemove = async (req: Request, res: Response) => {
  await deleteLocation(Number(req.params.id))
  return ok(res, { id: Number(req.params.id) }, 'Location deleted')
}

// ------------------------------------------------------- operation types ---
const ptJson = (t: PickingType, names: Map<number, string | null>, whs: Map<number, string>) => ({
  ...stripAudit(t.toJSON()),
  code_label: PICKING_CODE_LABELS[t.code] ?? t.code,
  warehouse_id: m2o(t.warehouse_id, t.warehouse_id != null ? whs.get(t.warehouse_id) : null),
  default_location_src_id: m2o(t.default_location_src_id, t.default_location_src_id != null ? names.get(t.default_location_src_id) : null),
  default_location_dest_id: m2o(t.default_location_dest_id, t.default_location_dest_id != null ? names.get(t.default_location_dest_id) : null),
})
const ptList = async (req: Request, res: Response) => {
  const q = simpleListSchema.parse(req.query)
  const where: WhereOptions[] = []
  if (q.q) where.push({ name: { [Op.iLike]: `%${likeEscape(q.q)}%` } })
  if (q.warehouse_id) where.push({ warehouse_id: q.warehouse_id })
  if (q.code) where.push({ code: q.code })
  const active = q.active ?? 'true'
  if (active !== 'all') where.push({ active: active === 'true' })
  const rows = await PickingType.findAll({ where: { [Op.and]: where }, order: [['warehouse_id', 'ASC'], ['sequence', 'ASC'], ['id', 'ASC']] })
  const [names, whs] = await Promise.all([
    locationNames(rows.flatMap(r => [r.default_location_src_id, r.default_location_dest_id])),
    Warehouse.findAll({ attributes: ['id', 'name'] }).then(w => new Map(w.map(x => [x.id, x.name]))),
  ])
  return ok(res, { records: rows.map(t => ptJson(t, names, whs)), total: rows.length })
}
const ptDetail = async (req: Request, res: Response) => {
  const t = await PickingType.findByPk(Number(req.params.id))
  if (!t) throw notFound('Operation type')
  const [names, whs] = await Promise.all([
    locationNames([t.default_location_src_id, t.default_location_dest_id]),
    Warehouse.findAll({ attributes: ['id', 'name'] }).then(w => new Map(w.map(x => [x.id, x.name]))),
  ])
  return ok(res, ptJson(t, names, whs))
}
const ptUpdate = async (req: Request, res: Response) => {
  const t = await updatePickingType(Number(req.params.id), pickingTypeSchema.parse(req.body) as never, req.env)
  return ok(res, { id: t.id, name: t.name }, 'Operation type updated')
}

export const warehouseRouter = Router()
warehouseRouter.param('id', guard('Warehouse'))
warehouseRouter.get('/', handle(whList))
warehouseRouter.get('/:id', handle(whDetail))
warehouseRouter.put('/:id', handle(whUpdate))

export const locationRouter = Router()
locationRouter.param('id', guard('Location'))
locationRouter.get('/', handle(locList))
locationRouter.post('/', handle(locCreate))
locationRouter.get('/:id', handle(locDetail))
locationRouter.put('/:id', handle(locUpdate))
locationRouter.post('/:id/archive', handle(locArchive(false)))
locationRouter.post('/:id/unarchive', handle(locArchive(true)))
locationRouter.delete('/:id', handle(locRemove))

export const operationTypeRouter = Router()
operationTypeRouter.param('id', guard('Operation type'))
operationTypeRouter.get('/', handle(ptList))
operationTypeRouter.get('/:id', handle(ptDetail))
operationTypeRouter.put('/:id', handle(ptUpdate))
