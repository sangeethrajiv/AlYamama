/**
 * Inventory API layer: loads the master data the screens show and sends their
 * edits to the backend (backend/src/inventory).
 *
 * Only these seven lists come from the database. Pickings, moves, stock
 * quantities and inventory adjustments are not built yet, so in API mode they
 * are empty and their menus show a "Coming soon" page.
 *
 * Fields the database does not hold (a product's cost and responsible user, a
 * location's owner, an operation type's sequence prefix) stay in the screen as
 * labels only and are never sent.
 */
import { getAll, post, put } from '../shared/api'
import type {
  Location, PickingType, Product, ProductCategory, StockState, Uom, UomCategory, Warehouse,
} from './types'

type Dto = Record<string, unknown> & { id: number }
type M2O = { id: number; name: string | null } | number | null | undefined

const idOf = (v: M2O): number | undefined => (v == null ? undefined : typeof v === 'number' ? v : v.id)
const str = (v: unknown) => (v == null ? '' : String(v))
const nums = (v: unknown) => (v == null || v === '' ? 0 : Number(v))

// ------------------------------------------------------------------ reads ---

const toUomCategory = (d: Dto): UomCategory => ({
  id: d.id,
  name: str(d.name),
  // A category without a measurement type exists in the live data ("Unsorted/Imported Units").
  measure_type: (d.measure_type ?? '') as UomCategory['measure_type'],
})

const toUom = (d: Dto): Uom => ({
  id: d.id,
  name: str(d.name),
  category_id: idOf(d.category_id as M2O) ?? 0,
  uom_type: d.uom_type as Uom['uom_type'],
  factor: nums(d.factor),
  rounding: nums(d.rounding),
  active: d.active !== false,
})

const toCategory = (d: Dto): ProductCategory => ({ id: d.id, name: str(d.name), parent_id: idOf(d.parent_id as M2O) })

const toProduct = (d: Dto): Product => ({
  id: d.id,
  name: str(d.name),
  default_code: str(d.default_code),
  barcode: str(d.barcode),
  type: d.type as Product['type'],
  categ_id: idOf(d.categ_id as M2O) ?? 0,
  uom_id: idOf(d.uom_id as M2O) ?? 0,
  uom_po_id: idOf(d.uom_po_id as M2O) ?? idOf(d.uom_id as M2O) ?? 0,
  list_price: nums(d.list_price),
  // Cost is a company-dependent property in Odoo (later phase) and the responsible user is not edited here.
  standard_price: 0,
  sale_ok: d.sale_ok !== false,
  purchase_ok: d.purchase_ok !== false,
  active: d.active !== false,
  description: str(d.description),
  description_picking: str(d.description_picking),
  description_pickingin: str(d.description_pickingin),
  description_pickingout: str(d.description_pickingout),
  weight: nums(d.weight),
  volume: nums(d.volume),
  responsible_id: '',
})

const toLocation = (d: Dto): Location => ({
  id: d.id,
  name: str(d.name),
  usage: d.usage as Location['usage'],
  location_id: idOf(d.location_id as M2O),
  comment: str(d.comment),
  posx: nums(d.posx),
  posy: nums(d.posy),
  posz: nums(d.posz),
  scrap_location: d.scrap_location === true,
  return_location: d.return_location === true,
  barcode: str(d.barcode),
  active: d.active !== false,
})

const toWarehouse = (d: Dto): Warehouse => ({
  id: d.id,
  name: str(d.name),
  code: str(d.code),
  active: d.active !== false,
  view_location_id: idOf(d.view_location_id as M2O) ?? 0,
  lot_stock_id: idOf(d.lot_stock_id as M2O) ?? 0,
  reception_steps: d.reception_steps as Warehouse['reception_steps'],
  delivery_steps: d.delivery_steps as Warehouse['delivery_steps'],
  in_type_id: nums(d.in_type_id),
  int_type_id: nums(d.int_type_id),
  out_type_id: nums(d.out_type_id),
})

/** Reference prefixes are shown as labels only; the database has no sequence for them yet. */
const PREFIX: Record<string, string> = { incoming: 'IN/', outgoing: 'OUT/', internal: 'INT/', mrp_operation: 'MO/' }
const toPickingType = (d: Dto): PickingType => ({
  id: d.id,
  name: str(d.name),
  code: d.code as PickingType['code'],
  sequence: nums(d.sequence),
  sequence_prefix: PREFIX[str(d.code)] ?? '',
  sequence_next: 1,
  warehouse_id: idOf(d.warehouse_id as M2O) ?? 0,
  default_location_src_id: idOf(d.default_location_src_id as M2O),
  default_location_dest_id: idOf(d.default_location_dest_id as M2O),
  barcode: str(d.barcode),
  active: d.active !== false,
})

