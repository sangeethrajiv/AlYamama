/* eslint-disable @typescript-eslint/no-explicit-any -- specs address records by Odoo field name */
import type { ProductState } from '@erp/shared/contracts';
import { seedProducts } from '@erp/web/api-client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ENTITIES, ENTITY_BY_KEY, ENTITY_BY_ROUTE } from './product-entities';
import { archiveBlocker, deleteBlocker } from './product-rules';
import type { Ctx, Rec, Tr } from './product-types';
import { buildView, fromForm, toForm } from './product-view';

const tr: Tr = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);
const s = seedProducts() as unknown as ProductState;
const ctx: Ctx = { s, tr, debug: false };
const debugCtx: Ctx = { s, tr, debug: true };
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
    // Active is the UI-only archive flag (header actions), `factor` is the stored ratio: both stay on the record, off the form.
    const category = Object.keys(s.categories[0]).filter(k => k !== 'id');
    expect(category.filter(k => !keys('categories').includes(k))).toEqual(['active']);
    const uom = Object.keys(s.uoms[0]).filter(k => k !== 'id');
    expect(uom.filter(k => !keys('uoms').includes(k))).toEqual(['factor']);
    const uomCategory = Object.keys(s.uom_categories[0]).filter(k => k !== 'id');
    expect(uomCategory.filter(k => !keys('uomCategories').includes(k))).toEqual(['active']);
  });

  it('offers exactly the approved Odoo fields, with their Odoo technical names, in form order', () => {
    // detail-only fields (e.g. the read-only Ratio) never reach the form
    const keys = (k: keyof typeof ENTITY_BY_KEY) => ENTITY_BY_KEY[k].sections.map(sec => sec.fields.filter(f => !f.detailOnly).map(f => f.key));
    expect(keys('categories')).toEqual([
      ['name', 'arabic_name', 'parent_id', 'lot_sequence_id'],
      ['removal_strategy_id'],
      ['property_cost_method', 'property_valuation'],
      ['property_account_creditor_price_difference_categ', 'property_account_income_categ_id', 'property_account_expense_categ_id'],
      ['property_stock_account_input_categ_id', 'property_stock_account_output_categ_id', 'property_stock_valuation_account_id', 'property_stock_journal'],
    ]);
    expect(keys('uoms')).toEqual([['view_name', 'name', 'category_id', 'uom_type', 'active', 'rounding']]);
    expect(keys('uomCategories')).toEqual([['name', 'measure_type', 'is_pos_groupable']]);
    // fields deliberately left out of the forms
    const all = ENTITIES.flatMap(e => e.sections.flatMap(sec => sec.fields.filter(f => !f.detailOnly).map(f => f.key)));
    for (const gone of ['sequence_code', 'sequence_id', 'route_ids', 'total_route_ids', 'complete_name', 'child_id', 'product_count', 'factor', 'factor_inv', 'timesheet_widget']) expect(all).not.toContain(gone);
    expect(ENTITY_BY_KEY.uoms.sections[0].fields.map(f => f.key)).not.toContain('measure_type');
  });

  it('presents the three Odoo models as plain lists and read-only sheets with the reference columns', () => {
    expect(ENTITIES.filter(e => e.odooView).map(e => e.key)).toEqual(['categories', 'uoms', 'uomCategories']);
    const cols = (k: keyof typeof ENTITY_BY_KEY) => ENTITY_BY_KEY[k].columns.map(c => c.labelKey);
    expect(cols('uoms')).toEqual(['product.f.uoms.name_col', 'product.f.uoms.category_id', 'product.f.uoms.uom_type']);
    expect(cols('uomCategories')).toEqual(['product.f.uomCategories.name_col']);
    expect(cols('categories')).toEqual(['product.f.categories.name_col']);
    const en = JSON.parse(readFileSync(resolve(__dirname, '../i18n/en.json'), 'utf8')).product.f;
    expect([en.uoms.name_col, en.uoms.category_id, en.uoms.uom_type, en.uomCategories.name_col, en.categories.name_col])
      .toEqual(['Unit of Measure', 'Category', 'Type', 'Unit of Measure Category', 'Product Category']);
    // the list cells are plain text, with the complete category name and the full Type label
    const unit = rec(s.uoms, x => x.name === 'Dozen(s)');
    expect(ENTITY_BY_KEY.uoms.columns.map(c => c.cell(unit, ctx))).toEqual([
      { kind: 'text', text: 'Dozen(s)' }, { kind: 'text', text: 'Unit' }, { kind: 'text', text: 'product.o.uomType.bigger' },
    ]);
    const hoses = rec(s.categories, x => x.name === 'Hydraulic Hoses');
    expect(ENTITY_BY_KEY.categories.columns[0].cell(hoses, ctx)).toEqual({ kind: 'text', text: 'All / Hoses & Pipes / Hydraulic Hoses' });
  });

  it('shows a category on its detail page as title + Parent Category / Sequence for Lot, then the stacked and side-by-side groups', () => {
    const cfg = ENTITY_BY_KEY.categories;
    const pumps = rec(s.categories, x => x.name === 'Pumps & Motors');
    expect(cfg.detailTitle!(pumps, ctx)).toEqual({ text: 'Pumps & Motors', secondary: 'مضخات ومحركات' });
    // the name rows move into the title; every other row stays
    expect(cfg.sections.flatMap(sec => sec.fields).filter(f => f.detailHidden).map(f => f.key)).toEqual(['name', 'arabic_name']);
    expect(cfg.sections[0].detail).toEqual({ title: false, columns: 1 });
    // detail: Logistics and Inventory Valuation stacked, the two account groups side by side (the form keeps Logistics | Valuation)
    expect(cfg.sections.map(sec => sec.detail?.half ?? sec.half)).toEqual([undefined, false, false, true, true]);
    expect(cfg.sections.map(sec => !!sec.half)).toEqual([false, true, true, true, true]);
  });

  it('shows the ratio on the unit detail only for bigger and smaller units, with the Odoo hint', () => {
    const ratio = ENTITY_BY_KEY.uoms.sections[0].fields.find(f => f.key === 'ratio')!;
    expect(ratio).toMatchObject({ kind: 'readonly', detailOnly: true, hideEmpty: true });
    const dozen = rec(s.uoms, x => x.name === 'Dozen(s)'), gram = rec(s.uoms, x => x.name === 'g'), kg = rec(s.uoms, x => x.name === 'kg');
    expect(ratio.get!(dozen, ctx)).toBe('12.00000');
    expect(ratio.get!(gram, ctx)).toBe('1000.00000');
    expect(ratio.get!(kg, ctx)).toBe('');
    expect(ratio.detailHint!(dozen, ctx)).toBe('product.h.uoms.ratioBigger');
    expect(ratio.detailHint!(gram, ctx)).toBe('product.h.uoms.ratioSmaller');
    // not a form control: no input for it in create or edit mode
    for (const mode of ['create', 'edit'] as const) expect(buildView(ENTITY_BY_KEY.uoms, mode, () => ctx).sections.flatMap(x => x.fields.map(f => f.key))).not.toContain('ratio');
  });

  it('labels the category and unit fields with the Odoo strings', () => {
    const label = (e: keyof typeof ENTITY_BY_KEY, k: string) => ENTITY_BY_KEY[e].sections.flatMap(sec => sec.fields).find(f => f.key === k)!.labelKey;
    expect(label('categories', 'name')).toBe('product.f.categories.name');
    expect(label('uoms', 'view_name')).toBe('product.f.uoms.view_name');
    const en = JSON.parse(readFileSync(resolve(__dirname, '../i18n/en.json'), 'utf8')).product.f;
    expect(en.categories).toMatchObject({
      name: 'Category name', arabic_name: 'Arabic Name', parent_id: 'Parent Category', lot_sequence_id: 'Sequence for Lot', removal_strategy_id: 'Force Removal Strategy',
      property_cost_method: 'Costing Method', property_valuation: 'Inventory Valuation', property_account_creditor_price_difference_categ: 'Price Difference Account',
      property_account_income_categ_id: 'Income Account', property_account_expense_categ_id: 'Expense Account', property_stock_account_input_categ_id: 'Stock Input Account',
      property_stock_account_output_categ_id: 'Stock Output Account', property_stock_valuation_account_id: 'Stock Valuation Account', property_stock_journal: 'Stock Journal',
    });
    expect(en.uoms).toMatchObject({ view_name: 'Display Name', name: 'Unit of Measure', category_id: 'Category', uom_type: 'Type', rounding: 'Rounding Precision' });
    expect(en.uomCategories).toMatchObject({ name: 'Unit of Measure Category', measure_type: 'Type of Measure', is_pos_groupable: 'Group Products in POS' });
    expect(JSON.parse(readFileSync(resolve(__dirname, '../i18n/en.json'), 'utf8')).product.o).toMatchObject({
      cost: { standard: 'Standard Price', fifo: 'First In First Out (FIFO)', average: 'Average Cost (AVCO)' },
      valuation: { manual_periodic: 'Manual', real_time: 'Automated' },
      uomType: { bigger: 'Bigger than the reference Unit of Measure', reference: 'Reference Unit of Measure for this category', smaller: 'Smaller than the reference Unit of Measure' },
      measure: { unit: 'Units', weight: 'Weight', time: 'Time', length: 'Length', volume: 'Volume' },
    });
  });

  it('keeps stock quantities read-only (detail only) and tracking locked for non-storable products', () => {
    const fields = ENTITY_BY_KEY.products.sections.flatMap(sec => sec.fields);
    expect(fields.find(f => f.key === 'qty_available')).toMatchObject({ kind: 'readonly', detailOnly: true });
    expect(fields.find(f => f.key === 'virtual_available')).toMatchObject({ kind: 'readonly', detailOnly: true });
    expect(fields.find(f => f.key === 'taxes_id')).toMatchObject({ kind: 'relation', rel: 'taxes' });
    expect(ENTITY_BY_KEY.products.finalize?.({ type: 'service', tracking: 'lot' })).toMatchObject({ tracking: 'none' });
    expect(ENTITY_BY_KEY.products.finalize?.({ type: 'product', tracking: 'lot' })).toMatchObject({ tracking: 'lot' });
    expect(fields.find(f => f.key === 'company_id')).toMatchObject({ kind: 'relation', rel: 'companies' });
    expect(fields.find(f => f.key === 'internal_type')?.options?.map(o => o.value)).toEqual(['material', 'labour', 'overhead']);
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

  it('enforces one reference unit per UoM category, a positive rounding and unique unit names', () => {
    const u = ENTITY_BY_KEY.uoms;
    const weight = rec(s.uom_categories, x => x.name === 'Weight'), area = rec(s.uom_categories, x => x.name === 'Area');
    expect(u.validate!({ name: 'stone', category_id: weight.id, uom_type: 'reference', rounding: '0.01' }, ctx)['uom_type']).toBeTruthy();
    expect(u.validate!({ name: 'ha', category_id: area.id, uom_type: 'bigger', rounding: '0' }, ctx)).toEqual({ rounding: expect.any(String) });
    expect(u.validate!({ name: 'G', category_id: weight.id, uom_type: 'smaller', rounding: '0.01' }, ctx)['name']).toBeTruthy();
    expect(u.validate!({ name: 'ha', category_id: area.id, uom_type: 'bigger', rounding: '0.01' }, ctx)).toEqual({});
  });

  it('keeps the stored ratio when a unit is saved from the form (the form has no ratio field)', () => {
    const u = ENTITY_BY_KEY.uoms;
    const dozen = rec(s.uoms, x => x.name === 'Dozen(s)');
    const saved = fromForm(u, toForm(u, dozen, ctx));
    expect(saved).not.toHaveProperty('factor_inv');
    expect(u.finalize).toBeUndefined();
    expect(u.defaults(s)).toMatchObject({ uom_type: 'reference', rounding: '0.01', active: true, factor: '1' });
  });

  it('allows one UoM category per measure type, but several with no type', () => {
    const c = ENTITY_BY_KEY.uomCategories;
    const weight = rec(s.uom_categories, x => x.name === 'Weight');
    expect(c.validate!({ name: 'Mass', measure_type: 'weight' }, ctx)['measure_type']).toBe('product.v.ucUniqueType');
    expect(c.validate!({ name: 'Weight', measure_type: 'weight' }, ctx, weight.id)).toEqual({});
    expect(c.validate!({ name: 'Density', measure_type: '' }, ctx)).toEqual({});
  });
});

