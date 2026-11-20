import { Injectable } from '@angular/core';
import type { ProductEntityKey } from '@erp/shared/contracts';

export type StatusFilter = 'active' | 'archived' | 'all';
export interface ListState {
  q: string;
  status: StatusFilter;
  filters: Record<string, string>;
  sort: { key: string; dir: 'asc' | 'desc' };
  page: number;
  pageSize: number;
}

/** Keeps search, filters and sort per list while navigating to a record and back (in memory only). */
@Injectable({ providedIn: 'root' })
export class ProductListMemory {
  private readonly lists = new Map<ProductEntityKey, ListState>();
  get(key: ProductEntityKey): ListState | undefined { return this.lists.get(key); }
  set(key: ProductEntityKey, state: ListState): void { this.lists.set(key, state); }
}
