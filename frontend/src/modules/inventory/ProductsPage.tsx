import { useState } from 'react'
import { Plus, Archive } from 'lucide-react'
import type { InventoryApi } from './useInventory'
import type { Product, ProductType, ID } from './types'
import { categoryName, getUom, qtyAvailable } from './helpers'
import { Breadcrumb, M2O, TabBar, Sheet, Row, SmartButton, ErrorBanner, fmtQty } from './components'
import { PageHeader, PrimaryButton, GhostButton, Segmented, SearchBox, Table, Pill, EmptyState, inputCls } from '../shared/ui'

const TYPE_LABEL: Record<ProductType, string> = { product: 'Storable Product', consu: 'Consumable', service: 'Service' }
type Tab = 'general' | 'inventory' | 'notes'

const blank = (s: InventoryApi['s']): Omit<Product, 'id'> => ({
  name: '', default_code: '', barcode: '', type: 'product', categ_id: s.categories[0]?.id ?? 0, uom_id: s.uoms[0]?.id ?? 0, uom_po_id: s.uoms[0]?.id ?? 0,
  list_price: 1, standard_price: 0, sale_ok: true, purchase_ok: true, active: true, description: '', description_picking: '', description_pickingin: '',
  description_pickingout: '', weight: 0, volume: 0, responsible_id: 'Sangeeth R.',
})

