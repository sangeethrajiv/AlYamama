import { Injectable, inject } from '@angular/core';
import type { Product, ProductCategory, ProductEntityKey, ProductState, Uom, UomCategory, ID } from '@erp/shared/contracts';
import { dec, gt, lt } from '@erp/shared/utils';
import { ApiError } from '../api/api-error';
import { ProductApi } from '../api/product.api';
import { MockDb, copy } from './mock-db';

type Draft<T extends { id: ID }> = Omit<T, 'id'> & { id?: ID };
type Field = { field: string; message: string };
type ListKey = 'products' | 'categories' | 'uoms' | 'uom_categories';
const LIST: Record<ProductEntityKey, ListKey> = { products: 'products', categories: 'categories', uoms: 'uoms', uomCategories: 'uom_categories' };
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * MOCK adapter: an in-memory stand-in for the future server. It enforces the same rules the server will (required
 * fields, uniqueness, unit-of-measure consistency, restrict-on-archive/delete), so the screens do not have to trust
 * their own checks. Nothing here touches Odoo or any database.
 */
@Injectable()
export class MockProductApi extends ProductApi {
  private readonly db = inject(MockDb);
  private get s(): ProductState { return this.db.product; }

  override async snapshot(): Promise<ProductState> { return copy(this.s); }

  /** Insert (no id, or an unknown id) or replace by id. Ids are per list (max + 1), like database sequences. Returns the stored record. */
  private put<T extends { id: ID }>(key: ListKey, rec: Draft<T>): T {
    const list = this.s[key] as unknown as T[];
    let stored: T;
    if (rec.id && list.some(x => x.id === rec.id)) {
      stored = copy(rec as T);
      (this.s[key] as unknown as T[]) = list.map(x => (x.id === stored.id ? stored : x));
    } else {
      const id = list.reduce((m, r) => Math.max(m, r.id), 0) + 1;
      stored = { ...copy(rec), id } as T;
      (this.s[key] as unknown as T[]) = [...list, stored];
    }
    return stored;
  }
  private done<T>(v: T): T { this.db.touch(); return copy(v); }
  private check(errors: Field[]): void { if (errors.length) throw ApiError.validation(errors); }

  override async productImage(id: ID): Promise<string> { return this.s.products.find(p => p.id === id)?.image ?? ''; }

  override async saveProduct(p: Draft<Product>): Promise<Product> {
    const e: Field[] = [];
    const name = p.name.trim();
    if (!name) e.push({ field: 'name', message: 'Name is required.' });
    if (!p.categ_id) e.push({ field: 'categ_id', message: 'Product Category is required.' });
    if (!p.uom_id) e.push({ field: 'uom_id', message: 'Unit of Measure is required.' });
    const nonNeg: [keyof Product, string][] = [['list_price', 'Sales Price'], ['standard_price', 'Cost'], ['weight', 'Weight'], ['volume', 'Volume'], ['margin_perc', 'Margin (%)']];
    for (const [k, label] of nonNeg) if (lt((p[k] as string) || '0', '0')) e.push({ field: k, message: `${label} cannot be negative.` });
    if (gt(p.margin_perc || '0', '100')) e.push({ field: 'margin_perc', message: 'Margin (%) cannot exceed 100.' });
    const uom = this.s.uoms.find(u => u.id === p.uom_id), po = this.s.uoms.find(u => u.id === (p.uom_po_id || p.uom_id));
    if (uom && po && uom.category_id !== po.category_id) e.push({ field: 'uom_po_id', message: 'Purchase unit must be in the same category as the Unit of Measure.' });
    if (p.tracking !== 'none' && p.type !== 'product') e.push({ field: 'tracking', message: 'Only storable products can be tracked.' });
    this.check(e);
    const others = this.s.products.filter(x => x.id !== p.id);
    if (p.default_code && others.some(x => same(x.default_code, p.default_code))) throw ApiError.businessRule('PRODUCT_DUPLICATE_REFERENCE', 'Duplicate reference', 'Another product already uses this Internal Reference.');
    if (p.barcode && others.some(x => same(x.barcode, p.barcode))) throw ApiError.businessRule('PRODUCT_DUPLICATE_BARCODE', 'Duplicate barcode', 'This barcode is already assigned to another product.');
    // qty_available / virtual_available are computed by stock in Odoo: never taken from the form, kept at zero for non-storable products.
    const prev = p.id ? this.s.products.find(x => x.id === p.id) : undefined;
    const storable = p.type === 'product';
    return this.done(this.put<Product>('products', {
      ...p, name, uom_po_id: p.uom_po_id || p.uom_id,
      // A save that leaves the picture out keeps the stored one, like the server.
      ...(p.image === undefined && prev?.image !== undefined ? { image: prev.image } : {}),
      qty_available: storable ? (prev?.qty_available ?? '0.0000') : '0.0000',
      virtual_available: storable ? (prev?.virtual_available ?? '0.0000') : '0.0000',
    }));
  }

  override async saveCategory(c: Draft<ProductCategory>): Promise<ProductCategory> {
    const e: Field[] = [];
    const name = c.name.trim();
    if (!name) e.push({ field: 'name', message: 'Name is required.' });
    if (c.id != null && c.parent_id != null && (c.parent_id === c.id || this.descendants(c.id).has(c.parent_id))) e.push({ field: 'parent_id', message: 'A category cannot be its own parent or a descendant of itself.' });
    if (name && this.s.categories.some(x => x.id !== c.id && (x.parent_id ?? null) === (c.parent_id ?? null) && same(x.name, name))) e.push({ field: 'name', message: 'A category with this name already exists under the same parent.' });
    this.check(e);
    return this.done(this.put<ProductCategory>('categories', { ...c, name, parent_id: c.parent_id ?? null }));
  }

