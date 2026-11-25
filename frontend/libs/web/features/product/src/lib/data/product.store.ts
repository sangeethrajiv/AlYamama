import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DataChanges, ProductApi } from '@erp/web/api-client';
import { I18n } from '@erp/web/ui';
import type { ID, Product, ProductCategory, ProductEntityKey, ProductState, Uom, UomCategory } from '@erp/shared/contracts';
import type { Ctx } from '../models/product-types';

const EMPTY: ProductState = { uom_categories: [], uoms: [], categories: [], products: [], companies: [], users: [], taxes: [], genres: [] };

/** Which list of the snapshot holds each model. */
const LIST: Record<ProductEntityKey, 'products' | 'categories' | 'uoms' | 'uom_categories'> = { products: 'products', categories: 'categories', uoms: 'uoms', uomCategories: 'uom_categories' };

/** Feature-local state: the product master-data snapshot, refreshed whenever data changes. */
@Injectable({ providedIn: 'root' })
export class ProductStore {
  readonly api = inject(ProductApi);
  private readonly changes = inject(DataChanges);
  private readonly i18n = inject(I18n);
  readonly s = signal<ProductState>(EMPTY);
  readonly loaded = signal(false);
  /** The last read of the snapshot failed (backend down, session, ...). Screens show it until a reload succeeds. */
  readonly failed = signal(false);
  /** Data + translation for the config callbacks. Re-evaluates when the data or the language changes. */
  readonly ctx = computed<Ctx>(() => ({ s: this.s(), tr: (k, p) => this.i18n.tr(k, p) }));

  constructor() {
    effect(() => {
      this.changes.revision();
      void this.reload();
    });
  }

  /** Reads the whole snapshot again. Data already on screen is kept when a refresh fails. */
  async reload(): Promise<void> {
    try {
      this.s.set(await this.api.snapshot());
      this.loaded.set(true);
      this.failed.set(false);
    } catch {
      this.failed.set(true);
    }
  }

  /**
   * Saves a record and puts the saved version into the local list. The HTTP adapter does not signal DataChanges and a full
   * reload is many requests, so without this the page opened right after a save would not find a new record.
   */
  async save(entity: ProductEntityKey, rec: Record<string, unknown>): Promise<ID> {
    const saved = await this.persist(entity, rec);
    this.patch(entity, list => (list.some(x => x.id === saved.id) ? list.map(x => (x.id === saved.id ? saved : x)) : [...list, saved]));
    return saved.id;
  }

  async setActive(entity: ProductEntityKey, id: ID, active: boolean): Promise<void> {
    await this.api.setActive(entity, id, active);
    this.patch(entity, list => list.map(x => (x.id === id ? { ...x, active } : x)));
  }

  async remove(entity: ProductEntityKey, id: ID): Promise<void> {
    await this.api.remove(entity, id);
    this.patch(entity, list => list.filter(x => x.id !== id));
  }

  private patch(entity: ProductEntityKey, change: (list: { id: ID }[]) => { id: ID }[]): void {
    const key = LIST[entity];
    this.s.update(s => ({ ...s, [key]: change(s[key] as { id: ID }[]) }));
  }

  private persist(entity: ProductEntityKey, rec: Record<string, unknown>): Promise<{ id: ID }> {
    switch (entity) {
      case 'products': return this.api.saveProduct(rec as unknown as Product);
      case 'categories': return this.api.saveCategory(rec as unknown as ProductCategory);
      case 'uoms': return this.api.saveUom(rec as unknown as Uom);
      case 'uomCategories': return this.api.saveUomCategory(rec as unknown as UomCategory);
    }
  }
}
