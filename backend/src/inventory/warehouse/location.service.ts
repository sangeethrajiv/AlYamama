import { sequelize } from '../../orm'
import { AppError, notFound } from '../../common.helper'
import { assertNoTreeRecursion, recomputeTree, type TreeSpec } from '../../common.tree'
import type { RequestEnv } from '../../middleware'
import { Location, LOCATION_USAGES, PickingType, Warehouse } from './stock.model'

/** Odoo 12 stock.location: a tree with a stored complete_name ("Parent/Child") and parent_path. */
export const LOCATION_TREE: TreeSpec = {
  model: Location as never,
  parentCol: 'location_id',
  separator: '/',
  recursionMessage: 'Error ! You cannot create recursive locations.',
}

export type LocationValues = Partial<{
  name: string
  usage: string
  location_id: number | null
  partner_id: number | null
  company_id: number | null
  comment: string | null
  barcode: string | null
  scrap_location: boolean
  return_location: boolean
  posx: number
  posy: number
  posz: number
  active: boolean
}>

function checkUsage(usage: string | undefined) {
  if (usage !== undefined && !(LOCATION_USAGES as readonly string[]).includes(usage)) {
    throw new AppError(`The location type must be one of: ${LOCATION_USAGES.join(', ')}.`, 400)
  }
}

export async function createLocation(values: LocationValues, env: RequestEnv): Promise<Location> {
  if (!values.name?.trim()) throw new AppError('You have to set a name for this location.', 400)
  checkUsage(values.usage)
  return sequelize.transaction(async trx => {
    if (values.location_id != null && !(await Location.findByPk(values.location_id, { transaction: trx }))) {
      throw notFound('Parent location')
    }
    const row = await Location.create(
      { company_id: env.companyId, ...values, name: values.name!.trim(), create_uid: env.uid, write_uid: env.uid } as never,
      { transaction: trx },
    )
    await recomputeTree(LOCATION_TREE, row.id, trx)
    return row.reload({ transaction: trx })
  })
}

export async function updateLocation(id: number, values: LocationValues, env: RequestEnv): Promise<Location> {
  checkUsage(values.usage)
  return sequelize.transaction(async trx => {
    const row = await Location.findByPk(id, { transaction: trx, lock: trx.LOCK.UPDATE })
    if (!row) throw notFound('Location')
    if ('name' in values && !values.name?.trim()) throw new AppError('You have to set a name for this location.', 400)
    if ('location_id' in values) {
      await assertNoTreeRecursion(LOCATION_TREE, id, values.location_id ?? null, trx)
      if (values.location_id != null && !(await Location.findByPk(values.location_id, { transaction: trx }))) {
        throw notFound('Parent location')
      }
    }
    const patch: Record<string, unknown> = { ...values, write_uid: env.uid }
    if (values.name !== undefined) patch.name = values.name.trim()
    await row.update(patch as never, { transaction: trx })
    if ('name' in values || 'location_id' in values) await recomputeTree(LOCATION_TREE, id, trx)
    // Archiving a location archives what is below it, as Odoo does.
    if (values.active === false) {
      await sequelize.query(
        `UPDATE stock_location SET active = false, write_uid = :uid WHERE parent_path LIKE :prefix`,
        { replacements: { uid: env.uid, prefix: `${(await row.reload({ transaction: trx })).parent_path}%` }, transaction: trx },
      )
    }
    return row.reload({ transaction: trx })
  })
}

export async function deleteLocation(id: number): Promise<void> {
  await sequelize.transaction(async trx => {
    const row = await Location.findByPk(id, { transaction: trx })
    if (!row) throw notFound('Location')
    const children = await Location.count({ where: { location_id: id }, transaction: trx })
    if (children) throw new AppError(`This location has ${children} sub-location(s).`, 400, 'has_children')
    const isWarehouseLocation = await Warehouse.count({
      where: sequelize.literal(`view_location_id = ${Number(id)} OR lot_stock_id = ${Number(id)}`) as never,
      transaction: trx,
    })
    if (isWarehouseLocation) throw new AppError('This location belongs to a warehouse. Archive it instead.', 400, 'in_use')
    const usedByType = await PickingType.count({
      where: sequelize.literal(`default_location_src_id = ${Number(id)} OR default_location_dest_id = ${Number(id)}`) as never,
      transaction: trx,
    })
    if (usedByType) throw new AppError('This location is the default of an operation type. Archive it instead.', 400, 'in_use')
    await row.destroy({ transaction: trx })
  })
}