  override async saveUomCategory(c: Draft<UomCategory>): Promise<UomCategory> {
    const e: Field[] = [];
    const name = c.name.trim();
    if (!name) e.push({ field: 'name', message: 'Unit of Measure Category is required.' });
    if (name && this.s.uom_categories.some(x => x.id !== c.id && same(x.name, name))) e.push({ field: 'name', message: 'A UoM category with this name already exists.' });
    this.check(e);
    return this.done(this.put<UomCategory>('uom_categories', { ...c, name }));
  }

  override async saveUom(u: Draft<Uom>): Promise<Uom> {
    const e: Field[] = [];
    const name = u.name.trim();
    if (!name) e.push({ field: 'name', message: 'Unit of Measure is required.' });
    if (!u.category_id) e.push({ field: 'category_id', message: 'Category is required.' });
    if (u.uom_type !== 'reference' && !gt(u.factor, '0')) e.push({ field: 'factor', message: 'Ratio must be greater than zero.' });
    if (!gt(u.rounding, '0')) e.push({ field: 'rounding', message: 'Rounding precision must be greater than zero.' });
    const siblings = this.s.uoms.filter(x => x.id !== u.id && x.category_id === u.category_id);
    const ref = siblings.find(x => x.uom_type === 'reference' && x.active);
    if (u.uom_type === 'reference' && ref) e.push({ field: 'uom_type', message: `Category already has the reference unit "${ref.name}". Only one reference unit is allowed.` });
    if (u.uom_type !== 'reference' && !ref) e.push({ field: 'uom_type', message: 'This category has no reference unit yet. Create the reference unit first.' });
    if (name && siblings.some(x => same(x.name, name))) e.push({ field: 'name', message: 'This category already has a unit with this name.' });
    this.check(e);
    return this.done(this.put<Uom>('uoms', { ...u, name, factor: u.uom_type === 'reference' ? dec(1, 8) : u.factor }));
  }

  override async setActive(entity: ProductEntityKey, id: ID, active: boolean): Promise<void> {
    const key = LIST[entity];
    const rec = (this.s[key] as { id: ID; active: boolean }[]).find(r => r.id === id);
    if (!rec) throw ApiError.notFound('Record');
    if (!active) { const why = this.archiveBlocker(entity, id); if (why) throw ApiError.businessRule('PRODUCT_ARCHIVE_BLOCKED', 'Cannot archive', why); }
    (this.s[key] as { id: ID; active: boolean }[]) = (this.s[key] as { id: ID; active: boolean }[]).map(r => (r.id === id ? { ...r, active } : r));
    this.db.touch();
  }

  override async remove(entity: ProductEntityKey, id: ID): Promise<void> {
    const key = LIST[entity];
    const list = this.s[key] as { id: ID }[];
    if (!list.some(r => r.id === id)) throw ApiError.notFound('Record');
    const why = this.deleteBlocker(entity, id);
    if (why) throw ApiError.businessRule('PRODUCT_DELETE_BLOCKED', 'Cannot delete', why);
    (this.s[key] as { id: ID }[]) = list.filter(r => r.id !== id);
    this.db.touch();
  }

  // ---------------------------------------------------------------- restrict rules (Odoo ondelete=restrict and similar constraints)
  private descendants(root: ID): Set<ID> {
    const out = new Set<ID>(); const queue = [root];
    while (queue.length) { const cur = queue.shift() as ID; for (const c of this.s.categories) if (c.parent_id === cur && !out.has(c.id)) { out.add(c.id); queue.push(c.id); } }
    return out;
  }
  private archiveBlocker(entity: ProductEntityKey, id: ID): string | null {
    const s = this.s;
    switch (entity) {
      case 'categories': {
        const n = s.products.filter(p => p.categ_id === id && p.active).length, kids = s.categories.filter(c => c.parent_id === id && c.active).length;
        return n ? `${n} active product(s) use this category. Move or archive them first.` : kids ? `${kids} active sub-category(ies) exist under this category.` : null;
      }
      case 'uomCategories': {
        const n = s.uoms.filter(u => u.category_id === id && u.active).length;
        return n ? `${n} active unit(s) of measure belong to this category. Archive them first.` : null;
      }
      case 'uoms': {
        const u = s.uoms.find(x => x.id === id), n = s.products.filter(p => p.active && (p.uom_id === id || p.uom_po_id === id)).length;
        if (n) return `${n} active product(s) use this unit of measure.`;
        return u?.uom_type === 'reference' && s.uoms.some(x => x.id !== id && x.category_id === u.category_id && x.active) ? 'This is the reference unit of its category and other active units depend on it.' : null;
      }
      default: return null;
    }
  }
  private deleteBlocker(entity: ProductEntityKey, id: ID): string | null {
    const s = this.s;
    switch (entity) {
      case 'products': { const p = s.products.find(x => x.id === id); return p && gt(p.qty_available, '0') ? `This product has ${p.qty_available} units on hand and stock history. Archive it instead.` : null; }
      case 'categories': {
        const n = s.products.filter(p => p.categ_id === id).length, kids = s.categories.filter(c => c.parent_id === id).length;
        return n ? `${n} product(s) use this category.` : kids ? `This category has ${kids} sub-category(ies).` : null;
      }
      case 'uomCategories': { const n = s.uoms.filter(u => u.category_id === id).length; return n ? `This category contains ${n} unit(s) of measure.` : null; }
      case 'uoms': { const n = s.products.filter(p => p.uom_id === id || p.uom_po_id === id).length; return n ? `${n} product(s) use this unit of measure.` : null; }
    }
  }
}
