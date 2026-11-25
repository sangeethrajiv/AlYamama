/* eslint-disable @typescript-eslint/no-explicit-any -- specs address records by Odoo field name */
import type { ProductState } from '@erp/shared/contracts';
import { seedProducts } from '@erp/web/api-client';
import { ENTITIES, ENTITY_BY_KEY, ENTITY_BY_ROUTE } from './product-entities';
import { archiveBlocker, deleteBlocker } from './product-rules';
import type { Ctx, Rec, Tr } from './product-types';
import { buildView, fromForm, toForm } from './product-view';

const tr: Tr = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);
const s = seedProducts() as unknown as ProductState;
const ctx: Ctx = { s, tr };
const rec = (list: unknown[], pred: (x: any) => boolean) => list.find(pred) as Rec;

describe('product entity configs', () => {
  it('declares the four models in the React order with their routes', () => {
    expect(ENTITIES.map(e => e.key)).toEqual(['products', 'categories', 'uoms', 'uomCategories']);
    expect(ENTITIES.map(e => e.model)).toEqual(['product.template', 'product.category', 'uom.uom', 'uom.category']);
    expect(Object.keys(ENTITY_BY_ROUTE)).toEqual(['products', 'categories', 'uom', 'uom-categories']);
  });

  it('covers every Odoo field of every model in a form or detail section', () => {
    const keys = (k: keyof typeof ENTITY_BY_KEY) => ENTITY_BY_KEY[k].sections.flatMap(sec => sec.fields.map(f => f.key));
    const product = Object.keys(s.products[0]).filter(k => k !== 'id');
    // The product form shows only the Odoo General Information fields; these stay on the record but are not on the screen.
    const notShown = ['tracking', 'active', 'weight', 'volume', 'responsible_id', 'description_sale', 'description_purchase', 'arabic_name'];
    expect(product.filter(k => !keys('products').includes(k))).toEqual(notShown);
    const category = Object.keys(s.categories[0]).filter(k => k !== 'id' && k !== 'arabic_name');
    expect(category.filter(k => !keys('categories').includes(k))).toEqual([]);
    const uom = Object.keys(s.uoms[0]).filter(k => k !== 'id');
    expect(uom.filter(k => !keys('uoms').includes(k))).toEqual([]);
    const uomCategory = Object.keys(s.uom_categories[0]).filter(k => k !== 'id');
    expect(uomCategory.filter(k => !keys('uomCategories').includes(k))).toEqual([]);
  });

  it('keeps stock quantities read-only (detail only) and tracking locked for non-storable products', () => {
    const fields = ENTITY_BY_KEY.products.sections.flatMap(sec => sec.fields);
    expect(fields.find(f => f.key === 'qty_available')).toMatchObject({ kind: 'readonly', detailOnly: true });
    expect(fields.find(f => f.key === 'virtual_available')).toMatchObject({ kind: 'readonly', detailOnly: true });
    expect(fields.find(f => f.key === 'taxes_id')).toMatchObject({ kind: 'relation', rel: 'taxes', multi: true });
    expect(fields.find(f => f.key === 'product_type_id')).toMatchObject({ kind: 'relation', rel: 'genres' });
    expect(ENTITY_BY_KEY.products.finalize?.({ type: 'service', tracking: 'lot' })).toMatchObject({ tracking: 'none' });
    expect(ENTITY_BY_KEY.products.finalize?.({ type: 'product', tracking: 'lot' })).toMatchObject({ tracking: 'lot' });
    expect(fields.find(f => f.key === 'company_id')).toMatchObject({ kind: 'relation', rel: 'companies' });
    expect(fields.find(f => f.key === 'internal_type')?.options?.map(o => o.value)).toEqual(['material', 'labour', 'overhead']);
  });

  it('maps Customer Taxes as many2many and Product Genre as many2one', () => {
    const view = buildView(ENTITY_BY_KEY.products, 'edit', () => ctx);
    const field = (k: string) => view.sections.flatMap(sec => sec.fields).find(f => f.key === k)!;
    expect(field('taxes_id').type).toBe('many2many');
    expect(field('product_type_id').type).toBe('many2one');
    // every assigned tax is kept as a list, a product without one as []
    expect(fromForm(ENTITY_BY_KEY.products, { taxes_id: [1, 2] })['taxes_id']).toEqual([1, 2]);
    expect(fromForm(ENTITY_BY_KEY.products, { taxes_id: undefined })['taxes_id']).toEqual([]);
    const two = s.products.find(p => p.taxes_id.length > 1)!;
    expect(two.taxes_id.map(id => s.taxes.find(t => t.id === id)?.name)).toEqual(['VAT 15% (Sales)', 'VAT 0% (Zero-rated)']);
  });

  it('applies the product on-change rules', () => {
    const f = (k: string) => ENTITY_BY_KEY.products.sections.flatMap(sec => sec.fields).find(x => x.key === k)!;
    expect(f('type').onChange?.('service', {}, ctx)).toEqual({ tracking: 'none' });
    expect(f('type').onChange?.('product', {}, ctx)).toEqual({});
    const kg = s.uoms.find(u => u.name === 'kg')!, unit = s.uoms.find(u => u.name === 'Unit(s)')!;
    // changing the unit to another category resets the purchase unit to it; staying in the category keeps it
    expect(f('uom_id').onChange?.(kg.id, { uom_po_id: unit.id }, ctx)).toEqual({ uom_po_id: kg.id });
    expect(f('uom_id').onChange?.(unit.id, { uom_po_id: unit.id }, ctx)).toEqual({});
    // the purchase unit may only be picked from the unit's category
    const choices = s.uoms.filter(u => f('uom_po_id').domain!(u as unknown as Rec, { uom_id: kg.id }, ctx));
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every(u => u.category_id === kg.category_id)).toBe(true);
  });
});

