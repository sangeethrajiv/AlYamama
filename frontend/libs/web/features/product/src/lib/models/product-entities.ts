import type { ProductEntityKey, ProductState } from '@erp/shared/contracts';
import { dec, div } from '@erp/shared/utils';
import { INTERNAL_TYPE_OPTIONS, MEASURE_TYPE_OPTIONS, PRODUCT_TYPE_OPTIONS, TRACKING_OPTIONS, UOM_TYPE_OPTIONS, YES_NO, optLabel } from './product-options';
import { byId, categoryName, countProducts, descendantsOf, fmtMoney, fmtNum, relLabel, trimZeros, uomRatio } from './product-helpers';
import type { Cell, Choice, ColumnSpec, Ctx, EntityConfig, FieldSpec, PillTone, Rec } from './product-types';

// ---------------------------------------------------------------- helpers
const lc = (v: unknown) => String(v ?? '').trim().toLowerCase();
const num = (v: unknown) => Number(v) || 0;
const other = <T extends { id: number }>(list: T[], id?: number) => list.filter(r => r.id !== id);
const dash: Cell = { kind: 'dash' };
const mono = (t: string): Cell => (t ? { kind: 'mono', text: t } : dash);
const f = (e: ProductEntityKey, k: string) => `product.f.${e}.${k}`;
const h = (e: ProductEntityKey, k: string) => `product.h.${e}.${k}`;
const fl = (e: ProductEntityKey, k: string) => `product.fl.${e}.${k}`;
const idOf = (v: string) => Number(v);
const choices = (opts: { value: string; labelKey: string }[], c: Ctx): Choice[] => opts.map(o => ({ value: o.value, label: c.tr(o.labelKey) }));
const catChoices = (c: Ctx): Choice[] => c.s.categories.map(x => ({ value: String(x.id), label: categoryName(c.s, x.id) })).sort((a, b) => a.label.localeCompare(b.label));
const TYPE_TONE: Record<string, PillTone> = { product: 'green', consu: 'amber', service: 'blue' };
const activeField = (e: ProductEntityKey, helpKey: string): FieldSpec => ({ key: 'active', labelKey: 'product.f.active', kind: 'boolean', helpKey });

// ---------------------------------------------------------------- Products (product.template)
const productColumns: ColumnSpec[] = [
  { key: 'name', labelKey: f('products', 'name_col'), primary: true, sort: r => lc(r['name']), cell: r => ({ kind: 'name', text: r['name'], sub: r['arabic_name'] || undefined }) },
  { key: 'default_code', labelKey: f('products', 'default_code_col'), sort: r => lc(r['default_code']), cell: r => mono(r['default_code']) },
  { key: 'categ_id', labelKey: f('products', 'categ_id_col'), hide: 'md', wrap: true, sort: (r, c) => lc(relLabel(c.s, 'categories', r['categ_id'])), cell: (r, c) => ({ kind: 'text', text: relLabel(c.s, 'categories', r['categ_id']).replace(/^All \/ /, '') }) },
  { key: 'type', labelKey: f('products', 'type_col'), sort: r => r['type'], cell: (r, c) => ({ kind: 'pill', text: c.tr(`product.o.typeShort.${r['type']}`), tone: TYPE_TONE[r['type']] ?? 'slate' }) },
  { key: 'uom_id', labelKey: f('products', 'uom_id_col'), hide: '2xl', sort: (r, c) => lc(relLabel(c.s, 'uoms', r['uom_id'])), cell: (r, c) => ({ kind: 'text', text: relLabel(c.s, 'uoms', r['uom_id']) }) },
  { key: 'list_price', labelKey: f('products', 'list_price_col'), right: true, sort: r => num(r['list_price']), cell: r => ({ kind: 'text', text: fmtMoney(r['list_price']) }) },
  { key: 'standard_price', labelKey: f('products', 'standard_price_col'), right: true, hide: '2xl', sort: r => num(r['standard_price']), cell: r => ({ kind: 'text', text: fmtMoney(r['standard_price']) }) },
  { key: 'qty_available', labelKey: f('products', 'qty_available_col'), right: true, hide: 'sm', sort: r => num(r['qty_available']), cell: r => (r['type'] !== 'product' ? dash : { kind: 'text', text: fmtNum(r['qty_available']), danger: num(r['qty_available']) <= 0 }) },
];

