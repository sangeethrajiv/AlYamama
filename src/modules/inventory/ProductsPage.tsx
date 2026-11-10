import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { moneyFormat } from '../../data/mockAccountingData'
import type { InventoryApi } from './useInventory'
import type { Product, ProductType, ProductCategory } from './types'
import { PageHeader, PrimaryButton, GhostButton, Segmented, SearchBox, Table, Pill, EmptyState, Drawer, Field, Card, inputCls, ConfirmDialog } from '../shared/ui'

const blank = (): Product => ({
  id: `prd_${Date.now()}`, sku: '', barcode: '', name: '', categoryId: 'cat_all', type: 'storable', uom: 'Units', cost: 0, salePrice: 0, taxRate: 0.15,
  canSell: true, canPurchase: true, tracking: 'none', description: '', vendor: '', active: true,
})

export function ProductsPage({ inv, readOnly, searchQuery }: { inv: InventoryApi; readOnly: boolean; searchQuery: string }) {
  const [filter, setFilter] = useState<'all' | ProductType | 'archived'>('all')
  const [cat, setCat] = useState('all')
  const [local, setLocal] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const q = (local || searchQuery).trim().toLowerCase()
  const catName = (id: string) => inv.categories.find(c => c.id === id)?.name || '—'

  const rows = useMemo(() => inv.products.filter(p => {
    if (filter === 'archived' ? p.active : !p.active) return false
    if (filter !== 'all' && filter !== 'archived' && p.type !== filter) return false
    if (cat !== 'all' && p.categoryId !== cat) return false
    return !q || [p.name, p.sku, p.barcode, p.vendor].some(v => v.toLowerCase().includes(q))
  }), [inv.products, filter, cat, q])
  const act = inv.products.filter(p => p.active)

  return (
    <div className="space-y-4">
      <PageHeader title="Products" subtitle="Items you stock, sell and purchase. SKUs and barcodes are unique."
        actions={<>
          <SearchBox value={local} onChange={setLocal} placeholder="Search name, SKU, barcode…" />
          <select aria-label="Category" value={cat} onChange={e => setCat(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
            <option value="all">All categories</option>{inv.categories.filter(c => c.id !== 'cat_all').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!readOnly && <PrimaryButton onClick={() => setEditing(blank())}><Plus size={16} />New Product</PrimaryButton>}
        </>} />
      <Segmented value={filter} onChange={setFilter} options={[
        { id: 'all', label: 'All', count: act.length }, { id: 'storable', label: 'Storable', count: act.filter(p => p.type === 'storable').length },
        { id: 'consumable', label: 'Consumable', count: act.filter(p => p.type === 'consumable').length }, { id: 'service', label: 'Service', count: act.filter(p => p.type === 'service').length },
        { id: 'archived', label: 'Archived', count: inv.products.length - act.length },
      ]} />
      <Table head={['Product', 'SKU', 'Barcode', 'Category', 'Type', { label: 'On hand', right: true }, { label: 'Cost', right: true }, { label: 'Sales price', right: true }]}
        empty={rows.length === 0 ? <EmptyState title="No products found" /> : null}>
        {rows.map(p => {
          const oh = inv.onHand(p.sku)
          return (
            <tr key={p.id} onClick={() => setEditing(p)} className="hover:bg-slate-50 cursor-pointer">
              <td className="px-3 py-2.5 font-bold text-slate-900">{p.name}</td>
              <td className="px-3 py-2.5 font-mono text-slate-600">{p.sku}</td>
              <td className="px-3 py-2.5 font-mono text-slate-500">{p.barcode || '—'}</td>
              <td className="px-3 py-2.5 text-slate-600">{catName(p.categoryId)}</td>
              <td className="px-3 py-2.5"><Pill tone={p.type === 'service' ? 'blue' : 'slate'}>{p.type}</Pill></td>
              <td className="px-3 py-2.5 text-right font-mono">{p.type === 'service' ? '—' : `${oh} ${p.uom}`}</td>
              <td className="px-3 py-2.5 text-right font-mono">{moneyFormat(p.cost)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{moneyFormat(p.salePrice)}</td>
            </tr>
          )
        })}
      </Table>
      {editing && <ProductDrawer inv={inv} product={editing} isNew={!inv.products.some(p => p.id === editing.id)} readOnly={readOnly} onClose={() => setEditing(null)} />}
    </div>
  )
}

function ProductDrawer({ inv, product, isNew, readOnly, onClose }: { inv: InventoryApi; product: Product; isNew: boolean; readOnly: boolean; onClose: () => void }) {
  const [p, setP] = useState(product)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP(x => ({ ...x, [k]: v }))
  const stock = inv.quants.filter(q => q.productCode === p.sku)
  const save = () => {
    const sku = p.sku.trim()
    if (!p.name.trim()) return setErr('Product name is required.')
    if (!sku) return setErr('SKU is required.')
    if (inv.products.some(o => o.id !== p.id && o.sku.toLowerCase() === sku.toLowerCase())) return setErr(`SKU "${sku}" is already used.`)
    if (p.barcode && inv.products.some(o => o.id !== p.id && o.barcode === p.barcode)) return setErr('Barcode is already used by another product.')
    if (p.cost < 0 || p.salePrice < 0) return setErr('Prices cannot be negative.')
    inv.saveProduct({ ...p, sku, name: p.name.trim() })
    onClose()
  }
  const dis = readOnly
  return (
    <Drawer title={isNew ? 'New Product' : p.name} subtitle={isNew ? undefined : p.sku} badge={!p.active ? <Pill tone="red">Archived</Pill> : undefined} onClose={onClose}
      footer={<>
        {!isNew && !readOnly && <GhostButton danger={p.active} onClick={() => (p.active ? setConfirm(true) : (inv.saveProduct({ ...p, active: true }), onClose()))}>{p.active ? 'Archive' : 'Restore'}</GhostButton>}
        <GhostButton onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</GhostButton>{!readOnly && <PrimaryButton onClick={save}>Save product</PrimaryButton>}
      </>}>
      {err && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{err}</div>}
      <Card title="General">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Product name *" span={2}><input className={inputCls} disabled={dis} value={p.name} onChange={e => set('name', e.target.value)} autoFocus={isNew} /></Field>
          <Field label="SKU (internal reference) *"><input className={`${inputCls} font-mono`} disabled={dis} value={p.sku} onChange={e => set('sku', e.target.value.toUpperCase())} /></Field>
          <Field label="Barcode"><input className={`${inputCls} font-mono`} disabled={dis} value={p.barcode} onChange={e => set('barcode', e.target.value.replace(/\s/g, ''))} /></Field>
          <Field label="Category"><select className={inputCls} disabled={dis} value={p.categoryId} onChange={e => set('categoryId', e.target.value)}>{inv.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Product type" hint="Services are never stocked"><select className={inputCls} disabled={dis} value={p.type} onChange={e => set('type', e.target.value as ProductType)}><option value="storable">Storable</option><option value="consumable">Consumable</option><option value="service">Service</option></select></Field>
          <Field label="Unit of measure"><input className={inputCls} disabled={dis} value={p.uom} onChange={e => set('uom', e.target.value)} /></Field>
          <Field label="Tracking"><select className={inputCls} disabled={dis || p.type === 'service'} value={p.tracking} onChange={e => set('tracking', e.target.value as Product['tracking'])}><option value="none">No tracking</option><option value="lot">By lot</option><option value="serial">By serial number</option></select></Field>
          <Field label="Description" span={2}><textarea rows={2} className={`${inputCls} resize-none`} disabled={dis} value={p.description} onChange={e => set('description', e.target.value)} /></Field>
        </div>
      </Card>
      <Card title="Pricing & sourcing">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Cost (SAR)"><input type="number" min={0} step="0.01" className={inputCls} disabled={dis} value={p.cost} onChange={e => set('cost', Number(e.target.value) || 0)} /></Field>
          <Field label="Sales price (SAR)"><input type="number" min={0} step="0.01" className={inputCls} disabled={dis} value={p.salePrice} onChange={e => set('salePrice', Number(e.target.value) || 0)} /></Field>
          <Field label="Sales tax"><select className={inputCls} disabled={dis} value={p.taxRate} onChange={e => set('taxRate', Number(e.target.value))}><option value={0.15}>VAT 15%</option><option value={0}>No tax</option></select></Field>
          <Field label="Preferred vendor"><input className={inputCls} disabled={dis} value={p.vendor} list="erp-vendors" onChange={e => set('vendor', e.target.value)} /></Field>
          <div className="flex gap-4 text-xs sm:col-span-2">
            <label className="flex items-center gap-1.5"><input type="checkbox" disabled={dis} checked={p.canSell} onChange={e => set('canSell', e.target.checked)} /> Can be sold</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" disabled={dis} checked={p.canPurchase} onChange={e => set('canPurchase', e.target.checked)} /> Can be purchased</label>
          </div>
        </div>
      </Card>
      {!isNew && p.type !== 'service' && (
        <Card title="Stock on hand">
          {stock.length === 0 ? <p className="text-xs text-slate-500">No stock recorded.</p> : (
            <table className="w-full text-xs"><tbody className="divide-y divide-slate-100">
              {stock.map(s => <tr key={s.id}><td className="py-1.5">{s.location}{s.lot ? <span className="text-slate-400"> · {s.lot}</span> : null}</td><td className="py-1.5 text-right font-mono">{s.onHand} {s.uom}</td></tr>)}
              <tr><td className="py-1.5 font-bold">Total</td><td className="py-1.5 text-right font-mono font-bold">{stock.reduce((a, s) => a + s.onHand, 0)} {p.uom}</td></tr>
            </tbody></table>
          )}
        </Card>
      )}
      {confirm && <ConfirmDialog title="Archive product?" text="It stays on past documents but disappears from pickers." confirmLabel="Archive" danger onCancel={() => setConfirm(false)} onConfirm={() => { inv.saveProduct({ ...p, active: false }); onClose() }} />}
    </Drawer>
  )
}

export function CategoriesPage({ inv, readOnly }: { inv: InventoryApi; readOnly: boolean }) {
  const [name, setName] = useState('')
  const [parent, setParent] = useState('cat_all')
  const [err, setErr] = useState('')
  const [rename, setRename] = useState<ProductCategory | null>(null)
  const add = () => {
    const n = name.trim()
    if (!n) return setErr('Enter a category name.')
    if (inv.categories.some(c => c.name.toLowerCase() === n.toLowerCase())) return setErr('That category already exists.')
    inv.saveCategory({ id: `cat_${Date.now()}`, name: n, parentId: parent })
    setName(''); setErr('')
  }
  const count = (id: string) => inv.products.filter(p => p.categoryId === id && p.active).length
  return (
    <div className="space-y-4">
      <PageHeader title="Product Categories" subtitle="Group products for reporting and pricing." />
      {!readOnly && (
        <Card title="New category">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="w-56"><Field label="Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} /></Field></div>
            <div className="w-56"><Field label="Parent"><select className={inputCls} value={parent} onChange={e => setParent(e.target.value)}>{inv.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div>
            <PrimaryButton onClick={add}><Plus size={14} />Add</PrimaryButton>
          </div>
          {err && <p role="alert" className="text-xs text-rose-600 mt-2">{err}</p>}
        </Card>
      )}
      <Table head={['Category', 'Parent', { label: 'Products', right: true }, '']}>
        {inv.categories.map(c => (
          <tr key={c.id}>
            <td className="px-3 py-2.5 font-bold text-slate-900">{rename?.id === c.id ? (
              <input autoFocus className={`${inputCls} max-w-xs`} value={rename.name} onChange={e => setRename({ ...rename, name: e.target.value })}
                onBlur={() => { if (rename.name.trim()) inv.saveCategory({ ...c, name: rename.name.trim() }); setRename(null) }} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            ) : <button disabled={readOnly || c.id === 'cat_all'} onClick={() => setRename(c)} className="text-left hover:underline disabled:no-underline">{c.name}</button>}</td>
            <td className="px-3 py-2.5 text-slate-600">{inv.categories.find(p => p.id === c.parentId)?.name || '—'}</td>
            <td className="px-3 py-2.5 text-right font-mono">{count(c.id)}</td>
            <td className="px-3 py-2.5 text-right">{!readOnly && c.id !== 'cat_all' && <button aria-label={`Delete ${c.name}`} onClick={() => setErr(inv.deleteCategory(c.id))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}</td>
          </tr>
        ))}
      </Table>
    </div>
  )
}
