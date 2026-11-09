import { useMemo, useState } from 'react'
import type { Invoice, Payment } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

export interface BulkAllocation {
  invoiceId: string
  amount: number
}

interface Props {
  invoices: Invoice[]
  payments: Payment[]
  onBulkReconcile: (paymentId: string, allocations: BulkAllocation[]) => void
}

/** Match one bulk customer payment against many open invoices. */
export default function BulkMatchPanel({ invoices, payments, onBulkReconcile }: Props) {
  const bulkPayments = payments.filter(p => p.state === 'posted' && p.partnerType === 'customer')
  const [paymentId, setPaymentId] = useState(bulkPayments[0]?.id || '')
  const [showAllCustomers, setShowAllCustomers] = useState(false)
  const [alloc, setAlloc] = useState<Record<string, number>>({})

  const payment = bulkPayments.find(p => p.id === paymentId)
  const candidates = useMemo(() => {
    const open = invoices.filter(i => (i.state === 'open' || i.state === 'in_payment') && i.residual > 0)
    const list = payment && !showAllCustomers ? open.filter(i => i.partner === payment.partner) : open
    return [...list].sort((a, b) => a.dateDue.localeCompare(b.dateDue))
  }, [invoices, payment, showAllCustomers])

  const allocated = Object.values(alloc).reduce((s, v) => s + (v || 0), 0)
  const remaining = (payment?.amount || 0) - allocated
  const over = remaining < -0.005

  const reset = (id: string) => {
    setPaymentId(id)
    setAlloc({})
  }

  // Oldest due date first until payment is used up
  const autoAllocate = () => {
    if (!payment) return
    let left = payment.amount
    const next: Record<string, number> = {}
    for (const inv of candidates) {
      if (left <= 0) break
      const amt = Math.min(left, inv.residual)
      next[inv.id] = Math.round(amt * 100) / 100
      left -= amt
    }
    setAlloc(next)
  }

  const apply = () => {
    const rows = Object.entries(alloc)
      .filter(([, v]) => v > 0)
      .map(([invoiceId, amount]) => ({ invoiceId, amount }))
    if (!payment || rows.length === 0 || over) return
    onBulkReconcile(payment.id, rows)
    setAlloc({})
    setPaymentId('')
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Bulk Payment Matching</h3>
          <p className="text-[11px] text-slate-400">Split one bulk payment across several open invoices.</p>
        </div>
        <select
          value={paymentId}
          onChange={e => reset(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs min-w-64"
          aria-label="Bulk payment"
        >
          {bulkPayments.length === 0 && <option value="">No unapplied payments</option>}
          {bulkPayments.map(p => (
            <option key={p.id} value={p.id}>
              {p.paymentNumber} · {p.partner} · {moneyFormat(p.amount, p.currency)}
            </option>
          ))}
        </select>
      </div>

      {payment && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button onClick={autoAllocate} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold">
              Auto-allocate (oldest due first)
            </button>
            <button onClick={() => setAlloc({})} className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold">
              Clear
            </button>
            <label className="flex items-center gap-1.5 text-slate-600 ml-auto">
              <input type="checkbox" checked={showAllCustomers} onChange={e => { setShowAllCustomers(e.target.checked); setAlloc({}) }} />
              Show invoices of all customers
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100">
                  <th className="py-2 w-8"></th>
                  <th className="py-2">Invoice</th>
                  <th className="py-2">Customer</th>
                  <th className="py-2">Due</th>
                  <th className="py-2 text-right">Open amount</th>
                  <th className="py-2 text-right w-36">Allocate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {candidates.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">No open invoices for this customer.</td></tr>
                )}
                {candidates.map(inv => {
                  const v = alloc[inv.id] || 0
                  return (
                    <tr key={inv.id}>
                      <td className="py-2">
                        <input
                          type="checkbox"
                          checked={v > 0}
                          aria-label={`Select ${inv.number}`}
                          onChange={e => {
                            const room = Math.max(0, remaining + v)
                            setAlloc(a => ({ ...a, [inv.id]: e.target.checked ? Math.min(inv.residual, room) : 0 }))
                          }}
                        />
                      </td>
                      <td className="py-2 font-mono font-bold text-emerald-800">{inv.number}</td>
                      <td className="py-2 text-slate-700">{inv.partner}</td>
                      <td className="py-2 font-mono text-slate-500">{inv.dateDue}</td>
                      <td className="py-2 text-right font-mono">{moneyFormat(inv.residual, inv.currency)}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number" min={0} max={inv.residual} step="0.01"
                          value={v || ''}
                          placeholder="0.00"
                          onChange={e => setAlloc(a => ({ ...a, [inv.id]: Math.min(inv.residual, Number(e.target.value) || 0) }))}
                          className="w-28 text-right bg-slate-50 border border-slate-200 rounded px-2 py-1 font-mono"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex gap-5 font-mono">
              <span>Payment: <b>{moneyFormat(payment.amount, payment.currency)}</b></span>
              <span>Allocated: <b>{moneyFormat(allocated, payment.currency)}</b></span>
              <span className={over ? 'text-rose-600' : remaining > 0.005 ? 'text-amber-600' : 'text-emerald-700'}>
                {over ? 'Over-allocated: ' : 'Unallocated: '}<b>{moneyFormat(Math.abs(remaining), payment.currency)}</b>
              </span>
            </div>
            <button
              onClick={apply}
              disabled={over || allocated <= 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
            >
              Reconcile {Object.values(alloc).filter(v => v > 0).length || ''} invoice(s)
            </button>
          </div>
        </>
      )}
    </div>
  )
}