const products: EntityConfig = {
  key: 'products', route: 'products', model: 'product.template', icon: 'package',
  nameOf: r => r['name'],
  searchText: (r, c) => [r['name'], r['arabic_name'], r['default_code'], r['barcode'], r['internal_short_code'], relLabel(c.s, 'categories', r['categ_id'])].join(' '),
  defaultSort: { key: 'name', dir: 'asc' },
  columns: productColumns,
  filters: [
    { key: 'type', labelKey: fl('products', 'type'), options: c => choices(PRODUCT_TYPE_OPTIONS, c), match: (r, v) => r['type'] === v },
    { key: 'categ_id', labelKey: fl('products', 'categ_id'), options: catChoices, match: (r, v, c) => r['categ_id'] === idOf(v) || descendantsOf(c.s.categories, idOf(v), 'parent_id').some(x => x.id === r['categ_id']) },
    { key: 'tracking', labelKey: fl('products', 'tracking'), options: c => choices(TRACKING_OPTIONS, c), match: (r, v) => r['tracking'] === v },
    { key: 'internal_type', labelKey: fl('products', 'internal_type'), options: c => choices(INTERNAL_TYPE_OPTIONS, c), match: (r, v) => r['internal_type'] === v },
    { key: 'sale_ok', labelKey: fl('products', 'sale_ok'), options: c => choices(YES_NO, c), match: (r, v) => r['sale_ok'] === (v === 'yes') },
    { key: 'purchase_ok', labelKey: fl('products', 'purchase_ok'), options: c => choices(YES_NO, c), match: (r, v) => r['purchase_ok'] === (v === 'yes') },
    { key: 'company_id', labelKey: fl('products', 'company_id'), options: c => c.s.companies.map(x => ({ value: String(x.id), label: x.name })), match: (r, v) => r['company_id'] === idOf(v) },
    { key: 'responsible_id', labelKey: fl('products', 'responsible_id'), options: c => c.s.users.map(x => ({ value: String(x.id), label: x.name })), match: (r, v) => r['responsible_id'] === idOf(v) },
  ],
  badges: (r, c) => [{ text: optLabel(PRODUCT_TYPE_OPTIONS, r['type'], c.tr), tone: TYPE_TONE[r['type']] ?? 'slate' }, ...(r['default_code'] ? [{ text: r['default_code'], tone: 'slate' as const }] : [])],
  stats: (r, c) => [
    { labelKey: 'product.stat.salesPrice', value: fmtMoney(r['list_price']), hint: c.tr(r['sale_ok'] ? 'product.stat.canSell' : 'product.stat.notForSale') },
    { labelKey: 'product.stat.cost', value: fmtMoney(r['standard_price']), hint: c.tr('product.stat.margin', { n: fmtNum(r['margin_perc']) }) },
    { labelKey: 'product.stat.onHand', value: r['type'] === 'product' ? fmtNum(r['qty_available']) : '—', hint: c.tr(r['type'] === 'product' ? 'product.stat.fromMoves' : 'product.stat.notStock') },
    { labelKey: 'product.stat.forecast', value: r['type'] === 'product' ? fmtNum(r['virtual_available']) : '—', hint: r['type'] === 'product' ? c.tr('product.stat.forecastHint') : undefined },
  ],
  sections: [
    {
      titleKey: 'product.s.general',
      fields: [
        { key: 'name', labelKey: f('products', 'name'), kind: 'text', required: true, span: 2, placeholderKey: 'product.ph.productName', maxLength: 255 },
        { key: 'default_code', labelKey: f('products', 'default_code'), kind: 'text', mono: true, placeholderKey: 'product.ph.reference', maxLength: 64 },
        { key: 'barcode', labelKey: f('products', 'barcode'), kind: 'text', mono: true, maxLength: 64 },
        { key: 'arabic_name', labelKey: f('products', 'arabic_name'), kind: 'text', rtl: true, placeholderKey: 'product.ph.arabicName', maxLength: 255 },
        { key: 'internal_short_code', labelKey: f('products', 'internal_short_code'), kind: 'text', mono: true, maxLength: 32 },
        { key: 'type', labelKey: f('products', 'type'), kind: 'select', required: true, options: PRODUCT_TYPE_OPTIONS, helpKey: h('products', 'type'), onChange: v => (v === 'product' ? {} : { tracking: 'none' }) },
        { key: 'categ_id', labelKey: f('products', 'categ_id'), kind: 'relation', rel: 'categories', required: true },
        { key: 'internal_type', labelKey: f('products', 'internal_type'), kind: 'select', options: INTERNAL_TYPE_OPTIONS },
        { key: 'company_id', labelKey: f('products', 'company_id'), kind: 'relation', rel: 'companies' },
        { key: 'responsible_id', labelKey: f('products', 'responsible_id'), kind: 'relation', rel: 'users' },
        activeField('products', h('products', 'active')),
      ],
    },
    {
      titleKey: 'product.s.units',
      fields: [
        {
          key: 'uom_id', labelKey: f('products', 'uom_id'), kind: 'relation', rel: 'uoms', required: true, helpKey: h('products', 'uom_id'),
          onChange: (v, next, c) => {
            const base = byId(c.s.uoms, v), po = byId(c.s.uoms, next['uom_po_id']);
            return !po || !base || po.category_id !== base.category_id ? { uom_po_id: v } : {};
          },
        },
        {
          key: 'uom_po_id', labelKey: f('products', 'uom_po_id'), kind: 'relation', rel: 'uoms', required: true, helpKey: h('products', 'uom_po_id'),
          domain: (r, v, c) => { const base = byId(c.s.uoms, v['uom_id']); return !base || r['category_id'] === base.category_id; },
        },
        { key: 'tracking', labelKey: f('products', 'tracking'), kind: 'select', required: true, options: TRACKING_OPTIONS, readonlyWhen: v => v['type'] !== 'product', helpKey: h('products', 'tracking') },
        { key: 'weight', labelKey: f('products', 'weight'), kind: 'number', min: 0, suffix: 'kg', places: 4 },
        { key: 'volume', labelKey: f('products', 'volume'), kind: 'number', min: 0, suffix: 'm³', places: 4 },
        { key: 'qty_available', labelKey: f('products', 'qty_available'), kind: 'readonly', detailOnly: true, get: r => (r['type'] === 'product' ? fmtNum(r['qty_available']) : '—') },
        { key: 'virtual_available', labelKey: f('products', 'virtual_available'), kind: 'readonly', detailOnly: true, get: r => (r['type'] === 'product' ? fmtNum(r['virtual_available']) : '—') },
      ],
    },
    {
      titleKey: 'product.s.sales',
      fields: [
        { key: 'sale_ok', labelKey: f('products', 'sale_ok'), kind: 'boolean' },
        { key: 'purchase_ok', labelKey: f('products', 'purchase_ok'), kind: 'boolean' },
        { key: 'no_discount', labelKey: f('products', 'no_discount'), kind: 'boolean', helpKey: h('products', 'no_discount') },
        { key: 'list_price', labelKey: f('products', 'list_price'), kind: 'number', min: 0, suffix: 'SAR', required: true, places: 2 },
        { key: 'standard_price', labelKey: f('products', 'standard_price'), kind: 'number', min: 0, suffix: 'SAR', places: 2 },
        { key: 'margin_perc', labelKey: f('products', 'margin_perc'), kind: 'number', min: 0, max: 100, suffix: '%', places: 2 },
      ],
    },
    {
      titleKey: 'product.s.notes',
      fields: [
        { key: 'description_sale', labelKey: f('products', 'description_sale'), kind: 'textarea', span: 2, hideEmpty: true },
        { key: 'description_purchase', labelKey: f('products', 'description_purchase'), kind: 'textarea', span: 2, hideEmpty: true },
      ],
    },
  ],
  defaults: (s: ProductState) => ({
    name: '', default_code: '', barcode: '', type: 'product', categ_id: null, uom_id: byId(s.uoms, 1)?.id ?? null, uom_po_id: byId(s.uoms, 1)?.id ?? null,
    tracking: 'none', active: true, company_id: s.companies[1]?.id ?? null, sale_ok: true, purchase_ok: true, list_price: '0.00', standard_price: '0.00',
    weight: '0.0000', volume: '0.0000', responsible_id: null, description_sale: '', description_purchase: '', arabic_name: '', internal_short_code: '',
    internal_type: 'material', margin_perc: '0.00', no_discount: false, qty_available: '0.0000', virtual_available: '0.0000',
  }),
  validate: (v, c, id) => {
    const e: Record<string, string> = {};
    const { s, tr } = c;
    if (v['default_code'] && other(s.products, id).some(p => lc(p.default_code) === lc(v['default_code']))) e['default_code'] = tr('product.v.dupReference');
    if (v['barcode'] && other(s.products, id).some(p => lc(p.barcode) === lc(v['barcode']))) e['barcode'] = tr('product.v.dupBarcode');
    const u = byId(s.uoms, v['uom_id']), po = byId(s.uoms, v['uom_po_id']);
    if (u && po && u.category_id !== po.category_id) e['uom_po_id'] = tr('product.v.uomCategory');
    if (v['tracking'] !== 'none' && v['type'] !== 'product') e['tracking'] = tr('product.v.trackStorable');
    return e;
  },
  related: [],
};

