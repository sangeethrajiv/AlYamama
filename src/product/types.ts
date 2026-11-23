/**
 * Frontend types for the Product module.
 * Property names are the Odoo 12 technical field names (see docs: migration_analysis/04_products_inventory_analysis.md).
 * Everything here is in-memory mock state; nothing is sent to a backend.
 */

export type Id = number

/** Generic record shape used by the config-driven list / detail / form engine. */
export type Rec = { id: Id; active: boolean; [key: string]: any }

// ── Lookup models that are only referenced (not managed) by this module ──
export type Company = { id: Id; name: string } // res.company
export type User = { id: Id; name: string } // res.users

// ── Managed models ──
export type ProductType = 'product' | 'consu' | 'service'
export type Tracking = 'none' | 'lot' | 'serial'
export type InternalType = 'material' | 'labour' | 'overhead' | ''

/** product.template (+ product.product.barcode, 1:1 in this database) */
export type Product = {
  id: Id
  name: string
  default_code: string
  barcode: string
  type: ProductType
  categ_id: Id | null
  uom_id: Id | null
  uom_po_id: Id | null
  tracking: Tracking
  active: boolean
  company_id: Id | null
  sale_ok: boolean
  purchase_ok: boolean
  list_price: number
  standard_price: number
  weight: number
  volume: number
  responsible_id: Id | null
  description_sale: string
  description_purchase: string
  // custom fields (stock_customization, sale_custom, crm_customization, att_customer_pricelist)
  arabic_name: string
  internal_short_code: string
  internal_type: InternalType
  margin_perc: number
  no_discount: boolean
  // computed by stock in Odoo (read only here)
  qty_available: number
  virtual_available: number
}

/** product.category (Odoo 12 has no `active` column; see UI-only note in the registry) */
export type ProductCategory = {
  id: Id
  name: string
  parent_id: Id | null
  arabic_name: string
  sequence_code: string
  active: boolean
}

export type MeasureType = 'unit' | 'weight' | 'time' | 'length' | 'volume' | ''
/** uom.category (Odoo 12 has no `active` column; see UI-only note in the registry) */
export type UomCategory = { id: Id; name: string; measure_type: MeasureType; active: boolean }

export type UomKind = 'reference' | 'bigger' | 'smaller'
/** uom.uom — `factor` is stored; `factor_inv` is derived (1 / factor) */
export type Uom = {
  id: Id
  name: string
  category_id: Id | null
  uom_type: UomKind
  factor: number
  rounding: number
  view_name: string
  active: boolean
}

export type EntityKey =
  | 'products'
  | 'categories'
  | 'uoms'
  | 'uomCategories'

export type LookupKey = 'companies' | 'users'
export type RelKey = EntityKey | LookupKey

export type ProductState = {
  products: Product[]
  categories: ProductCategory[]
  uoms: Uom[]
  uomCategories: UomCategory[]
  companies: Company[]
  users: User[]
}
