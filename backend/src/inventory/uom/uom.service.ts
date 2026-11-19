import { Op, type Transaction } from 'sequelize'
import Decimal from 'decimal.js'
import { sequelize } from '../../orm'
import { AppError, notFound } from '../../common.helper'
import type { RequestEnv } from '../../middleware'
import { Uom, UomCategory, UOM_TYPES } from './uom.model'
import { ProductTemplate } from '../product/product.model'

/**
 * Odoo 12 behaviour of uom.category and uom.uom, ported from
 * addons/uom/models/uom_uom.py:
 *
 *   - factor / rounding can never be 0 (SQL CHECKs, messages below)
 *   - the reference unit has factor = 1
 *   - `_check_category_reference_uniqueness`: exactly one active reference
 *     unit per category
 *   - `factor_inv` is not stored: it is 1 / factor, and writing it sets
 *     factor = 1 / factor_inv
 *   - `measure_type` is copied from the category
 *   - units of the `time` category cannot be deleted, only archived
 *
 * All arithmetic uses decimal.js: a ratio like 1/12 must not pass through a float.
 */

Decimal.set({ precision: 40 })

/** factor_inv for a stored factor, as a string; '0' when factor is 0 (Odoo's `factor and 1/factor or 0`). */
export const factorInv = (factor: string | number): string => {
  const f = new Decimal(factor)
  return f.isZero() ? '0' : new Decimal(1).div(f).toString()
}

/** Converts a quantity between two units of the same category, as `uom._compute_quantity` does (without rounding). */
export function convertQty(qty: string | number, from: Pick<Uom, 'factor' | 'category_id'>, to: Pick<Uom, 'factor' | 'category_id'>): string {
  if (from.category_id !== to.category_id) {
    throw new AppError('Conversion from Product UoM to Default UoM is not possible as they both belong to different Category!', 400)
  }
  return new Decimal(qty).div(new Decimal(from.factor)).mul(new Decimal(to.factor)).toString()
}

/** Odoo `float_round(value, precision_rounding=rounding)` with HALF-UP, used after a conversion. */
export function roundToRounding(value: string | number, rounding: string | number): string {
  const r = new Decimal(rounding)
  if (r.isZero()) return new Decimal(value).toString()
  return new Decimal(value).div(r).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(r).toString()
}

export type UomValues = Partial<{
  name: string
  category_id: number
  uom_type: string
  factor: string | number
  factor_inv: string | number
  rounding: string | number
  active: boolean
  view_name: string | null
}>

const REFERENCE_NEEDED = (name: string) =>
  `UoM category ${name} should have a reference unit of measure. If you just created a new category, please record the 'reference' unit first.`
const REFERENCE_ONE = (name: string) => `UoM category ${name} should only have one reference unit of measure.`

/** Odoo `_check_category_reference_uniqueness`, run after every create/update/delete of a unit. */
async function assertSingleReference(categoryId: number, trx: Transaction) {
  const cat = await UomCategory.findByPk(categoryId, { transaction: trx })
  if (!cat) return
  const count = await Uom.count({ where: { category_id: categoryId, uom_type: 'reference', active: true }, transaction: trx })
  if (count === 0) throw new AppError(REFERENCE_NEEDED(cat.name), 400, 'uom_reference')
  if (count > 1) throw new AppError(REFERENCE_ONE(cat.name), 400, 'uom_reference')
}

function normalise(values: UomValues): UomValues {
  const v = { ...values }
  // factor_inv is a way of writing factor: factor = 1 / factor_inv.
  if (v.factor_inv !== undefined) {
    const inv = new Decimal(v.factor_inv)
    v.factor = inv.isZero() ? '0' : new Decimal(1).div(inv).toString()
    delete v.factor_inv
  }
  if (v.uom_type !== undefined && !(UOM_TYPES as readonly string[]).includes(v.uom_type)) {
    throw new AppError('The unit type must be bigger, reference or smaller.', 400)
  }
  // onchange uom_type -> reference sets factor = 1
  if (v.uom_type === 'reference') v.factor = '1'
  if (v.factor !== undefined) {
    const f = new Decimal(v.factor)
    if (f.isZero()) throw new AppError('The conversion ratio for a unit of measure cannot be 0!', 400, 'constraint_error')
    v.factor = f.toString()
  }
  if (v.rounding !== undefined && !new Decimal(v.rounding).gt(0)) {
    throw new AppError('The rounding precision must be strictly positive.', 400, 'constraint_error')
  }
  if (v.rounding !== undefined) v.rounding = new Decimal(v.rounding).toString()
  return v
}

