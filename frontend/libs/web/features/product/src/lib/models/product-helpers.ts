import type { ProductState, Uom, ID } from '@erp/shared/contracts';
import { dec, div, mul, add, type Decimal } from '@erp/shared/utils';
import type { Rec, RelKey } from './product-types';

/** Display helpers mirroring Odoo's computed display names. Pure functions over the product snapshot. */
export const getUom = (s: ProductState, id?: ID | null) => s.uoms.find(u => u.id === id);
export const byId = <T extends { id: ID }>(list: T[], id: ID | null | undefined): T | undefined => (id == null ? undefined : list.find(x => x.id === id));

/** complete_name of a product category ("All / Hoses & Pipes"). Guards against cycles. */
export function categoryName(s: ProductState, id?: ID | null): string {
  const seen = new Set<ID>();
  const parts: string[] = [];
  let cur = byId(s.categories, id);
  while (cur && !seen.has(cur.id)) { seen.add(cur.id); parts.unshift(cur.name); cur = byId(s.categories, cur.parent_id); }
  return parts.join(' / ');
}

/** All records below `rootId` (breadth first). */
export function descendantsOf<T extends { id: ID }>(list: T[], rootId: ID, parentKey: keyof T): T[] {
  const out: T[] = [];
  const queue = [rootId];
  const seen = new Set<ID>(queue);
  while (queue.length) {
    const cur = queue.shift() as ID;
    for (const x of list) {
      if ((x[parentKey] as unknown as ID | null) === cur && !seen.has(x.id)) { seen.add(x.id); out.push(x); queue.push(x.id); }
    }
  }
  return out;
}

/** Products in a category or any of its sub-categories. */
export function countProducts(s: ProductState, categoryId: ID): number {
  const ids = new Set([categoryId, ...descendantsOf(s.categories, categoryId, 'parent_id').map(c => c.id)]);
  return s.products.filter(p => p.categ_id != null && ids.has(p.categ_id)).length;
}

/** Display name of any related record. */
export function relLabel(s: ProductState, rel: RelKey, id: ID | null | undefined): string {
  if (id == null) return '';
  switch (rel) {
    case 'categories': return categoryName(s, id);
    case 'products': return s.products.find(x => x.id === id)?.name ?? '';
    case 'uoms': return s.uoms.find(x => x.id === id)?.name ?? '';
    case 'uomCategories': return s.uom_categories.find(x => x.id === id)?.name ?? '';
    case 'companies': return s.companies.find(x => x.id === id)?.name ?? '';
    case 'users': return s.users.find(x => x.id === id)?.name ?? '';
  }
}

/** The records of a relation, for selection lists. */
export function relRecords(s: ProductState, rel: RelKey): Rec[] {
  const list = rel === 'uomCategories' ? s.uom_categories : s[rel];
  return list as unknown as Rec[];
}

export interface RelOption { id: ID; label: string; active: boolean }
/** Options for a relation select: active records, plus the currently selected one even if archived. */
export function relOptions(s: ProductState, rel: RelKey, current?: ID | null, domain?: (r: Rec) => boolean): RelOption[] {
  return relRecords(s, rel)
    .filter(r => (r.active !== false || r.id === current) && (!domain || domain(r) || r.id === current))
    .map(r => ({ id: r.id, label: relLabel(s, rel, r.id), active: r.active !== false }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** factor_inv (Bigger Ratio) is 1 / factor. */
export const factorInv = (u: Pick<Uom, 'factor'>): Decimal => div('1', u.factor, 6);

/** `2.0000` -> `2`, `2.5000` -> `2.5`. */
export const trimZeros = (v: string): string => (v.includes('.') ? v.replace(/0+$/, '').replace(/\.$/, '') : v);
export const fmtQty = (v: Decimal | undefined): string => trimZeros(dec(v ?? '0', 4));

/** Display-only number formatting (never used for arithmetic). */
export const fmtNum = (v: Decimal | number | null | undefined, max = 4): string => {
  const n = Number(v);
  return Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(n) : '—';
};
export const fmtMoney = (v: Decimal | number | null | undefined): string => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);

/** The ratio a user reads for a unit: bigger => 1 / factor, smaller => factor, reference => 1. */
export const uomRatio = (u: Pick<Uom, 'factor' | 'uom_type'>): Decimal => (u.uom_type === 'bigger' ? trimZeros(factorInv(u)) : u.uom_type === 'smaller' ? trimZeros(dec(u.factor, 6)) : '1');

/** Estimated stock value: sum of on-hand quantity x cost over storable products (exact decimal arithmetic). */
export const stockValue = (s: ProductState, products = s.products.filter(p => p.active && p.type === 'product')): Decimal =>
  products.reduce((a, p) => add(a, mul(p.qty_available, p.standard_price, 4), 4), '0');