export type ApiLists = Pick<StockState, 'uom_categories' | 'uoms' | 'categories' | 'products' | 'locations' | 'warehouses' | 'picking_types'>

/** Reads the seven master-data lists. Archived records are included so the Archived filters work. */
export async function loadInventory(): Promise<ApiLists> {
  const [uomCats, uoms, cats, products, locations, warehouses, types] = await Promise.all([
    getAll<Dto>('/uom-categories'),
    getAll<Dto>('/uoms', { active: 'all' }),
    getAll<Dto>('/product-categories'),
    getAll<Dto>('/products', { active: 'all' }),
    getAll<Dto>('/locations', { active: 'all' }),
    getAll<Dto>('/warehouses', { active: 'all' }),
    getAll<Dto>('/operation-types', { active: 'all' }),
  ])
  return {
    uom_categories: uomCats.map(toUomCategory),
    uoms: uoms.map(toUom),
    categories: cats.map(toCategory),
    products: products.map(toProduct),
    locations: locations.map(toLocation),
    warehouses: warehouses.map(toWarehouse),
    picking_types: types.map(toPickingType),
  }
}

// ----------------------------------------------------------------- writes ---

/** Lists that are stored in the database; every other list is in-memory only. */
export const API_KEYS = ['uom_categories', 'uoms', 'categories', 'products', 'locations', 'warehouses', 'picking_types'] as const
export type ApiKey = (typeof API_KEYS)[number]
export const isApiKey = (k: string): k is ApiKey => (API_KEYS as readonly string[]).includes(k)

const PATH: Record<ApiKey, string> = {
  uom_categories: '/uom-categories', uoms: '/uoms', categories: '/product-categories', products: '/products',
  locations: '/locations', warehouses: '/warehouses', picking_types: '/operation-types',
}

/** The columns each screen may send. Anything else on the record is a label the database does not hold. */
const SENDABLE: Record<ApiKey, string[]> = {
  uom_categories: ['name', 'measure_type'],
  uoms: ['name', 'category_id', 'uom_type', 'factor', 'rounding', 'active'],
  categories: ['name', 'parent_id'],
  products: ['name', 'default_code', 'barcode', 'type', 'categ_id', 'uom_id', 'uom_po_id', 'list_price', 'sale_ok', 'purchase_ok', 'active',
    'description', 'description_picking', 'description_pickingin', 'description_pickingout', 'weight', 'volume'],
  locations: ['name', 'usage', 'location_id', 'comment', 'posx', 'posy', 'posz', 'scrap_location', 'return_location', 'barcode', 'active'],
  warehouses: ['name', 'code', 'active'],
  picking_types: ['name', 'sequence', 'barcode', 'active'],
}

/** Creating these needs rules that are not built yet (Odoo generates locations, routes and sequences). */
const READ_ONLY_CREATE: Partial<Record<ApiKey, string>> = {
  warehouses: 'Creating a warehouse is not available yet: Odoo generates its locations, operation types and routes, which are not built here. You can edit an existing warehouse.',
  picking_types: 'Creating an operation type is not available yet. You can edit an existing one.',
}

/** Empty strings become null so the database stores NULL, as the Contacts mapper does. */
const clean = (v: unknown) => (v === '' ? null : v)

/**
 * Saves one record. Only the fields that changed are sent on an update, so
 * saving a form never rewrites a value the user did not touch (a bigger unit's
 * 1/12 ratio, for example, would otherwise be rounded by the float round trip).
 * Resolves to the id the database assigned.
 */
export async function persist(key: ApiKey, rec: Record<string, unknown> & { id?: number }, before?: Record<string, unknown>): Promise<number> {
  const keys = SENDABLE[key]
  const isNew = !before
  if (isNew && READ_ONLY_CREATE[key]) throw new Error(READ_ONLY_CREATE[key])

  const body: Record<string, unknown> = {}
  for (const k of keys) {
    if (isNew || JSON.stringify(rec[k]) !== JSON.stringify(before[k])) body[k] = clean(rec[k])
  }
  // The reference unit's ratio is always 1; a number the user typed would only be refused.
  if (key === 'uoms' && body.uom_type === 'reference') body.factor = 1

  if (isNew) {
    const out = await post<{ id: number }>(PATH[key], body)
    return out.id
  }
  if (!Object.keys(body).length) return rec.id as number
  await put(`${PATH[key]}/${rec.id}`, body)
  return rec.id as number
}
