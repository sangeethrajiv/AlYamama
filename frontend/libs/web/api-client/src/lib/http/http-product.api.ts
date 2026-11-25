import { Injectable, inject } from '@angular/core';
import type { ID, Product, ProductCategory, ProductEntityKey, ProductState, Uom, UomCategory, ProductGenre, ProductTax } from '@erp/shared/contracts';
import { ProductApi } from '../api/product.api';
import { BackendHttp } from './backend-http';

type Rec = Record<string, unknown>;
type M2o = { id: number } | number | null | undefined;

const id = (v: M2o): number | null => (v == null ? null : typeof v === 'object' ? v.id : v);
/** A many2many value: every assigned record's id (the backend sends `{ id, name }` entries). */
const ids = (v: unknown): number[] => (Array.isArray(v) ? (v as M2o[]).map(id).filter((x): x is number => x != null) : []);
const str = (v: unknown): string => (v == null ? '' : String(v));
const dec = (v: unknown): string => (v == null || v === '' ? '0' : String(v));

/** Backend path per managed model (Express /v2). */
const PATH: Record<ProductEntityKey, string> = {
  products: '/products',
  categories: '/product-categories',
  uoms: '/uoms',
  uomCategories: '/uom-categories',
};
/** Models the backend archives with a dedicated route; the other two take `active` in a PUT. */
const HAS_ARCHIVE_ROUTE: Record<ProductEntityKey, boolean> = { products: true, uoms: true, categories: false, uomCategories: false };

// ---- backend record -> Angular contract -------------------------------------------------------------------------
export function toProduct(r: Rec): Product {
  return {
    id: r['id'] as number,
    name: str(r['name']),
    default_code: str(r['default_code']),
    barcode: str(r['barcode']),
    type: r['type'] as Product['type'],
    categ_id: id(r['categ_id'] as M2o),
    uom_id: id(r['uom_id'] as M2o),
    uom_po_id: id(r['uom_po_id'] as M2o),
    tracking: (r['tracking'] as Product['tracking']) ?? 'none',
    active: r['active'] !== false,
    company_id: id(r['company_id'] as M2o),
    sale_ok: r['sale_ok'] !== false,
    purchase_ok: r['purchase_ok'] !== false,
    list_price: dec(r['list_price']),
    standard_price: dec(r['standard_price']),
    weight: dec(r['weight']),
    volume: dec(r['volume']),
    responsible_id: id(r['responsible_id'] as M2o),
    description_sale: str(r['description_sale']),
    description_purchase: str(r['description_purchase']),
    // Arabic is not exposed by the backend for now.
    arabic_name: '',
    internal_short_code: str(r['internal_short_code']),
    internal_type: (r['internal_type'] as Product['internal_type']) ?? '',
    margin_perc: dec(r['margin_perc']),
    no_discount: r['no_discount'] === true,
    product_type_id: id(r['product_type_id'] as M2o),
    is_teltonika_product: r['is_teltonika_product'] === true,
    is_vehicle_subscription: r['is_vehicle_subscription'] === true,
    taxes_id: ids(r['taxes_id']),
    // No stock moves yet: both stay empty.
    qty_available: '0',
    virtual_available: '0',
  };
}

export function toCategory(r: Rec): ProductCategory {
  return {
    id: r['id'] as number,
    name: str(r['name']),
    parent_id: id(r['parent_id'] as M2o),
    arabic_name: '',
    sequence_code: str(r['sequence_code']),
    active: r['active'] !== false,
  };
}

export function toUomCategory(r: Rec): UomCategory {
  return { id: r['id'] as number, name: str(r['name']), measure_type: (r['measure_type'] as UomCategory['measure_type']) ?? '', active: r['active'] !== false };
}

export function toUom(r: Rec): Uom {
  return {
    id: r['id'] as number,
    name: str(r['name']),
    category_id: id(r['category_id'] as M2o),
    uom_type: r['uom_type'] as Uom['uom_type'],
    factor: dec(r['factor']),
    rounding: dec(r['rounding']),
    view_name: str(r['view_name']),
    active: r['active'] !== false,
  };
}

/**
 * The tax lookup: the sales taxes, plus every tax a product already has (the product carries its name), so an assigned tax
 * is never shown as a bare id, even one the user may not list (another company, or not a sales tax).
 */
function mergeTaxes(taxes: Rec[], products: Rec[]): ProductTax[] {
  const out = new Map<number, ProductTax>(taxes.map(t => [t['id'] as number, { id: t['id'] as number, name: str(t['name']), active: t['active'] !== false }]));
  for (const p of products) {
    for (const t of (Array.isArray(p['taxes_id']) ? p['taxes_id'] : []) as { id: number; name?: string | null }[]) {
      if (!out.has(t.id)) out.set(t.id, { id: t.id, name: t.name ?? `#${t.id}`, active: true });
    }
  }
  return [...out.values()];
}

// ---- Angular contract -> backend body ---------------------------------------------------------------------------
type Draft<T> = Omit<T, 'id'> & { id?: ID };
const blankToNull = (v: string | null | undefined) => (v === '' || v === undefined ? null : v);