export async function createUom(values: UomValues, env: RequestEnv): Promise<Uom> {
  return sequelize.transaction(async trx => {
    const v = normalise(values)
    if (!v.name) throw new AppError('Name is required.', 400)
    if (!v.category_id) throw new AppError('Category is required.', 400)
    const cat = await UomCategory.findByPk(v.category_id, { transaction: trx })
    if (!cat) throw notFound('UoM category')
    const uomType = v.uom_type ?? 'reference'
    const factor = uomType === 'reference' ? '1' : (v.factor ?? '1')
    const row = await Uom.create({
      ...v,
      uom_type: uomType,
      factor,
      measure_type: cat.measure_type,
      create_uid: env.uid,
      write_uid: env.uid,
    } as never, { transaction: trx })
    await assertSingleReference(row.category_id, trx)
    return row
  })
}

export async function updateUom(id: number, values: UomValues, env: RequestEnv): Promise<Uom> {
  return sequelize.transaction(async trx => {
    const row = await Uom.findByPk(id, { transaction: trx, lock: trx.LOCK.UPDATE })
    if (!row) throw notFound('Unit of measure')
    const v = normalise(values)
    const oldCategory = row.category_id
    const patch: Record<string, unknown> = { ...v, write_uid: env.uid }
    if (v.category_id !== undefined && v.category_id !== oldCategory) {
      const cat = await UomCategory.findByPk(v.category_id, { transaction: trx })
      if (!cat) throw notFound('UoM category')
      patch.measure_type = cat.measure_type
    }
    await row.update(patch as never, { transaction: trx })
    await assertSingleReference(row.category_id, trx)
    if (oldCategory !== row.category_id) await assertSingleReference(oldCategory, trx)
    return row
  })
}

export async function archiveUom(id: number, active: boolean, env: RequestEnv): Promise<Uom> {
  return updateUom(id, { active }, env)
}

export async function deleteUom(id: number): Promise<void> {
  await sequelize.transaction(async trx => {
    const row = await Uom.findByPk(id, { transaction: trx })
    if (!row) throw notFound('Unit of measure')
    if (row.measure_type === 'time') {
      throw new AppError('You cannot delete this UoM as it is used by the system. You should rather archive it.', 400)
    }
    const used = await ProductTemplate.count({
      where: { [Op.or]: [{ uom_id: id }, { uom_po_id: id }] },
      transaction: trx,
    })
    if (used) throw new AppError(`This unit is used by ${used} product(s). Archive it instead.`, 400, 'in_use')
    // Odoo's reference check is a constraint on create/write, not on unlink, so none here.
    await row.destroy({ transaction: trx })
  })
}

// -------------------------------------------------------------- categories ---

export async function createUomCategory(values: { name?: string; measure_type?: string | null }, env: RequestEnv) {
  if (!values.name?.trim()) throw new AppError('Name is required.', 400)
  return UomCategory.create({ name: values.name.trim(), measure_type: values.measure_type ?? null, create_uid: env.uid, write_uid: env.uid } as never)
}

export async function updateUomCategory(id: number, values: { name?: string; measure_type?: string | null }, env: RequestEnv) {
  return sequelize.transaction(async trx => {
    const row = await UomCategory.findByPk(id, { transaction: trx })
    if (!row) throw notFound('UoM category')
    const patch: Record<string, unknown> = { write_uid: env.uid }
    if (values.name !== undefined) patch.name = values.name.trim()
    if (values.measure_type !== undefined) patch.measure_type = values.measure_type
    await row.update(patch as never, { transaction: trx })
    // measure_type is copied onto the units, as Odoo's stored related field does.
    if (values.measure_type !== undefined) {
      await Uom.update({ measure_type: values.measure_type } as never, { where: { category_id: id }, transaction: trx })
    }
    return row
  })
}

export async function deleteUomCategory(id: number) {
  await sequelize.transaction(async trx => {
    const row = await UomCategory.findByPk(id, { transaction: trx })
    if (!row) throw notFound('UoM category')
    const units = await Uom.findAll({ where: { category_id: id }, attributes: ['id'], transaction: trx })
    const used = units.length
      ? await ProductTemplate.count({ where: { uom_id: { [Op.in]: units.map(u => u.id) } }, transaction: trx })
      : 0
    if (used) throw new AppError(`Units of this category are used by ${used} product(s).`, 400, 'in_use')
    await row.destroy({ transaction: trx })
  })
}
