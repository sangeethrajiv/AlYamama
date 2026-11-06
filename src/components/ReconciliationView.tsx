import { useState } from 'react'
import {
  FileCheck2,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Scale,
  Coins,
  AlertCircle,
} from 'lucide-react'
import type { Invoice, Payment, UserRole } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

interface ReconciliationViewProps {
  invoices: Invoice[]
  payments: Payment[]
  onReconcile: (invoiceId: string, paymentId: string, writeOffAmount?: number) => void
  currentRole: UserRole
}

export default function ReconciliationView({
  invoices,
  payments,
  onReconcile,
  currentRole,
}: ReconciliationViewProps) {
  // Outstanding debits (unpaid invoices)
  const openInvoices = invoices.filter(i => i.state === 'open' || i.state === 'in_payment')
  
  // Outstanding credits (posted payments not fully reconciled)
  const availablePayments = payments.filter(p => p.state === 'posted' && p.partnerType === 'customer')

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(openInvoices[0]?.id || '')
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>(availablePayments[0]?.id || '')
  const [writeOffAmount, setWriteOffAmount] = useState<number>(0)
  const [writeOffAccount, setWriteOffAccount] = useState('505000 - Bank Charges & Rounding')

  const selectedInvoice = openInvoices.find(i => i.id === selectedInvoiceId)
  const selectedPayment = availablePayments.find(p => p.id === selectedPaymentId)

  // Smart Suggested Matches (§7.1 REC-003)
  const suggestedMatches = openInvoices
    .map(inv => {
      const match = availablePayments.find(
        pay =>
          pay.partner.toLowerCase() === inv.partner.toLowerCase() ||
          Math.abs(pay.amount - inv.residual) < 0.01
      )
      return match ? { invoice: inv, payment: match } : null
    })
    .filter(Boolean) as { invoice: Invoice; payment: Payment }[]

  const invoiceAmount = selectedInvoice?.residual || 0
  const paymentAmount = selectedPayment?.amount || 0
  const difference = invoiceAmount - paymentAmount

  const handleApplySuggested = (invId: string, payId: string) => {
    setSelectedInvoiceId(invId)
    setSelectedPaymentId(payId)
    setWriteOffAmount(0)
  }

  const handleExecuteReconciliation = () => {
    if (!selectedInvoiceId || !selectedPaymentId) {
      alert('Please select an invoice and a payment to reconcile.')
      return
    }
    onReconcile(selectedInvoiceId, selectedPaymentId, writeOffAmount)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Payment Reconciliation Wizard</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Match outstanding customer payments against unpaid receivables to close open journal items.
          </p>
        </div>
      </div>

      {/* Suggested Matches Card (§7.1 REC-003) */}
      {suggestedMatches.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 mb-2">
            <Sparkles size={16} className="text-emerald-600" />
            <span>AI / Rule-Based Suggested Matches ({suggestedMatches.length} detected)</span>
          </div>
          <div className="space-y-2">
            {suggestedMatches.map(({ invoice, payment }) => (
              <div
                key={`${invoice.id}-${payment.id}`}
                className="bg-white p-3 rounded-lg border border-emerald-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="font-bold text-slate-800">
                    <span className="font-mono text-emerald-700">{invoice.number}</span>
                    <span className="text-slate-500 font-normal ml-2">({invoice.partner})</span>
                  </div>
                  <div className="font-mono text-slate-600 font-semibold">{moneyFormat(invoice.residual, invoice.currency)}</div>
                </div>

                <div className="flex items-center gap-2 text-slate-400">
                  <ArrowRight size={14} className="text-emerald-600" />
                  <span className="text-[11px] font-bold uppercase text-emerald-700">Matches Payment</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="font-bold text-slate-800">
                    <span className="font-mono text-blue-700">{payment.paymentNumber}</span>
                    <span className="text-slate-500 font-normal ml-2 font-mono">{moneyFormat(payment.amount, payment.currency)}</span>
                  </div>
                  <button
                    onClick={() => handleApplySuggested(invoice.id, payment.id)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-xs transition"
                  >
                    Select Match
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Reconciliation Workbench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Outstanding Debits (Invoices) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Outstanding Invoices / Debits
              </h3>
              <p className="text-[11px] text-slate-400">Select invoice to clear</p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
              {openInvoices.length} open
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {openInvoices.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                All customer invoices are fully reconciled!
              </div>
            ) : (
              openInvoices.map(inv => {
                const isSelected = inv.id === selectedInvoiceId
                return (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInvoiceId(inv.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-emerald-800">{inv.number}</span>
                      <span className="font-mono text-slate-900">{moneyFormat(inv.residual, inv.currency)}</span>
                    </div>
                    <div className="text-slate-600 mt-0.5 truncate">{inv.partner}</div>
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                      <span>Date: {inv.dateInvoice}</span>
                      <span>Total: {moneyFormat(inv.amountTotal, inv.currency)}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Center / Match Status & Actions */}
        <div className="lg:col-span-2 flex flex-col justify-center items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <Scale size={24} className="text-emerald-600" />
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Balance Diff</div>
            <div
              className={`text-sm font-bold font-mono mt-0.5 ${
                Math.abs(difference - writeOffAmount) < 0.01 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              {moneyFormat(difference - writeOffAmount, 'SAR')}
            </div>
          </div>

          {Math.abs(difference - writeOffAmount) < 0.01 ? (
            <div className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold flex items-center gap-1">
              <CheckCircle2 size={12} /> Balanced
            </div>
          ) : difference > 0 ? (
            <div className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold text-center">
              Partial Settlement (Remaining: {moneyFormat(difference, 'SAR')})
            </div>
          ) : (
            <div className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold text-center">
              Overpayment (Credit on Acct)
            </div>
          )}

          <button
            onClick={handleExecuteReconciliation}
            disabled={!selectedInvoice || !selectedPayment}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition"
          >
            Reconcile
          </button>
        </div>

        {/* Right Column: Outstanding Credits (Payments) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Unapplied Payments / Credits
              </h3>
              <p className="text-[11px] text-slate-400">Select payment voucher</p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
              {availablePayments.length} available
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {availablePayments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No unapplied customer payments in system.
              </div>
            ) : (
              availablePayments.map(pay => {
                const isSelected = pay.id === selectedPaymentId
                return (
                  <div
                    key={pay.id}
                    onClick={() => setSelectedPaymentId(pay.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="font-mono text-blue-800">{pay.paymentNumber}</span>
                      <span className="font-mono text-slate-900">{moneyFormat(pay.amount, pay.currency)}</span>
                    </div>
                    <div className="text-slate-600 mt-0.5 truncate">{pay.partner}</div>
                    <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                      <span>{pay.paymentMethod}</span>
                      <span>Date: {pay.paymentDate}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Difference Write-off & FX Gain/Loss Box */}
      {selectedInvoice && selectedPayment && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Coins size={15} className="text-emerald-600" />
            <span>Write-Off Configuration & Currency FX Gain/Loss</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Write-off Small Difference</label>
              <input
                type="number"
                step="0.01"
                value={writeOffAmount}
                onChange={e => setWriteOffAmount(Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Allowed for minor bank transfer deductions or rounding pennies.
              </span>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">Write-off GL Account</label>
              <select
                value={writeOffAccount}
                onChange={e => setWriteOffAccount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              >
                <option>504000 - Bank Charges & Transaction Fees</option>
                <option>490000 - Realised FX Gain/Loss</option>
                <option>505000 - Cash Rounding / Miscellaneous</option>
              </select>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-700 text-xs mb-1">Currency Exchange Treatment:</div>
              <p className="text-[11px] text-slate-500">
                {selectedInvoice.currency !== 'SAR' || selectedPayment.currency !== 'SAR' ? (
                  <span className="text-emerald-700 font-semibold">
                    Foreign currency detected! FX Gain/Loss entry will be auto-calculated and posted to account 490000 / 590000 (CUR-006).
                  </span>
                ) : (
                  <span>Both transactions in base SAR. No foreign exchange variance required.</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

