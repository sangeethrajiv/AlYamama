import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Invoice } from '../../types/accounting'
import type { Contact } from '../contacts/types'
import type { InventoryApi } from './useInventory'
import type { Transfer, TransferKind, TransferLine, TransferState } from './types'
import { PageHeader, PrimaryButton, GhostButton, Segmented, SearchBox, Table, Pill, EmptyState, Drawer, Field, Card, inputCls, today, ConfirmDialog } from '../shared/ui'

const TONE: Record<TransferState, 'slate' | 'blue' | 'green' | 'red'> = { draft: 'slate', ready: 'blue', done: 'green', cancel: 'red' }
const TITLE = { receipt: 'Receipts', delivery: 'Deliveries', internal: 'Internal Transfers' } as const

interface Props { inv: InventoryApi; kind: TransferKind; contacts: Contact[]; invoices: Invoice[]; readOnly: boolean; searchQuery: string }

export function TransfersPage({ inv, kind, contacts, invoices, readOnly, searchQuery }: Props) {
  const [filter, setFilter] = useState<'all' | TransferState>('all')
  const [local, setLocal] = useState('')
  const [open, setOpen] = useState<Transfer | null>(null)
  const q = (local || searchQuery).trim().toLowerCase()
  const all = inv.transfers.filter(t => t.kind === kind)
  const rows = all.filter(t => (filter === 'all' || t.state === filter) && (!q || [t.reference, t.partner, t.sourceDoc, ...t.lines.map(l => l.sku)].some(v => v.toLowerCase().includes(q))))
  const n = (s: TransferState) => all.filter(t => t.state === s).length
  const blankFrom = (patch: Partial<Transfer> = {}): Transfer => {
    const wh = inv.warehouses[0]?.code || 'WH'
    return {
      id: `tr_${Date.now()}`, reference: inv.nextRef(kind, wh), kind, state: 'draft', partner: '', sourceDoc: '', scheduled: today(), notes: '', lines: [],
      from: kind === 'receipt' ? 'Partners/Vendors' : `${wh}/Stock`, to: kind === 'delivery' ? 'Partners/Customers' : `${wh}/Stock`, ...patch,
    }
  }
  /** Delivery pre-filled from a posted customer invoice: only storable products found in the catalogue become lines. */
  const fromInvoice = (inv_: Invoice) => {
    const lines: TransferLine[] = inv_.lines.flatMap(l => {
      const p = inv.products.find(x => x.sku === l.product || x.name === l.product)
      return p && p.type !== 'service' ? [{ id: `l_${l.id}`, sku: p.sku, productName: p.name, uom: p.uom, demand: l.quantity }] : []
    })
    setOpen(blankFrom({ partner: inv_.partner, sourceDoc: inv_.number, lines }))
  }
  const eligible = invoices.filter(i => (i.state === 'open' || i.state === 'in_payment' || i.state === 'paid') && i.category !== 'proforma' && i.lines.some(l => inv.products.some(p => p.sku === l.product || p.name === l.product)))

  return (
    <div className="space-y-4">
      <PageHeader title={TITLE[kind]} subtitle={kind === 'receipt' ? 'Goods arriving from vendors.' : kind === 'delivery' ? 'Goods leaving for customers. Create from a posted invoice or from scratch.' : 'Move stock between your own locations.'}
        actions={<>
          <SearchBox value={local} onChange={setLocal} placeholder="Search reference, partner, SKU…" />
          {kind === 'delivery' && !readOnly && eligible.length > 0 && (
            <select aria-label="Create delivery from invoice" value="" onChange={e => { const i = invoices.find(x => x.id === e.target.value); if (i) fromInvoice(i) }} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs">
              <option value="">From invoice…</option>{eligible.map(i => <option key={i.id} value={i.id}>{i.number} · {i.partner}</option>)}
            </select>
          )}
          {!readOnly && <PrimaryButton onClick={() => setOpen(blankFrom())}><Plus size={16} />New {kind === 'receipt' ? 'Receipt' : kind === 'delivery' ? 'Delivery' : 'Transfer'}</PrimaryButton>}
        </>} />
      <Segmented value={filter} onChange={setFilter} options={[{ id: 'all', label: 'All', count: all.length }, { id: 'draft', label: 'Draft', count: n('draft') }, { id: 'ready', label: 'Ready', count: n('ready') }, { id: 'done', label: 'Done', count: n('done') }, { id: 'cancel', label: 'Cancelled', count: n('cancel') }]} />
      <Table head={['Reference', kind === 'internal' ? 'From → To' : kind === 'receipt' ? 'Vendor' : 'Customer', 'Source', 'Scheduled', { label: 'Lines', right: true }, 'Status']} empty={rows.length === 0 ? <EmptyState title={`No ${TITLE[kind].toLowerCase()} yet`} /> : null}>
        {rows.map(t => (
          <tr key={t.id} onClick={() => setOpen(t)} className="hover:bg-slate-50 cursor-pointer">
            <td className="px-3 py-2.5 font-bold text-slate-900">{t.reference}</td>
            <td className="px-3 py-2.5 text-slate-600">{kind === 'internal' ? `${t.from} → ${t.to}` : t.partner || '—'}</td>
            <td className="px-3 py-2.5 font-mono text-slate-500">{t.sourceDoc || '—'}</td><td className="px-3 py-2.5 font-mono text-slate-600">{t.scheduled}</td>
            <td className="px-3 py-2.5 text-right font-mono">{t.lines.length}</td><td className="px-3 py-2.5"><Pill tone={TONE[t.state]}>{t.state}</Pill></td>
          </tr>
        ))}
      </Table>
      {open && <TransferDrawer inv={inv} transfer={open} contacts={contacts} readOnly={readOnly} onClose={() => setOpen(null)} />}
    </div>
  )
}

