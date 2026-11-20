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
/** account.tax (id + name only), used for Customer Taxes */
export interface ProductTax { id: ID; name: string; active: boolean }
/** ir.sequence (id + name only), used for a category's lot sequence */
export interface ProductSequence { id: ID; name: string }
/** product.removal (id + name only), a category's Force Removal Strategy */
export interface ProductRemovalStrategy { id: ID; name: string }
/** account.account (id + code + name + type only), used by the category's account properties */
export interface ProductAccount { id: ID; code: string; name: string; type: string }
/** account.journal (id + name only), a category's Stock Journal */
export interface ProductJournal { id: ID; name: string }

// ---- uom ----
export type MeasureType = 'unit' | 'weight' | 'time' | 'length' | 'volume';
/**
 * uom.category. Odoo 12 has no `active` column here; it is a UI-only archive flag in this prototype.
 * `measure_type` may be empty (e.g. the "Area" category), as in the reference data. At most one category per measure type.
 * `is_pos_groupable` (point_of_sale) is only editable in debug mode.
 */
export interface UomCategory { id: ID; name: string; measure_type: MeasureType | ''; is_pos_groupable: boolean; active: boolean }

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
/** Costing Method (stock_account): Standard Price, First In First Out (FIFO), Average Cost (AVCO). */
export type CostMethod = 'standard' | 'fifo' | 'average';
/** Inventory Valuation (stock_account): Manual, Automated. */
export type ValuationMethod = 'manual_periodic' | 'real_time';

/**
 * product.category. Odoo 12 has no `active` column; archive is a UI-only flag in this prototype.
 * `arabic_name` is added by sale_custom and `lot_sequence_id` by att_product_tracking. The property_* fields are
 * company-dependent in Odoo; the prototype keeps one value per category.
 */
export interface ProductCategory {
  id: ID;
  name: string;
  parent_id: ID | null;
  arabic_name: string;
  lot_sequence_id: ID | null;
  // stock
  removal_strategy_id: ID | null;
  // stock_account
  property_cost_method: CostMethod;
  property_valuation: ValuationMethod;
  property_stock_account_input_categ_id: ID | null;
  property_stock_account_output_categ_id: ID | null;
  property_stock_valuation_account_id: ID | null;
  property_stock_journal: ID | null;
  // account / purchase
  property_account_creditor_price_difference_categ: ID | null;
  property_account_income_categ_id: ID | null;
  property_account_expense_categ_id: ID | null;
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
  product_genre: string;
  is_teltonika: boolean;
  is_vehicle_subscription: boolean;
  /** Customer tax (account.tax id), or null. */
  taxes_id: ID | null;
  // computed by stock in Odoo (read-only in the UI; stored in the mock data only)
  qty_available: Decimal;
  virtual_available: Decimal;
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
  sequences: ProductSequence[];
  removal_strategies: ProductRemovalStrategy[];
  accounts: ProductAccount[];
  journals: ProductJournal[];
}

/** The four managed models. */
export type ProductEntityKey = 'products' | 'categories' | 'uoms' | 'uomCategories';
