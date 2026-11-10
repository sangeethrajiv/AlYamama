import { useState } from 'react'
import { CheckCircle2, Plus } from 'lucide-react'
import type { Invoice, Bill, Payment, Account, TabId, DrawerType, UserRole } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

interface DashboardViewProps {
  invoices: Invoice[]
  bills: Bill[]
  payments: Payment[]
  accounts: Account[]
  currentRole?: UserRole
  onSelectTab: (tab: TabId) => void
  onOpenDrawer: (drawer: DrawerType) => void
  onOpenInvoiceModal: (invoice: Invoice) => void
}

export default function DashboardView({
  invoices,
  bills,
  payments,
  accounts,
  currentRole,
  onSelectTab,
  onOpenDrawer,
  onOpenInvoiceModal,
}: DashboardViewProps) {
  const openInvoices = invoices.filter(i => i.state === 'open' || i.state === 'in_payment')
  const overdueInvoices = invoices.filter(i => i.state !== 'paid' && i.state !== 'cancel' && i.dateDue < '2026-11-06')
  const totalReceivables = openInvoices.reduce((sum, i) => sum + i.residual, 0)

  const openBills = bills.filter(b => b.state === 'open' || b.state === 'in_payment')
  const pendingApprovalBills = bills.filter(b => b.approvalStatus === 'pending_manager' || b.approvalStatus === 'pending_director')
  const totalPayables = openBills.reduce((sum, b) => sum + b.residual, 0)

  const bankAccounts = accounts.filter(a => a.type === 'Bank and Cash')
  const totalCash = bankAccounts.reduce((sum, a) => sum + (a.currency === 'USD' ? a.balance * 3.75 : a.balance), 0)

  // Role-based perspective: owners see the money picture, accountants see the work queue
  const [view, setView] = useState<'owner' | 'accountant'>(currentRole === 'Finance Director' ? 'owner' : 'accountant')
  const [lastRole, setLastRole] = useState(currentRole)
  if (lastRole !== currentRole) {
    setLastRole(currentRole)
    setView(currentRole === 'Finance Director' ? 'owner' : 'accountant')
  }
  const booked = invoices.filter(i => i.state !== 'draft' && i.state !== 'cancel' && (i.category || 'credit') !== 'proforma')
  const totalRevenue = booked.reduce((s, i) => s + i.amountUntaxed * (i.currencyRate || 1), 0)
  const totalExpenses = bills
    .filter(b => b.state !== 'draft' && b.state !== 'cancel')
    .reduce((s, b) => s + b.amountUntaxed * (b.currencyRate || 1), 0)
  const pendingPayments = openInvoices.length + openBills.length
  const pendingReconciliation = payments.filter(p => p.state === 'posted' && p.partnerType === 'customer').length
  const kpis: { label: string; value: string; note: string; tab: TabId; tone?: string }[] =
    view === 'owner'
      ? [
          { label: 'Total Revenue', value: moneyFormat(totalRevenue, 'SAR'), note: `${booked.length} invoices booked (excl. VAT)`, tab: 'reports' },
          { label: 'Total Expenses', value: moneyFormat(totalExpenses, 'SAR'), note: 'Vendor bills (excl. VAT)', tab: 'bills' },
          { label: 'Net Profit', value: moneyFormat(totalRevenue - totalExpenses, 'SAR'), note: totalRevenue ? `${(((totalRevenue - totalExpenses) / totalRevenue) * 100).toFixed(1)}% margin` : '—', tab: 'reports', tone: totalRevenue >= totalExpenses ? 'text-emerald-800' : 'text-rose-600' },
          { label: 'Cash Available', value: moneyFormat(totalCash, 'SAR'), note: 'All bank & cash journals', tab: 'banking' },
        ]
      : [
          { label: 'Pending Payments', value: String(pendingPayments), note: `${openInvoices.length} invoices to collect · ${openBills.length} bills to pay`, tab: 'payments' },
          { label: 'Awaiting Reconciliation', value: String(pendingReconciliation), note: 'Posted payments not yet matched', tab: 'reconcile', tone: pendingReconciliation ? 'text-amber-600' : undefined },
          { label: 'Bills to Approve', value: String(pendingApprovalBills.length), note: 'Waiting on manager / director', tab: 'bills' },
          { label: 'Overdue Invoices', value: String(overdueInvoices.length), note: moneyFormat(overdueInvoices.reduce((s, i) => s + i.residual, 0), 'SAR') + ' outstanding', tab: 'invoices', tone: overdueInvoices.length ? 'text-rose-600' : undefined },
        ]

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Al-Yamama Business Overview • Hydraulic Workshop Suite
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            Financial Health & Real-Time Cash Position
          </h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-xl">
            Live operational telemetry across Al-Yamama workshop divisions, customer receivables, supplier liabilities, and bank balances.
          </p>
        </div>

      </div>

      {/* Role-based KPIs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">
            {view === 'owner' ? 'Owner view: business performance' : 'Accountant view: work queue'}
          </h2>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold" role="tablist">
            {(['owner', 'accountant'] as const).map(v => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md transition ${view === v ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {v === 'owner' ? 'Owner' : 'Accountant'}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map(k => (
            <button
              key={k.label}
              onClick={() => onSelectTab(k.tab)}
              className="text-left bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition"
            >
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{k.label}</div>
              <div className={`text-2xl font-black font-mono ${k.tone || 'text-slate-900'}`}>{k.value}</div>
              <div className="text-[11px] text-slate-500 mt-2">{k.note}</div>
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash in Bank */}
        <div
          onClick={() => onSelectTab('banking')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Cash & Bank Balances</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {moneyFormat(totalCash, 'SAR')}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 size={13} />
            <span>Across 4 Active Journals</span>
          </div>
        </div>

        {/* Receivables (Invoices) */}
        <div
          onClick={() => onSelectTab('invoices')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Customer Receivables</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {moneyFormat(totalReceivables, 'SAR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span>{openInvoices.length} unpaid</span>
            {overdueInvoices.length > 0 && (
              <span className="text-rose-600 font-bold ml-1">
                • {overdueInvoices.length} overdue
              </span>
            )}
          </div>
        </div>

        {/* Payables (Bills) */}
        <div
          onClick={() => onSelectTab('bills')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Supplier Payables</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {moneyFormat(totalPayables, 'SAR')}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span>{openBills.length} unpaid bills</span>
            {pendingApprovalBills.length > 0 && (
              <span className="text-amber-700 font-bold ml-1">
                • {pendingApprovalBills.length} to approve
              </span>
            )}
          </div>
        </div>

        {/* Net Operating Position */}
        <div
          onClick={() => onSelectTab('reports')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Net Operating Working Capital</span>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-800">
            {moneyFormat(totalReceivables - totalPayables, 'SAR')}
          </div>
          <div className="text-[11px] text-slate-700 font-semibold mt-2 flex items-center gap-1">
            
            <span>Receivables exceed payables</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Customer Invoicing Activity */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">
                Recent Customer Billing Activity
              </h3>
              <p className="text-xs text-slate-400">Latest hydraulic cylinder & pump repair invoices</p>
            </div>
            <button
              onClick={() => onSelectTab('invoices')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              View all invoices →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-100 select-none">
                  <th className="pb-2">Invoice #</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Due Date</th>
                  <th className="pb-2 text-right">Amount Due</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.slice(0, 4).map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => onOpenInvoiceModal(inv)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 font-bold font-mono text-emerald-800">{inv.number}</td>
                    <td className="py-2.5 font-semibold text-slate-800">{inv.partner}</td>
                    <td className="py-2.5 text-slate-500 font-mono">{inv.dateDue}</td>
                    <td className="py-2.5 text-right font-bold font-mono text-slate-900">
                      {moneyFormat(inv.residual, inv.currency)}
                    </td>
                    <td className="py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {inv.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Cash & Bank Accounts Snapshot */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">
                Bank & Cash Accounts
              </h3>
              <p className="text-xs text-slate-400">Current balances in real-time</p>
            </div>
            <button
              onClick={() => onSelectTab('banking')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
            >
              Banking →
            </button>
          </div>

          <div className="space-y-3">
            {bankAccounts.map(b => (
              <div
                key={b.id}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800">{b.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{b.code}</div>
                </div>
                <div className="font-mono font-bold text-slate-900">
                  {moneyFormat(b.balance, b.currency || 'SAR')}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Bank Reconciliation:</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} />
              <span>Up to date</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

