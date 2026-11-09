import { useState } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import type { Payment, Invoice, Bill, CompanyId, PaymentMethod } from '../types/accounting'
import { mockChartOfAccounts, moneyFormat } from '../data/mockAccountingData'

interface PaymentModalProps {
  initialType?: 'customer' | 'supplier'
  initialInvoice?: Invoice
  initialBill?: Bill
  companyId: CompanyId
  openInvoices: Invoice[]
  openBills: Bill[]
  onClose: () => void
  onSavePayment: (payment: Payment, allocatedInvoiceId?: string, allocatedBillId?: string) => void
}

export default function PaymentModal({
  initialType = 'customer',
  initialInvoice,
  initialBill,
  companyId,
  openInvoices,
  openBills,
  onClose,
  onSavePayment,
}: PaymentModalProps) {
  const isCustomer = initialInvoice ? true : initialBill ? false : initialType === 'customer'
  const partnerType = isCustomer ? 'customer' : 'supplier'

  const defaultPartner = initialInvoice
    ? initialInvoice.partner
    : initialBill
    ? initialBill.vendor
    : isCustomer
    ? 'Al-Yamama Steel Industries'
    : 'Dammam Special Steel & Honed Tubes Co.'

  const defaultAmount = initialInvoice
    ? initialInvoice.residual
    : initialBill
    ? initialBill.residual
    : 85000

  const [partner, setPartner] = useState(defaultPartner)
  const [paymentDate, setPaymentDate] = useState('2026-11-06')
  const [amount, setAmount] = useState<number>(defaultAmount)
  const [journalId, setJournalId] = useState('acc_101') // Al Rajhi Bank Current
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bank Transfer')
  const [memo, setMemo] = useState(
    initialInvoice
      ? `Settlement for ${initialInvoice.number}`
      : initialBill
      ? `Payment for ${initialBill.number} (${initialBill.supplierInvoiceNumber})`
      : 'Wire transfer payment'
  )
  const [chequeNumber, setChequeNumber] = useState('')
  const [chequeBank, setChequeBank] = useState('Riyad Bank')

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(initialInvoice?.id || '')
  const [selectedBillId, setSelectedBillId] = useState<string>(initialBill?.id || '')

  const bankJournals = mockChartOfAccounts.filter(a => a.type === 'Bank and Cash')
  const selectedJournal = bankJournals.find(j => j.id === journalId) || bankJournals[0]

  const handleSave = () => {
    // PAY-007: System shall prevent posting payment with amount = 0
    if (amount <= 0) {
      alert('Payment amount must be greater than zero.')
      return
    }

    if (!partner.trim()) {
      alert('Please enter a partner name.')
      return
    }

    const stamp = Math.floor(1000 + Math.random() * 9000)
    const newPayment: Payment = {
      id: `pay_${Date.now()}`,
      paymentNumber: `PAY/2026/${stamp}`,
      companyId,
      partner,
      partnerType,
      paymentDate,
      journalId: selectedJournal.id,
      journalName: selectedJournal.name,
      amount,
      currency: 'SAR',
      currencyRate: 1.0,
      amountBaseCurrency: amount,
      memo: chequeNumber ? `${memo} (Cheque #${chequeNumber} - ${chequeBank})` : memo,
      paymentMethod,
      state: 'posted',
      matchedInvoiceIds: selectedInvoiceId ? [selectedInvoiceId] : [],
      chequeNumber: paymentMethod === 'Corporate Cheque' ? chequeNumber : undefined,
    }

    onSavePayment(newPayment, selectedInvoiceId || undefined, selectedBillId || undefined)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div>
              <h3 className="font-extrabold text-sm">
                {isCustomer ? 'Register Customer Receipt' : 'Register Vendor Payment'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Payment Voucher
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-600 font-bold mb-1">
              {isCustomer ? 'Customer' : 'Vendor / Supplier'} *
            </label>
            <input
              type="text"
              value={partner}
              onChange={e => setPartner(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Payment Date *</label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">
                Amount *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-mono font-bold text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-bold mb-1">Bank / Cash Journal *</label>
              <select
                value={journalId}
                onChange={e => setJournalId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-medium"
              >
                {bankJournals.map(j => (
                  <option key={j.id} value={j.id}>
                    {j.name} ({j.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-medium"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mada Debit">Mada Debit POS</option>
                <option value="Corporate Cheque">Corporate Cheque</option>
                <option value="Cash">Petty Cash</option>
              </select>
            </div>
          </div>

          {/* Cheque Fields if Cheque method selected (§18.2) */}
          {paymentMethod === 'Corporate Cheque' && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-amber-900 font-bold mb-1">Cheque Number *</label>
                <input
                  type="text"
                  value={chequeNumber}
                  onChange={e => setChequeNumber(e.target.value)}
                  placeholder="e.g. CHQ-992102"
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block text-amber-900 font-bold mb-1">Drawee Bank Name</label>
                <input
                  type="text"
                  value={chequeBank}
                  onChange={e => setChequeBank(e.target.value)}
                  placeholder="e.g. Riyad Bank"
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-slate-800"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-600 font-bold mb-1">Memo / Payment Reference</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              placeholder="Appears on bank statement & audit trail"
            />
          </div>

          {/* Document Allocation Preview */}
          {isCustomer && openInvoices.length > 0 && (
            <div>
              <label className="block text-slate-600 font-bold mb-1">
                Apply to Open Customer Invoice:
              </label>
              <select
                value={selectedInvoiceId}
                onChange={e => setSelectedInvoiceId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              >
                <option value="">-- Leave as Unallocated Customer Credit --</option>
                {openInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} • {inv.partner} • Due: {moneyFormat(inv.residual, inv.currency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isCustomer && openBills.length > 0 && (
            <div>
              <label className="block text-slate-600 font-bold mb-1">
                Apply to Open Vendor Bill:
              </label>
              <select
                value={selectedBillId}
                onChange={e => setSelectedBillId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800"
              >
                <option value="">-- Leave as Unallocated Debit Note --</option>
                {openBills.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.number} ({b.supplierInvoiceNumber}) • {b.vendor} • Due: {moneyFormat(b.residual, b.currency)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-[11px] text-emerald-900 flex items-start gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              Posting automatically generates a double-entry Journal Entry (Debit Bank/Cash account, Credit Accounts Receivable/Payable) in accordance with standard accounting principles.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-white rounded-lg text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <CheckCircle2 size={15} />
            <span>Confirm & Post Payment</span>
          </button>
        </div>
      </div>
    </div>
  )
}

