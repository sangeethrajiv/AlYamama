import { useMemo, useState } from 'react'
import { moneyFormat } from '../../data/mockAccountingData'
import type { InventoryApi } from './useInventory'
import type { MoveType } from './types'
import { PageHeader, Segmented, SearchBox, Table, Pill, EmptyState, Kpi } from '../shared/ui'

export function StockOnHandPage({ inv, searchQuery }: { inv: InventoryApi; searchQuery: string }) {
  const [view, setView] = useState<'product' | 'location'>('product')
  const [local, setLocal] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const q = (local || searchQuery).trim().toLowerCase()
  const catOf = (sku: string) => inv.categories.find(c => c.id === inv.products.find(p => p.sku === sku)?.categoryId)?.name || '—'
  const minOf = (sku: string) => inv.rules.filter(r => r.sku === sku).reduce((s, r) => s + r.min, 0)

  const byProduct = useMemo(() => {
    const m = new Map<string, { sku: string; name: string; uom: string; qty: number; value: number; locs: Set<string> }>()
    inv.quants.forEach(x => {
      const e = m.get(x.productCode) ?? { sku: x.productCode, name: x.productName, uom: x.uom, qty: 0, value: 0, locs: new Set<string>() }
      e.qty += x.onHand; e.value += x.onHand * x.unitCost; e.locs.add(x.location); m.set(x.productCode, e)
    })
    return [...m.values()].filter(e => (!q || e.sku.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)) && (!lowOnly || (minOf(e.sku) > 0 && e.qty < minOf(e.sku))))
  }, [inv.quants, inv.rules, q, lowOnly])

  const lines = inv.quants.filter(x => !q || [x.productCode, x.productName, x.location, x.lot].some(v => v?.toLowerCase().includes(q)))
  const totalValue = inv.quants.reduce((s, x) => s + x.onHand * x.unitCost, 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Stock On Hand" subtitle="Live quantities and valuation per product and location."
        actions={<>
          <SearchBox value={local} onChange={setLocal} placeholder="Search SKU, product, lot…" />
          <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} />Below minimum only</label>
        </>} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Kpi label="Stock value" value={moneyFormat(totalValue)} />
        <Kpi label="Products in stock" value={new Set(inv.quants.filter(x => x.onHand > 0).map(x => x.productCode)).size} />
        <Kpi label="Stock lines" value={inv.quants.length} hint="Product · location · lot" />
      </div>
      <Segmented value={view} onChange={setView} options={[{ id: 'product', label: 'By product' }, { id: 'location', label: 'By location / lot' }]} />
      {view === 'product' ? (
        <Table head={['SKU', 'Product', 'Category', 'Locations', { label: 'On hand', right: true }, { label: 'Value', right: true }, 'Level']}
          empty={byProduct.length === 0 ? <EmptyState title="Nothing matches" /> : null}>
          {byProduct.map(e => {
            const min = minOf(e.sku)
            return (
              <tr key={e.sku}>
                <td className="px-3 py-2.5 font-mono text-slate-600">{e.sku}</td><td className="px-3 py-2.5 font-bold text-slate-900">{e.name}</td>
                <td className="px-3 py-2.5 text-slate-600">{catOf(e.sku)}</td><td className="px-3 py-2.5 text-slate-500">{e.locs.size}</td>
                <td className="px-3 py-2.5 text-right font-mono">{e.qty} {e.uom}</td><td className="px-3 py-2.5 text-right font-mono">{moneyFormat(e.value)}</td>
                <td className="px-3 py-2.5">{min > 0 ? (e.qty < min ? <Pill tone="red">Below min {min}</Pill> : <Pill tone="green">OK</Pill>) : <span className="text-slate-300">—</span>}</td>
              </tr>
            )
          })}
        </Table>
      ) : (
        <Table head={['Location', 'SKU', 'Product', 'Lot / serial', { label: 'On hand', right: true }, { label: 'Unit cost', right: true }]}
          empty={lines.length === 0 ? <EmptyState title="Nothing matches" /> : null}>
          {[...lines].sort((a, b) => a.location.localeCompare(b.location)).map(x => (
            <tr key={x.id}><td className="px-3 py-2.5 font-mono text-slate-600">{x.location}</td><td className="px-3 py-2.5 font-mono">{x.productCode}</td>
              <td className="px-3 py-2.5 font-bold text-slate-900">{x.productName}</td><td className="px-3 py-2.5 text-slate-500">{x.lot || '—'}</td>
              <td className="px-3 py-2.5 text-right font-mono">{x.onHand} {x.uom}</td><td className="px-3 py-2.5 text-right font-mono">{moneyFormat(x.unitCost)}</td></tr>
          ))}
        </Table>
      )}
    </div>
  )
}

const TONE: Record<MoveType, 'green' | 'amber' | 'blue' | 'slate'> = { receipt: 'green', delivery: 'amber', internal: 'blue', adjustment: 'slate' }

export function StockMovesPage({ inv, searchQuery }: { inv: InventoryApi; searchQuery: string }) {
  const [type, setType] = useState<'all' | MoveType>('all')
  const [local, setLocal] = useState('')
  const q = (local || searchQuery).trim().toLowerCase()
  const rows = inv.moves.filter(m => (type === 'all' || m.type === type) && (!q || [m.reference, m.sku, m.productName, m.from, m.to, m.lot].some(v => v?.toLowerCase().includes(q))))
  const n = (t: MoveType) => inv.moves.filter(m => m.type === t).length
  return (
    <div className="space-y-4">
      <PageHeader title="Stock Movements" subtitle="Every receipt, delivery, transfer and adjustment, newest first." actions={<SearchBox value={local} onChange={setLocal} placeholder="Search reference, SKU, location…" />} />
      <Segmented value={type} onChange={setType} options={[{ id: 'all', label: 'All', count: inv.moves.length }, { id: 'receipt', label: 'Receipts', count: n('receipt') }, { id: 'delivery', label: 'Deliveries', count: n('delivery') }, { id: 'internal', label: 'Internal', count: n('internal') }, { id: 'adjustment', label: 'Adjustments', count: n('adjustment') }]} />
      <Table head={['Date', 'Reference', 'Type', 'Product', 'From', 'To', { label: 'Quantity', right: true }]} empty={rows.length === 0 ? <EmptyState title="No movements" /> : null}>
        {rows.map(m => (
          <tr key={m.id}><td className="px-3 py-2.5 font-mono text-slate-600">{m.date}</td><td className="px-3 py-2.5 font-bold">{m.reference}</td><td className="px-3 py-2.5"><Pill tone={TONE[m.type]}>{m.type}</Pill></td>
            <td className="px-3 py-2.5"><div className="font-bold text-slate-900">{m.productName}</div><div className="text-[10px] text-slate-500 font-mono">{m.sku}{m.lot ? ` · ${m.lot}` : ''}</div></td>
            <td className="px-3 py-2.5 text-slate-600">{m.from}</td><td className="px-3 py-2.5 text-slate-600">{m.to}</td><td className="px-3 py-2.5 text-right font-mono">{m.qty} {m.uom}</td></tr>
        ))}
      </Table>
    </div>
  )
}
