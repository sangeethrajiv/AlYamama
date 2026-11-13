import { useState } from 'react'
import type { InventoryApi } from './useInventory'
import type { MoveState } from './types'
import { completeName, productLabel, getProduct, getUom, categoryName } from './helpers'
import { fmtQty } from './components'
import { PageHeader, SearchBox, Table, Pill, EmptyState } from '../shared/ui'

const tone = (st: MoveState) => (st === 'done' ? 'green' : st === 'cancel' ? 'red' : st === 'assigned' ? 'blue' : 'amber') as 'green' | 'red' | 'blue' | 'amber'
const LABEL: Record<MoveState, string> = { draft: 'New', cancel: 'Cancelled', waiting: 'Waiting Another Move', confirmed: 'Waiting Availability', partially_available: 'Partially Available', assigned: 'Available', done: 'Done' }

/** Inventory Report: stock.quant list (stock on hand per product and location). */
export function StockPage({ inv, searchQuery }: { inv: InventoryApi; searchQuery: string }) {
  const { s } = inv
  const [local, setLocal] = useState('')
  const [loc, setLoc] = useState('')
  const q = (local || searchQuery).trim().toLowerCase()
  const rows = s.quants.filter(k => getProduct(s, k.product_id)?.type === 'product' && s.locations.find(l => l.id === k.location_id)?.usage === 'internal' && (!loc || String(k.location_id) === loc) && (!q || productLabel(getProduct(s, k.product_id)).toLowerCase().includes(q) || completeName(s, k.location_id).toLowerCase().includes(q)))
  const locs = [...new Set(s.quants.map(k => k.location_id))]
  return (
    <div className="space-y-4">
      <PageHeader title="Inventory Report" subtitle="Stock on hand by product and location." actions={<>
        <select aria-label="Location" value={loc} onChange={e => setLoc(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"><option value="">All locations</option>{locs.map(id => <option key={id} value={id}>{completeName(s, id)}</option>)}</select>
        <SearchBox value={local} onChange={setLocal} placeholder="Search product or location…" />
      </>} />
      <Table head={['Product', 'Product Category', 'Location', { label: 'Reserved Quantity', right: true }, { label: 'Quantity', right: true }, 'Unit of Measure', 'Incoming Date']} empty={rows.length === 0 ? <EmptyState title="No stock found" /> : null}>
        {rows.map(k => { const p = getProduct(s, k.product_id); return (
          <tr key={k.id}><td className="px-3 py-2.5 font-bold text-slate-900">{productLabel(p)}</td><td className="px-3 py-2.5 text-slate-600">{categoryName(s, p?.categ_id)}</td><td className="px-3 py-2.5 text-slate-600">{completeName(s, k.location_id)}</td>
            <td className="px-3 py-2.5 text-right font-mono text-slate-500">{fmtQty(k.reserved_quantity)}</td><td className="px-3 py-2.5 text-right font-mono font-bold">{fmtQty(k.quantity)}</td><td className="px-3 py-2.5 text-slate-600">{getUom(s, p?.uom_id)?.name}</td><td className="px-3 py-2.5 font-mono text-slate-500">{k.in_date}</td></tr>
        ) })}
      </Table>
    </div>
  )
}

/** Stock Moves (stock.move). */
export function MovesPage({ inv, searchQuery }: { inv: InventoryApi; searchQuery: string }) {
  const { s } = inv
  const [local, setLocal] = useState('')
  const q = (local || searchQuery).trim().toLowerCase()
  const rows = s.moves.filter(m => !q || m.reference.toLowerCase().includes(q) || productLabel(getProduct(s, m.product_id)).toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="space-y-4">
      <PageHeader title="Stock Moves" actions={<SearchBox value={local} onChange={setLocal} placeholder="Search reference or product…" />} />
      <Table head={['Date', 'Reference', 'Product', 'From', 'To', { label: 'Initial Demand', right: true }, 'Unit of Measure', 'Status']} empty={rows.length === 0 ? <EmptyState title="No stock moves" /> : null}>
        {rows.map(m => <tr key={m.id}><td className="px-3 py-2.5 font-mono text-slate-600">{m.date}</td><td className="px-3 py-2.5 font-bold">{m.reference}</td><td className="px-3 py-2.5">{productLabel(getProduct(s, m.product_id))}</td><td className="px-3 py-2.5 text-slate-600">{completeName(s, m.location_id)}</td><td className="px-3 py-2.5 text-slate-600">{completeName(s, m.location_dest_id)}</td><td className="px-3 py-2.5 text-right font-mono">{fmtQty(m.product_uom_qty)}</td><td className="px-3 py-2.5">{getUom(s, m.product_uom)?.name}</td><td className="px-3 py-2.5"><Pill tone={tone(m.state)}>{LABEL[m.state]}</Pill></td></tr>)}
      </Table>
    </div>
  )
}

/** Moves History (stock.move.line). */
export function MoveLinesPage({ inv, searchQuery }: { inv: InventoryApi; searchQuery: string }) {
  const { s } = inv
  const [local, setLocal] = useState('')
  const q = (local || searchQuery).trim().toLowerCase()
  const rows = s.move_lines.filter(l => !q || l.reference.toLowerCase().includes(q) || productLabel(getProduct(s, l.product_id)).toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="space-y-4">
      <PageHeader title="Moves History" actions={<SearchBox value={local} onChange={setLocal} placeholder="Search reference or product…" />} />
      <Table head={['Date', 'Reference', 'Product', 'From', 'To', { label: 'Reserved', right: true }, { label: 'Done', right: true }, 'Unit of Measure', 'Status']} empty={rows.length === 0 ? <EmptyState title="No move lines" /> : null}>
        {rows.map(l => <tr key={l.id}><td className="px-3 py-2.5 font-mono text-slate-600">{l.date}</td><td className="px-3 py-2.5 font-bold">{l.reference}</td><td className="px-3 py-2.5">{productLabel(getProduct(s, l.product_id))}</td><td className="px-3 py-2.5 text-slate-600">{completeName(s, l.location_id)}</td><td className="px-3 py-2.5 text-slate-600">{completeName(s, l.location_dest_id)}</td><td className="px-3 py-2.5 text-right font-mono text-slate-500">{fmtQty(l.product_uom_qty)}</td><td className="px-3 py-2.5 text-right font-mono font-bold">{fmtQty(l.qty_done)}</td><td className="px-3 py-2.5">{getUom(s, l.product_uom_id)?.name}</td><td className="px-3 py-2.5"><Pill tone={tone(l.state)}>{LABEL[l.state]}</Pill></td></tr>)}
      </Table>
    </div>
  )
}
