import { Injectable, inject } from '@angular/core';
import type { DirectoryProduct } from '@erp/shared/contracts';
import { dec, type Decimal } from '@erp/shared/utils';
import { CatalogApi } from '../api/catalog.api';
import { MockDb } from './mock-db';

@Injectable()
export class MockCatalogApi extends CatalogApi {
  private readonly db = inject(MockDb);

  override async products(): Promise<DirectoryProduct[]> {
    const s = this.db.product;
    return s.products.filter(p => p.active).map(p => ({
      id: String(p.id), sku: p.default_code || p.name, name: p.name, salePrice: p.list_price, taxRate: '0.1500', canSell: p.sale_ok,
      uom: s.uoms.find(u => u.id === p.uom_id)?.name ?? '', active: p.active,
    }));
  }

  override async stockBySku(): Promise<Record<string, Decimal>> {
    const out: Record<string, Decimal> = {};
    for (const p of this.db.product.products) {
      if (p.type !== 'product') continue;
      out[p.default_code || p.name] = dec(p.qty_available, 3);
    }
    return out;
  }
}
