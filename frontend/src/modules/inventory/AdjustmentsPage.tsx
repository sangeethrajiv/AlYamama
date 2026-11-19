import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { InventoryApi } from './useInventory'
import type { Inventory, InventoryFilter, InventoryLine, InventoryState, ID } from './types'
import { completeName, productLabel, getProduct, getUom, theoreticalQty, nowStr, categoryName } from './helpers'
import { Breadcrumb, StatusBar, M2O, TabBar, Sheet, Row, Static, ErrorBanner, dtInput, dtOutput, fmtQty } from './components'
import { PageHeader, PrimaryButton, GhostButton, SearchBox, Table, Pill, EmptyState, inputCls } from '../shared/ui'

const STATE_LABEL: Record<InventoryState, string> = { draft: 'Draft', cancel: 'Cancelled', confirm: 'In Progress', done: 'Validated' }
const TONE: Record<InventoryState, 'slate' | 'amber' | 'green' | 'red'> = { draft: 'slate', cancel: 'red', confirm: 'amber', done: 'green' }
const FILTERS: { id: InventoryFilter; label: string }[] = [{ id: 'none', label: 'All products' }, { id: 'category', label: 'One product category' }, { id: 'product', label: 'One product only' }, { id: 'partial', label: 'Select products manually' }]
const STEPS = [{ id: 'draft', label: 'Draft' }, { id: 'confirm', label: 'In Progress' }, { id: 'done', label: 'Validated' }]
type Tab = 'lines' | 'moves'
type LineRow = Omit<InventoryLine, 'id' | 'inventory_id'> & { key: string }