// ---------------------------------------------------------------- Product categories (product.category)
const categories: EntityConfig = {
  key: 'categories', route: 'categories', model: 'product.category', icon: 'tags', uiOnlyActive: true,
  nameOf: (r, c) => categoryName(c.s, r.id),
  searchText: (r, c) => [categoryName(c.s, r.id), r['arabic_name'], r['sequence_code']].join(' '),
  defaultSort: { key: 'name', dir: 'asc' },
  columns: [
    { key: 'name', labelKey: f('categories', 'name_col'), primary: true, sort: (r, c) => lc(categoryName(c.s, r.id)), cell: (r, c) => ({ kind: 'text', text: categoryName(c.s, r.id) }) },
    { key: 'arabic_name', labelKey: f('categories', 'arabic_name'), hide: 'sm', sort: r => r['arabic_name'], cell: r => (r['arabic_name'] ? { kind: 'rtl', text: r['arabic_name'] } : dash) },
    { key: 'sequence_code', labelKey: f('categories', 'sequence_code'), hide: 'md', sort: r => lc(r['sequence_code']), cell: r => mono(r['sequence_code']) },
    { key: 'parent_id', labelKey: f('categories', 'parent_id_col'), hide: 'lg', sort: (r, c) => lc(relLabel(c.s, 'categories', r['parent_id'])), cell: (r, c) => (r['parent_id'] == null ? { kind: 'pill', text: c.tr('product.root'), tone: 'slate' } : { kind: 'text', text: relLabel(c.s, 'categories', r['parent_id']) }) },
    { key: 'child_id', labelKey: f('categories', 'child_id'), right: true, hide: 'xl', sort: (r, c) => c.s.categories.filter(x => x.parent_id === r.id).length, cell: (r, c) => ({ kind: 'text', text: String(c.s.categories.filter(x => x.parent_id === r.id).length) }) },
    { key: 'product_count', labelKey: f('categories', 'product_count_col'), right: true, sort: (r, c) => countProducts(c.s, r.id), cell: (r, c) => ({ kind: 'text', text: String(countProducts(c.s, r.id)) }) },
  ],
  filters: [
    { key: 'parent', labelKey: fl('categories', 'parent'), options: c => [{ value: 'root', label: c.tr('product.o.rootOnly') }, ...catChoices(c)], match: (r, v) => (v === 'root' ? r['parent_id'] == null : r['parent_id'] === idOf(v)) },
    { key: 'has_products', labelKey: fl('categories', 'has_products'), options: c => [{ value: 'yes', label: c.tr('product.o.withProducts') }, { value: 'no', label: c.tr('product.o.withoutProducts') }], match: (r, v, c) => (countProducts(c.s, r.id) > 0) === (v === 'yes') },
  ],
  stats: (r, c) => [
    { labelKey: 'product.stat.productsDirect', value: String(c.s.products.filter(p => p.categ_id === r.id).length) },
    { labelKey: 'product.stat.productsAll', value: String(countProducts(c.s, r.id)) },
    { labelKey: 'product.stat.subCategories', value: String(c.s.categories.filter(x => x.parent_id === r.id).length) },
  ],
  sections: [
    {
      titleKey: 'product.s.general',
      fields: [
        { key: 'name', labelKey: f('categories', 'name'), kind: 'text', required: true, maxLength: 128 },
        { key: 'parent_id', labelKey: f('categories', 'parent_id'), kind: 'relation', rel: 'categories' },
        { key: 'arabic_name', labelKey: f('categories', 'arabic_name'), kind: 'text', rtl: true, maxLength: 128 },
        { key: 'sequence_code', labelKey: f('categories', 'sequence_code'), kind: 'text', mono: true, maxLength: 16 },
        { key: 'complete_name', labelKey: f('categories', 'complete_name'), kind: 'readonly', get: (r, c) => categoryName(c.s, r.id) },
        { key: 'product_count', labelKey: f('categories', 'product_count'), kind: 'readonly', get: (r, c) => String(countProducts(c.s, r.id)) },
        activeField('categories', h('categories', 'active')),
      ],
    },
  ],
  defaults: () => ({ name: '', parent_id: null, arabic_name: '', sequence_code: '', active: true }),
  validate: (v, c, id) => {
    const e: Record<string, string> = {};
    if (id != null && v['parent_id'] != null && (v['parent_id'] === id || descendantsOf(c.s.categories, id, 'parent_id').some(x => x.id === v['parent_id']))) e['parent_id'] = c.tr('product.v.catCycle');
    if (other(c.s.categories, id).some(x => (x.parent_id ?? null) === (v['parent_id'] ?? null) && lc(x.name) === lc(v['name']))) e['name'] = c.tr('product.v.catDup');
    return e;
  },
  related: [
    { titleKey: 'product.rel.products', entity: 'products', items: (r, c) => c.s.products.filter(p => p.categ_id === r.id) as unknown as Rec[], meta: p => p['default_code'] },
    { titleKey: 'product.rel.subCategories', entity: 'categories', items: (r, c) => c.s.categories.filter(x => x.parent_id === r.id) as unknown as Rec[], meta: x => x['arabic_name'] },
  ],
};

