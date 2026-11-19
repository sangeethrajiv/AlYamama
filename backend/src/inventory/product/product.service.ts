import { sequelize } from '../../orm'
import { AppError, notFound } from '../../common.helper'
import type { RequestEnv } from '../../middleware'
import { Uom } from '../uom/uom.model'
import { ProductCategory } from '../category/product-category.model'
import { PRODUCT_TYPES, ProductProduct, ProductTemplate, TRACKING_MODES } from './product.model'
import type { Transaction } from 'sequelize'

/**
 * Odoo 12 behaviour of product.template / product.product for a catalogue with
 * exactly one variant per template (the live data has no attributes):
 *
 *   - creating a template creates its single variant
 *   - `default_code`, `weight`, `volume`, `active` and `no_discount` live on the
 *     template and are kept in step with the variant; `barcode` lives on the
 *     variant only and is unique ("A barcode can only be assigned to one product !")
 *   - `_check_uom`: the sales and purchase units must be in the same category
 *   - a new product's purchase unit defaults to its sales unit
 *   - archiving a template archives its variant
 *
 * Prices on the product (standard_price, taxes, accounts) are company-dependent
 * properties in Odoo and belong to a later phase.
 */

export type ProductValues = Partial<{
  name: string
  type: string
  tracking: string
  categ_id: number
  uom_id: number
  uom_po_id: number
  default_code: string | null
  barcode: string | null
  list_price: string | number | null
  weight: string | number | null
  volume: string | number | null
  sale_ok: boolean
  purchase_ok: boolean
  active: boolean
  rental: boolean | null
  sequence: number | null
  color: number | null
  company_id: number | null
  responsible_id: number | null
  sale_delay: string | number | null
  description: string | null
  description_purchase: string | null
  description_sale: string | null
  description_picking: string | null
  description_pickingout: string | null
  description_pickingin: string | null
  arabic_name: string | null
  internal_short_code: string | null
  no_discount: boolean
  is_teltonika_product: boolean
  is_vehicle_subscription: boolean
  purchase_request: boolean
  product_type_id: number | null
}>

/** Template columns that are copied onto the variant. */
const VARIANT_SYNC = ['default_code', 'weight', 'volume', 'active', 'no_discount'] as const

const num = (v: string | number | null | undefined) => (v === undefined ? undefined : v === null ? null : String(v))

function checkEnums(v: ProductValues) {
  if (v.type !== undefined && !(PRODUCT_TYPES as readonly string[]).includes(v.type)) {
    throw new AppError('The product type must be Consumable, Service or Storable Product.', 400)
  }
  if (v.tracking !== undefined && !(TRACKING_MODES as readonly string[]).includes(v.tracking)) {
    throw new AppError('Tracking must be none, lot or serial.', 400)
  }
}

/** Odoo `_check_uom`. */
async function checkUom(uomId: number, uomPoId: number, trx: Transaction) {
  const [a, b] = await Promise.all([Uom.findByPk(uomId, { transaction: trx }), Uom.findByPk(uomPoId, { transaction: trx })])
  if (!a) throw notFound('Unit of measure')
  if (!b) throw notFound('Purchase unit of measure')
  if (a.category_id !== b.category_id) {
    throw new AppError('The default Unit of Measure and the purchase Unit of Measure must be in the same category.', 400, 'constraint_error')
  }
}

function templateColumns(v: ProductValues): Record<string, unknown> {
  const { barcode: _barcode, ...rest } = v
  const out: Record<string, unknown> = { ...rest }
  for (const k of ['list_price', 'weight', 'volume', 'sale_delay'] as const) if (k in rest) out[k] = num(rest[k])
  if (typeof out.name === 'string') out.name = out.name.trim()
  return out
}

export async function createProduct(values: ProductValues, env: RequestEnv): Promise<ProductTemplate> {
  if (!values.name?.trim()) throw new AppError('Name is required.', 400)
  if (!values.categ_id) throw new AppError('Product category is required.', 400)
  if (!values.uom_id) throw new AppError('Unit of measure is required.', 400)
  checkEnums(values)

  return sequelize.transaction(async trx => {
    if (!(await ProductCategory.findByPk(values.categ_id!, { transaction: trx }))) throw notFound('Product category')
    // Odoo's default: the purchase unit follows the sales unit.
    const uomPo = values.uom_po_id ?? values.uom_id!
    await checkUom(values.uom_id!, uomPo, trx)

    const tmpl = await ProductTemplate.create(
      {
        type: 'consu', tracking: 'none', sale_ok: true, purchase_ok: true, active: true,
        company_id: env.companyId,
        ...templateColumns(values),
        uom_po_id: uomPo,
        create_uid: env.uid, write_uid: env.uid,
      } as never,
      { transaction: trx },
    )
    await ProductProduct.create(
      {
        product_tmpl_id: tmpl.id,
        default_code: tmpl.default_code,
        barcode: values.barcode || null,
        active: tmpl.active,
        weight: tmpl.weight,
        volume: tmpl.volume,
        no_discount: tmpl.no_discount,
        create_uid: env.uid, write_uid: env.uid,
      } as never,
      { transaction: trx },
    )
    return tmpl.reload({ transaction: trx })
  })
}

export async function updateProduct(id: number, values: ProductValues, env: RequestEnv): Promise<ProductTemplate> {
  checkEnums(values)
  return sequelize.transaction(async trx => {
    const tmpl = await ProductTemplate.findByPk(id, { transaction: trx, lock: trx.LOCK.UPDATE })
    if (!tmpl) throw notFound('Product')
    if ('name' in values && !values.name?.trim()) throw new AppError('Name is required.', 400)
    if (values.categ_id !== undefined && !(await ProductCategory.findByPk(values.categ_id, { transaction: trx }))) {
      throw notFound('Product category')
    }
    if (values.uom_id !== undefined || values.uom_po_id !== undefined) {
      await checkUom(values.uom_id ?? tmpl.uom_id, values.uom_po_id ?? tmpl.uom_po_id, trx)
    }

    await tmpl.update({ ...templateColumns(values), write_uid: env.uid } as never, { transaction: trx })

    // Keep the single variant in step.
    const variantPatch: Record<string, unknown> = { write_uid: env.uid }
    for (const k of VARIANT_SYNC) if (k in values) variantPatch[k] = (tmpl as unknown as Record<string, unknown>)[k]
    if ('barcode' in values) variantPatch.barcode = values.barcode || null
    await ProductProduct.update(variantPatch as never, { where: { product_tmpl_id: id }, transaction: trx })

    return tmpl.reload({ transaction: trx })
  })
}

export async function archiveProduct(id: number, active: boolean, env: RequestEnv) {
  return updateProduct(id, { active }, env)
}

export async function deleteProduct(id: number): Promise<void> {
  await sequelize.transaction(async trx => {
    const tmpl = await ProductTemplate.findByPk(id, { transaction: trx })
    if (!tmpl) throw notFound('Product')
    // No stock moves exist yet, so a product can be removed. Once moves are
    // built this must refuse a product that has history and archive it instead.
    await ProductProduct.destroy({ where: { product_tmpl_id: id }, transaction: trx })
    await tmpl.destroy({ transaction: trx })
  })
}
