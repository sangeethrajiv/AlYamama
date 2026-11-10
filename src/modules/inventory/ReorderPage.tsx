import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { InventoryApi } from './useInventory'
import type { ReorderRule } from './types'
import { PageHeader, PrimaryButton, GhostButton, Table, Pill, EmptyState, Drawer, Field, Card, inputCls, today } from '../shared/ui'

export function ReorderPage({ inv, readOnly, onGoReceipts }: { inv: InventoryApi; readOnly: boolean; onGoReceipts: () => void }) {
  const [edit, setEdit] = useState<ReorderRule | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const stock = (r: ReorderRule) => inv.quants.filter(q => q.productCode === r.sku && q.location.split('/')[0] === r.warehouseCode).reduce((s, q) => s + q.onHand, 0)
  const incoming = (r: ReorderRule) => inv.transfers.filter(t => t.kind === 'receipt' && (t.state === 'draft' || t.state === 'ready')).flatMap(t => t.lines).filter(l => l.sku === r.sku).reduce((s, l) => s + l.demand, 0)
  const need = (r: ReorderRule) => {
    const gap = r.max - stock(r) - incoming(r)
    return gap <= 0 ? 0 : Math.ceil(gap / (r.multiple || 1)) * (r.multiple || 1)
  }
  const below = inv.rules.filter(r => stock(r) < r.min && need(r) > 0)

  const order = (list: ReorderRule[]) => {
    const bySupplier = new Map<string, ReorderRule[]>()
    list.forEach(r => { const v = inv.products.find(p => p.sku === r.sku)?.vendor || ''; bySupplier.set(v, [...(bySupplier.get(v) || []), r]) })
    let n = 0
    bySupplier.forEach((rs, vendor) => {
      const wh = rs[0].warehouseCode
      const ref = `${wh}/IN/${String(inv.transfers.filter(t => t.kind === 'receipt').length + 1 + n).padStart(4, '0')}`
      n++
      inv.saveTransfer({
        id: `tr_${Date.now()}_${n}`, reference: ref, kind: 'receipt', state: 'draft', partner: vendor, sourceDoc: 'Reorder', scheduled: today(), from: 'Partners/Vendors', to: `${wh}/Stock`, notes: 'Created from reordering rules',
        lines: rs.map((r, i) => { const p = inv.products.find(x => x.sku === r.sku); return { id: `l_${i}`, sku: r.sku, productName: p?.name || r.sku, uom: p?.uom || 'Units', demand: need(r) } }),
      })
    })
    setMsg(`${n} draft receipt${n === 1 ? '' : 's'} created.`)
  }

  const save = () => {
    if (!edit) return
    if (!edit.sku) return setErr('Choose a product.')
    if (edit.min < 0 || edit.max <= 0) return setErr('Quantities must be positive.')
    if (edit.max < edit.min) return setErr('Maximum must be at least the minimum.')
    if (inv.rules.some(r => r.id !== edit.id && r.sku === edit.sku && r.warehouseCode === edit.warehouseCode)) return setErr('A rule for this product and warehouse already exists.')
    inv.saveRule(edit); setEdit(null); setErr('')
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Reordering Rules" subtitle="When stock falls below the minimum, order enough to reach the maximum."
        actions={<>
          {!readOnly && below.length > 0 && <GhostButton onClick={() => order(below)}>Order all below minimum ({below.length})</GhostButton>}
          {!readOnly && <PrimaryButton onClick={() => { setErr(''); setEdit({ id: `rr_${Date.now()}`, sku: '', warehouseCode: inv.warehouses[0]?.code || 'WH', min: 0, max: 0, multiple: 1 }) }}><Plus size={16} />New Rule</PrimaryButton>}
        </>} />
      {msg && <div role="status" className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2 flex items-center justify-between">{msg}<button className="font-bold underline" onClick={onGoReceipts}>View receipts</button></div>}
      <Table head={['Product', 'Warehouse', { label: 'On hand', right: true }, { label: 'Incoming', right: true }, { label: 'Min', right: true }, { label: 'Max', right: true }, { label: 'To order', right: true }, 'Status', '']}
        empty={inv.rules.length === 0 ? <EmptyState title="No rules" text="Create a rule to be warned before you run out." /> : null}>
        {inv.rules.map(r => {
          const p = inv.products.find(x => x.sku === r.sku); const s = stock(r); const low = s < r.min
          return (
            <tr key={r.id} onClick={() => !readOnly && (setErr(''), setEdit(r))} className="hover:bg-slate-50 cursor-pointer">
              <td className="px-3 py-2.5"><div className="font-bold text-slate-900">{p?.name || r.sku}</div><div className="font-mono text-[10px] text-slate-500">{r.sku}</div></td>
              <td className="px-3 py-2.5 font-mono">{r.warehouseCode}</td><td className="px-3 py-2.5 text-right font-mono">{s}</td><td className="px-3 py-2.5 text-right font-mono">{incoming(r) || '—'}</td>
              <td className="px-3 py-2.5 text-right font-mono">{r.min}</td><td className="px-3 py-2.5 text-right font-mono">{r.max}</td>
              <td className="px-3 py-2.5 text-right font-mono font-bold">{low ? need(r) : '—'}</td>
              <td className="px-3 py-2.5">{low ? (need(r) > 0 ? <Pill tone="red">Below minimum</Pill> : <Pill tone="amber">Covered by incoming</Pill>) : <Pill tone="green">OK</Pill>}</td>
              <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>{!readOnly && low && need(r) > 0 && <GhostButton onClick={() => order([r])}>Order now</GhostButton>}</td>
            </tr>
          )
        })}
      </Table>
      {edit && (
        <Drawer title={inv.rules.some(r => r.id === edit.id) ? 'Edit Rule' : 'New Rule'} onClose={() => setEdit(null)}
          footer={<>
            {inv.rules.some(r => r.id === edit.id) && <GhostButton danger onClick={() => { inv.deleteRule(edit.id); setEdit(null) }}><Trash2 size={12} className="inline -mt-0.5 mr-1" />Delete</GhostButton>}
            <GhostButton onClick={() => setEdit(null)}>Cancel</GhostButton><PrimaryButton onClick={save}>Save rule</PrimaryButton></>}>
          {err && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{err}</div>}
          <Card><div className="grid sm:grid-cols-2 gap-3">
            <Field label="Product *" span={2}><select className={inputCls} value={edit.sku} onChange={e => setEdit({ ...edit, sku: e.target.value })}><option value="">Select…</option>{inv.products.filter(p => p.active && p.type === 'storable').map(p => <option key={p.id} value={p.sku}>{p.sku} — {p.name}</option>)}</select></Field>
            <Field label="Warehouse"><select className={inputCls} value={edit.warehouseCode} onChange={e => setEdit({ ...edit, warehouseCode: e.target.value })}>{inv.warehouses.map(w => <option key={w.id} value={w.code}>{w.name}</option>)}</select></Field>
            <Field label="Order multiple"><input type="number" min={1} className={inputCls} value={edit.multiple} onChange={e => setEdit({ ...edit, multiple: Math.max(1, Number(e.target.value) || 1) })} /></Field>
            <Field label="Minimum quantity"><input type="number" min={0} className={inputCls} value={edit.min} onChange={e => setEdit({ ...edit, min: Number(e.target.value) || 0 })} /></Field>
            <Field label="Maximum quantity"><input type="number" min={0} className={inputCls} value={edit.max} onChange={e => setEdit({ ...edit, max: Number(e.target.value) || 0 })} /></Field>
          </div></Card>
        </Drawer>
      )}
    </div>
  )
}
