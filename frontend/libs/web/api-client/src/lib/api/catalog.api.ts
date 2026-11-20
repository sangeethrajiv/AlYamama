import type { DirectoryProduct } from '@erp/shared/contracts';
import type { Decimal } from '@erp/shared/utils';

/** Read-only bridge: lets document forms pick products and see stock without importing another domain's internals. */
export abstract class CatalogApi {
  abstract products(): Promise<DirectoryProduct[]>;
  /** On-hand quantity by SKU (storable products only). */
  abstract stockBySku(): Promise<Record<string, Decimal>>;
}
