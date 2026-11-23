import { Package, Ruler, Shapes, FolderTree } from 'lucide-react'
import type { EntityConfig, FieldDef, Values } from './config'
import { byId, categoryPath, descendantsOf, money, num, relLabel, uomFactorInv } from './derived'
import {
  INTERNAL_TYPE_OPTIONS, MEASURE_TYPE_OPTIONS, PRODUCT_TYPE_OPTIONS, TRACKING_OPTIONS, UOM_TYPE_OPTIONS, YES_NO, optLabel,
} from './options'
import type { EntityKey, ProductState, Rec } from './types'
import { Badge } from './ui'

// ── helpers ──
const lc = (v: unknown) => String(v ?? '').trim().toLowerCase()
const other = <T extends { id: number }>(list: T[], id?: number) => list.filter((r) => r.id !== id)
const companyOptions = (s: ProductState) => s.companies.map((c) => ({ value: String(c.id), label: c.name }))
const sub = (text: string) => <span className="block text-xs text-slate-500">{text}</span>
const dash = <span className="text-slate-400">—</span>
const mono = (t: string) => (t ? <span className="font-mono text-[13px]">{t}</span> : dash)
const activeField = (help = 'Uncheck to hide this record without deleting it.'): FieldDef => ({ key: 'active', label: 'Active', kind: 'boolean', help })
const idOf = (v: string) => Number(v)

const TYPE_TONE = { product: 'teal', consu: 'amber', service: 'violet' } as const
const catOptions = (s: ProductState) =>
  s.categories.map((c) => ({ value: String(c.id), label: categoryPath(s, c) })).sort((a, b) => a.label.localeCompare(b.label))

