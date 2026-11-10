import { useMemo, useState } from 'react'
import { Minus, Plus, Search } from 'lucide-react'
import type { StockQuant, InventoryAdjustment, InventoryAdjustmentLine, AdjustmentReason, UserRole } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

interface Props {
  quants: StockQuant[]
  history: InventoryAdjustment[]
  currentRole: UserRole
  onApply: (meta: { reference: string; accountingDate: string; reason: AdjustmentReason; notes: string }, lines: InventoryAdjustmentLine[]) => void
}

const REASONS: AdjustmentReason[] = ['Physical count', 'Damaged / scrapped', 'Lost / theft', 'Found / surplus', 'Opening balance', 'Other']
const CAN_APPLY: UserRole[] = ['Finance Director', 'Accounts Manager', 'Senior Accountant']

export default function InventoryAdjustmentView({ quants, history, currentRole, onApply }: Props) {
  const [tab, setTab] = useState<'count' | 'history'>('count')
  const [counted, setCounted] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('all')
  const [category, setCategory] = useState('all')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const [reference, setReference] = useState(`INV-ADJ/2026/${String(history.length + 1).padStart(4, '0')}`)
  const [accountingDate, setAccountingDate] = useState('2026-11-10')
  const [reason, setReason] = useState<AdjustmentReason>('Physical count')
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  const locations = useMemo(() => [...new Set(quants.map(q => q.location))].sort(), [quants])
  const categories = useMemo(() => [...new Set(quants.map(q => q.category))].sort(), [quants])

  const rows = quants.filter(q => {
    if (location !== 'all' && q.location !== location) return false
    if (category !== 'all' && q.category !== category) return false
    if (onlyChanged && (counted[q.id] === undefined || counted[q.id] === q.onHand)) return false
    const t = search.trim().toLowerCase()
    return !t || [q.productName, q.productCode, q.lot, q.pack, q.owner, q.location].some(v => v?.toLowerCase().includes(t))
  })

  const pending: InventoryAdjustmentLine[] = quants
    .filter(q => counted[q.id] !== undefined && counted[q.id] !== q.onHand)
    .map(q => ({
      quantId: q.id, productCode: q.productCode, productName: q.productName, location: q.location, lot: q.lot, uom: q.uom,
      previousQty: q.onHand, countedQty: counted[q.id], difference: counted[q.id] - q.onHand, unitCost: q.unitCost,
    }))
  const netValue = pending.reduce((s, l) => s + l.difference * l.unitCost, 0)
  const gains = pending.filter(l => l.difference > 0).length
  const losses = pending.filter(l => l.difference < 0).length
  const canApply = CAN_APPLY.includes(currentRole)

  const setQty = (q: StockQuant, v: number | undefined) =>
    setCounted(c => {
      const next = { ...c }
      if (v === undefined || Number.isNaN(v)) delete next[q.id]
      else next[q.id] = Math.max(0, v)
      return next
    })

  const apply = () => {
    onApply({ reference, accountingDate, reason, notes }, pending)
    setCounted({})
    setNotes('')
    setConfirming(false)
    setReference(`INV-ADJ/2026/${String(history.length + 2).padStart(4, '0')}`)
  }

  const input = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Inventory Adjustments</h1>
          <p className="text-xs text-slate-500 mt-0.5">Count stock, review differences, then apply to correct quantities and book the value in accounting.</p>
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold" role="tablist">
          {(['count', 'history'] as const).map(t => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-md transition ${tab === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
              {t === 'count' ? 'Count sheet' : `History (${history.length})`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'count' && (
        <>
          {/* Session details */}
          <section className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label className="block"><span className="block font-bold text-slate-600 mb-1">Reference</span>
              <input value={reference} onChange={e => setReference(e.target.value)} className={`${input} font-mono`} /></label>
            <label className="block"><span className="block font-bold text-slate-600 mb-1">Accounting date</span>
              <input type="date" value={accountingDate} onChange={e => setAccountingDate(e.target.value)} className={input} /></label>
            <label className="block"><span className="block font-bold text-slate-600 mb-1">Reason</span>
              <select value={reason} onChange={e => setReason(e.target.value as AdjustmentReason)} className={input}>
                {REASONS.map(r => <option key={r}>{r}</option>)}
              </select></label>
            <div><span className="block font-bold text-slate-600 mb-1">Responsible</span>
              <div className={`${input} bg-slate-100`}>{currentRole}</div></div>
            <label className="block sm:col-span-2 lg:col-span-4"><span className="block font-bold text-slate-600 mb-1">Notes</span>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional: why is this adjustment needed?" className={input} /></label>
          </section>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative flex-1 min-w-56 max-w-sm">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Product, lot / serial, package, owner…" className={`${input} pl-9`} />
            </div>
            <select value={location} onChange={e => setLocation(e.target.value)} className={`${input.replace("w-full", "")} w-auto`} aria-label="Location">
              <option value="all">All locations</option>
              {locations.map(l => <option key={l}>{l}</option>)}
            </select>
            <select value={category} onChange={e => setCategory(e.target.value)} className={`${input.replace("w-full", "")} w-auto`} aria-label="Category">
              <option value="all">All categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} /> Only differences
            </label>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setCounted(Object.fromEntries(rows.map(q => [q.id, q.onHand])))} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold">Set counted = on hand</button>
              <button onClick={() => setCounted({})} className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold">Reset</button>
            </div>
          </div>

          {/* Count sheet */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-2">Location</th>
                  <th className="py-3 px-2">Lot / Serial</th>
                  <th className="py-3 px-2">Package</th>
                  <th className="py-3 px-2">Owner</th>
                  <th className="py-3 px-2 text-right">On hand</th>
                  <th className="py-3 px-2 text-center w-44">Counted</th>
                  <th className="py-3 px-2 text-right">Difference</th>
                  <th className="py-3 px-3 text-right">Value impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-slate-400">No stock lines match your filters.</td></tr>}
                {rows.map(q => {
                  const c = counted[q.id]
                  const diff = c === undefined ? 0 : c - q.onHand
                  return (
                    <tr key={q.id} className={diff ? (diff > 0 ? 'bg-emerald-50/40' : 'bg-rose-50/40') : ''}>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{q.productName}</div>
                        <div className="text-[10px] text-slate-400"><span className="font-mono">{q.productCode}</span> · {q.category}</div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">{q.location}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-600">{q.lot || '—'}</td>
                      <td className="py-2.5 px-2 font-mono text-slate-600">{q.pack || '—'}</td>
                      <td className="py-2.5 px-2 text-slate-600 max-w-36 truncate" title={q.owner}>{q.owner || '—'}</td>
                      <td className="py-2.5 px-2 text-right font-mono">{q.onHand} <span className="text-[10px] text-slate-400">{q.uom}</span></td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setQty(q, (c ?? q.onHand) - 1)} aria-label="Decrease" className="h-7 w-7 grid place-items-center rounded-md border border-slate-200 hover:bg-slate-50"><Minus size={13} /></button>
                          <input type="number" min={0} value={c ?? ''} placeholder={String(q.onHand)} aria-label={`Counted quantity for ${q.productName}`}
                            onChange={e => setQty(q, e.target.value === '' ? undefined : Number(e.target.value))}
                            className="h-7 w-16 text-center font-mono bg-white border border-slate-200 rounded-md focus:border-emerald-500" />
                          <button onClick={() => setQty(q, (c ?? q.onHand) + 1)} aria-label="Increase" className="h-7 w-7 grid place-items-center rounded-md border border-slate-200 hover:bg-slate-50"><Plus size={13} /></button>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        {diff === 0 ? <span className="text-slate-300">—</span> : (
                          <span className={`px-2 py-0.5 rounded-full font-bold font-mono ${diff > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>{diff > 0 ? '+' : ''}{diff}</span>
                        )}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono ${diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                        {diff ? moneyFormat(diff * q.unitCost, 'SAR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary + apply */}
          <div className="sticky bottom-3 bg-slate-900 text-white rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
              <span><b className="font-mono text-sm">{pending.length}</b> line(s) to adjust</span>
              <span className="text-emerald-300"><b className="font-mono text-sm">{gains}</b> surplus</span>
              <span className="text-rose-300"><b className="font-mono text-sm">{losses}</b> shortage</span>
              <span>Net value <b className={`font-mono text-sm ${netValue < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{moneyFormat(netValue, 'SAR')}</b></span>
            </div>
            <button onClick={() => setConfirming(true)} disabled={pending.length === 0 || !canApply || !reference.trim()}
              title={canApply ? undefined : 'Your role cannot apply adjustments'}
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold">
              Apply adjustments
            </button>
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 && <div className="bg-white rounded-xl border border-slate-200 py-12 text-center text-xs text-slate-400">No adjustments applied yet.</div>}
          {history.map(h => (
            <article key={h.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => setOpenHistory(openHistory === h.id ? null : h.id)} className="w-full text-left px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50">
                <div>
                  <div className="font-mono font-bold text-emerald-800 text-sm">{h.reference}</div>
                  <div className="text-[11px] text-slate-500">{h.accountingDate} · {h.reason} · by {h.responsible}</div>
                </div>
                <div className="text-right text-xs">
                  <div className={`font-mono font-bold ${h.netValue < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{moneyFormat(h.netValue, 'SAR')}</div>
                  <div className="text-[10px] text-slate-400">{h.lines.length} line(s) · {h.journalEntryNumber}</div>
                </div>
              </button>
              {openHistory === h.id && (
                <div className="border-t border-slate-100 px-4 py-3 text-xs space-y-1.5">
                  {h.notes && <p className="text-slate-500 italic">“{h.notes}”</p>}
                  {h.lines.map(l => (
                    <div key={l.quantId} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-700"><b>{l.productName}</b> <span className="text-slate-400">{l.location}{l.lot ? ` · ${l.lot}` : ''}</span></span>
                      <span className="font-mono text-slate-600">{l.previousQty} → <b>{l.countedQty}</b> <span className={l.difference > 0 ? 'text-emerald-700' : 'text-rose-600'}>({l.difference > 0 ? '+' : ''}{l.difference})</span></span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Confirm adjustment">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-3">
            <h2 className="text-base font-extrabold text-slate-900">Apply {pending.length} adjustment(s)?</h2>
            <p className="text-xs text-slate-500">Quantities will be updated and a journal entry for <b className={netValue < 0 ? 'text-rose-600' : 'text-emerald-700'}>{moneyFormat(netValue, 'SAR')}</b> will be posted on {accountingDate}. This cannot be undone, only corrected by another adjustment.</p>
            <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg text-xs">
              {pending.map(l => (
                <li key={l.quantId} className="px-3 py-2 flex justify-between gap-3">
                  <span className="truncate">{l.productName}{l.lot ? ` · ${l.lot}` : ''}</span>
                  <span className="font-mono shrink-0">{l.previousQty} → <b>{l.countedQty}</b></span>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold">Back</button>
              <button onClick={apply} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">Confirm & apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
