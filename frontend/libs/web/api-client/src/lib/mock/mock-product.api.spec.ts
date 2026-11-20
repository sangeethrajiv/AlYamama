import { TestBed } from '@angular/core/testing';
import type { Product } from '@erp/shared/contracts';
import { MockCatalogApi } from './mock-catalog.api';
import { MockProductApi } from './mock-product.api';

const field = (e: unknown) => (e as { problem: { errors: { field: string }[] } }).problem.errors.map(x => x.field);

describe('MockProductApi', () => {
  let api: MockProductApi;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MockProductApi, MockCatalogApi] });
    api = TestBed.inject(MockProductApi);
  });
  const blank = async (over: Partial<Product> = {}): Promise<Omit<Product, 'id'>> => {
    const { id, ...rest } = (await api.snapshot()).products[0]; void id;
    return { ...rest, default_code: '', barcode: '', ...over };
  };

  it('seeds every Odoo field the React reference defines', async () => {
    const s = await api.snapshot();
    const p = s.products[0];
    for (const k of ['arabic_name', 'internal_short_code', 'internal_type', 'tracking', 'company_id', 'responsible_id', 'margin_perc', 'no_discount', 'description_sale', 'description_purchase', 'qty_available', 'virtual_available']) expect(p).toHaveProperty(k);
    expect(typeof p.responsible_id).toBe('number');
    expect(s.categories[1]).toHaveProperty('sequence_code');
    expect(s.uoms[0]).toHaveProperty('view_name');
    expect(s.companies.length).toBeGreaterThan(0);
    expect(s.users.length).toBeGreaterThan(0);
    expect(p.qty_available).toMatch(/^\d+\.\d{4}$/);
  });

  it('rejects a product with no name, category or unit of measure', async () => {
    const e = await api.saveProduct(await blank({ name: ' ', categ_id: null, uom_id: null })).catch(x => x);
    expect(field(e)).toEqual(expect.arrayContaining(['name', 'categ_id', 'uom_id']));
  });

  it('refuses a duplicate internal reference or barcode with a 422 business rule', async () => {
    const s = await api.snapshot();
    const ref = await api.saveProduct(await blank({ name: 'Clone', default_code: s.products[0].default_code })).catch(e => e);
    expect(ref.problem.status).toBe(422);
    expect(ref.problem.code).toBe('PRODUCT_DUPLICATE_REFERENCE');
    const bar = await api.saveProduct(await blank({ name: 'Clone', barcode: s.products[0].barcode })).catch(e => e);
    expect(bar.problem.code).toBe('PRODUCT_DUPLICATE_BARCODE');
  });

  it('refuses a purchase unit from another category and tracking on non-storable products', async () => {
    const s = await api.snapshot();
    const kg = s.uoms.find(u => u.name === 'kg')!;
    const e1 = await api.saveProduct(await blank({ name: 'X1', default_code: 'X1', uom_po_id: kg.id, uom_id: s.uoms[0].id })).catch(e => e);
    expect(field(e1)).toContain('uom_po_id');
    const e2 = await api.saveProduct(await blank({ name: 'X2', default_code: 'X2', type: 'service', tracking: 'lot' })).catch(e => e);
    expect(field(e2)).toContain('tracking');
  });

  it('refuses negative prices and a margin above 100', async () => {
    const e = await api.saveProduct(await blank({ name: 'Neg', default_code: 'NEG', list_price: '-1.00', margin_perc: '120.00' })).catch(x => x);
    expect(field(e)).toEqual(expect.arrayContaining(['list_price', 'margin_perc']));
  });

  it('creates per-entity ids and never takes the stock quantities from the form', async () => {
    const before = await api.snapshot();
    const created = await api.saveProduct(await blank({ name: 'Fresh', default_code: 'FRESH-1', type: 'product', qty_available: '99.0000', virtual_available: '99.0000' }));
    expect(created.id).toBe(Math.max(...before.products.map(p => p.id)) + 1);
    expect(created.qty_available).toBe('0.0000');
    const svc = await api.saveProduct(await blank({ name: 'Svc', default_code: 'SVC-1', type: 'service', tracking: 'none' }));
    expect(svc.qty_available).toBe('0.0000');
    // an update keeps the computed stock figures of the stored record
    const stored = before.products.find(p => p.type === 'product' && p.qty_available !== '0.0000')!;
    const updated = await api.saveProduct({ ...stored, name: `${stored.name} v2`, qty_available: '1.0000' });
    expect(updated.qty_available).toBe(stored.qty_available);
  });

  it('feeds the Accounting catalog from qty_available', async () => {
    const catalog = TestBed.inject(MockCatalogApi);
    const s = await api.snapshot();
    const stored = s.products.find(p => p.type === 'product' && p.active && p.default_code && p.qty_available !== '0.0000')!;
    expect((await catalog.products()).some(p => p.sku === stored.default_code)).toBe(true);
    expect((await catalog.stockBySku())[stored.default_code]).toBe(Number(stored.qty_available).toFixed(3));
  });

  it('validates categories: parent cycles and duplicate names under one parent', async () => {
    const s = await api.snapshot();
    const hoses = s.categories.find(c => c.name === 'Hoses & Pipes')!;
    const cycle = await api.saveCategory({ ...hoses, parent_id: s.categories.find(c => c.name === 'Hydraulic Hoses')!.id }).catch(e => e);
    expect(field(cycle)).toContain('parent_id');
    const dup = await api.saveCategory({ name: 'hoses & pipes', parent_id: hoses.parent_id, arabic_name: '', sequence_code: '', active: true }).catch(e => e);
    expect(field(dup)).toContain('name');
  });

  it('validates units of measure: ratio, rounding and exactly one reference unit', async () => {
    const s = await api.snapshot();
    const weight = s.uom_categories.find(c => c.name === 'Weight')!;
    const bad = await api.saveUom({ name: 'lb', category_id: weight.id, uom_type: 'smaller', factor: '0.00000000', rounding: '0.000000', view_name: '', active: true }).catch(e => e);
    expect(field(bad)).toEqual(expect.arrayContaining(['factor', 'rounding']));
    const second = await api.saveUom({ name: 'stone', category_id: weight.id, uom_type: 'reference', factor: '1', rounding: '0.01', view_name: '', active: true }).catch(e => e);
    expect(field(second)).toContain('uom_type');
    const area = s.uom_categories.find(c => c.name === 'Area')!;
    const orphan = await api.saveUom({ name: 'ha', category_id: area.id, uom_type: 'bigger', factor: '0.0001', rounding: '0.01', view_name: '', active: true });
    expect(orphan.uom_type).toBe('bigger'); // Area already has its reference unit (m²), so a bigger unit is accepted
    const ok = await api.saveUom({ name: 'oz', category_id: weight.id, uom_type: 'smaller', factor: '35.27396195', rounding: '0.01', view_name: 'Oz', active: true });
    expect(ok.id).toBeGreaterThan(0);
  });

  it('refuses to archive or delete records that are still referenced (422)', async () => {
    const s = await api.snapshot();
    const hoses = s.categories.find(c => c.name === 'Hydraulic Hoses')!;
    const a = await api.setActive('categories', hoses.id, false).catch(e => e);
    expect(a.problem.code).toBe('PRODUCT_ARCHIVE_BLOCKED');
    const d = await api.remove('categories', hoses.id).catch(e => e);
    expect(d.problem.code).toBe('PRODUCT_DELETE_BLOCKED');
    const unit = s.uoms.find(u => u.name === 'Unit(s)')!;
    expect((await api.remove('uoms', unit.id).catch(e => e)).problem.status).toBe(422);
    const stocked = s.products.find(p => p.qty_available !== '0.0000')!;
    expect((await api.remove('products', stocked.id).catch(e => e)).problem.code).toBe('PRODUCT_DELETE_BLOCKED');
  });

  it('archives, restores and deletes an unreferenced record', async () => {
    const created = await api.saveProduct(await blank({ name: 'Temp', default_code: 'TMP-1', qty_available: '0.0000' }));
    await api.setActive('products', created.id, false);
    expect((await api.snapshot()).products.find(p => p.id === created.id)?.active).toBe(false);
    await api.setActive('products', created.id, true);
    expect((await api.snapshot()).products.find(p => p.id === created.id)?.active).toBe(true);
    await api.remove('products', created.id);
    expect((await api.snapshot()).products.some(p => p.id === created.id)).toBe(false);
  });
});