// ───────────────────────────── Products ─────────────────────────────
const products: EntityConfig = {
  key: 'products', route: 'prd_products', title: 'Products', singular: 'Product', model: 'product.template', icon: Package,
  subtitle: 'Items you stock, buy, sell and service.',
  nameOf: (r) => r.name,
  searchPlaceholder: 'Search name, Arabic name, reference, barcode…',
  searchText: (r, s) => [r.name, r.arabic_name, r.default_code, r.barcode, r.internal_short_code, relLabel(s, 'categories', r.categ_id)].join(' '),
  defaultSort: { key: 'name', dir: 'asc' },
  columns: [
    { key: 'name', label: 'Product', primary: true, sort: (r) => lc(r.name), render: (r) => <span><span className="block">{r.name}</span>{r.arabic_name && <span dir="rtl" className="block text-right text-xs font-normal text-slate-500 sm:text-left">{r.arabic_name}</span>}</span> },
    { key: 'default_code', label: 'Reference', sort: (r) => lc(r.default_code), render: (r) => mono(r.default_code) },
    { key: 'categ_id', label: 'Category', hide: 'md', wrap: true, sort: (r, s) => lc(relLabel(s, 'categories', r.categ_id)), render: (r, s) => <span className="text-slate-600">{relLabel(s, 'categories', r.categ_id).replace(/^All \/ /, '')}</span> },
    { key: 'type', label: 'Type', sort: (r) => r.type, render: (r) => <Badge tone={TYPE_TONE[r.type as keyof typeof TYPE_TONE]}>{{ product: 'Storable', consu: 'Consumable', service: 'Service' }[r.type as 'product']}</Badge> },
    { key: 'uom_id', label: 'UoM', hide: '2xl', sort: (r, s) => lc(relLabel(s, 'uoms', r.uom_id)), render: (r, s) => relLabel(s, 'uoms', r.uom_id) },
    { key: 'list_price', label: 'Sales Price', align: 'right', sort: (r) => r.list_price, render: (r) => money(r.list_price) },
    { key: 'standard_price', label: 'Cost', align: 'right', hide: '2xl', sort: (r) => r.standard_price, render: (r) => money(r.standard_price) },
    { key: 'qty_available', label: 'On Hand', align: 'right', hide: 'sm', sort: (r) => r.qty_available, render: (r) => r.type !== 'product' ? dash : <span className={r.qty_available <= 0 ? 'font-medium text-rose-600' : ''}>{num(r.qty_available)}</span> },
  ],
  filters: [
    { key: 'type', label: 'Type', options: () => PRODUCT_TYPE_OPTIONS, match: (r, v) => r.type === v },
    { key: 'categ_id', label: 'Category', options: catOptions, match: (r, v, s) => r.categ_id === idOf(v) || descendantsOf(s.categories, idOf(v), 'parent_id').some((c) => c.id === r.categ_id) },
    { key: 'tracking', label: 'Tracking', options: () => TRACKING_OPTIONS, match: (r, v) => r.tracking === v },
    { key: 'internal_type', label: 'Internal Type', options: () => INTERNAL_TYPE_OPTIONS, match: (r, v) => r.internal_type === v },
    { key: 'sale_ok', label: 'Can be Sold', options: () => YES_NO, match: (r, v) => r.sale_ok === (v === 'yes') },
    { key: 'purchase_ok', label: 'Can be Purchased', options: () => YES_NO, match: (r, v) => r.purchase_ok === (v === 'yes') },
    { key: 'company_id', label: 'Company', options: companyOptions, match: (r, v) => r.company_id === idOf(v) },
    { key: 'responsible_id', label: 'Responsible', options: (s) => s.users.map((u) => ({ value: String(u.id), label: u.name })), match: (r, v) => r.responsible_id === idOf(v) },
  ],
  badges: (r) => [{ label: optLabel(PRODUCT_TYPE_OPTIONS, r.type), tone: TYPE_TONE[r.type as keyof typeof TYPE_TONE] }, ...(r.default_code ? [{ label: r.default_code, tone: 'slate' as const }] : [])],
  stats: (r) => [
    { label: 'Sales Price (SAR)', value: money(r.list_price), hint: r.sale_ok ? 'Can be sold' : 'Not for sale' },
    { label: 'Cost (SAR)', value: money(r.standard_price), hint: `Margin ${num(r.margin_perc)}%` },
    { label: 'On Hand', value: r.type === 'product' ? num(r.qty_available) : '—', hint: r.type === 'product' ? 'Computed from stock moves' : 'Not stock-managed' },
    { label: 'Forecasted', value: r.type === 'product' ? num(r.virtual_available) : '—', hint: r.type === 'product' ? 'On hand + incoming − outgoing' : undefined },
  ],
  sections: [
    {
      title: 'General Information',
      fields: [
        { key: 'name', label: 'Product Name', kind: 'text', required: true, span: 2, placeholder: 'e.g. Hydraulic Hose 1SN 1/2"', maxLength: 255 },
        { key: 'default_code', label: 'Internal Reference', kind: 'text', mono: true, placeholder: 'e.g. HH1-050', maxLength: 64 },
        { key: 'barcode', label: 'Barcode', kind: 'text', mono: true, maxLength: 64 },
        { key: 'arabic_name', label: 'Arabic Name', kind: 'text', rtl: true, placeholder: 'الاسم بالعربية', maxLength: 255 },
        { key: 'internal_short_code', label: 'Internal Short Code', kind: 'text', mono: true, maxLength: 32 },
        {
          key: 'type', label: 'Product Type', kind: 'select', required: true, options: PRODUCT_TYPE_OPTIONS,
          help: 'Storable: stock is managed. Consumable: no stock tracking. Service: not physical.',
          onChange: (v) => (v === 'product' ? {} : { tracking: 'none' }),
        },
        { key: 'categ_id', label: 'Product Category', kind: 'relation', rel: 'categories', required: true },
        { key: 'internal_type', label: 'Internal Type', kind: 'select', options: INTERNAL_TYPE_OPTIONS },
        { key: 'company_id', label: 'Company', kind: 'relation', rel: 'companies' },
        { key: 'responsible_id', label: 'Responsible', kind: 'relation', rel: 'users' },
        activeField('Uncheck to archive the product.'),
      ],
    },
    {
      title: 'Units & Tracking',
      fields: [
        {
          key: 'uom_id', label: 'Unit of Measure', kind: 'relation', rel: 'uoms', required: true, help: 'Default unit for stock and sales.',
          onChange: (v, next, s) => {
            const base = byId(s.uoms, v), po = byId(s.uoms, next.uom_po_id)
            return !po || !base || po.category_id !== base.category_id ? { uom_po_id: v } : {}
          },
        },
        {
          key: 'uom_po_id', label: 'Purchase Unit of Measure', kind: 'relation', rel: 'uoms', required: true, help: 'Must be in the same category as the Unit of Measure.',
          domain: (r, v, s) => { const base = byId(s.uoms, v.uom_id); return !base || r.category_id === base.category_id },
        },
        {
          key: 'tracking', label: 'Tracking', kind: 'select', required: true, options: TRACKING_OPTIONS,
          readonlyWhen: (v) => v.type !== 'product', help: 'Only storable products can be tracked by lot or serial number.',
        },
        { key: 'weight', label: 'Weight', kind: 'number', min: 0, suffix: 'kg', step: '0.01' },
        { key: 'volume', label: 'Volume', kind: 'number', min: 0, suffix: 'm³', step: '0.001' },
        { key: 'qty_available', label: 'Quantity On Hand', kind: 'readonly', detailOnly: true, get: (r) => (r.type === 'product' ? num(r.qty_available) : '—') },
        { key: 'virtual_available', label: 'Forecasted Quantity', kind: 'readonly', detailOnly: true, get: (r) => (r.type === 'product' ? num(r.virtual_available) : '—') },
      ],
    },
    {
      title: 'Sales & Purchase',
      fields: [
        { key: 'sale_ok', label: 'Can be Sold', kind: 'boolean' },
        { key: 'purchase_ok', label: 'Can be Purchased', kind: 'boolean' },
        { key: 'no_discount', label: 'No Discount', kind: 'boolean', help: 'Customer discounts are not applied to this product.' },
        { key: 'list_price', label: 'Sales Price', kind: 'number', min: 0, step: '0.01', suffix: 'SAR', required: true },
        { key: 'standard_price', label: 'Cost', kind: 'number', min: 0, step: '0.01', suffix: 'SAR' },
        { key: 'margin_perc', label: 'Margin (%)', kind: 'number', min: 0, max: 100, step: '0.1', suffix: '%' },
      ],
    },
    {
      title: 'Notes',
      fields: [
        { key: 'description_sale', label: 'Sales Description', kind: 'textarea', span: 2, hideEmpty: true },
        { key: 'description_purchase', label: 'Purchase Description', kind: 'textarea', span: 2, hideEmpty: true },
      ],
    },
  ],
  defaults: (s) => ({
    name: '', default_code: '', barcode: '', type: 'product', categ_id: null, uom_id: byId(s.uoms, 1)?.id ?? null, uom_po_id: byId(s.uoms, 1)?.id ?? null,
    tracking: 'none', active: true, company_id: s.companies[1]?.id ?? null, sale_ok: true, purchase_ok: true, list_price: 0, standard_price: 0, weight: 0, volume: 0,
    responsible_id: null, description_sale: '', description_purchase: '', arabic_name: '', internal_short_code: '', internal_type: 'material', margin_perc: 0,
    no_discount: false, qty_available: 0, virtual_available: 0,
  }),
  validate: (v, s, id) => {
    const e: Record<string, string> = {}
    const dupCode = v.default_code && other(s.products, id).some((p) => lc(p.default_code) === lc(v.default_code))
    if (dupCode) e.default_code = 'Another product already uses this internal reference.'
    if (v.barcode && other(s.products, id).some((p) => lc(p.barcode) === lc(v.barcode))) e.barcode = 'This barcode is already assigned to another product.'
    const u = byId(s.uoms, v.uom_id), po = byId(s.uoms, v.uom_po_id)
    if (u && po && u.category_id !== po.category_id) e.uom_po_id = 'Purchase unit must be in the same category as the Unit of Measure.'
    if (v.tracking !== 'none' && v.type !== 'product') e.tracking = 'Only storable products can be tracked.'
    return e
  },
  related: [],
}

