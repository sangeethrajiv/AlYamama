import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DataChanges, ProductApi } from '@erp/web/api-client';
import { DebugModeService, PermissionService } from '@erp/web/core';
import { I18n } from '@erp/web/ui';
import { PERM, type ProductState } from '@erp/shared/contracts';
import type { Ctx } from '../models/product-types';

const EMPTY: ProductState = { uom_categories: [], uoms: [], categories: [], products: [], companies: [], users: [], taxes: [], sequences: [], removal_strategies: [], accounts: [], journals: [] };

/** Feature-local state: the product master-data snapshot, refreshed whenever data changes. */
@Injectable({ providedIn: 'root' })
export class ProductStore {
  readonly api = inject(ProductApi);
  private readonly changes = inject(DataChanges);
  private readonly i18n = inject(I18n);
  private readonly debugMode = inject(DebugModeService);
  private readonly perms = inject(PermissionService);
  readonly s = signal<ProductState>(EMPTY);
  readonly loaded = signal(false);
  /** Data + translation for the config callbacks. Re-evaluates when the data or the language changes. */
  readonly ctx = computed<Ctx>(() => ({ s: this.s(), tr: (k, p) => this.i18n.tr(k, p), debug: this.debugMode.active() && this.perms.has(PERM.inventory.write) }));

  constructor() {
    effect(() => {
      this.changes.revision();
      void this.api.snapshot().then(v => { this.s.set(v); this.loaded.set(true); });
    });
  }
}
