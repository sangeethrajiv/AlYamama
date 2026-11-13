/**
 * Data model for the Inventory module.
 * Field names, selections and relations follow the Odoo 12 `stock`, `product` and `uom` addons
 * (stock.picking, stock.move, stock.move.line, stock.quant, stock.location, stock.warehouse,
 * stock.picking.type, stock.inventory, product.template, product.category, uom.uom, uom.category).
 * Many2one fields hold the id of the target record, exactly like Odoo's `xxx_id` fields.
 * `partner_id` points at a record of the Users module (Contact.id).
 */
export type ID = number

// ---- uom ----
export type MeasureType = 'unit' | 'weight' | 'time' | 'length' | 'volume'
export interface UomCategory { id: ID; name: string; measure_type: MeasureType }
export type UomType = 'bigger' | 'reference' | 'smaller'
export interface Uom {
  id: ID
  name: string
  category_id: ID
  uom_type: UomType
  /** Ratio against the category's reference unit (reference = 1). factor_inv is derived (1 / factor). */
  factor: number
  rounding: number
  active: boolean
}

// ---- product ----
export interface ProductCategory { id: ID; name: string; parent_id?: ID }
/** 'product' = Storable Product (added by the stock addon), 'consu' = Consumable, 'service' = Service */
export type ProductType = 'consu' | 'service' | 'product'
export interface Product {
  id: ID
  name: string
  default_code: string
  barcode: string
  type: ProductType
  categ_id: ID
  uom_id: ID
  uom_po_id: ID
  list_price: number
  standard_price: number
  sale_ok: boolean
  purchase_ok: boolean
  active: boolean
  description: string
  description_picking: string
  description_pickingin: string
  description_pickingout: string
  weight: number
  volume: number
  responsible_id: string
}

// ---- stock.location / stock.warehouse / stock.picking.type ----
export type LocationUsage = 'supplier' | 'view' | 'internal' | 'customer' | 'inventory' | 'procurement' | 'production' | 'transit'
export interface Location {
  id: ID
  name: string
  usage: LocationUsage
  location_id?: ID
  partner_id?: string
  comment: string
  posx: number
  posy: number
  posz: number
  scrap_location: boolean
  return_location: boolean
  barcode: string
  active: boolean
}

export interface Warehouse {
  id: ID
  name: string
  code: string
  active: boolean
  partner_id?: string
  view_location_id: ID
  lot_stock_id: ID
  reception_steps: 'one_step' | 'two_steps' | 'three_steps'
  delivery_steps: 'ship_only' | 'pick_ship' | 'pick_pack_ship'
  in_type_id: ID
  int_type_id: ID
  out_type_id: ID
}

export type PickingTypeCode = 'incoming' | 'outgoing' | 'internal'
export interface PickingType {
  id: ID
  name: string
  code: PickingTypeCode
  sequence: number
  /** Stands in for sequence_id (ir.sequence): prefix and next number */
  sequence_prefix: string
  sequence_next: number
  warehouse_id: ID
  default_location_src_id?: ID
  default_location_dest_id?: ID
  barcode: string
  active: boolean
}

// ---- stock.picking / stock.move / stock.move.line ----
export type PickingState = 'draft' | 'waiting' | 'confirmed' | 'assigned' | 'done' | 'cancel'
export type MoveState = 'draft' | 'cancel' | 'waiting' | 'confirmed' | 'partially_available' | 'assigned' | 'done'
export interface Picking {
  id: ID
  name: string
  origin: string
  note: string
  move_type: 'direct' | 'one'
  state: PickingState
  priority: '0' | '1' | '2' | '3'
  scheduled_date: string
  date: string
  date_done?: string
  location_id: ID
  location_dest_id: ID
  picking_type_id: ID
  partner_id?: string
  backorder_id?: ID
}

export interface Move {
  id: ID
  name: string
  sequence: number
  date: string
  date_expected: string
  product_id: ID
  product_uom_qty: number
  product_uom: ID
  location_id: ID
  location_dest_id: ID
  picking_id?: ID
  picking_type_id?: ID
  inventory_id?: ID
  state: MoveState
  origin: string
  reference: string
  price_unit: number
}

export interface MoveLine {
  id: ID
  picking_id?: ID
  move_id: ID
  product_id: ID
  product_uom_id: ID
  /** "Reserved" */
  product_uom_qty: number
  /** "Done" */
  qty_done: number
  date: string
  location_id: ID
  location_dest_id: ID
  state: MoveState
  reference: string
}

export interface Quant {
  id: ID
  product_id: ID
  location_id: ID
  quantity: number
  reserved_quantity: number
  in_date: string
}

// ---- stock.inventory ----
export type InventoryState = 'draft' | 'cancel' | 'confirm' | 'done'
export type InventoryFilter = 'none' | 'category' | 'product' | 'partial'
export interface Inventory {
  id: ID
  name: string
  date: string
  location_id: ID
  product_id?: ID
  category_id?: ID
  filter: InventoryFilter
  exhausted: boolean
  state: InventoryState
}
export interface InventoryLine {
  id: ID
  inventory_id: ID
  product_id: ID
  product_uom_id: ID
  location_id: ID
  theoretical_qty: number
  product_qty: number
}

/** Everything the module keeps in memory. */
export interface StockState {
  seq: number
  uom_categories: UomCategory[]
  uoms: Uom[]
  categories: ProductCategory[]
  products: Product[]
  locations: Location[]
  warehouses: Warehouse[]
  picking_types: PickingType[]
  pickings: Picking[]
  moves: Move[]
  move_lines: MoveLine[]
  quants: Quant[]
  inventories: Inventory[]
  inventory_lines: InventoryLine[]
}