// ───────────────────────────── Product categories ─────────────────────────────
const categories: EntityConfig = {
  key: 'categories', route: 'prd_categories', title: 'Product Categories', singular: 'Category', model: 'product.category', icon: FolderTree,
  subtitle: 'Hierarchy used to group products.',
  uiOnlyActive: true,
  nameOf: (r, s) => categoryPath(s, r),
  searchPlaceholder: 'Search name, Arabic name, short code…',
  searchText: (r, s) => [categoryPath(s, r), r.arabic_name, r.sequence_code].join(' '),
  defaultSort: { key: 'name', dir: 'asc' },
  columns: [
    { key: 'name', label: 'Category', primary: true, sort: (r, s) => lc(categoryPath(s, r)), render: (r, s) => categoryPath(s, r) },
    { key: 'arabic_name', label: 'Arabic Name', hide: 'sm', sort: (r) => r.arabic_name, render: (r) => (r.arabic_name ? <span dir="rtl">{r.arabic_name}</span> : dash) },
    { key: 'sequence_code', label: 'Short Code', hide: 'md', sort: (r) => lc(r.sequence_code), render: (r) => mono(r.sequence_code) },
    { key: 'parent_id', label: 'Parent', hide: 'lg', sort: (r, s) => lc(relLabel(s, 'categories', r.parent_id)), render: (r, s) => relLabel(s, 'categories', r.parent_id) || <Badge>Root</Badge> },
    { key: 'child_id', label: 'Sub-categories', align: 'right', hide: 'xl', sort: (r, s) => s.categories.filter((c) => c.parent_id === r.id).length, render: (r, s) => s.categories.filter((c) => c.parent_id === r.id).length },
    { key: 'product_count', label: 'Products', align: 'right', sort: (r, s) => countProducts(s, r.id), render: (r, s) => countProducts(s, r.id) },
  ],
  filters: [
    { key: 'parent', label: 'Parent', options: (s) => [{ value: 'root', label: 'Root categories only' }, ...catOptions(s)], match: (r, v) => (v === 'root' ? r.parent_id == null : r.parent_id === idOf(v)) },
    { key: 'has_products', label: 'Products', options: () => [{ value: 'yes', label: 'With products' }, { value: 'no', label: 'Without products' }], match: (r, v, s) => (countProducts(s, r.id) > 0) === (v === 'yes') },
  ],
  stats: (r, s) => [
    { label: 'Products (direct)', value: s.products.filter((p) => p.categ_id === r.id).length },
    { label: 'Products (incl. sub-categories)', value: countProducts(s, r.id) },
    { label: 'Sub-categories', value: s.categories.filter((c) => c.parent_id === r.id).length },
  ],
  sections: [
    {
      title: 'General Information',
      fields: [
        { key: 'name', label: 'Category Name', kind: 'text', required: true, maxLength: 128 },
        { key: 'parent_id', label: 'Parent Category', kind: 'relation', rel: 'categories', placeholder: '— none (root category) —', },
        { key: 'arabic_name', label: 'Arabic Name', kind: 'text', rtl: true, maxLength: 128 },
        { key: 'sequence_code', label: 'Short Code', kind: 'text', mono: true, maxLength: 16 },
        { key: 'complete_name', label: 'Complete Name', kind: 'readonly', get: (r, s) => categoryPath(s, r) },
        { key: 'product_count', label: 'Product Count', kind: 'readonly', get: (r, s) => countProducts(s, r.id) },
        activeField('Odoo 12 has no active flag on categories; archive is UI-only here.'),
      ],
    },
  ],
  defaults: () => ({ name: '', parent_id: null, arabic_name: '', sequence_code: '', active: true }),
  validate: (v, s, id) => {
    const e: Record<string, string> = {}
    if (id != null && v.parent_id != null) {
      if (v.parent_id === id || descendantsOf(s.categories, id, 'parent_id').some((c) => c.id === v.parent_id)) e.parent_id = 'A category cannot be its own parent or a descendant of itself.'
    }
    if (other(s.categories, id).some((c) => c.parent_id === (v.parent_id ?? null) && lc(c.name) === lc(v.name))) e.name = 'A category with this name already exists under the same parent.'
    return e
  },
  related: [
    { title: 'Products', entity: 'products', items: (r, s) => s.products.filter((p) => p.categ_id === r.id), meta: (p) => p.default_code },
    { title: 'Sub-categories', entity: 'categories', items: (r, s) => s.categories.filter((c) => c.parent_id === r.id), meta: (c) => c.arabic_name },
  ],
}
function countProducts(s: ProductState, categoryId: number) {
  const ids = new Set([categoryId, ...descendantsOf(s.categories, categoryId, 'parent_id').map((c) => c.id)])
  return s.products.filter((p) => p.categ_id != null && ids.has(p.categ_id)).length
}