export function AdjustmentsPage({ inv, readOnly, searchQuery }: { inv: InventoryApi; readOnly: boolean; searchQuery: string }) {
  const { s } = inv
  const [local, setLocal] = useState('')
  const [open, setOpen] = useState<ID | 'new' | null>(null)
  const q = (local || searchQuery).trim().toLowerCase()
  const rows = s.inventories.filter(i => !q || i.name.toLowerCase().includes(q))
  if (open !== null) return <AdjustmentForm inv={inv} id={open === 'new' ? undefined : open} readOnly={readOnly} onClose={() => setOpen(null)} />
  return (
    <div className="space-y-4">
      <PageHeader title="Inventory Adjustments" actions={<>
        <SearchBox value={local} onChange={setLocal} placeholder="Search reference…" />
        {!readOnly && <PrimaryButton onClick={() => setOpen('new')}><Plus size={16} />Create</PrimaryButton>}
      </>} />
      <Table head={['Inventory Reference', 'Inventory Date', 'Status']} empty={rows.length === 0 ? <EmptyState title="No inventory adjustments" /> : null}>
        {rows.map(i => (
          <tr key={i.id} onClick={() => setOpen(i.id)} className="hover:bg-slate-50 cursor-pointer">
            <td className="px-3 py-2.5 font-bold text-slate-900">{i.name}</td><td className="px-3 py-2.5 font-mono text-slate-600">{i.date}</td>
            <td className="px-3 py-2.5"><Pill tone={TONE[i.state]}>{STATE_LABEL[i.state]}</Pill></td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

function AdjustmentForm({ inv, id, readOnly, onClose }: { inv: InventoryApi; id?: ID; readOnly: boolean; onClose: () => void }) {
  const { s } = inv
  const existing = s.inventories.find(i => i.id === id)
  const [h, setH] = useState<Inventory>(() => existing ?? { id: 0, name: '', date: nowStr(), location_id: s.warehouses[0]?.lot_stock_id ?? 0, filter: 'none', exhausted: false, state: 'draft' })
  const [lines, setLines] = useState<LineRow[]>(() => s.inventory_lines.filter(l => l.inventory_id === id).map(l => ({ key: String(l.id), product_id: l.product_id, product_uom_id: l.product_uom_id, location_id: l.location_id, theoretical_qty: l.theoretical_qty, product_qty: l.product_qty })))
  const [tab, setTab] = useState<Tab>('lines')
  const [err, setErr] = useState('')
  const set = <K extends keyof Inventory>(k: K, v: Inventory[K]) => setH(p => ({ ...p, [k]: v }))
  const draft = h.state === 'draft'
  const headEdit = !readOnly && draft
  const countEdit = !readOnly && (h.state === 'draft' || h.state === 'confirm')
  const locOpts = s.locations.filter(l => l.active && l.usage === 'internal').map(l => ({ id: l.id, label: completeName(s, l.id) }))
  const moves = existing ? s.moves.filter(m => m.inventory_id === existing.id) : []
  const setLine = (key: string, patch: Partial<LineRow>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  const retheory = (key: string, pid: number | undefined, loc: number) => {
    const p = getProduct(s, pid)
    setLine(key, { product_id: pid ?? 0, product_uom_id: p?.uom_id ?? 0, location_id: loc, theoretical_qty: pid ? theoreticalQty(s, pid, loc) : 0 })
  }
  const save = () => {
    if (!h.name.trim()) return setErr('Inventory Reference is required.')
    const r = inv.save('inventories', { ...h, name: h.name.trim() })
    inv.removeWhere('inventory_lines', l => l.inventory_id === r)
    lines.filter(l => l.product_id).forEach(l => inv.save('inventory_lines', { inventory_id: r, product_id: l.product_id, product_uom_id: l.product_uom_id, location_id: l.location_id, theoretical_qty: l.theoretical_qty, product_qty: l.product_qty }))
    onClose()
  }
  const btn = (label: string, show: boolean, primary = false) => show && <button key={label} disabled title="Workflow actions are not part of this UI-only version" className={`px-4 py-2 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed ${primary ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{label}</button>

  return (
    <div className="space-y-3 max-w-6xl">
      <Breadcrumb parent="Inventory Adjustments" current={existing ? existing.name : 'New'} onBack={onClose} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">{btn('Start Inventory', h.state === 'draft' && !!existing, true)}{btn('Validate Inventory', h.state === 'confirm', true)}{btn('Set to Draft', h.state === 'cancel')}{btn('Cancel Inventory', h.state === 'confirm')}</div>
        <StatusBar steps={STEPS} value={h.state === 'cancel' ? 'draft' : h.state} />
      </div>
      <ErrorBanner text={err} />
      <Sheet>
        <div className="grid lg:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <Row label="Inventory Reference">{headEdit ? <input aria-label="Inventory Reference" className={inputCls} placeholder="e.g. Annual inventory" value={h.name} onChange={e => set('name', e.target.value)} /> : <Static>{h.name}</Static>}</Row>
            <Row label="Inventoried Location">{headEdit ? <M2O label="Inventoried Location" value={h.location_id} onChange={v => set('location_id', v ?? 0)} options={locOpts} /> : <Static>{completeName(s, h.location_id)}</Static>}</Row>
            <Row label="Inventory of">{headEdit ? <select aria-label="Inventory of" className={inputCls} value={h.filter} onChange={e => set('filter', e.target.value as InventoryFilter)}>{FILTERS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select> : <Static>{FILTERS.find(f => f.id === h.filter)?.label}</Static>}</Row>
          </div>
          <div className="space-y-2">
            <Row label="Inventory Date">{headEdit ? <input type="datetime-local" aria-label="Inventory Date" className={inputCls} value={dtInput(h.date)} onChange={e => set('date', dtOutput(e.target.value))} /> : <Static>{h.date}</Static>}</Row>
            {h.filter === 'product' && <Row label="Inventoried Product">{headEdit ? <M2O label="Inventoried Product" value={h.product_id} onChange={v => set('product_id', v)} options={s.products.filter(p => p.type === 'product').map(p => ({ id: p.id, label: productLabel(p) }))} /> : <Static>{productLabel(getProduct(s, h.product_id))}</Static>}</Row>}
            {h.filter === 'category' && <Row label="Product Category">{headEdit ? <M2O label="Product Category" value={h.category_id} onChange={v => set('category_id', v)} options={s.categories.map(c => ({ id: c.id, label: categoryName(s, c.id) }))} /> : <Static>{categoryName(s, h.category_id)}</Static>}</Row>}
            {(h.filter === 'none' || h.filter === 'category') && <Row label="Include Exhausted Products"><input type="checkbox" aria-label="Include Exhausted Products" disabled={!headEdit} checked={h.exhausted} onChange={e => set('exhausted', e.target.checked)} /></Row>}
          </div>
        </div>
        <TabBar<Tab> value={tab} onChange={setTab} tabs={[{ id: 'lines', label: 'Inventory Details' }, { id: 'moves', label: 'Inventory Adjustments' }]} />
        {tab === 'lines' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="py-2 text-left font-bold">Product</th><th className="text-left font-bold">Product Unit of Measure</th><th className="text-left font-bold">Location</th><th className="text-right font-bold w-32">Theoretical Quantity</th><th className="text-right font-bold w-32">Checked Quantity</th><th className="w-8" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map(l => (
                  <tr key={l.key}>
                    <td className="py-1.5 pr-2 min-w-48">{headEdit ? <M2O label="Product" value={l.product_id} onChange={v => retheory(l.key, v, l.location_id)} options={s.products.filter(p => p.type === 'product').map(p => ({ id: p.id, label: productLabel(p) }))} /> : <span className="font-bold">{productLabel(getProduct(s, l.product_id))}</span>}</td>
                    <td className="text-slate-600">{getUom(s, l.product_uom_id)?.name}</td>
                    <td className="pr-2 min-w-44">{headEdit ? <M2O label="Location" value={l.location_id} onChange={v => retheory(l.key, l.product_id, v ?? 0)} options={locOpts} /> : <span className="text-slate-600">{completeName(s, l.location_id)}</span>}</td>
                    <td className="text-right font-mono text-slate-500">{fmtQty(l.theoretical_qty)}</td>
                    <td className="pl-2"><input aria-label="Checked Quantity" type="number" min={0} disabled={!countEdit} className={`${inputCls} text-right`} value={l.product_qty} onChange={e => setLine(l.key, { product_qty: Number(e.target.value) || 0 })} /></td>
                    <td>{headEdit && <button aria-label="Remove line" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {headEdit && <button onClick={() => setLines(ls => [...ls, { key: `n${Date.now()}`, product_id: 0, product_uom_id: 0, location_id: h.location_id, theoretical_qty: 0, product_qty: 0 }])} className="mt-2 text-xs font-bold text-emerald-700 hover:underline">Add a line</button>}
            {lines.length === 0 && !headEdit && <EmptyState title="No inventory lines" />}
          </div>
        )}
        {tab === 'moves' && (
          <Table head={['Product', 'From', 'To', { label: 'Quantity Done', right: true }, 'Unit of Measure', 'Status']} empty={moves.length === 0 ? <EmptyState title="No adjustments yet" text="Moves are created when the inventory is validated." /> : null}>
            {moves.map(m => <tr key={m.id}><td className="px-3 py-2 font-bold">{productLabel(getProduct(s, m.product_id))}</td><td className="px-3 py-2 text-slate-600">{completeName(s, m.location_id)}</td><td className="px-3 py-2 text-slate-600">{completeName(s, m.location_dest_id)}</td><td className="px-3 py-2 text-right font-mono">{fmtQty(m.product_uom_qty)}</td><td className="px-3 py-2">{getUom(s, m.product_uom)?.name}</td><td className="px-3 py-2"><Pill tone="green">{m.state}</Pill></td></tr>)}
          </Table>
        )}
      </Sheet>
      <div className="flex gap-2">{!readOnly && h.state !== 'done' && <PrimaryButton onClick={save}>Save</PrimaryButton>}<GhostButton onClick={onClose}>Discard</GhostButton></div>
    </div>
  )
}
