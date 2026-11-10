import { useState } from 'react'
import type { Invoice, CreditNoteOptions } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

interface Props {
  invoice: Invoice
  customer: { name: string; vat: string; address: string } // values currently shown on the form
  onRegisterPayment: () => void
  onCreateCreditNote: (opts: CreditNoteOptions) => void
  onSubmitZatca: () => void
  hideCreditNote?: boolean // proforma / progressive: only payment and ZATCA
}


/** Mandatory data a ZATCA submission needs from the customer record. */
const zatcaChecks = (inv: Invoice, c: Props['customer']) => [
  { label: 'Customer name', ok: !!c.name.trim() },
  { label: 'VAT number (15 digits)', ok: /^\d{15}$/.test(c.vat.replace(/\s/g, '')) },
  { label: 'Customer address', ok: c.address.trim().length > 5 },
  { label: 'At least one invoice line', ok: inv.lines.length > 0 },
]

const STEPS = ['Posted', 'Submitted', 'Cleared']

/** Post-posting actions: collect money, correct the invoice, report it to ZATCA. */
export default function InvoiceNextSteps({ invoice, customer, onRegisterPayment, onCreateCreditNote, onSubmitZatca, hideCreditNote }: Props) {
  const [dialog, setDialog] = useState<null | 'credit' | 'zatca'>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('2026-11-10')
  const [method, setMethod] = useState<CreditNoteOptions['method']>('draft')
  const [ack, setAck] = useState(false)

  const canPay = (invoice.state === 'open' || invoice.state === 'in_payment') && invoice.residual > 0
  const isCreditNote = invoice.type === 'out_refund'
  const z = invoice.zatca
  const checks = zatcaChecks(invoice, customer)
  const allOk = checks.every(c => c.ok)
  const stepIndex = z ? (z.status === 'cleared' ? 2 : 1) : 0

  const card = 'rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3'
  const btn = 'h-8 px-3.5 rounded-lg text-xs font-bold transition'

  return (
    <section aria-label="Next steps" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Next steps</h3>
        <span className="text-[11px] text-slate-400">What can you do with this invoice now</span>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${hideCreditNote ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        {/* Register payment */}
        <div className={card}>
          <div>
            <div className="text-xs font-extrabold text-slate-800">Collect payment</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Amount due</div>
            <div className="text-lg font-black font-mono text-slate-900">{moneyFormat(invoice.residual, invoice.currency)}</div>
          </div>
          <button type="button" onClick={onRegisterPayment} disabled={!canPay}
            className={`${btn} mt-auto bg-emerald-600 hover:bg-emerald-700 text-white`}>
            {canPay ? 'Register payment' : 'Fully paid'}
          </button>
        </div>

        {/* Credit note */}
        {!hideCreditNote && <div className={card}>
          <div>
            <div className="text-xs font-extrabold text-slate-800">Correct or reverse</div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {isCreditNote ? 'This document is already a credit note.' : 'Issue a credit note for returns, pricing errors or cancelled services.'}
            </p>
          </div>
          <button type="button" onClick={() => setDialog('credit')} disabled={isCreditNote}
            className={`${btn} mt-auto border border-slate-300 hover:bg-slate-50 text-slate-800`}>
            Add credit note
          </button>
        </div>}

        {/* ZATCA */}
        <div className={card}>
          <div>
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-slate-800">ZATCA e-invoicing</div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${z ? (z.status === 'cleared' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700') : 'bg-amber-100 text-amber-800'}`}>
                {z ? (z.status === 'cleared' ? 'Cleared' : 'Rejected') : 'Not submitted'}
              </span>
            </div>
            <ol className="flex items-center gap-1.5 mt-3" aria-label="ZATCA progress">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
                  <span className={`h-5 w-5 shrink-0 rounded-full grid place-items-center text-[10px] font-bold ${i <= stepIndex ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>
                  <span className={`text-[10px] font-semibold ${i <= stepIndex ? 'text-slate-800' : 'text-slate-400'}`}>{s}</span>
                  {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < stepIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </li>
              ))}
            </ol>
          </div>
          {z ? (
            <button type="button" onClick={() => setShowDetails(v => !v)} className={`${btn} mt-auto border border-slate-300 hover:bg-slate-50 text-slate-800`}>
              {showDetails ? 'Hide submission details' : 'View submission details'}
            </button>
          ) : (
            <button type="button" onClick={() => { setAck(false); setDialog('zatca') }} className={`${btn} mt-auto bg-slate-900 hover:bg-slate-800 text-white`}>
              Submit to ZATCA
            </button>
          )}
        </div>
      </div>

      {z && showDetails && (
        <dl className="rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {[
            ['Document UUID', z.uuid], ['Invoice hash', z.invoiceHash], ['Chain index', String(z.chainIndex)],
            ['Submitted at', z.submittedAt], ['Submitted by', z.submittedBy], ['Result', z.message || z.status],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-slate-500 font-medium">{k}</dt>
              <dd className="font-mono text-slate-800 break-all">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Credit note dialog */}
      {dialog === 'credit' && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Add credit note">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 text-xs">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Add credit note</h2>
              <p className="text-slate-500 mt-0.5">For <span className="font-mono font-bold">{invoice.number}</span> · {moneyFormat(invoice.amountTotal, invoice.currency)}</p>
            </div>
            <label className="block"><span className="block font-bold text-slate-600 mb-1">Reason</span>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Goods returned by customer"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" /></label>
            <label className="block"><span className="block font-bold text-slate-600 mb-1">Credit Note Date</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2" /></label>
            <fieldset className="space-y-2">
              <legend className="font-bold text-slate-600 mb-1">Credit Method</legend>
              {([
                ['draft', 'Create a draft credit note'],
                ['cancel', 'Cancel: create credit note and reconcile'],
                ['modify', 'Modify: create credit note, reconcile and create a new draft invoice'],
              ] as const).map(([v, t]) => (
                <label key={v} className={`flex gap-2.5 p-3 rounded-lg border cursor-pointer ${method === v ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="cn-method" checked={method === v} onChange={() => setMethod(v)} className="mt-0.5" />
                  <span className="font-semibold text-slate-800">{t}</span>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDialog(null)} className={`${btn} border border-slate-200 hover:bg-slate-50`}>Cancel</button>
              <button disabled={!reason.trim()}
                onClick={() => { onCreateCreditNote({ reason: reason.trim(), date, method }); setDialog(null); setReason('') }}
                className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>Create credit note</button>
            </div>
          </div>
        </div>
      )}

      {/* ZATCA confirmation dialog */}
      {dialog === 'zatca' && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Submit to ZATCA">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4 text-xs">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Submit to ZATCA</h2>
              <p className="text-slate-500 mt-0.5">We check the required customer data before sending.</p>
            </div>
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {checks.map(c => (
                <li key={c.label} className="px-3 py-2 flex items-center justify-between">
                  <span className="text-slate-700">{c.label}</span>
                  <span className={`font-bold ${c.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{c.ok ? 'Ready' : 'Missing'}</span>
                </li>
              ))}
            </ul>
            {!allOk && <p className="text-rose-600">Complete the missing details on the customer before submitting.</p>}
            <label className="flex gap-2 items-start p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-0.5" />
              <span>Once submitted, this invoice cannot be cancelled or changed. Corrections need a credit note.</span>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDialog(null)} className={`${btn} border border-slate-200 hover:bg-slate-50`}>Cancel</button>
              <button disabled={!allOk || !ack} onClick={() => { onSubmitZatca(); setDialog(null); setShowDetails(true) }}
                className={`${btn} bg-slate-900 hover:bg-slate-800 text-white`}>Submit invoice</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