describe('product form view', () => {
  it('builds every category field as a form control; computed fields stay off the form', () => {
    const create = buildView(ENTITY_BY_KEY.categories, 'create', () => ctx);
    const edit = buildView(ENTITY_BY_KEY.categories, 'edit', () => ctx);
    const keys = (v: ReturnType<typeof buildView>) => v.sections.flatMap(x => x.fields.map(f => f.key));
    expect(keys(create)).toEqual(keys(edit));
    expect(keys(create)).toHaveLength(14);
    const product = buildView(ENTITY_BY_KEY.products, 'edit', () => ctx);
    expect(product.sections.flatMap(x => x.fields.map(f => f.key))).not.toContain('qty_available');
  });

  it('lays the category form out as Basic | Logistics + Valuation | Accounts, with the account groups side by side', () => {
    const v = buildView(ENTITY_BY_KEY.categories, 'create', () => ctx);
    expect(v.sections.map(x => x.title)).toEqual(['product.s.catBasic', 'product.s.catLogistics', 'product.s.catValuation', 'product.s.catAccount', 'product.s.catAccountStock']);
    expect(v.sections.map(x => !!x.half)).toEqual([false, true, true, true, true]);
    expect(v.sections.map(x => x.columns)).toEqual([2, 1, 1, 1, 1]);
  });

  it('requires the stock accounts and journal only for automated valuation, and the two selections always', () => {
    const fields = buildView(ENTITY_BY_KEY.categories, 'create', () => ctx).sections.flatMap(x => x.fields);
    const f = (k: string) => fields.find(x => x.key === k)!;
    for (const k of ['property_stock_account_input_categ_id', 'property_stock_account_output_categ_id', 'property_stock_valuation_account_id', 'property_stock_journal']) {
      expect(f(k).requiredWhen?.({ property_valuation: 'real_time' })).toBe(true);
      expect(f(k).requiredWhen?.({ property_valuation: 'manual_periodic' })).toBe(false);
    }
    expect(f('property_cost_method')).toMatchObject({ required: true, type: 'select' });
    expect(f('property_valuation')).toMatchObject({ required: true, type: 'select' });
    expect((f('property_cost_method').options as { value: string }[]).map(o => o.value)).toEqual(['standard', 'fifo', 'average']);
    expect((f('property_valuation').options as { value: string }[]).map(o => o.value)).toEqual(['manual_periodic', 'real_time']);
    expect(ENTITY_BY_KEY.categories.defaults(s)).toMatchObject({ property_cost_method: 'standard', property_valuation: 'manual_periodic' });
  });

  it('offers real accounts for the income/expense fields, without receivable, payable or bank accounts', () => {
    const accounts = ENTITY_BY_KEY.categories.sections[3].fields;
    const income = accounts.find(x => x.key === 'property_account_income_categ_id')!;
    const bank = { id: 1, type: 'Bank and Cash' } as unknown as Rec, sales = { id: 2, type: 'Income' } as unknown as Rec;
    expect(income.domain!(bank, {}, ctx)).toBe(false);
    expect(income.domain!(sales, {}, ctx)).toBe(true);
    const options = buildView(ENTITY_BY_KEY.categories, 'create', () => ctx).sections.flatMap(x => x.fields).find(x => x.key === 'property_account_income_categ_id')!.options as (v: Record<string, unknown>, l: Record<string, never>) => { label: string }[];
    expect(options({}, {}).every(o => !/Bank|Receivable|Payable/.test(o.label))).toBe(true);
  });

  it('arranges a unit of measure in two columns: Display Name, Unit of Measure, Category, Type | Active, Rounding Precision', () => {
    const fields = buildView(ENTITY_BY_KEY.uoms, 'create', () => ctx).sections.flatMap(x => x.fields);
    expect(fields.map(f => [f.key, f.column])).toEqual([['view_name', 1], ['name', 1], ['category_id', 1], ['uom_type', 1], ['active', 2], ['rounding', 2]]);
    expect(fields.find(f => f.key === 'active')?.type).toBe('boolean');
    expect(fields.find(f => f.key === 'rounding')).toMatchObject({ type: 'number', required: true });
    expect(fields.find(f => f.key === 'uom_type')).toMatchObject({ type: 'select', required: true });
  });

  it('hides Group Products in POS unless debug mode is on', () => {
    const field = (c: Ctx) => buildView(ENTITY_BY_KEY.uomCategories, 'create', () => c).sections.flatMap(x => x.fields).find(f => f.key === 'is_pos_groupable')!;
    expect(field(ctx).visible?.({})).toBe(false);
    expect(field(debugCtx).visible?.({})).toBe(true);
    expect(field(ctx).type).toBe('boolean');
    // the Time category is protected from deletion
    const time = rec(s.uom_categories, x => x.measure_type === 'time');
    expect(deleteBlocker('uomCategories', time, s, tr)).toBe('product.block.ucTime');
  });

  it('has no Products stat button on the category (the generic stat-button support stays unused)', () => {
    expect(ENTITIES.filter(e => e.smartButton)).toEqual([]);
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