function productBody(p: Draft<Product>): Rec {
  return {
    name: p.name, default_code: blankToNull(p.default_code), barcode: blankToNull(p.barcode), type: p.type,
    categ_id: p.categ_id, uom_id: p.uom_id, uom_po_id: p.uom_po_id ?? p.uom_id, tracking: p.tracking, active: p.active,
    company_id: p.company_id, sale_ok: p.sale_ok, purchase_ok: p.purchase_ok,
    list_price: p.list_price, standard_price: p.standard_price, weight: p.weight, volume: p.volume,
    responsible_id: p.responsible_id, description_sale: blankToNull(p.description_sale), description_purchase: blankToNull(p.description_purchase),
    internal_short_code: blankToNull(p.internal_short_code), internal_type: blankToNull(p.internal_type), margin_perc: p.margin_perc,
    no_discount: p.no_discount, product_type_id: p.product_type_id, taxes_id: p.taxes_id,
    // Left out when untouched, so the server keeps the stored picture.
    ...(p.image === undefined ? {} : { image: p.image || null }),
    is_teltonika_product: p.is_teltonika_product, is_vehicle_subscription: p.is_vehicle_subscription,
  };
}
const categoryBody = (c: Draft<ProductCategory>): Rec => ({ name: c.name, parent_id: c.parent_id, sequence_code: blankToNull(c.sequence_code), active: c.active });
const uomCategoryBody = (c: Draft<UomCategory>): Rec => ({ name: c.name, measure_type: blankToNull(c.measure_type), active: c.active });
const uomBody = (u: Draft<Uom>): Rec => ({
  name: u.name, category_id: u.category_id, uom_type: u.uom_type, factor: u.factor, rounding: u.rounding, active: u.active,
});

/** Product master data served by the Express backend (`/v2`). */
@Injectable()
export class HttpProductApi extends ProductApi {
  private readonly http = inject(BackendHttp);

  override async snapshot(): Promise<ProductState> {
    const all = { active: 'all' };
    const [uomCats, uoms, cats, prods, companies, users, taxes, genres] = await Promise.all([
      this.http.getAll<Rec>('/uom-categories'),
      this.http.getAll<Rec>('/uoms', all),
      this.http.getAll<Rec>('/product-categories'),
      this.http.getAll<Rec>('/products', all),
      this.http.getAll<Rec>('/companies'),
      this.http.getAll<Rec>('/users'),
      // Customer Taxes: Odoo offers the sales taxes. Read-only; the tax screens belong to Accounting.
      this.http.getAll<Rec>('/accounting/taxes', { active: 'all', type_tax_use: 'sale' }),
      this.http.getAll<Rec>('/product-genres'),
    ]);
    return {
      uom_categories: uomCats.map(toUomCategory),
      uoms: uoms.map(toUom),
      categories: cats.map(toCategory),
      products: prods.map(toProduct),
      companies: companies.map(c => ({ id: c['id'] as number, name: str(c['name']) })),
      users: users.map(u => ({ id: u['id'] as number, name: str(u['name']) })),
      taxes: mergeTaxes(taxes, prods),
      genres: genres.map((g): ProductGenre => ({ id: g['id'] as number, name: str(g['name']), active: g['active'] !== false })),
    };
  }

  private async save<T extends { id: ID }>(path: string, rec: Draft<T>, body: Rec, map: (r: Rec) => T): Promise<T> {
    const saved = rec.id
      ? await this.http.put<Rec>(`${path}/${rec.id}`, body).then(() => rec.id as number)
      : await this.http.post<Rec>(path, body).then(r => r['id'] as number);
    return map(await this.http.get<Rec>(`${path}/${saved}`));
  }

  override async productImage(id: ID): Promise<string> { return str((await this.http.get<Rec>(`${PATH.products}/${id}`))['image']); }

  override saveProduct(p: Draft<Product>) { return this.save<Product>(PATH.products, p, productBody(p), toProduct); }
  override saveCategory(c: Draft<ProductCategory>) { return this.save<ProductCategory>(PATH.categories, c, categoryBody(c), toCategory); }
  override saveUomCategory(c: Draft<UomCategory>) { return this.save<UomCategory>(PATH.uomCategories, c, uomCategoryBody(c), toUomCategory); }
  override saveUom(u: Draft<Uom>) { return this.save<Uom>(PATH.uoms, u, uomBody(u), toUom); }

  override async setActive(entity: ProductEntityKey, recId: ID, active: boolean): Promise<void> {
    if (HAS_ARCHIVE_ROUTE[entity]) await this.http.post(`${PATH[entity]}/${recId}/${active ? 'unarchive' : 'archive'}`);
    else await this.http.put(`${PATH[entity]}/${recId}`, { active });
  }

  override async remove(entity: ProductEntityKey, recId: ID): Promise<void> {
    await this.http.delete(`${PATH[entity]}/${recId}`);
  }
}
