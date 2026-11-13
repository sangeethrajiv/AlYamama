import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Contact } from '../contacts/types'
import type { InventoryApi } from './useInventory'
import type { Picking, PickingState, PickingTypeCode, ID } from './types'
import { completeName, productLabel, getProduct, getUom, nowStr } from './helpers'
import { Breadcrumb, StatusBar, M2O, TabBar, Sheet, Row, Static, ErrorBanner, dtInput, dtOutput, fmtQty } from './components'
import { PageHeader, PrimaryButton, GhostButton, Segmented, SearchBox, Table, Pill, EmptyState, inputCls } from '../shared/ui'

const STATE_LABEL: Record<PickingState, string> = { draft: 'Draft', waiting: 'Waiting Another Operation', confirmed: 'Waiting', assigned: 'Ready', done: 'Done', cancel: 'Cancelled' }
const TONE: Record<PickingState, 'slate' | 'amber' | 'blue' | 'green' | 'red'> = { draft: 'slate', waiting: 'amber', confirmed: 'amber', assigned: 'blue', done: 'green', cancel: 'red' }
const STEPS = [{ id: 'draft', label: 'Draft' }, { id: 'confirmed', label: 'Waiting' }, { id: 'assigned', label: 'Ready' }, { id: 'done', label: 'Done' }]
const PARTNER_LABEL: Record<PickingTypeCode, string> = { incoming: 'Receive From', outgoing: 'Delivery Address', internal: 'Partner' }

/** Lines of the form being edited (stock.move: product, description, initial demand, unit of measure). */
interface Line { key: string; product_id?: ID; name: string; product_uom_qty: number; product_uom?: ID }

interface Props { inv: InventoryApi; contacts: Contact[]; code?: PickingTypeCode; typeId?: ID; readOnly: boolean; searchQuery: string }

export function TransfersPage({ inv, contacts, code, typeId, readOnly, searchQuery }: Props) {
  const { s } = inv
  const [filter, setFilter] = useState<'all' | PickingState>('all')
  const [local, setLocal] = useState('')
  const [open, setOpen] = useState<ID | 'new' | null>(null)
  const title = code === 'incoming' ? 'Receipts' : code === 'outgoing' ? 'Delivery Orders' : code === 'internal' ? 'Internal Transfers' : 'Transfers'
  const typeOf = (id: ID) => s.picking_types.find(t => t.id === id)
  const partnerName = (id?: string) => contacts.find(c => c.id === id)?.name ?? ''
  const q = (local || searchQuery).trim().toLowerCase()
  const scoped = s.pickings.filter(p => (!code || typeOf(p.picking_type_id)?.code === code) && (!typeId || p.picking_type_id === typeId))
  const rows = scoped.filter(p => (filter === 'all' || p.state === filter) && (!q || [p.name, p.origin, partnerName(p.partner_id)].some(v => v.toLowerCase().includes(q))))
  const n = (st: PickingState) => scoped.filter(p => p.state === st).length

  if (open !== null) return <TransferForm inv={inv} contacts={contacts} id={open === 'new' ? undefined : open} code={code} typeId={typeId} title={title} readOnly={readOnly} onClose={() => setOpen(null)} />
  return (
    <div className="space-y-4">
      <PageHeader title={title} actions={<>
        <SearchBox value={local} onChange={setLocal} placeholder="Search reference, partner, source…" />
        {!readOnly && <PrimaryButton onClick={() => setOpen('new')}><Plus size={16} />Create</PrimaryButton>}
      </>} />
      <Segmented value={filter} onChange={setFilter} options={[
        { id: 'all', label: 'All', count: scoped.length }, { id: 'draft', label: 'Draft', count: n('draft') }, { id: 'confirmed', label: 'Waiting', count: n('confirmed') + n('waiting') },
        { id: 'assigned', label: 'Ready', count: n('assigned') }, { id: 'done', label: 'Done', count: n('done') }, { id: 'cancel', label: 'Cancelled', count: n('cancel') },
      ]} />
      <Table head={['Reference', 'To', 'Contact', 'Scheduled Date', 'Source Document', 'Back Order of', 'Status']} empty={rows.length === 0 ? <EmptyState title="No transfers found" /> : null}>
        {rows.map(p => (
          <tr key={p.id} onClick={() => setOpen(p.id)} className="hover:bg-slate-50 cursor-pointer">
            <td className="px-3 py-2.5 font-bold text-slate-900">{p.name}</td>
            <td className="px-3 py-2.5 text-slate-600">{completeName(s, p.location_dest_id)}</td>
            <td className="px-3 py-2.5 text-slate-600">{partnerName(p.partner_id) || '—'}</td>
            <td className="px-3 py-2.5 font-mono text-slate-600">{p.scheduled_date}</td>
            <td className="px-3 py-2.5 font-mono text-slate-500">{p.origin || '—'}</td>
            <td className="px-3 py-2.5 text-slate-500">{s.pickings.find(x => x.id === p.backorder_id)?.name || '—'}</td>
            <td className="px-3 py-2.5"><Pill tone={TONE[p.state]}>{STATE_LABEL[p.state]}</Pill></td>
          </tr>
        ))}
      </Table>
    </div>
  )
}