// ---------------------------------------------------------------- UoM categories (uom.category)
const uomCategories: EntityConfig = {
  key: 'uomCategories', route: 'uom-categories', model: 'uom.category', icon: 'tags', uiOnlyActive: true,
  nameOf: r => r['name'],
  searchText: (r, c) => `${r['name']} ${optLabel(MEASURE_TYPE_OPTIONS, r['measure_type'], c.tr)}`,
  defaultSort: { key: 'name', dir: 'asc' },
  columns: [
    { key: 'name', labelKey: f('uomCategories', 'name_col'), primary: true, sort: r => lc(r['name']), cell: r => ({ kind: 'text', text: r['name'] }) },
    { key: 'measure_type', labelKey: f('uomCategories', 'measure_type'), sort: r => r['measure_type'], cell: (r, c) => (r['measure_type'] ? { kind: 'pill', text: optLabel(MEASURE_TYPE_OPTIONS, r['measure_type'], c.tr), tone: 'blue' } : dash) },
    { key: 'reference', labelKey: f('uomCategories', 'reference'), hide: 'sm', cell: (r, c) => { const u = c.s.uoms.find(x => x.category_id === r.id && x.uom_type === 'reference' && x.active); return u ? { kind: 'text', text: u.name } : dash; } },
    { key: 'uoms', labelKey: f('uomCategories', 'uoms'), right: true, sort: (r, c) => c.s.uoms.filter(u => u.category_id === r.id).length, cell: (r, c) => ({ kind: 'text', text: String(c.s.uoms.filter(u => u.category_id === r.id).length) }) },
  ],
  filters: [{ key: 'measure_type', labelKey: fl('uomCategories', 'measure_type'), options: c => choices(MEASURE_TYPE_OPTIONS, c), match: (r, v) => r['measure_type'] === v }],
  stats: (r, c) => [
    { labelKey: 'product.stat.units', value: String(c.s.uoms.filter(u => u.category_id === r.id).length) },
    { labelKey: 'product.stat.referenceUnit', value: c.s.uoms.find(u => u.category_id === r.id && u.uom_type === 'reference')?.name ?? '—' },
  ],
  sections: [
    {
      titleKey: 'product.s.general',
      fields: [
        { key: 'name', labelKey: f('uomCategories', 'name'), kind: 'text', required: true, maxLength: 128 },
        { key: 'measure_type', labelKey: f('uomCategories', 'measure_type'), kind: 'select', options: MEASURE_TYPE_OPTIONS },
        activeField('uomCategories', h('uomCategories', 'active')),
      ],
    },
  ],
  defaults: () => ({ name: '', measure_type: '', active: true }),
  validate: (v, c, id) => {
    const e: Record<string, string> = {};
    if (other(c.s.uom_categories, id).some(x => lc(x.name) === lc(v['name']))) e['name'] = c.tr('product.v.ucDup');
    return e;
  },
  related: [{ titleKey: 'product.rel.uoms', entity: 'uoms', items: (r, c) => c.s.uoms.filter(u => u.category_id === r.id) as unknown as Rec[], meta: (u, c) => optLabel(UOM_TYPE_OPTIONS, u['uom_type'], c.tr) }],
};