function TransferDrawer({ inv, transfer, contacts, readOnly, onClose }: { inv: InventoryApi; transfer: Transfer; contacts: Contact[]; readOnly: boolean; onClose: () => void }) {
  const [t, setT] = useState(transfer)
  const [err, setErr] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const exists = inv.transfers.some(x => x.id === t.id)
  const live = inv.transfers.find(x => x.id === t.id)
  const state = live?.state ?? t.state
  const locked = readOnly || state === 'done' || state === 'cancel'
  const set = <K extends keyof Transfer>(k: K, v: Transfer[K]) => setT(x => ({ ...x, [k]: v }))
  const internal = inv.locations.filter(l => l.usage === 'internal')
  const stockable = inv.products.filter(p => p.active && p.type !== 'service')
  const partners = contacts.filter(c => c.active && (t.kind === 'receipt' ? c.isVendor : c.isCustomer))

  const addLine = () => set('lines', [...t.lines, { id: `l_${Date.now()}`, sku: '', productName: '', uom: 'Units', demand: 1 }])
  const setLine = (id: string, patch: Partial<TransferLine>) => set('lines', t.lines.map(l => (l.id === id ? { ...l, ...patch } : l)))
  const pick = (id: string, sku: string) => { const p = inv.products.find(x => x.sku === sku); if (p) setLine(id, { sku: p.sku, productName: p.name, uom: p.uom }) }

  const check = (): string => {
    if (t.lines.length === 0) return 'Add at least one product line.'
    if (t.lines.some(l => !l.sku)) return 'Choose a product on every line.'
    if (t.lines.some(l => !(l.demand > 0))) return 'Quantities must be greater than zero.'
    if (t.kind === 'internal' && t.from === t.to) return 'Source and destination must differ.'
    if (t.kind !== 'receipt') {
      for (const l of t.lines) {
        const have = inv.onHand(l.sku, t.from)
        const need = t.lines.filter(x => x.sku === l.sku).reduce((s, x) => s + x.demand, 0)
        if (need > have) return `Only ${have} ${l.uom} of ${l.sku} in ${t.from}; ${need} requested.`
      }
    }
    return ''
  }
  const persist = (next: Transfer) => { inv.saveTransfer(next); return next }
  const save = () => { const e = t.lines.some(l => !l.sku) ? 'Choose a product on every line.' : ''; setErr(e); if (e) return; persist(t); onClose() }
  const markReady = () => { const e = check(); setErr(e); if (e) return; persist({ ...t, state: 'ready' }); setT({ ...t, state: 'ready' }) }
  const validate = () => {
    const e = check(); setErr(e); if (e) return
    const msg = inv.validateTransfer(t)
    setErr(msg); if (!msg) onClose()
  }

  return (
    <Drawer title={t.reference} subtitle={exists ? undefined : 'New'} wide badge={<Pill tone={TONE[state]}>{state}</Pill>} onClose={onClose}
      footer={<>
        {exists && !locked && <GhostButton danger onClick={() => setConfirmCancel(true)}>Cancel transfer</GhostButton>}
        <GhostButton onClick={onClose}>Close</GhostButton>
        {!locked && <GhostButton onClick={save}>Save</GhostButton>}
        {!locked && state === 'draft' && <GhostButton onClick={markReady}>Mark as ready</GhostButton>}
        {!locked && <PrimaryButton onClick={validate}>Validate</PrimaryButton>}
      </>}>
      {err && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{err}</div>}
      <Card title="Details">
        <div className="grid sm:grid-cols-2 gap-3">
          {t.kind !== 'internal' && (
            <Field label={t.kind === 'receipt' ? 'Vendor' : 'Customer'}>
              <input className={inputCls} disabled={locked} value={t.partner} list={t.kind === 'receipt' ? 'erp-vendors' : 'erp-customers'} onChange={e => set('partner', e.target.value)} />
            </Field>
          )}
          <Field label="Scheduled date"><input type="date" className={inputCls} disabled={locked} value={t.scheduled} onChange={e => set('scheduled', e.target.value)} /></Field>
          <Field label="Source document"><input className={inputCls} disabled={locked} value={t.sourceDoc} onChange={e => set('sourceDoc', e.target.value)} placeholder="PO / invoice number" /></Field>
          <Field label={t.kind === 'receipt' ? 'Receive into' : 'Source location'}>
            {t.kind === 'receipt' ? <select className={inputCls} disabled={locked} value={t.to} onChange={e => set('to', e.target.value)}>{internal.map(l => <option key={l.id}>{l.name}</option>)}</select>
              : <select className={inputCls} disabled={locked} value={t.from} onChange={e => set('from', e.target.value)}>{internal.map(l => <option key={l.id}>{l.name}</option>)}</select>}
          </Field>
          {t.kind === 'internal' && <Field label="Destination"><select className={inputCls} disabled={locked} value={t.to} onChange={e => set('to', e.target.value)}>{internal.map(l => <option key={l.id}>{l.name}</option>)}</select></Field>}
        </div>
        {partners.length === 0 && t.kind !== 'internal' && <p className="text-[11px] text-slate-400 mt-2">Tip: add {t.kind === 'receipt' ? 'vendors' : 'customers'} in Users to pick them here.</p>}
      </Card>
      <Card title="Products" actions={!locked && <GhostButton onClick={addLine}>Add line</GhostButton>}>
        {t.lines.length === 0 ? <p className="text-xs text-slate-500">No lines yet.</p> : (
          <div className="space-y-2">
            {t.lines.map(l => (
              <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                <select aria-label="Product" disabled={locked} className={`${inputCls} col-span-6`} value={l.sku} onChange={e => pick(l.id, e.target.value)}>
                  <option value="">Select product…</option>{stockable.map(p => <option key={p.id} value={p.sku}>{p.sku} — {p.name}</option>)}
                  {l.sku && !stockable.some(p => p.sku === l.sku) && <option value={l.sku}>{l.sku}</option>}
                </select>
                <input aria-label="Lot" disabled={locked} placeholder="Lot (opt.)" className={`${inputCls} col-span-2`} value={l.lot || ''} onChange={e => setLine(l.id, { lot: e.target.value || undefined })} />
                <input aria-label="Quantity" type="number" min={0} disabled={locked} className={`${inputCls} col-span-2 text-right font-mono`} value={l.demand} onChange={e => setLine(l.id, { demand: Number(e.target.value) || 0 })} />
                <span className="col-span-1 text-[11px] text-slate-500 truncate">{l.uom}</span>
                {!locked && <button aria-label="Remove line" onClick={() => set('lines', t.lines.filter(x => x.id !== l.id))} className="col-span-1 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>}
                {t.kind !== 'receipt' && l.sku && <div className="col-span-12 -mt-1 text-[10px] text-slate-400">Available in {t.from}: {inv.onHand(l.sku, t.from)} {l.uom}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
      {t.doneAt && <p className="text-xs text-emerald-700">Validated on {t.doneAt}. Stock and movements are updated.</p>}
      {confirmCancel && <ConfirmDialog title="Cancel this transfer?" text="No stock will move." confirmLabel="Cancel transfer" danger onCancel={() => setConfirmCancel(false)}
        onConfirm={() => { if (exists) inv.setTransferState(t.id, 'cancel'); else inv.saveTransfer({ ...t, state: 'cancel' }); onClose() }} />}
    </Drawer>
  )
}