type Tab = 'ops' | 'detail' | 'info' | 'note'

function TransferForm({ inv, contacts, id, code, typeId, title, readOnly, onClose }: { inv: InventoryApi; contacts: Contact[]; id?: ID; code?: PickingTypeCode; typeId?: ID; title: string; readOnly: boolean; onClose: () => void }) {
  const { s } = inv
  const existing = s.pickings.find(p => p.id === id)
  const defaultType = s.picking_types.find(t => t.id === typeId) ?? s.picking_types.find(t => t.active && (!code || t.code === code)) ?? s.picking_types[0]
  const [h, setH] = useState<Picking>(() => existing ?? {
    id: 0, name: '/', origin: '', note: '', move_type: 'direct', state: 'draft', priority: '1', scheduled_date: nowStr(), date: nowStr(),
    location_id: defaultType.default_location_src_id ?? 0, location_dest_id: defaultType.default_location_dest_id ?? 0, picking_type_id: defaultType.id,
  })
  const [lines, setLines] = useState<Line[]>(() => existing ? s.moves.filter(m => m.picking_id === existing.id).map(m => ({ key: String(m.id), product_id: m.product_id, name: m.name, product_uom_qty: m.product_uom_qty, product_uom: m.product_uom })) : [])
  const [tab, setTab] = useState<Tab>('ops')
  const [err, setErr] = useState('')
  const editable = !readOnly && h.state === 'draft'
  const type = s.picking_types.find(t => t.id === h.picking_type_id)
  const set = <K extends keyof Picking>(k: K, v: Picking[K]) => setH(p => ({ ...p, [k]: v }))
  const moves = existing ? s.moves.filter(m => m.picking_id === existing.id) : []
  const mlines = existing ? s.move_lines.filter(l => l.picking_id === existing.id) : []
  const locOpts = s.locations.filter(l => l.active && l.usage !== 'view').map(l => ({ id: l.id, label: completeName(s, l.id) }))
  const uomsFor = (pid?: ID) => { const p = getProduct(s, pid); const c = getUom(s, p?.uom_id)?.category_id; return s.uoms.filter(u => u.active && (!c || u.category_id === c)) }

  const changeType = (tid?: ID) => {
    const t = s.picking_types.find(x => x.id === tid)
    if (t) setH(p => ({ ...p, picking_type_id: t.id, location_id: t.default_location_src_id ?? p.location_id, location_dest_id: t.default_location_dest_id ?? p.location_dest_id }))
  }
  const setLine = (key: string, patch: Partial<Line>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)))
  const pickProduct = (key: string, pid?: ID) => { const p = getProduct(s, pid); setLine(key, { product_id: pid, name: productLabel(p), product_uom: p?.uom_id }) }

  const save = () => {
    const good = lines.filter(l => l.product_id)
    if (!h.picking_type_id) return setErr('Operation Type is required.')
    if (!h.location_id || !h.location_dest_id) return setErr('Source and destination locations are required.')
    if (good.some(l => !(l.product_uom_qty > 0))) return setErr('Initial Demand must be greater than zero.')
    const pid = inv.save('pickings', existing ? { ...h } : { ...h, name: `${type?.sequence_prefix ?? ''}${String(type?.sequence_next ?? 1).padStart(5, '0')}` })
    if (!existing && type) inv.save('picking_types', { ...type, sequence_next: type.sequence_next + 1 })
    // stock.move rows for the lines (a draft's previous rows are replaced)
    inv.removeWhere('moves', m => m.picking_id === pid)
    good.forEach((l, i) => {
      inv.save('moves', { name: l.name, sequence: (i + 1) * 10, date: h.scheduled_date, date_expected: h.scheduled_date, product_id: l.product_id!, product_uom_qty: l.product_uom_qty, product_uom: l.product_uom!, location_id: h.location_id, location_dest_id: h.location_dest_id, picking_id: pid, picking_type_id: h.picking_type_id, state: 'draft', origin: h.origin, reference: h.name, price_unit: getProduct(s, l.product_id)?.standard_price ?? 0 })
    })
    onClose()
  }

  const btn = (label: string, show: boolean, primary = false) => show && (primary
    ? <button key={label} disabled title="Workflow actions are not part of this UI-only version" className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold opacity-50 cursor-not-allowed">{label}</button>
    : <button key={label} disabled title="Workflow actions are not part of this UI-only version" className="px-3 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-xs font-bold opacity-50 cursor-not-allowed">{label}</button>)

  return (
    <div className="space-y-3 max-w-6xl">
      <Breadcrumb parent={title} current={existing ? h.name : 'New'} onBack={onClose} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {btn('Mark as Todo', h.state === 'draft', true)}
          {btn('Check Availability', h.state === 'confirmed' || h.state === 'waiting', true)}
          {btn('Validate', h.state === 'assigned', true)}
          {btn('Unreserve', h.state === 'assigned')}
          {btn('Return', h.state === 'done')}
          {btn('Cancel', h.state !== 'done' && h.state !== 'cancel' && !!existing)}
        </div>
        <StatusBar steps={STEPS} value={h.state === 'waiting' ? 'confirmed' : h.state} />
      </div>
      <ErrorBanner text={err} />
      <Sheet>
        <h2 className="text-2xl font-extrabold text-slate-900">{existing ? h.name : 'New'}</h2>
        <div className="grid lg:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <Row label={PARTNER_LABEL[type?.code ?? 'incoming']}>
              {editable ? <select aria-label="Partner" className={inputCls} value={h.partner_id ?? ''} onChange={e => set('partner_id', e.target.value || undefined)}><option value="" />{contacts.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                : <Static>{contacts.find(c => c.id === h.partner_id)?.name}</Static>}
            </Row>
            <Row label="Operation Type">{editable && !existing ? <M2O label="Operation Type" value={h.picking_type_id} onChange={changeType} options={s.picking_types.filter(t => t.active).map(t => ({ id: t.id, label: `${s.warehouses.find(w => w.id === t.warehouse_id)?.name ?? ''}: ${t.name}` }))} /> : <Static>{type ? `${s.warehouses.find(w => w.id === type.warehouse_id)?.name}: ${type.name}` : ''}</Static>}</Row>
            <Row label="Source Location">{editable ? <M2O label="Source Location" value={h.location_id} onChange={v => set('location_id', v ?? 0)} options={locOpts} /> : <Static>{completeName(s, h.location_id)}</Static>}</Row>
            <Row label="Destination Location">{editable ? <M2O label="Destination Location" value={h.location_dest_id} onChange={v => set('location_dest_id', v ?? 0)} options={locOpts} /> : <Static>{completeName(s, h.location_dest_id)}</Static>}</Row>
            {h.backorder_id && <Row label="Back Order of"><Static>{s.pickings.find(p => p.id === h.backorder_id)?.name}</Static></Row>}
          </div>
          <div className="space-y-2">
            <Row label="Scheduled Date">{editable ? <input type="datetime-local" aria-label="Scheduled Date" className={inputCls} value={dtInput(h.scheduled_date)} onChange={e => set('scheduled_date', dtOutput(e.target.value))} /> : <Static>{h.scheduled_date}</Static>}</Row>
            {h.state === 'done' && <Row label="Date of Transfer"><Static>{h.date_done}</Static></Row>}
            <Row label="Source Document">{editable ? <input aria-label="Source Document" className={inputCls} value={h.origin} onChange={e => set('origin', e.target.value)} /> : <Static>{h.origin}</Static>}</Row>
          </div>
        </div>
        <TabBar<Tab> value={tab} onChange={setTab} tabs={[{ id: 'ops', label: 'Operations' }, { id: 'detail', label: 'Detailed Operations' }, { id: 'info', label: 'Additional Info' }, { id: 'note', label: 'Note' }]} />
        {tab === 'ops' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="py-2 text-left font-bold">Product</th><th className="text-left font-bold">Description</th><th className="text-right font-bold w-28">Initial Demand</th><th className="text-right font-bold w-24">Reserved</th><th className="text-right font-bold w-24">Done</th><th className="text-left font-bold w-32 pl-3">Unit of Measure</th><th className="w-8" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {editable ? lines.map(l => (
                  <tr key={l.key}>
                    <td className="py-1.5 pr-2 min-w-48"><M2O label="Product" value={l.product_id} onChange={v => pickProduct(l.key, v)} options={s.products.filter(p => p.active && p.type !== 'service').map(p => ({ id: p.id, label: productLabel(p) }))} /></td>
                    <td className="pr-2"><input aria-label="Description" className={inputCls} value={l.name} onChange={e => setLine(l.key, { name: e.target.value })} /></td>
                    <td className="pr-2"><input aria-label="Initial Demand" type="number" min={0} className={`${inputCls} text-right`} value={l.product_uom_qty} onChange={e => setLine(l.key, { product_uom_qty: Number(e.target.value) })} /></td>
                    <td className="text-right text-slate-300">0</td><td className="text-right text-slate-300">0</td>
                    <td className="pl-3"><M2O label="Unit of Measure" value={l.product_uom} onChange={v => setLine(l.key, { product_uom: v })} options={uomsFor(l.product_id).map(u => ({ id: u.id, label: u.name }))} /></td>
                    <td><button aria-label="Remove line" onClick={() => setLines(ls => ls.filter(x => x.key !== l.key))} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></td>
                  </tr>
                )) : moves.map(m => (
                  <tr key={m.id}>
                    <td className="py-2 font-bold text-slate-800">{productLabel(getProduct(s, m.product_id))}</td><td className="text-slate-600">{m.name}</td>
                    <td className="text-right font-mono">{fmtQty(m.product_uom_qty)}</td>
                    <td className="text-right font-mono">{fmtQty(mlines.filter(l => l.move_id === m.id).reduce((a, l) => a + l.product_uom_qty, 0))}</td>
                    <td className="text-right font-mono">{fmtQty(mlines.filter(l => l.move_id === m.id).reduce((a, l) => a + l.qty_done, 0))}</td>
                    <td className="pl-3 text-slate-600">{getUom(s, m.product_uom)?.name}</td><td />
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button onClick={() => setLines(ls => [...ls, { key: `n${Date.now()}`, name: '', product_uom_qty: 1 }])} className="mt-2 text-xs font-bold text-emerald-700 hover:underline">Add a line</button>}
            {!editable && moves.length === 0 && <EmptyState title="No operations" />}
          </div>
        )}
        {tab === 'detail' && (
          <Table head={['Product', 'From', 'To', { label: 'Reserved', right: true }, { label: 'Done', right: true }, 'Unit of Measure']} empty={mlines.length === 0 ? <EmptyState title="No detailed operations yet" text="Move lines appear once products are reserved or processed." /> : null}>
            {mlines.map(l => <tr key={l.id}><td className="px-3 py-2 font-bold">{productLabel(getProduct(s, l.product_id))}</td><td className="px-3 py-2 text-slate-600">{completeName(s, l.location_id)}</td><td className="px-3 py-2 text-slate-600">{completeName(s, l.location_dest_id)}</td><td className="px-3 py-2 text-right font-mono">{fmtQty(l.product_uom_qty)}</td><td className="px-3 py-2 text-right font-mono">{fmtQty(l.qty_done)}</td><td className="px-3 py-2">{getUom(s, l.product_uom_id)?.name}</td></tr>)}
          </Table>
        )}
        {tab === 'info' && (
          <div className="max-w-md space-y-2">
            <Row label="Shipping Policy">{editable ? <select aria-label="Shipping Policy" className={inputCls} value={h.move_type} onChange={e => set('move_type', e.target.value as Picking['move_type'])}><option value="direct">As soon as possible</option><option value="one">When all products are ready</option></select> : <Static>{h.move_type === 'direct' ? 'As soon as possible' : 'When all products are ready'}</Static>}</Row>
          </div>
        )}
        {tab === 'note' && <textarea aria-label="Notes" rows={4} disabled={readOnly} className={`${inputCls} resize-none`} placeholder="Add an internal note…" value={h.note} onChange={e => set('note', e.target.value)} />}
      </Sheet>
      <div className="flex gap-2">
        {!readOnly && <PrimaryButton onClick={save} disabled={!editable && !!existing && h.note === existing.note}>Save</PrimaryButton>}
        <GhostButton onClick={onClose}>Discard</GhostButton>
      </div>
    </div>
  )
}