// ---------------------------------------------------------------- Units of measure (uom.uom)
const uoms: EntityConfig = {
  key: 'uoms', route: 'uom', model: 'uom.uom', icon: 'layers',
  nameOf: r => r['name'],
  searchText: (r, c) => [r['name'], r['view_name'], relLabel(c.s, 'uomCategories', r['category_id'])].join(' '),
  defaultSort: { key: 'category_id', dir: 'asc' },
  columns: [
    { key: 'name', labelKey: f('uoms', 'name_col'), primary: true, sort: r => lc(r['name']), cell: r => ({ kind: 'text', text: r['name'] }) },
    { key: 'category_id', labelKey: f('uoms', 'category_id'), sort: (r, c) => lc(relLabel(c.s, 'uomCategories', r['category_id'])), cell: (r, c) => ({ kind: 'text', text: relLabel(c.s, 'uomCategories', r['category_id']) }) },
    { key: 'uom_type', labelKey: f('uoms', 'uom_type'), hide: 'sm', sort: r => r['uom_type'], cell: (r, c) => ({ kind: 'pill', text: c.tr(`product.o.uomTypeShort.${r['uom_type']}`), tone: r['uom_type'] === 'reference' ? 'green' : r['uom_type'] === 'bigger' ? 'blue' : 'amber' }) },
    {
      key: 'ratio', labelKey: f('uoms', 'ratio_col'), right: true, hide: 'lg', sort: r => num(uomRatio(r as never)),
      cell: (r, c) => {
        if (r['uom_type'] === 'reference') return dash;
        const ref = c.s.uoms.find(u => u.category_id === r['category_id'] && u.uom_type === 'reference')?.name ?? '';
        const ratio = fmtNum(uomRatio(r as never), 6);
        return { kind: 'text', text: r['uom_type'] === 'bigger' ? `1 ${r['name']} = ${ratio} ${ref}` : `1 ${ref} = ${ratio} ${r['name']}` };
      },
    },
    { key: 'rounding', labelKey: f('uoms', 'rounding_col'), right: true, hide: '2xl', sort: r => num(r['rounding']), cell: r => ({ kind: 'text', text: fmtNum(r['rounding'], 6) }) },
    { key: 'view_name', labelKey: f('uoms', 'view_name'), hide: '2xl', sort: r => lc(r['view_name']), cell: r => (r['view_name'] ? { kind: 'text', text: r['view_name'] } : dash) },
    { key: 'used', labelKey: f('uoms', 'used'), right: true, hide: '2xl', sort: (r, c) => c.s.products.filter(p => p.uom_id === r.id).length, cell: (r, c) => ({ kind: 'text', text: String(c.s.products.filter(p => p.uom_id === r.id).length) }) },
  ],
  filters: [
    { key: 'category_id', labelKey: fl('uoms', 'category_id'), options: c => c.s.uom_categories.map(x => ({ value: String(x.id), label: x.name })), match: (r, v) => r['category_id'] === idOf(v) },
    { key: 'uom_type', labelKey: fl('uoms', 'uom_type'), options: c => ['reference', 'bigger', 'smaller'].map(t => ({ value: t, label: c.tr(`product.o.uomTypeFilter.${t}`) })), match: (r, v) => r['uom_type'] === v },
  ],
  stats: (r, c) => [
    { labelKey: 'product.stat.category', value: relLabel(c.s, 'uomCategories', r['category_id']) },
    { labelKey: 'product.stat.type', value: c.tr(`product.o.uomTypeShort.${r['uom_type']}`) },
    { labelKey: 'product.stat.usedBy', value: String(c.s.products.filter(p => p.uom_id === r.id || p.uom_po_id === r.id).length) },
  ],
  sections: [
    {
      titleKey: 'product.s.general',
      fields: [
        { key: 'name', labelKey: f('uoms', 'name'), kind: 'text', required: true, maxLength: 64 },
        { key: 'category_id', labelKey: f('uoms', 'category_id'), kind: 'relation', rel: 'uomCategories', required: true },
        { key: 'uom_type', labelKey: f('uoms', 'uom_type'), kind: 'select', required: true, options: UOM_TYPE_OPTIONS, span: 2 },
        { key: 'factor', labelKey: f('uoms', 'factor'), kind: 'number', min: 0, places: 8, showWhen: v => v['uom_type'] === 'smaller', helpKey: h('uoms', 'factor') },
        { key: 'factor_inv', labelKey: f('uoms', 'factor_inv'), kind: 'number', min: 0, places: 6, showWhen: v => v['uom_type'] === 'bigger', helpKey: h('uoms', 'factor_inv') },
        { key: 'ratio_ref', labelKey: f('uoms', 'ratio_ref'), kind: 'readonly', detailOnly: true, get: (r, c) => (r['uom_type'] === 'reference' ? c.tr('product.o.oneReference') : fmtNum(uomRatio(r as never), 6)) },
        { key: 'rounding', labelKey: f('uoms', 'rounding'), kind: 'number', min: 0, required: true, places: 6, helpKey: h('uoms', 'rounding') },
        { key: 'view_name', labelKey: f('uoms', 'view_name'), kind: 'text', helpKey: h('uoms', 'view_name'), maxLength: 32 },
        { key: 'measure_type', labelKey: f('uoms', 'measure_type'), kind: 'readonly', get: (r, c) => optLabel(MEASURE_TYPE_OPTIONS, byId(c.s.uom_categories, r['category_id'])?.measure_type, c.tr) || '—' },
        activeField('uoms', h('uoms', 'active')),
      ],
    },
  ],
  defaults: s => ({ name: '', category_id: s.uom_categories[0]?.id ?? null, uom_type: 'reference', factor: '1', rounding: '0.01', view_name: '', active: true }),
  prepare: rec => ({ factor_inv: rec['factor'] ? trimZeros(div('1', rec['factor'], 6)) : '1' }),
  finalize: v => {
    const { factor_inv, ...rest } = v;
    const factor = v['uom_type'] === 'reference' ? dec(1, 8) : v['uom_type'] === 'bigger' ? div('1', dec(factor_inv || '1', 8), 8) : dec(v['factor'], 8);
    return { ...rest, factor };
  },
  validate: (v, c, id) => {
    const e: Record<string, string> = {};
    const { s, tr } = c;
    if (v['uom_type'] === 'smaller' && !(num(v['factor']) > 0)) e['factor'] = tr('product.v.ratioPositive');
    if (v['uom_type'] === 'bigger' && !(num(v['factor_inv']) > 0)) e['factor_inv'] = tr('product.v.biggerPositive');
    if (!(num(v['rounding']) > 0)) e['rounding'] = tr('product.v.roundingPositive');
    const siblings = other(s.uoms, id).filter(u => u.category_id === v['category_id']);
    const ref = siblings.find(u => u.uom_type === 'reference' && u.active);
    if (v['uom_type'] === 'reference' && ref) e['uom_type'] = tr('product.v.oneReference', { name: ref.name });
    if (v['uom_type'] !== 'reference' && !ref) e['uom_type'] = tr('product.v.noReference');
    if (id != null && v['uom_type'] !== 'reference' && byId(s.uoms, id)?.uom_type === 'reference' && siblings.length > 0 && !ref) e['uom_type'] = tr('product.v.keepReference');
    if (siblings.some(u => lc(u.name) === lc(v['name']))) e['name'] = tr('product.v.uomDup');
    return e;
  },
  related: [{ titleKey: 'product.rel.productsUsing', entity: 'products', items: (r, c) => c.s.products.filter(p => p.uom_id === r.id || p.uom_po_id === r.id) as unknown as Rec[], meta: p => p['default_code'] }],
};

/** Order matches the React module: Products, Product Categories, Units of Measure, UoM Categories. */
export const ENTITIES: EntityConfig[] = [products, categories, uoms, uomCategories];
export const ENTITY_BY_KEY = Object.fromEntries(ENTITIES.map(e => [e.key, e])) as Record<ProductEntityKey, EntityConfig>;
export const ENTITY_BY_ROUTE = Object.fromEntries(ENTITIES.map(e => [e.route, e])) as Record<string, EntityConfig>;