export function ProductsPage({ inv, readOnly, searchQuery, onOpenStock }: { inv: InventoryApi; readOnly: boolean; searchQuery: string; onOpenStock: () => void }) {
  const { s } = inv
  const [filter, setFilter] = useState<'all' | ProductType | 'archived'>('all')
  const [local, setLocal] = useState('')
  const [open, setOpen] = useState<ID | 'new' | null>(null)
  const q = (local || searchQuery).trim().toLowerCase()
  const rows = s.products.filter(p => (filter === 'archived' ? !p.active : p.active && (filter === 'all' || p.type === filter)) && (!q || [p.name, p.default_code, p.barcode].some(v => v.toLowerCase().includes(q))))
  const n = (t: ProductType) => s.products.filter(p => p.active && p.type === t).length

  if (open !== null) return <ProductForm inv={inv} id={open === 'new' ? undefined : open} readOnly={readOnly} onClose={() => setOpen(null)} onOpenStock={onOpenStock} />
  return (
    <div className="space-y-4">
      <PageHeader title="Products" actions={<>
        <SearchBox value={local} onChange={setLocal} placeholder="Search name, reference, barcode…" />
        {!readOnly && <PrimaryButton onClick={() => setOpen('new')}><Plus size={16} />Create</PrimaryButton>}
      </>} />
      <Segmented value={filter} onChange={setFilter} options={[
        { id: 'all', label: 'All', count: s.products.filter(p => p.active).length }, { id: 'product', label: 'Storable', count: n('product') },
        { id: 'consu', label: 'Consumable', count: n('consu') }, { id: 'service', label: 'Service', count: n('service') }, { id: 'archived', label: 'Archived', count: s.products.filter(p => !p.active).length },
      ]} />
      <Table head={['Internal Reference', 'Name', { label: 'Sales Price', right: true }, { label: 'Cost', right: true }, 'Product Category', 'Product Type', { label: 'Quantity On Hand', right: true }, 'Unit of Measure']} empty={rows.length === 0 ? <EmptyState title="No products found" /> : null}>
        {rows.map(p => (
          <tr key={p.id} onClick={() => setOpen(p.id)} className="hover:bg-slate-50 cursor-pointer">
            <td className="px-3 py-2.5 font-mono text-slate-600">{p.default_code || '—'}</td>
            <td className="px-3 py-2.5 font-bold text-slate-900">{p.name}</td>
            <td className="px-3 py-2.5 text-right font-mono">{p.list_price.toFixed(2)}</td><td className="px-3 py-2.5 text-right font-mono">{p.standard_price.toFixed(2)}</td>
            <td className="px-3 py-2.5 text-slate-600">{categoryName(s, p.categ_id)}</td><td className="px-3 py-2.5"><Pill tone={p.type === 'product' ? 'green' : p.type === 'consu' ? 'blue' : 'slate'}>{TYPE_LABEL[p.type]}</Pill></td>
            <td className="px-3 py-2.5 text-right font-mono">{p.type === 'product' ? fmtQty(qtyAvailable(s, p.id)) : '—'}</td><td className="px-3 py-2.5 text-slate-600">{getUom(s, p.uom_id)?.name}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

function ProductForm({ inv, id, readOnly, onClose, onOpenStock }: { inv: InventoryApi; id?: ID; readOnly: boolean; onClose: () => void; onOpenStock: () => void }) {
  const { s } = inv
  const existing = s.products.find(p => p.id === id)
  const [p, setP] = useState<Product>(() => existing ?? { id: 0, ...blank(s) })
  const [tab, setTab] = useState<Tab>('general')
  const [err, setErr] = useState('')
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP(x => ({ ...x, [k]: v }))
  const dis = readOnly
  const num = (k: 'list_price' | 'standard_price' | 'weight' | 'volume', label: string) => <input aria-label={label} type="number" min={0} step="0.01" disabled={dis} className={inputCls} value={p[k]} onChange={e => set(k, Number(e.target.value) || 0)} />
  const area = (k: 'description' | 'description_pickingout' | 'description_pickingin' | 'description_picking', label: string) => <textarea aria-label={label} rows={2} disabled={dis} className={`${inputCls} resize-none`} value={p[k]} onChange={e => set(k, e.target.value)} />

  const save = () => {
    if (!p.name.trim()) return setErr('Name is required.')
    if (!p.uom_id) return setErr('Unit of Measure is required.')
    if (s.products.some(x => x.id !== p.id && p.default_code && x.default_code.toLowerCase() === p.default_code.toLowerCase())) return setErr('Another product already uses this Internal Reference.')
    inv.save('products', { ...p, name: p.name.trim(), uom_po_id: p.uom_po_id || p.uom_id, ...(existing ? {} : { id: undefined }) })
    onClose()
  }
  return (
    <div className="space-y-3 max-w-5xl">
      <Breadcrumb parent="Products" current={existing ? existing.name : 'New'} onBack={onClose} />
      <div className="flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          {existing && <SmartButton value={p.type === 'product' ? fmtQty(qtyAvailable(s, p.id)) : '—'} label="On Hand" onClick={onOpenStock} />}
          {existing && !readOnly && <button onClick={() => set('active', !p.active)} className="min-w-24 border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-left hover:border-emerald-400 flex items-center gap-2"><Archive size={14} className={p.active ? 'text-emerald-600' : 'text-rose-500'} /><span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">{p.active ? 'Active' : 'Archived'}</span></button>}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 font-bold"><input type="checkbox" disabled={dis} checked={p.sale_ok} onChange={e => set('sale_ok', e.target.checked)} />Can be Sold</label>
          <label className="flex items-center gap-1.5 font-bold"><input type="checkbox" disabled={dis} checked={p.purchase_ok} onChange={e => set('purchase_ok', e.target.checked)} />Can be Purchased</label>
        </div>
      </div>
      <ErrorBanner text={err} />
      <Sheet>
        <input aria-label="Product Name" disabled={dis} placeholder="Product Name" className="w-full text-2xl font-extrabold text-slate-900 border-b border-slate-200 focus:outline-none focus:border-emerald-600 pb-1 bg-transparent" value={p.name} onChange={e => set('name', e.target.value)} />
        <TabBar<Tab> value={tab} onChange={setTab} tabs={[{ id: 'general', label: 'General Information' }, { id: 'inventory', label: 'Inventory' }, { id: 'notes', label: 'Notes' }]} />
        {tab === 'general' && (
          <div className="grid lg:grid-cols-2 gap-x-8 gap-y-2">
            <div className="space-y-2">
              <Row label="Product Type"><select aria-label="Product Type" disabled={dis} className={inputCls} value={p.type} onChange={e => set('type', e.target.value as ProductType)}>{(Object.keys(TYPE_LABEL) as ProductType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></Row>
              <Row label="Product Category"><M2O label="Product Category" disabled={dis} value={p.categ_id} onChange={v => set('categ_id', v ?? 0)} options={s.categories.map(c => ({ id: c.id, label: categoryName(s, c.id) }))} /></Row>
              <Row label="Internal Reference"><input aria-label="Internal Reference" disabled={dis} className={`${inputCls} font-mono`} value={p.default_code} onChange={e => set('default_code', e.target.value)} /></Row>
              <Row label="Barcode"><input aria-label="Barcode" disabled={dis} className={`${inputCls} font-mono`} value={p.barcode} onChange={e => set('barcode', e.target.value)} /></Row>
            </div>
            <div className="space-y-2">
              <Row label="Sales Price">{num('list_price', 'Sales Price')}</Row>
              <Row label="Cost">{num('standard_price', 'Cost')}</Row>
              <Row label="Unit of Measure"><M2O label="Unit of Measure" disabled={dis} value={p.uom_id} onChange={v => setP(x => ({ ...x, uom_id: v ?? 0, uom_po_id: v ?? 0 }))} options={s.uoms.filter(u => u.active).map(u => ({ id: u.id, label: u.name }))} /></Row>
              <Row label="Purchase Unit of Measure"><M2O label="Purchase Unit of Measure" disabled={dis} value={p.uom_po_id} onChange={v => set('uom_po_id', v ?? 0)} options={s.uoms.filter(u => u.active && u.category_id === getUom(s, p.uom_id)?.category_id).map(u => ({ id: u.id, label: u.name }))} /></Row>
            </div>
          </div>
        )}
        {tab === 'inventory' && (
          <div className="grid lg:grid-cols-2 gap-x-8 gap-y-2">
            <div className="space-y-2">
              <Row label="Responsible"><input aria-label="Responsible" disabled={dis} className={inputCls} value={p.responsible_id} onChange={e => set('responsible_id', e.target.value)} /></Row>
              <Row label="Weight">{num('weight', 'Weight')}</Row>
              <Row label="Volume">{num('volume', 'Volume')}</Row>
            </div>
            <div className="space-y-2">
              <Row label="Delivery Orders">{area('description_pickingout', 'Description on Delivery Orders')}</Row>
              <Row label="Receipts">{area('description_pickingin', 'Description on Receptions')}</Row>
              <Row label="Internal Transfers">{area('description_picking', 'Description on Picking')}</Row>
            </div>
          </div>
        )}
        {tab === 'notes' && area('description', 'Description')}
      </Sheet>
      <div className="flex gap-2">{!readOnly && <PrimaryButton onClick={save}>Save</PrimaryButton>}<GhostButton onClick={onClose}>Discard</GhostButton></div>
    </div>
  )
}
