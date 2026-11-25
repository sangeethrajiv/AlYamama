import { TestBed } from '@angular/core/testing';
import type { Product, ProductState } from '@erp/shared/contracts';
import { ProductApi } from '@erp/web/api-client';
import { I18n } from '@erp/web/ui';
import { ProductStore } from './product.store';

const state = (products: Partial<Product>[] = []): ProductState =>
  ({ uom_categories: [], uoms: [], categories: [], products: products as Product[], companies: [], users: [], taxes: [], genres: [] });

/** A backend that answers like the HTTP adapter: it never signals DataChanges, so the store has to keep its own list right. */
class FakeApi {
  snapshots: Array<ProductState | Error> = [state([{ id: 1, name: 'Pump', active: true }])];
  setActiveCalls: unknown[] = [];
  snapshot = async () => { const v = this.snapshots.length > 1 ? this.snapshots.shift()! : this.snapshots[0]; if (v instanceof Error) throw v; return v; };
  saveProduct = async (p: Partial<Product>) => ({ ...p, id: p.id ?? 2 }) as Product;
  setActive = async (...a: unknown[]) => { this.setActiveCalls.push(a); };
  remove = async () => undefined;
}

describe('ProductStore', () => {
  let api: FakeApi;
  const make = async () => {
    TestBed.configureTestingModule({ providers: [{ provide: ProductApi, useValue: api }, { provide: I18n, useValue: { tr: (k: string) => k } }] });
    const store = TestBed.inject(ProductStore);
    TestBed.tick();
    await new Promise(r => setTimeout(r));
    return store;
  };
  beforeEach(() => { api = new FakeApi(); });

  it('loads the snapshot from the API', async () => {
    const store = await make();
    expect(store.loaded()).toBe(true);
    expect(store.failed()).toBe(false);
    expect(store.s().products.map(p => p.name)).toEqual(['Pump']);
  });

  it('reports a failed first load instead of staying on "loading", and recovers on retry', async () => {
    api.snapshots = [new Error('down'), state([{ id: 1, name: 'Pump', active: true }])];
    const store = await make();
    expect(store.loaded()).toBe(false);
    expect(store.failed()).toBe(true);
    await store.reload();
    expect(store.failed()).toBe(false);
    expect(store.loaded()).toBe(true);
  });

  it('keeps the data on screen when a later refresh fails', async () => {
    const store = await make();
    api.snapshots = [new Error('down')];
    await store.reload();
    expect(store.failed()).toBe(true);
    expect(store.loaded()).toBe(true);
    expect(store.s().products).toHaveLength(1);
  });

  it('shows a saved, archived or deleted record at once, without reloading', async () => {
    const store = await make();
    const id = await store.save('products', { name: 'Valve', active: true });
    expect(id).toBe(2);
    expect(store.s().products.map(p => p.name)).toEqual(['Pump', 'Valve']);
    await store.save('products', { id: 2, name: 'Valve 2', active: true });
    expect(store.s().products.map(p => p.name)).toEqual(['Pump', 'Valve 2']);
    await store.setActive('products', 1, false);
    expect(store.s().products.find(p => p.id === 1)?.active).toBe(false);
    await store.remove('products', 2);
    expect(store.s().products.map(p => p.id)).toEqual([1]);
  });
});
