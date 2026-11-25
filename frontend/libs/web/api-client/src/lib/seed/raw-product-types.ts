/**
 * Prototype (numeric) shape of the Product seed, as the React reference module holds it. The seed is converted to the
 * contract shape (decimal strings) by `decimalize` with PRODUCT_SPEC. Field names are the Odoo 12 technical names.
 */
export type ID = number

export interface UomCategory { id: ID; name: string; measure_type: 'unit' | 'weight' | 'time' | 'length' | 'volume' | ''; active: boolean }
export interface Uom {
  id: ID
  name: string
  category_id: ID | null
  uom_type: 'bigger' | 'reference' | 'smaller'
  factor: number
  rounding: number
  view_name: string
  active: boolean
}
export interface ProductCategory { id: ID; name: string; parent_id: ID | null; arabic_name: string; sequence_code: string; active: boolean }
export interface Product {
  id: ID
  name: string
  default_code: string
  barcode: string
  type: 'product' | 'consu' | 'service'
  categ_id: ID | null
  uom_id: ID | null
  uom_po_id: ID | null
  tracking: 'none' | 'lot' | 'serial'
  active: boolean
  company_id: ID | null
  sale_ok: boolean
  purchase_ok: boolean
  list_price: number
  standard_price: number
  weight: number
  volume: number
  responsible_id: ID | null
  description_sale: string
  description_purchase: string
  arabic_name: string
  internal_short_code: string
  internal_type: 'material' | 'labour' | 'overhead' | ''
  margin_perc: number
  no_discount: boolean
  product_type_id: ID | null
  is_teltonika_product: boolean
  is_vehicle_subscription: boolean
  taxes_id: ID[]
  qty_available: number
  virtual_available: number
}
export interface ProductState {
  uom_categories: UomCategory[]
  uoms: Uom[]
  categories: ProductCategory[]
  products: Product[]
  companies: { id: ID; name: string }[]
  users: { id: ID; name: string }[]
  taxes: { id: ID; name: string; active: boolean }[]
  genres: { id: ID; name: string; active: boolean }[]
}