describe('product validation', () => {
  const p = ENTITY_BY_KEY.products;
  const base = () => ({ ...p.defaults(s), name: 'X', categ_id: 3 });

  it('flags a duplicate reference and barcode (case-insensitive) but not the record itself', () => {
    const first = s.products[0];
    expect(Object.keys(p.validate!({ ...base(), default_code: first.default_code.toLowerCase(), barcode: first.barcode }, ctx))).toEqual(['default_code', 'barcode']);
    expect(p.validate!({ ...base(), default_code: first.default_code, barcode: first.barcode }, ctx, first.id)).toEqual({});
  });

  it('flags a purchase unit from another category and tracking on non-storable products', () => {
    const kg = s.uoms.find(u => u.name === 'kg')!, unit = s.uoms.find(u => u.name === 'Unit(s)')!;
    expect(p.validate!({ ...base(), uom_id: unit.id, uom_po_id: kg.id }, ctx)['uom_po_id']).toBeTruthy();
    expect(p.validate!({ ...base(), type: 'consu', tracking: 'lot' }, ctx)['tracking']).toBeTruthy();
    expect(p.validate!({ ...base(), type: 'product', tracking: 'lot' }, ctx)).toEqual({});
  });

  it('blocks category cycles and duplicate sibling names', () => {
    const c = ENTITY_BY_KEY.categories;
    const hoses = rec(s.categories, x => x.name === 'Hoses & Pipes'), leaf = rec(s.categories, x => x.name === 'Hydraulic Hoses');
    expect(c.validate!({ name: 'Hoses & Pipes', parent_id: leaf.id }, ctx, hoses.id)['parent_id']).toBeTruthy();
    expect(c.validate!({ name: 'hydraulic hoses', parent_id: hoses.id }, ctx)['name']).toBeTruthy();
    expect(c.validate!({ name: 'Hydraulic Hoses', parent_id: hoses.id }, ctx, leaf.id)).toEqual({});
  });

  it('enforces one reference unit per UoM category and positive ratios', () => {
    const u = ENTITY_BY_KEY.uoms;
    const weight = rec(s.uom_categories, x => x.name === 'Weight'), area = rec(s.uom_categories, x => x.name === 'Area');
    expect(u.validate!({ name: 'stone', category_id: weight.id, uom_type: 'reference', rounding: '0.01' }, ctx)['uom_type']).toBeTruthy();
    expect(u.validate!({ name: 'ha', category_id: area.id, uom_type: 'smaller', factor: '0', rounding: '0.01' }, ctx)['factor']).toBeTruthy();
    expect(u.validate!({ name: 'ha', category_id: area.id, uom_type: 'bigger', factor_inv: '', rounding: '0' }, ctx)).toMatchObject({ factor_inv: expect.any(String), rounding: expect.any(String) });
    expect(u.validate!({ name: 'G', category_id: weight.id, uom_type: 'smaller', factor: '1000', rounding: '0.01' }, ctx)['name']).toBeTruthy();
  });

  it('round-trips a bigger unit through the ratio the user types', () => {
    const u = ENTITY_BY_KEY.uoms;
    const dozen = rec(s.uoms, x => x.name === 'Dozen(s)');
    const form = toForm(u, dozen, ctx);
    expect(form['factor_inv']).toBe(12); // number input while editing
    const saved = u.finalize!(fromForm(u, { ...form, factor_inv: 12 }));
    expect(saved['factor']).toBe('0.08333333');
    expect(saved).not.toHaveProperty('factor_inv');
    expect(u.finalize!({ uom_type: 'reference', factor: '5' })['factor']).toBe('1.00000000');
    expect(u.finalize!({ uom_type: 'smaller', factor: '1000' })['factor']).toBe('1000.00000000');
  });
});

