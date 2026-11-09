import { useState } from 'react'

import type { Payment, UserRole } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

interface PaymentListProps {
  payments: Payment[]
  onOpenPaymentModal: (type?: 'customer' | 'supplier') => void
  currentRole: UserRole
  searchQuery: string
}

export default function PaymentList({
  payments,
  onOpenPaymentModal,
  currentRole,
  searchQuery,
}: PaymentListProps) {
  const [filterType, setFilterType] = useState<'all' | 'customer' | 'supplier'>('all')

  const filteredPayments = payments.filter(p => {
    if (filterType !== 'all' && p.partnerType !== filterType) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match =
        p.paymentNumber.toLowerCase().includes(q) ||
        p.partner.toLowerCase().includes(q) ||
        p.memo.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const totalReceipts = payments
    .filter(p => p.partnerType === 'customer')
    .reduce((acc, p) => acc + p.amountBaseCurrency, 0)

  const totalPayouts = payments
    .filter(p => p.partnerType === 'supplier')
    .reduce((acc, p) => acc + p.amountBaseCurrency, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Payments & Receipts</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer settlements, vendor disbursements, cheque logs and bank journal postings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenPaymentModal('customer')}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            
            <span>Receive Payment</span>
          </button>
          <button
            onClick={() => onOpenPaymentModal('supplier')}
            className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            
            <span>Pay Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Collections (AR)</div>
          <div className="text-lg font-bold font-mono text-emerald-700">{moneyFormat(totalReceipts)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            
            <span>Customer remittances into Al Rajhi & Riyad Bank</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Payouts (AP)</div>
          <div className="text-lg font-bold font-mono text-amber-700">{moneyFormat(totalPayouts)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            
            <span>Supplier wire transfers & corporate cheques</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net Cash Flow Impact</div>
          <div className="text-lg font-bold font-mono text-slate-700">{moneyFormat(totalReceipts - totalPayouts)}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            
            <span>Surplus cash available for workshop operations</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          All Transactions ({payments.length})
        </button>
        <button
          onClick={() => setFilterType('customer')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'customer' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          Customer Receipts ({payments.filter(p => p.partnerType === 'customer').length})
        </button>
        <button
          onClick={() => setFilterType('supplier')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterType === 'supplier' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          Vendor Payments ({payments.filter(p => p.partnerType === 'supplier').length})
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-3 px-3.5">Payment #</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Partner (Customer/Vendor)</th>
                <th className="py-3 px-3">Bank / Cash Journal</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Reference / Memo</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    
                    <p className="font-semibold text-slate-600">No payment records found</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3.5 font-bold font-mono text-slate-800">
                      {p.paymentNumber}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{p.paymentDate}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {p.partnerType === 'customer' ? (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded font-bold">
                            REC
                          </span>
                        ) : (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-bold">
                            PAY
                          </span>
                        )}
                        <span>{p.partner}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 flex items-center gap-1">
                      
                      <span>{p.journalName}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 max-w-xs truncate" title={p.memo}>
                      {p.memo}
                      {p.chequeNumber && (
                        <span className="font-mono text-emerald-700 ml-1">({p.chequeNumber})</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-bold font-mono whitespace-nowrap">
                      <span className={p.partnerType === 'customer' ? 'text-emerald-700' : 'text-amber-800'}>
                        {p.partnerType === 'customer' ? '+' : '-'} {moneyFormat(p.amount, p.currency)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.state === 'reconciled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.state === 'posted'
                            ? 'bg-slate-100 text-slate-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.state.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
          <div>Showing {filteredPayments.length} transactions</div>
          <button
            onClick={() => alert('Exporting Payment Receipts...')}
            className="hover:text-emerald-700 font-semibold flex items-center gap-1"
          >
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}

