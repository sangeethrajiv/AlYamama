import { useState } from 'react'
import { Plus, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { Bill, InvoiceState, UserRole } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'
import MoneyBar from './MoneyBar'

interface BillListProps {
  bills: Bill[]
  onOpenBillModal: (bill?: Bill) => void
  onPayBill: (bill: Bill) => void
  onApproveBill: (billId: string) => void
  onRejectBill: (billId: string, reason: string) => void
  currentRole: UserRole
  searchQuery: string
}

export default function BillList({
  bills,
  onOpenBillModal,
  onPayBill,
  onApproveBill,
  onRejectBill,
  currentRole,
  searchQuery,
}: BillListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [rejectModalBillId, setRejectModalBillId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const today = '2026-11-06'

  // Segments for Money Bar
  const draftBills = bills.filter(b => b.state === 'draft')
  const openBills = bills.filter(b => b.state === 'open' || b.state === 'in_payment')
  const overdueBills = bills.filter(b => b.state !== 'paid' && b.state !== 'cancel' && b.dateDue < today)
  const paidBills = bills.filter(b => b.state === 'paid')

  const segments = [
    { id: 'draft', label: 'Draft Bills', count: draftBills.length, amount: draftBills.reduce((a, b) => a + b.amountTotal, 0), color: 'blue' as const },
    { id: 'open', label: 'Unpaid Payables', count: openBills.length, amount: openBills.reduce((a, b) => a + b.residual, 0), color: 'orange' as const },
    { id: 'overdue', label: 'Overdue Bills', count: overdueBills.length, amount: overdueBills.reduce((a, b) => a + b.residual, 0), color: 'red' as const },
    { id: 'paid', label: 'Paid Bills', count: paidBills.length, amount: paidBills.reduce((a, b) => a + b.amountTotal, 0), color: 'green' as const },
  ]

  const filteredBills = bills.filter(bill => {
    if (statusFilter === 'draft' && bill.state !== 'draft') return false
    if (statusFilter === 'open' && bill.state !== 'open' && bill.state !== 'in_payment') return false
    if (statusFilter === 'overdue' && (bill.state === 'paid' || bill.state === 'cancel' || bill.dateDue >= today)) return false
    if (statusFilter === 'paid' && bill.state !== 'paid') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match =
        bill.number.toLowerCase().includes(q) ||
        bill.vendor.toLowerCase().includes(q) ||
        bill.supplierInvoiceNumber.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const getStateBadge = (state: InvoiceState) => {
    switch (state) {
      case 'draft':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Draft</span>
      case 'open':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Open</span>
      case 'in_payment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">In Payment</span>
      case 'paid':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Paid</span>
      case 'cancel':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Cancelled</span>
    }
  }

  // Permissions based on §19.3
  const canApproveLevel1 = currentRole === 'Finance Director' || currentRole === 'Accounts Manager'
  const canApproveLevel2 = currentRole === 'Finance Director'

  const handleConfirmReject = () => {
    if (rejectModalBillId && rejectReason.trim()) {
      onRejectBill(rejectModalBillId, rejectReason)
      setRejectModalBillId(null)
      setRejectReason('')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Vendor Bills</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage supplier invoices, purchase orders, approval thresholds, duplicate detection, and disbursements.
          </p>
        </div>

        <button
          onClick={() => onOpenBillModal()}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus size={16} />
          <span>Create Vendor Bill</span>
        </button>
      </div>

      {/* Summary Money Bar */}
      <MoneyBar
        segments={segments}
        selectedSegment={statusFilter}
        onSelectSegment={setStatusFilter}
        currency="SAR"
      />

      {/* Bills Table Container */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-3 px-3.5">Bill Number</th>
                <th className="py-3 px-3">Supplier Invoice #</th>
                <th className="py-3 px-3">Bill Date</th>
                <th className="py-3 px-3">Vendor</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Tax 15%</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-right">Amount Due</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Approval Workflow</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    
                    <p className="font-semibold text-slate-600">No vendor bills found</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your filters or create a new bill.</p>
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => {
                  const isOverdue = bill.state !== 'paid' && bill.state !== 'cancel' && bill.dateDue < today
                  return (
                    <tr
                      key={bill.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => onOpenBillModal(bill)}
                    >
                      <td className="py-3 px-3.5 font-bold font-mono text-amber-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{bill.number}</span>
                          {bill.attachmentsCount > 0 && (
                            <span className="text-[10px] text-slate-400 flex items-center" title={`${bill.attachmentsCount} files attached`}>
                              {bill.attachmentsCount}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                        {bill.supplierInvoiceNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{bill.dateBill}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <div>{bill.vendor}</div>
                        {bill.interCompanyOrigin && (
                          <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-mono">
                            Auto-IC from: {bill.interCompanyOrigin}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={isOverdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-slate-600'}>
                          {isOverdue && <AlertTriangle size={12} />}
                          {bill.dateDue}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {moneyFormat(bill.amountTax, bill.currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                        {moneyFormat(bill.amountTotal, bill.currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono whitespace-nowrap">
                        <span className={bill.residual > 0 ? 'text-amber-700' : 'text-slate-400'}>
                          {moneyFormat(bill.residual, bill.currency)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getStateBadge(bill.state)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {bill.approvalStatus === 'approved' && (
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center justify-center gap-1">
                            <CheckCircle size={12} /> Approved
                          </span>
                        )}
                        {bill.approvalStatus === 'pending_manager' && (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 font-semibold">
                              Pending Accts Mgr
                            </span>
                            {canApproveLevel1 && (
                              <button
                                onClick={() => onApproveBill(bill.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Approve Bill"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            {canApproveLevel1 && (
                              <button
                                onClick={() => setRejectModalBillId(bill.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="Reject Bill"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </div>
                        )}
                        {bill.approvalStatus === 'pending_director' && (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200 font-semibold">
                              Pending Finance Dir
                            </span>
                            {canApproveLevel2 && (
                              <button
                                onClick={() => onApproveBill(bill.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                title="Approve Bill"
                              >
                                <CheckCircle size={14} />
                              </button>
                            )}
                            {canApproveLevel2 && (
                              <button
                                onClick={() => setRejectModalBillId(bill.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                title="Reject Bill"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                          </div>
                        )}
                        {bill.approvalStatus === 'rejected' && (
                          <span className="text-[10px] text-rose-700 font-semibold flex items-center justify-center gap-1" title={bill.approvalRejectReason}>
                            <XCircle size={12} /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {(bill.state === 'open' || bill.state === 'in_payment') && (
                            <button
                              onClick={() => onPayBill(bill)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition"
                              title="Pay Vendor Bill"
                            >
                              
                              <span>Pay</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
          <div>
            Showing <strong className="text-slate-700">{filteredBills.length}</strong> of{' '}
            <strong className="text-slate-700">{bills.length}</strong> bills
          </div>
          <button
            onClick={() => alert('Exporting Vendor Bills to XLSX...')}
            className="hover:text-emerald-700 font-semibold flex items-center gap-1"
          >
            Export CSV/XLSX
          </button>
        </div>
      </div>

      {/* Reject with Reason Modal */}
      {rejectModalBillId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <h3 className="font-bold text-sm text-slate-800 mb-2">Reject Vendor Bill with Reason</h3>
            <p className="text-xs text-slate-500 mb-3">
              Document will be returned to Draft with the rejection reason recorded in the activity log.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Quantity mismatch with GRN, price higher than PO agreement..."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 mb-4 focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectModalBillId(null)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

