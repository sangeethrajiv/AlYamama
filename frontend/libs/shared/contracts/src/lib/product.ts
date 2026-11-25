import type { Decimal } from './common';

/**
 * Product master data. Property names are the Odoo 12 technical field names (product.template, product.category,
 * uom.uom, uom.category) exactly as the React reference module defines them. Many2one fields hold the id of the target
 * record (or null when empty), like Odoo's `xxx_id` fields. Money and quantities are decimal strings (architecture v2.2 s.9).
 * Everything served by the mock adapter is sample data; nothing here is read from or written to Odoo.
 */
export type ID = number;

// ---- lookup models that Product only references (not managed here) ----
/** res.company (id + name only) */
export interface ProductCompany { id: ID; name: string }
/** res.users (id + name only) */
export interface ProductUser { id: ID; name: string }
/** att.product.type (id + name only), the Product Genre choices */
export interface ProductGenre { id: ID; name: string; active: boolean }
/** account.tax (id + name only), used for Customer Taxes */
export interface ProductTax { id: ID; name: string; active: boolean }

// ---- uom ----
export type MeasureType = 'unit' | 'weight' | 'time' | 'length' | 'volume';
/**
 * uom.category. Odoo 12 has no `active` column here; it is a UI-only archive flag in this prototype.
 * `measure_type` may be empty (e.g. the "Area" category), as in the reference data.
 */
export interface UomCategory { id: ID; name: string; measure_type: MeasureType | ''; active: boolean }

export type UomType = 'bigger' | 'reference' | 'smaller';
/** uom.uom. `factor` is stored; `factor_inv` (Bigger Ratio) is derived as 1 / factor. */
export interface Uom {
  id: ID;
  name: string;
  category_id: ID | null;
  uom_type: UomType;
  /** Ratio against the category's reference unit (reference = 1). */
  factor: Decimal;
  rounding: Decimal;
  view_name: string;
  active: boolean;
}

// ---- product ----
/** product.category. Odoo 12 has no `active` column; archive is a UI-only flag in this prototype. */
export interface ProductCategory {
  id: ID;
  name: string;
  parent_id: ID | null;
  arabic_name: string;
  sequence_code: string;
  active: boolean;
}

/** 'product' = Storable Product, 'consu' = Consumable, 'service' = Service */
export type ProductType = 'product' | 'consu' | 'service';
export type Tracking = 'none' | 'lot' | 'serial';
export type InternalType = 'material' | 'labour' | 'overhead' | '';

/** product.template (+ product.product.barcode, 1:1 in this database). */
export interface Product {
  id: ID;
  name: string;
  default_code: string;
  barcode: string;
  type: ProductType;
  categ_id: ID | null;
  uom_id: ID | null;
  uom_po_id: ID | null;
  tracking: Tracking;
  active: boolean;
  company_id: ID | null;
  sale_ok: boolean;
  purchase_ok: boolean;
  list_price: Decimal;
  standard_price: Decimal;
  weight: Decimal;
  volume: Decimal;
  responsible_id: ID | null;
  description_sale: string;
  description_purchase: string;
  // custom fields (stock_customization, sale_custom, crm_customization, att_customer_pricelist)
  arabic_name: string;
  internal_short_code: string;
  internal_type: InternalType;
  margin_perc: Decimal;
  no_discount: boolean;
  /** Product Genre: many2one att.product.type */
  product_type_id: ID | null;
  is_teltonika_product: boolean;
  is_vehicle_subscription: boolean;
  /** Customer Taxes: many2many account.tax, every assigned tax id. */
  taxes_id: ID[];
  // computed by stock in Odoo (read-only in the UI; stored in the mock data only)
  qty_available: Decimal;
  virtual_available: Decimal;
  /**
   * The picture as a data URL, or '' for none. The server's product list leaves it out (pictures are large), so read it with
   * `ProductApi.productImage`; on save, `undefined` keeps the stored picture and '' removes it.
   */
  image?: string;
}

/** Everything the Product master data reads. */
export interface ProductState {
  uom_categories: UomCategory[];
  uoms: Uom[];
  categories: ProductCategory[];
  products: Product[];
  companies: ProductCompany[];
  users: ProductUser[];
  taxes: ProductTax[];
  genres: ProductGenre[];
}

/** The four managed models. */
export type ProductEntityKey = 'products' | 'categories' | 'uoms' | 'uomCategories';
