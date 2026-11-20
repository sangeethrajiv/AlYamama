import { z } from 'zod'
import { PRODUCT_TYPES, TRACKING_MODES } from './product/product.model'
import { LOCATION_USAGES } from './warehouse/stock.model'
import { MEASURE_TYPES, UOM_TYPES } from './uom/uom.model'

/**
 * Request shapes for the Inventory endpoints. Keys are the Odoo column names.
 * Prices, weights and ratios are accepted as strings or numbers and stay
 * strings, so no value passes through a JS float.
 */

const str = z.string().trim().max(512)
const nullableStr = str.nullish().transform(v => (v === '' ? null : v ?? null))
const id = z.coerce.number().int().positive()
const nullableId = z.union([id, z.null(), z.literal('')]).transform(v => (v === '' || v === null ? null : (v as number))).nullish()
const bool = z.coerce.boolean()
const decimal = z
  .union([z.number(), z.string()])
  .nullish()
  .transform(v => (v === null || v === undefined || v === '' ? null : String(v)))
  .refine(v => v === null || /^-?\d+(\.\d+)?$/.test(v), 'must be a number')
const positiveDecimal = z
  .union([z.number(), z.string()])
  .transform(v => String(v))
  .refine(v => /^\d+(\.\d+)?$/.test(v), 'must be a number')

export const productSchema = z.object({
  name: str.min(1, 'Name is required').optional(),
  type: z.enum(PRODUCT_TYPES).optional(),
  tracking: z.enum(TRACKING_MODES).optional(),
  categ_id: id.optional(),
  uom_id: id.optional(),
  uom_po_id: id.optional(),
  default_code: nullableStr,
  barcode: nullableStr,
  list_price: decimal,
  standard_price: decimal,
  margin_perc: decimal,
  internal_type: z.enum(['material', 'labour', 'overhead']).nullish().or(z.literal('').transform(() => null)),
  product_genre: nullableStr,
  weight: decimal,
  volume: decimal,
  sale_ok: bool.optional(),
  purchase_ok: bool.optional(),
  active: bool.optional(),
  rental: bool.nullish(),
  sequence: z.coerce.number().int().nullish(),
  color: z.coerce.number().int().nullish(),
  company_id: nullableId,
  responsible_id: nullableId,
  sale_delay: decimal,
  description: nullableStr,
  description_purchase: nullableStr,
  description_sale: nullableStr,
  description_picking: nullableStr,
  description_pickingout: nullableStr,
  description_pickingin: nullableStr,
  internal_short_code: nullableStr,
  no_discount: bool.optional(),
  is_teltonika_product: bool.optional(),
  is_vehicle_subscription: bool.optional(),
  purchase_request: bool.optional(),
  product_type_id: nullableId,
})

export const productListSchema = z.object({
  q: str.optional(),
  field: str.optional(),
  filters: str.optional(),
  active: z.enum(['true', 'false', 'all']).optional(),
  categ_id: id.optional(),
  uom_id: id.optional(),
  type: z.enum(PRODUCT_TYPES).optional(),
  company_id: id.optional(),
  order: str.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  counts: z.enum(['0', '1']).optional(),
  group_by: str.optional(),
})

export const categorySchema = z.object({
  name: str.min(1, 'Name is required').optional(),
  parent_id: nullableId,
  sequence_code: nullableStr,
  active: bool.optional(),
})

export const uomCategorySchema = z.object({
  name: str.min(1, 'Name is required').optional(),
  measure_type: z.enum(MEASURE_TYPES).nullish().or(z.literal('').transform(() => null)),
  active: bool.optional(),
})

export const uomSchema = z.object({
  name: str.min(1, 'Name is required').optional(),
  category_id: id.optional(),
  uom_type: z.enum(UOM_TYPES).optional(),
  factor: positiveDecimal.optional(),
  /** "Bigger ratio": writing it sets factor = 1 / factor_inv, as Odoo does. */
  factor_inv: positiveDecimal.optional(),
  rounding: positiveDecimal.optional(),
  active: bool.optional(),
  view_name: nullableStr,
})

export const locationSchema = z.object({
  name: str.min(1, 'You have to set a name for this location.').optional(),
  usage: z.enum(LOCATION_USAGES).optional(),
  location_id: nullableId,
  partner_id: nullableId,
  company_id: nullableId,
  comment: nullableStr,
  barcode: nullableStr,
  scrap_location: bool.optional(),
  return_location: bool.optional(),
  posx: z.coerce.number().int().optional(),
  posy: z.coerce.number().int().optional(),
  posz: z.coerce.number().int().optional(),
  active: bool.optional(),
})

export const warehouseSchema = z.object({
  name: str.min(1).optional(),
  code: str.min(1).max(5).optional(),
  active: bool.optional(),
  partner_id: nullableId,
  // present only so the service can refuse them with a clear message
  reception_steps: z.string().optional(),
  delivery_steps: z.string().optional(),
  company_id: z.any().optional(),
  view_location_id: z.any().optional(),
  lot_stock_id: z.any().optional(),
})

export const pickingTypeSchema = z.object({
  name: str.min(1).optional(),
  active: bool.optional(),
  color: z.coerce.number().int().nullish(),
  sequence: z.coerce.number().int().nullish(),
  barcode: nullableStr,
})

export const simpleListSchema = z.object({
  q: str.optional(),
  active: z.enum(['true', 'false', 'all']).optional(),
  parent_id: id.optional(),
  category_id: id.optional(),
  usage: z.enum(LOCATION_USAGES).optional(),
  warehouse_id: id.optional(),
  company_id: id.optional(),
  code: str.optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
})