// ───────────────────────────── UoM categories ─────────────────────────────
const uomCategories: EntityConfig = {
  key: 'uomCategories', route: 'prd_uom_categories', title: 'UOM Categories', singular: 'UoM Category', model: 'uom.category', icon: Shapes,
  subtitle: 'Groups of units that can be converted into each other.',
  uiOnlyActive: true,
  nameOf: (r) => r.name,
  searchPlaceholder: 'Search UoM categories…',
  searchText: (r) => `${r.name} ${optLabel(MEASURE_TYPE_OPTIONS, r.measure_type)}`,
  defaultSort: { key: 'name', dir: 'asc' },
  columns: [
    { key: 'name', label: 'Category', primary: true, sort: (r) => lc(r.name), render: (r) => r.name },
    { key: 'measure_type', label: 'Type of Measure', sort: (r) => r.measure_type, render: (r) => (r.measure_type ? <Badge tone="blue">{optLabel(MEASURE_TYPE_OPTIONS, r.measure_type)}</Badge> : dash) },
    { key: 'reference', label: 'Reference Unit', hide: 'sm', render: (r, s) => s.uoms.find((u) => u.category_id === r.id && u.uom_type === 'reference' && u.active)?.name ?? dash },
    { key: 'uoms', label: 'Units', align: 'right', sort: (r, s) => s.uoms.filter((u) => u.category_id === r.id).length, render: (r, s) => s.uoms.filter((u) => u.category_id === r.id).length },
  ],
  filters: [{ key: 'measure_type', label: 'Type of Measure', options: () => MEASURE_TYPE_OPTIONS, match: (r, v) => r.measure_type === v }],
  stats: (r, s) => [
    { label: 'Units of measure', value: s.uoms.filter((u) => u.category_id === r.id).length },
    { label: 'Reference unit', value: s.uoms.find((u) => u.category_id === r.id && u.uom_type === 'reference')?.name ?? '—' },
  ],
  sections: [
    {
      title: 'General Information',
      fields: [
        { key: 'name', label: 'Category Name', kind: 'text', required: true, maxLength: 128 },
        { key: 'measure_type', label: 'Type of Measure', kind: 'select', options: MEASURE_TYPE_OPTIONS },
        activeField('Odoo 12 has no active flag on UoM categories; archive is UI-only here.'),
      ],
    },
  ],
  defaults: () => ({ name: '', measure_type: '', active: true }),
  validate: (v, s, id) => {
    const e: Record<string, string> = {}
    if (other(s.uomCategories, id).some((c) => lc(c.name) === lc(v.name))) e.name = 'A UoM category with this name already exists.'
    return e
  },
  related: [{ title: 'Units of Measure', entity: 'uoms', items: (r, s) => s.uoms.filter((u) => u.category_id === r.id), meta: (u) => optLabel(UOM_TYPE_OPTIONS, u.uom_type) }],
}

