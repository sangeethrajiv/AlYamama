import type { Product, ProductCategory, ProductEntityKey, ProductState, Uom, UomCategory, ID } from '@erp/shared/contracts';

/**
 * Product master data: products, product categories, units of measure and their categories.
 * The prototype stores records only; there are no stock documents or movements.
 * Archive and delete are separate operations: a record that is referenced elsewhere can be neither archived nor deleted
 * (the API answers 422 with the reason), mirroring Odoo's `ondelete=restrict` style constraints.
 */
export abstract class ProductApi {
  abstract snapshot(): Promise<ProductState>;

  /** The picture of one product as a data URL, or '' when it has none. */
  abstract productImage(id: ID): Promise<string>;

  abstract saveProduct(product: Omit<Product, 'id'> & { id?: ID }): Promise<Product>;
  abstract saveCategory(category: Omit<ProductCategory, 'id'> & { id?: ID }): Promise<ProductCategory>;
  abstract saveUomCategory(category: Omit<UomCategory, 'id'> & { id?: ID }): Promise<UomCategory>;
  abstract saveUom(uom: Omit<Uom, 'id'> & { id?: ID }): Promise<Uom>;

  /** Archive (`active = false`) or restore a record. */
  abstract setActive(entity: ProductEntityKey, id: ID, active: boolean): Promise<void>;
  /** Permanently delete a record. */
  abstract remove(entity: ProductEntityKey, id: ID): Promise<void>;
}