describe('product form view', () => {
  it('builds every input field for create and adds computed read-only fields in edit mode only', () => {
    const create = buildView(ENTITY_BY_KEY.categories, 'create', () => ctx);
    const edit = buildView(ENTITY_BY_KEY.categories, 'edit', () => ctx);
    const keys = (v: ReturnType<typeof buildView>) => v.sections.flatMap(x => x.fields.map(f => f.key));
    expect(keys(create)).toEqual(expect.arrayContaining(['name', 'parent_id', 'sequence_code', 'active']));
    const completeName = edit.sections.flatMap(x => x.fields).find(f => f.key === 'complete_name')!;
    expect(completeName.visible?.({})).toBe(true);
    expect(create.sections.flatMap(x => x.fields).find(f => f.key === 'complete_name')).toBeUndefined();
    const product = buildView(ENTITY_BY_KEY.products, 'edit', () => ctx);
    expect(product.sections.flatMap(x => x.fields.map(f => f.key))).not.toContain('qty_available');
  });

  it('shows Ratio only for smaller units and Bigger Ratio only for bigger units', () => {
    const fields = buildView(ENTITY_BY_KEY.uoms, 'create', () => ctx).sections.flatMap(x => x.fields);
    expect(fields.find(f => f.key === 'factor')?.visible?.({ uom_type: 'smaller' })).toBe(true);
    expect(fields.find(f => f.key === 'factor')?.visible?.({ uom_type: 'bigger' })).toBe(false);
    expect(fields.find(f => f.key === 'factor_inv')?.visible?.({ uom_type: 'bigger' })).toBe(true);
    expect(fields.find(f => f.key === 'factor_inv')?.visible?.({ uom_type: 'reference' })).toBe(false);
  });

  it('turns decimal strings into numbers for editing and back into decimal strings', () => {
    const p = ENTITY_BY_KEY.products;
    const hose = s.products[0] as unknown as Rec;
    const form = toForm(p, hose, ctx);
    expect(typeof form['list_price']).toBe('number');
    const back = fromForm(p, { ...form, list_price: 19.5, standard_price: null, name: '  Padded  ' });
    expect(back['list_price']).toBe('19.50');
    expect(back['standard_price']).toBe('0');
    expect(back['name']).toBe('Padded');
  });

  it('limits the purchase-unit choices to the unit category while editing', () => {
    const view = buildView(ENTITY_BY_KEY.products, 'create', () => ctx);
    const po = view.sections.flatMap(x => x.fields).find(f => f.key === 'uom_po_id')!;
    const kg = s.uoms.find(u => u.name === 'kg')!;
    const opts = (po.options as (v: Record<string, unknown>, l: Record<string, never>) => { value: unknown }[])({ uom_id: kg.id, uom_po_id: kg.id }, {});
    expect(opts.map(o => s.uoms.find(u => u.id === o.value)?.category_id)).toEqual(opts.map(() => kg.category_id));
  });
});

describe('archive and delete pre-flight', () => {
  it('explains why a referenced record cannot be archived or deleted', () => {
    const hoses = rec(s.categories, x => x.name === 'Hydraulic Hoses');
    expect(archiveBlocker('categories', hoses, s, tr)).toContain('product.block.catProducts');
    expect(deleteBlocker('categories', hoses, s, tr)).toContain('product.block.catDelProducts');
    const unit = rec(s.uoms, x => x.name === 'Unit(s)');
    expect(archiveBlocker('uoms', unit, s, tr)).toContain('product.block.uomProducts');
    const weight = rec(s.uom_categories, x => x.name === 'Weight');
    expect(archiveBlocker('uomCategories', weight, s, tr)).toContain('product.block.ucUnits');
    const stocked = rec(s.products, x => x.qty_available !== '0.0000');
    expect(deleteBlocker('products', stocked, s, tr)).toContain('product.block.prodStock');
  });

  it('lets an unreferenced record go', () => {
    const empty = { id: 99, name: 'Empty', parent_id: null, active: true } as Rec;
    expect(archiveBlocker('categories', empty, s, tr)).toBeNull();
    expect(deleteBlocker('categories', empty, s, tr)).toBeNull();
    expect(deleteBlocker('products', { id: 99, active: true, qty_available: '0.0000' }, s, tr)).toBeNull();
  });
});

describe('list configs', () => {
  it('every list column and filter renders for every seeded record', () => {
    for (const cfg of ENTITIES) {
      const rows = (cfg.key === 'uomCategories' ? s.uom_categories : s[cfg.key]) as unknown as Rec[];
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        for (const c of cfg.columns) expect(c.cell(r, ctx).kind).toBeTruthy();
        expect(cfg.nameOf(r, ctx)).toBeTruthy();
        expect(cfg.searchText(r, ctx)).toBeTruthy();
        cfg.stats?.(r, ctx); cfg.badges?.(r, ctx);
      }
      for (const f of cfg.filters) expect(f.options(ctx).length).toBeGreaterThan(0);
    }
  });

  it('filters products by category including sub-categories, and by tracking', () => {
    const f = (k: string) => ENTITY_BY_KEY.products.filters.find(x => x.key === k)!;
    const pipes = rec(s.categories, x => x.name === 'Hoses & Pipes');
    const hit = s.products.filter(p => f('categ_id').match(p as unknown as Rec, String(pipes.id), ctx));
    expect(hit.length).toBeGreaterThan(s.products.filter(p => p.categ_id === pipes.id).length);
    expect(s.products.filter(p => f('tracking').match(p as unknown as Rec, 'serial', ctx)).every(p => p.tracking === 'serial')).toBe(true);
  });
});
