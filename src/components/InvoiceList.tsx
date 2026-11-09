import { useState } from 'react'
import {
  FileText,
  Plus,
  Printer,
  CreditCard,
  CheckCircle,
  XCircle,
  FileDown,
  Paperclip,
  ArrowRightLeft,
  Building,
  AlertTriangle,
  Coins,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import type { Invoice, InvoiceState, UserRole, InvoiceCategory } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'
import MoneyBar from './MoneyBar'

interface InvoiceListProps {
  invoices: Invoice[]
  onOpenInvoiceModal: (invoice?: Invoice, defaultCategory?: InvoiceCategory) => void
  onOpenPaymentModal: (invoice: Invoice) => void
  onOpenPdfModal: (invoice: Invoice) => void
  onValidateInvoice: (invoiceId: string) => void
  onCancelInvoice: (invoiceId: string) => void
  onCreateCreditNote: (invoice: Invoice) => void
  onConvertToTaxInvoice?: (invoiceId: string) => void
  currentRole: UserRole
  searchQuery: string
  activeCategoryFilter?: InvoiceCategory | 'all'
  onCategoryFilterChange?: (cat: InvoiceCategory | 'all') => void
}

export default function InvoiceList({
  invoices,
  onOpenInvoiceModal,
  onOpenPaymentModal,
  onOpenPdfModal,
  onValidateInvoice,
  onCancelInvoice,
  onCreateCreditNote,
  onConvertToTaxInvoice,
  currentRole,
  searchQuery,
  activeCategoryFilter = 'all',
  onCategoryFilterChange,
}: InvoiceListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [internalCategory, setInternalCategory] = useState<InvoiceCategory | 'all'>('all')

  const categoryFilter = activeCategoryFilter !== undefined && activeCategoryFilter !== 'all'
    ? activeCategoryFilter
    : internalCategory

  const handleSelectCategory = (cat: InvoiceCategory | 'all') => {
    setInternalCategory(cat)
    if (onCategoryFilterChange) onCategoryFilterChange(cat)
  }

  // Counts by category
  const allCount = invoices.length
  const cashCount = invoices.filter(i => (i.category || 'credit') === 'cash').length
  const creditCount = invoices.filter(i => (i.category || 'credit') === 'credit').length
  const proformaCount = invoices.filter(i => i.category === 'proforma').length
  const progressiveCount = invoices.filter(i => i.category === 'progressive').length

  // Money bar calculations
  const draftCount = invoices.filter(i => i.state === 'draft').length
  const draftAmount = invoices.filter(i => i.state === 'draft').reduce((acc, i) => acc + i.amountTotal, 0)

  const openInvoices = invoices.filter(i => i.state === 'open' || i.state === 'in_payment')
  const openCount = openInvoices.length
  const openAmount = openInvoices.reduce((acc, i) => acc + i.residual, 0)

  // Overdue check (due date < today and not fully paid)
  const today = '2026-11-06'
  const overdueInvoices = invoices.filter(i => i.state !== 'paid' && i.state !== 'cancel' && i.dateDue < today)
  const overdueCount = overdueInvoices.length
  const overdueAmount = overdueInvoices.reduce((acc, i) => acc + i.residual, 0)

  const paidInvoices = invoices.filter(i => i.state === 'paid')
  const paidCount = paidInvoices.length
  const paidAmount = paidInvoices.reduce((acc, i) => acc + i.amountTotal, 0)

  const segments = [
    { id: 'draft', label: 'Draft', count: draftCount, amount: draftAmount, color: 'blue' as const },
    { id: 'open', label: 'Unpaid / Open', count: openCount, amount: openAmount, color: 'orange' as const },
    { id: 'overdue', label: 'Overdue Receivables', count: overdueCount, amount: overdueAmount, color: 'red' as const },
    { id: 'paid', label: 'Paid', count: paidCount, amount: paidAmount, color: 'green' as const },
  ]

  const filteredInvoices = invoices.filter(inv => {
    // Category filter
    if (categoryFilter !== 'all') {
      const cat = inv.category || 'credit'
      if (cat !== categoryFilter) return false
    }

    // Status filter
    if (statusFilter === 'draft' && inv.state !== 'draft') return false
    if (statusFilter === 'open' && inv.state !== 'open' && inv.state !== 'in_payment') return false
    if (statusFilter === 'overdue' && (inv.state === 'paid' || inv.state === 'cancel' || inv.dateDue >= today)) return false
    if (statusFilter === 'paid' && inv.state !== 'paid') return false

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match =
        inv.number.toLowerCase().includes(q) ||
        inv.partner.toLowerCase().includes(q) ||
        (inv.reference && inv.reference.toLowerCase().includes(q))
      if (!match) return false
    }

    return true
  })

  const getStateBadge = (state: InvoiceState) => {
    switch (state) {
      case 'draft':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">Draft</span>
      case 'open':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">Posted</span>
      case 'in_payment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">In Payment</span>
      case 'paid':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Paid</span>
      case 'cancel':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">Cancelled</span>
    }
  }

  // Permission check based on Segregation of Duties Matrix (§19.3)
  const canValidate = currentRole === 'Finance Director' || currentRole === 'Accounts Manager' || currentRole === 'Senior Accountant'

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Customer Invoices</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, validate, manage receivables, partial settlements and generate ZATCA-compliant invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenInvoiceModal()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={16} />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* 4 Invoice Types Selector Bar */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => handleSelectCategory('all')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            categoryFilter === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>All Invoices</span>
          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono">
            {allCount}
          </span>
        </button>

        <button
          onClick={() => handleSelectCategory('cash')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            categoryFilter === 'cash'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins size={13} />
          <span>Cash Invoices</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            categoryFilter === 'cash' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {cashCount}
          </span>
        </button>

        <button
          onClick={() => handleSelectCategory('credit')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            categoryFilter === 'credit'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CreditCard size={13} />
          <span>Credit Invoices</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            categoryFilter === 'credit' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {creditCount}
          </span>
        </button>

        <button
          onClick={() => handleSelectCategory('proforma')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            categoryFilter === 'proforma'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText size={13} />
          <span>Proforma Invoices</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            categoryFilter === 'proforma' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {proformaCount}
          </span>
        </button>

        <button
          onClick={() => handleSelectCategory('progressive')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            categoryFilter === 'progressive'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers size={13} />
          <span>Progressive Invoices</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            categoryFilter === 'progressive' ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-700'
          }`}>
            {progressiveCount}
          </span>
        </button>
      </div>

      {/* Interactive Money Bar */}
      <MoneyBar
        segments={segments}
        selectedSegment={statusFilter}
        onSelectSegment={setStatusFilter}
        currency="SAR"
      />

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-3 px-3.5">Invoice #</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-right">Tax 15%</th>
                <th className="py-3 px-3 text-right">Total Amount</th>
                <th className="py-3 px-3 text-right">Amount Due</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Approval</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No invoices match your criteria</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your search or Money Bar filter.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const isOverdue = inv.state !== 'paid' && inv.state !== 'cancel' && inv.dateDue < today
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => onOpenInvoiceModal(inv)}
                    >
                      <td className="py-3 px-3.5 font-bold font-mono text-emerald-800 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{inv.number}</span>
                          {inv.attachmentsCount > 0 && (
                            <span className="text-[10px] text-slate-400 flex items-center" title={`${inv.attachmentsCount} attachments`}>
                              <Paperclip size={11} /> {inv.attachmentsCount}
                            </span>
                          )}
                          {inv.type === 'out_refund' && (
                            <span className="bg-purple-100 text-purple-700 text-[9px] px-1 rounded font-sans">Credit Note</span>
                          )}
                        </div>
                        {inv.reference && (
                          <div className="text-[10px] text-slate-400 font-normal font-sans">Ref: {inv.reference}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {inv.category === 'cash' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <Coins size={11} /> Cash
                          </span>
                        )}
                        {(inv.category === 'credit' || !inv.category) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            <CreditCard size={11} /> Credit
                          </span>
                        )}
                        {inv.category === 'proforma' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                            <FileText size={11} /> Proforma
                          </span>
                        )}
                        {inv.category === 'progressive' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            <Layers size={11} /> Progressive {inv.progressPercentage ? `${inv.progressPercentage}%` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{inv.dateInvoice}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        <div>{inv.partner}</div>
                        {inv.interCompanyBillRef && (
                          <div className="text-[10px] text-emerald-600 flex items-center gap-1 font-mono">
                            <Building size={10} /> IC: {inv.interCompanyBillRef}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={isOverdue ? 'text-rose-600 font-bold flex items-center gap-1' : 'text-slate-600'}>
                          {isOverdue && <AlertTriangle size={12} />}
                          {inv.dateDue}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {moneyFormat(inv.amountTax, inv.currency)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 whitespace-nowrap">
                        {moneyFormat(inv.amountTotal, inv.currency)}
                        {inv.currency !== 'SAR' && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            ≈ {moneyFormat(inv.amountTotal * inv.currencyRate, 'SAR')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono whitespace-nowrap">
                        <span className={inv.residual > 0 ? 'text-amber-700' : 'text-slate-400'}>
                          {moneyFormat(inv.residual, inv.currency)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {getStateBadge(inv.state)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {inv.approvalStatus === 'approved' && (
                          <span className="text-[10px] text-emerald-700 font-semibold flex items-center justify-center gap-1">
                            <CheckCircle size={12} /> Approved
                          </span>
                        )}
                        {inv.approvalStatus === 'pending_director' && (
                          <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-full border border-purple-200 font-semibold" title="Invoice >= SAR 200,000 threshold">
                            Pending Director
                          </span>
                        )}
                        {inv.approvalStatus === 'pending_manager' && (
                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200 font-semibold">
                            Pending Manager
                          </span>
                        )}
                        {inv.approvalStatus === 'rejected' && (
                          <span className="text-[10px] text-rose-700 font-semibold flex items-center justify-center gap-1">
                            <XCircle size={12} /> Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Proforma Convert to Tax Invoice */}
                          {inv.category === 'proforma' && onConvertToTaxInvoice && (
                            <button
                              onClick={() => onConvertToTaxInvoice(inv.id)}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition"
                              title="Convert Proforma to Official Tax Invoice"
                            >
                              <ArrowUpRight size={12} />
                              <span>Convert</span>
                            </button>
                          )}

                          {/* Validate & Post button if Draft */}
                          {inv.state === 'draft' && canValidate && (
                            <button
                              onClick={() => onValidateInvoice(inv.id)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition"
                              title="Validate & Post Invoice"
                            >
                              Post
                            </button>
                          )}

                          {/* Register payment button if Open or In Payment */}
                          {(inv.state === 'open' || inv.state === 'in_payment') && (
                            <button
                              onClick={() => onOpenPaymentModal(inv)}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition"
                              title="Register Payment / Receipt"
                            >
                              <CreditCard size={11} />
                              <span>Pay</span>
                            </button>
                          )}

                          {/* Print PDF */}
                          <button
                            onClick={() => onOpenPdfModal(inv)}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                            title="Preview Printable Tax Invoice (QWeb / ZATCA)"
                          >
                            <Printer size={15} />
                          </button>

                          {/* Credit Note button */}
                          {inv.state === 'open' && (
                            <button
                              onClick={() => onCreateCreditNote(inv)}
                              className="p-1 text-purple-600 hover:bg-purple-50 rounded transition"
                              title="Create Credit Note (out_refund)"
                            >
                              <ArrowRightLeft size={15} />
                            </button>
                          )}

                          {/* Cancel button if Open or Draft */}
                          {(inv.state === 'draft' || inv.state === 'open') && (
                            <button
                              onClick={() => onCancelInvoice(inv.id)}
                              className="p-1 text-rose-500 hover:bg-rose-50 rounded transition"
                              title="Cancel Invoice"
                            >
                              <XCircle size={15} />
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

        {/* Table footer info */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[11px]">
          <div>
            Showing <strong className="text-slate-700">{filteredInvoices.length}</strong> of{' '}
            <strong className="text-slate-700">{invoices.length}</strong> invoices
          </div>
          <div className="flex items-center gap-3">
            <span>Statuses: <span className="font-semibold text-slate-700">Draft → Posted → In Payment → Paid</span></span>
            <button
              onClick={() => alert('Exporting Customer Invoices to Excel format (XLSX)...')}
              className="hover:text-emerald-700 font-semibold flex items-center gap-1"
            >
              <FileDown size={12} /> Export CSV/XLSX
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