// ───────────────────────────── Units of measure ─────────────────────────────
const ratioOf = (u: Rec) => (u.uom_type === 'bigger' ? Number(uomFactorInv(u.factor).toFixed(6)) : u.uom_type === 'smaller' ? u.factor : 1)
const uoms: EntityConfig = {
  key: 'uoms', route: 'prd_uoms', title: 'Units of Measure', singular: 'Unit of Measure', model: 'uom.uom', icon: Ruler,
  subtitle: 'Units used for stock, purchase and sales quantities.',
  nameOf: (r) => r.name,
  searchPlaceholder: 'Search unit or display name…',
  searchText: (r, s) => [r.name, r.view_name, relLabel(s, 'uomCategories', r.category_id)].join(' '),
  defaultSort: { key: 'category_id', dir: 'asc' },
  columns: [
    { key: 'name', label: 'Unit', primary: true, sort: (r) => lc(r.name), render: (r) => r.name },
    { key: 'category_id', label: 'Category', sort: (r, s) => lc(relLabel(s, 'uomCategories', r.category_id)), render: (r, s) => relLabel(s, 'uomCategories', r.category_id) },
    { key: 'uom_type', label: 'Type', hide: 'sm', sort: (r) => r.uom_type, render: (r) => <Badge tone={r.uom_type === 'reference' ? 'green' : r.uom_type === 'bigger' ? 'blue' : 'amber'}>{r.uom_type === 'reference' ? 'Reference' : r.uom_type === 'bigger' ? 'Bigger' : 'Smaller'}</Badge> },
    { key: 'ratio', label: 'Ratio', align: 'right', hide: 'lg', sort: (r) => ratioOf(r), render: (r, s) => { const ref = s.uoms.find((u) => u.category_id === r.category_id && u.uom_type === 'reference'); return r.uom_type === 'reference' ? dash : r.uom_type === 'bigger' ? `1 ${r.name} = ${num(ratioOf(r), 6)} ${ref?.name ?? ''}` : `1 ${ref?.name ?? ''} = ${num(ratioOf(r), 6)} ${r.name}` } },
    { key: 'rounding', label: 'Rounding', align: 'right', hide: '2xl', sort: (r) => r.rounding, render: (r) => num(r.rounding, 6) },
    { key: 'view_name', label: 'Display Name', hide: '2xl', sort: (r) => lc(r.view_name), render: (r) => r.view_name || dash },
    { key: 'used', label: 'Products', align: 'right', hide: '2xl', sort: (r, s) => s.products.filter((p) => p.uom_id === r.id).length, render: (r, s) => s.products.filter((p) => p.uom_id === r.id).length },
  ],
  filters: [
    { key: 'category_id', label: 'Category', options: (s) => s.uomCategories.map((c) => ({ value: String(c.id), label: c.name })), match: (r, v) => r.category_id === idOf(v) },
    { key: 'uom_type', label: 'Type', options: () => [{ value: 'reference', label: 'Reference unit' }, { value: 'bigger', label: 'Bigger than reference' }, { value: 'smaller', label: 'Smaller than reference' }], match: (r, v) => r.uom_type === v },
  ],
  stats: (r, s) => [
    { label: 'Category', value: relLabel(s, 'uomCategories', r.category_id) },
    { label: 'Type', value: r.uom_type === 'reference' ? 'Reference' : r.uom_type === 'bigger' ? 'Bigger' : 'Smaller' },
    { label: 'Used by products', value: s.products.filter((p) => p.uom_id === r.id || p.uom_po_id === r.id).length },
  ],
  sections: [
    {
      title: 'General Information',
      fields: [
        { key: 'name', label: 'Unit of Measure', kind: 'text', required: true, maxLength: 64 },
        { key: 'category_id', label: 'Category', kind: 'relation', rel: 'uomCategories', required: true },
        { key: 'uom_type', label: 'Type', kind: 'select', required: true, options: UOM_TYPE_OPTIONS, span: 2 },
        { key: 'factor', label: 'Ratio', kind: 'number', min: 0, step: 'any', showWhen: (v) => v.uom_type === 'smaller', help: 'How many of this unit make up 1 reference unit (e.g. 1 kg = 1000 g).' },
        { key: 'factor_inv', label: 'Bigger Ratio', kind: 'number', min: 0, step: 'any', showWhen: (v) => v.uom_type === 'bigger', help: 'How many reference units make up 1 of this unit (e.g. 1 t = 1000 kg).' },
        { key: 'ratio_ref', label: 'Ratio', kind: 'readonly', detailOnly: true, get: (r) => (r.uom_type === 'reference' ? '1 (reference)' : `${num(ratioOf(r), 6)}`) },
        { key: 'rounding', label: 'Rounding Precision', kind: 'number', min: 0, step: 'any', required: true, help: 'Quantities are rounded to a multiple of this value.' },
        { key: 'view_name', label: 'Display Name', kind: 'text', help: 'Short name shown on documents.', maxLength: 32 },
        { key: 'measure_type', label: 'Type of Measure', kind: 'readonly', get: (r, s) => optLabel(MEASURE_TYPE_OPTIONS, byId(s.uomCategories, r.category_id)?.measure_type) || '—' },
        activeField('Uncheck to disable this unit without deleting it.'),
      ],
    },
  ],
  defaults: (s) => ({ name: '', category_id: s.uomCategories[0]?.id ?? null, uom_type: 'reference', factor: 1, rounding: 0.01, view_name: '', active: true }),
  prepare: (rec) => ({ factor_inv: rec.factor ? String(Number(uomFactorInv(rec.factor).toFixed(6))) : '1' }),
  finalize: (v) => {
    const { factor_inv, ...rest } = v
    const factor = v.uom_type === 'reference' ? 1 : v.uom_type === 'bigger' ? 1 / Number(factor_inv || 1) : Number(v.factor)
    return { ...rest, factor }
  },
  validate: (v, s, id) => {
    const e: Record<string, string> = {}
    if (v.uom_type === 'smaller' && !(Number(v.factor) > 0)) e.factor = 'Ratio must be greater than 0.'
    if (v.uom_type === 'bigger' && !(Number(v.factor_inv) > 0)) e.factor_inv = 'Bigger ratio must be greater than 0.'
    if (!(Number(v.rounding) > 0)) e.rounding = 'Rounding precision must be greater than 0.'
    const siblings = other(s.uoms, id).filter((u) => u.category_id === v.category_id)
    const ref = siblings.find((u) => u.uom_type === 'reference' && u.active)
    if (v.uom_type === 'reference' && ref) e.uom_type = `Category already has the reference unit "${ref.name}". Only one reference unit is allowed.`
    if (v.uom_type !== 'reference' && !ref) e.uom_type = 'This category has no reference unit yet. Create the reference unit first.'
    if (id != null && v.uom_type !== 'reference' && byId(s.uoms, id)?.uom_type === 'reference' && siblings.length > 0 && !ref) e.uom_type = 'A category must keep exactly one reference unit.'
    if (siblings.some((u) => lc(u.name) === lc(v.name))) e.name = 'This category already has a unit with this name.'
    return e
  },
  related: [{ title: 'Products using this unit', entity: 'products', items: (r, s) => s.products.filter((p) => p.uom_id === r.id || p.uom_po_id === r.id), meta: (p) => p.default_code }],
}

export const ENTITIES: EntityConfig[] = [products, categories, uoms, uomCategories]
export const ENTITY_BY_KEY = Object.fromEntries(ENTITIES.map((e) => [e.key, e])) as Record<EntityKey, EntityConfig>
export const ENTITY_BY_ROUTE = Object.fromEntries(ENTITIES.map((e) => [e.route, e])) as Record<string, EntityConfig>

export const NAV_GROUPS: { label: string; items: EntityKey[] }[] = [
  { label: 'Master Data', items: ['products', 'categories', 'uoms', 'uomCategories'] },
]

export type { Values }
