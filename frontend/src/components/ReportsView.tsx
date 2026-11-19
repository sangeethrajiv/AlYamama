import { useState } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import type { Account, Invoice, JournalEntry, AnalyticAccount } from '../types/accounting'
import { mockAnalyticAccounts, moneyFormat } from '../data/mockAccountingData'

interface ReportsViewProps {
  accounts: Account[]
  invoices: Invoice[]
  entries: JournalEntry[]
  initialReportTab?: 'pnl' | 'balance_sheet' | 'trial_balance' | 'gl' | 'aged_ar'
  selectedGlAccountCode?: string
}

export default function ReportsView({
  accounts,
  invoices,
  entries,
  initialReportTab = 'pnl',
  selectedGlAccountCode,
}: ReportsViewProps) {
  const [activeReport, setActiveReport] = useState<'pnl' | 'balance_sheet' | 'trial_balance' | 'gl' | 'aged_ar'>(
    selectedGlAccountCode ? 'gl' : initialReportTab
  )
  const [selectedCostCentre, setSelectedCostCentre] = useState<string>('all')
  const [glAccountCode, setGlAccountCode] = useState<string>(selectedGlAccountCode || '101000')

  // Calculate P&L
  const incomeAccounts = accounts.filter(a => a.internalGroup === 'income')
  const expenseAccounts = accounts.filter(a => a.internalGroup === 'expense')
  const totalIncome = incomeAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0)
  const totalExpenses = expenseAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0)
  const netProfit = totalIncome - totalExpenses

  // Calculate Balance Sheet
  const assetAccounts = accounts.filter(a => a.internalGroup === 'asset')
  const liabilityAccounts = accounts.filter(a => a.internalGroup === 'liability')
  const equityAccounts = accounts.filter(a => a.internalGroup === 'equity')

  const totalAssets = assetAccounts.reduce((sum, a) => sum + a.balance, 0)
  const totalLiabilities = liabilityAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0)
  const totalEquityBase = equityAccounts.reduce((sum, a) => sum + Math.abs(a.balance), 0)
  const totalEquityAndLiabilities = totalLiabilities + totalEquityBase + netProfit

  const balanceSheetEquationBalanced = Math.abs(totalAssets - totalEquityAndLiabilities) < 1.0

  // Calculate Trial Balance
  const trialBalanceRows = accounts.map(a => {
    const isDebitNormal = a.internalGroup === 'asset' || a.internalGroup === 'expense'
    const openDebit = isDebitNormal ? Math.max(0, a.balance * 0.8) : 0
    const openCredit = !isDebitNormal ? Math.max(0, Math.abs(a.balance) * 0.8) : 0
    const periodDebit = isDebitNormal ? Math.max(0, a.balance * 0.2) : 0
    const periodCredit = !isDebitNormal ? Math.max(0, Math.abs(a.balance) * 0.2) : 0
    const closingDebit = isDebitNormal ? a.balance : 0
    const closingCredit = !isDebitNormal ? Math.abs(a.balance) : 0

    return {
      account: a,
      openDebit,
      openCredit,
      periodDebit,
      periodCredit,
      closingDebit,
      closingCredit,
    }
  })

  const tbTotalClosingDebit = trialBalanceRows.reduce((sum, r) => sum + r.closingDebit, 0)
  const tbTotalClosingCredit = trialBalanceRows.reduce((sum, r) => sum + r.closingCredit, 0)
  const tbVariance = Math.abs(tbTotalClosingDebit - tbTotalClosingCredit)

  // Aged Receivables
  const agedReceivables = invoices
    .filter(inv => inv.state !== 'paid' && inv.state !== 'cancel')
    .map(inv => {
      // Days overdue simulation
      const dueDate = new Date(inv.dateDue).getTime()
      const todayDate = new Date('2026-11-06').getTime()
      const diffDays = Math.floor((todayDate - dueDate) / (1000 * 60 * 60 * 24))

      const current = diffDays <= 0 ? inv.residual : 0
      const d1_30 = diffDays > 0 && diffDays <= 30 ? inv.residual : 0
      const d31_60 = diffDays > 30 && diffDays <= 60 ? inv.residual : 0
      const d61_90 = diffDays > 60 && diffDays <= 90 ? inv.residual : 0
      const d90_plus = diffDays > 90 ? inv.residual : 0

      return {
        invoice: inv,
        current,
        d1_30,
        d31_60,
        d61_90,
        d90_plus,
        total: inv.residual,
      }
    })

  // GL transactions for selected account
  const glAccount = accounts.find(a => a.code === glAccountCode) || accounts[0]
  const glLines = entries.flatMap(e =>
    e.lines
      .filter(l => l.accountCode === glAccount.code)
      .map(l => ({
        entryNumber: e.entryNumber,
        date: e.entryDate,
        label: l.label,
        debit: l.debit,
        credit: l.credit,
        partner: l.partner || '—',
      }))
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Financial Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Profit & Loss, Balance Sheet, Trial Balance with variance validation, and Aged Receivables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            Print Report
          </button>
          <button
            onClick={() => alert('Exporting report data to Excel (.XLSX)...')}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            Export Excel
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveReport('pnl')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeReport === 'pnl' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Profit & Loss
          </button>
          <button
            onClick={() => setActiveReport('balance_sheet')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeReport === 'balance_sheet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Balance Sheet
          </button>
          <button
            onClick={() => setActiveReport('trial_balance')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeReport === 'trial_balance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Trial Balance
          </button>
          <button
            onClick={() => setActiveReport('aged_ar')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeReport === 'aged_ar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Aged Receivables
          </button>
          <button
            onClick={() => setActiveReport('gl')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeReport === 'gl' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            General Ledger
          </button>
        </div>

        {/* Cost centre filter (§16.1 ANA-009) */}
        <div className="flex items-center gap-2 text-xs">
          
          <span className="text-slate-500 font-semibold">Cost Centre:</span>
          <select
            value={selectedCostCentre}
            onChange={e => setSelectedCostCentre(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
          >
            <option value="all">All Workshop Cost Centres</option>
            {mockAnalyticAccounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 1. PROFIT & LOSS VIEW */}
      {activeReport === 'pnl' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-end">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Statement of Profit & Loss</h2>
              <p className="text-xs text-slate-400">For the period Jan 01, 2026 to Nov 06, 2026</p>
            </div>
            <div className="text-right">
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-mono">
                Period: Q1–Q4 2026
              </span>
            </div>
          </div>

          <div className="space-y-6 text-xs">
            {/* Revenue Section */}
            <div>
              <div className="bg-slate-50 px-3 py-2 font-bold text-slate-700 uppercase tracking-wider rounded-lg flex justify-between">
                <span>Operating Revenue / Income</span>
                <span>Amount</span>
              </div>
              <div className="divide-y divide-slate-100 mt-1">
                {incomeAccounts.map(acc => (
                  <div key={acc.id} className="py-2.5 px-3 flex justify-between hover:bg-slate-50/50">
                    <span className="text-slate-700 font-semibold">
                      <span className="font-mono text-emerald-800 mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">{moneyFormat(Math.abs(acc.balance))}</span>
                  </div>
                ))}
                <div className="py-2.5 px-3 flex justify-between font-bold text-emerald-800 bg-emerald-50/40 rounded-b">
                  <span>Total Income:</span>
                  <span className="font-mono">{moneyFormat(totalIncome)}</span>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div>
              <div className="bg-slate-50 px-3 py-2 font-bold text-slate-700 uppercase tracking-wider rounded-lg flex justify-between">
                <span>Cost of Goods Sold & Operating Expenses</span>
                <span>Amount</span>
              </div>
              <div className="divide-y divide-slate-100 mt-1">
                {expenseAccounts.map(acc => (
                  <div key={acc.id} className="py-2.5 px-3 flex justify-between hover:bg-slate-50/50">
                    <span className="text-slate-700 font-semibold">
                      <span className="font-mono text-amber-800 mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">{moneyFormat(Math.abs(acc.balance))}</span>
                  </div>
                ))}
                <div className="py-2.5 px-3 flex justify-between font-bold text-amber-800 bg-amber-50/40 rounded-b">
                  <span>Total Expenses:</span>
                  <span className="font-mono">{moneyFormat(totalExpenses)}</span>
                </div>
              </div>
            </div>

            {/* Net Profit Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-slate-700 text-white p-4 rounded-xl flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                  Net Operating Profit
                </div>
                <div className="text-xl font-black font-mono mt-0.5">
                  {moneyFormat(netProfit)}
                </div>
              </div>
              <div className="text-right text-[11px] opacity-90 font-mono">
                <div>Profit Margin: {((netProfit / totalIncome) * 100).toFixed(1)}%</div>
                <div>Flows directly into Retained Earnings</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. BALANCE SHEET VIEW */}
      {activeReport === 'balance_sheet' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-6 text-xs">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-end">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Balance Sheet</h2>
              <p className="text-xs text-slate-400">As of November 06, 2026</p>
            </div>
            {/* Equation Check */}
            <div>
              {balanceSheetEquationBalanced ? (
                <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs">
                  <CheckCircle2 size={14} /> Total Assets = Liabilities + Equity
                </span>
              ) : (
                <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs">
                  <AlertCircle size={14} /> Variance Detected
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assets Column */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-2.5 rounded-lg font-bold text-slate-800 uppercase tracking-wider flex justify-between">
                <span>Assets</span>
                <span>Amount</span>
              </div>
              <div className="divide-y divide-slate-100">
                {assetAccounts.map(acc => (
                  <div key={acc.id} className="py-2 px-2 flex justify-between hover:bg-slate-50/50">
                    <span className="text-slate-700">
                      <span className="font-mono text-slate-700 mr-2">{acc.code}</span>
                      {acc.name}
                    </span>
                    <span className="font-mono font-bold text-slate-900">{moneyFormat(acc.balance)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t-2 border-slate-300 flex justify-between font-bold text-sm text-slate-900">
                <span>Total Assets:</span>
                <span className="font-mono">{moneyFormat(totalAssets)}</span>
              </div>
            </div>

            {/* Liabilities & Equity Column */}
            <div className="space-y-4">
              <div className="bg-slate-50 p-2.5 rounded-lg font-bold text-slate-800 uppercase tracking-wider flex justify-between">
                <span>Liabilities & Equity</span>
                <span>Amount</span>
              </div>

              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Liabilities</div>
                <div className="divide-y divide-slate-100">
                  {liabilityAccounts.map(acc => (
                    <div key={acc.id} className="py-2 px-2 flex justify-between hover:bg-slate-50/50">
                      <span className="text-slate-700">
                        <span className="font-mono text-amber-700 mr-2">{acc.code}</span>
                        {acc.name}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{moneyFormat(Math.abs(acc.balance))}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Equity & Retained Earnings</div>
                <div className="divide-y divide-slate-100">
                  {equityAccounts.map(acc => (
                    <div key={acc.id} className="py-2 px-2 flex justify-between hover:bg-slate-50/50">
                      <span className="text-slate-700">
                        <span className="font-mono text-slate-700 mr-2">{acc.code}</span>
                        {acc.name}
                      </span>
                      <span className="font-mono font-bold text-slate-900">{moneyFormat(Math.abs(acc.balance))}</span>
                    </div>
                  ))}
                  <div className="py-2 px-2 flex justify-between text-emerald-700 font-semibold">
                    <span>Current Year Net Profit:</span>
                    <span className="font-mono font-bold">{moneyFormat(netProfit)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-slate-300 flex justify-between font-bold text-sm text-slate-900">
                <span>Total Liabilities & Equity:</span>
                <span className="font-mono text-emerald-800">{moneyFormat(totalEquityAndLiabilities)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. TRIAL BALANCE VIEW */}
      {activeReport === 'trial_balance' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Trial Balance Verification</h2>
              <p className="text-[11px] text-slate-500">
                Validates Total Debits = Total Credits across all GL accounts.
              </p>
            </div>
            {tbVariance === 0 ? (
              <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs self-start">
                <CheckCircle2 size={14} /> Total Debits = Total Credits
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 text-xs self-start">
                Variance: {moneyFormat(tbVariance)}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Account Code & Name</th>
                  <th className="py-2.5 px-3 text-right">Opening Debit</th>
                  <th className="py-2.5 px-3 text-right">Opening Credit</th>
                  <th className="py-2.5 px-3 text-right">Period Debit</th>
                  <th className="py-2.5 px-3 text-right">Period Credit</th>
                  <th className="py-2.5 px-3 text-right">Closing Debit</th>
                  <th className="py-2.5 px-3 text-right">Closing Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {trialBalanceRows.map(r => (
                  <tr key={r.account.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                      <span className="font-mono text-emerald-700 mr-2">{r.account.code}</span>
                      {r.account.name}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500">{r.openDebit ? moneyFormat(r.openDebit) : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{r.openCredit ? moneyFormat(r.openCredit) : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{r.periodDebit ? moneyFormat(r.periodDebit) : '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{r.periodCredit ? moneyFormat(r.periodCredit) : '—'}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{r.closingDebit ? moneyFormat(r.closingDebit) : '—'}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{r.closingCredit ? moneyFormat(r.closingCredit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-mono font-bold text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td className="py-3 px-3 font-sans">Total Balance Check:</td>
                  <td className="py-3 px-3 text-right"></td>
                  <td className="py-3 px-3 text-right"></td>
                  <td className="py-3 px-3 text-right"></td>
                  <td className="py-3 px-3 text-right"></td>
                  <td className="py-3 px-3 text-right text-emerald-800">{moneyFormat(tbTotalClosingDebit)}</td>
                  <td className="py-3 px-3 text-right text-emerald-800">{moneyFormat(tbTotalClosingCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 4. AGED RECEIVABLES VIEW */}
      {activeReport === 'aged_ar' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden text-xs">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-base font-extrabold text-slate-900">Aged Receivables Summary</h2>
            <p className="text-[11px] text-slate-500">
              Bucketed aging intervals: Current, 1–30 days, 31–60 days, 61–90 days, 90+ days overdue.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Customer & Invoice</th>
                  <th className="py-2.5 px-3 text-right">Current</th>
                  <th className="py-2.5 px-3 text-right">1–30 Days</th>
                  <th className="py-2.5 px-3 text-right">31–60 Days</th>
                  <th className="py-2.5 px-3 text-right">61–90 Days</th>
                  <th className="py-2.5 px-3 text-right">90+ Days</th>
                  <th className="py-2.5 px-3 text-right font-black">Total Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {agedReceivables.map(ar => (
                  <tr key={ar.invoice.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-sans">
                      <div className="font-bold text-slate-900">{ar.invoice.partner}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {ar.invoice.number} • Due: {ar.invoice.dateDue}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">
                      {ar.current ? moneyFormat(ar.current, ar.invoice.currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-700 font-semibold">
                      {ar.d1_30 ? moneyFormat(ar.d1_30, ar.invoice.currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-800 font-semibold">
                      {ar.d31_60 ? moneyFormat(ar.d31_60, ar.invoice.currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-600 font-bold">
                      {ar.d61_90 ? moneyFormat(ar.d61_90, ar.invoice.currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-800 font-black">
                      {ar.d90_plus ? moneyFormat(ar.d90_plus, ar.invoice.currency) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      {moneyFormat(ar.total, ar.invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. GENERAL LEDGER VIEW */}
      {activeReport === 'gl' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">General Ledger Drilldown</h2>
              <p className="text-[11px] text-slate-400">
                Detailed transaction lines and running balance for specific accounts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Select GL Account:</span>
              <select
                value={glAccountCode}
                onChange={e => setGlAccountCode(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-800"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.code}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">{glAccount.code} — {glAccount.name}</div>
              <div className="text-[11px] text-slate-500">Group: {glAccount.internalGroup} • Type: {glAccount.type}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Current Ledger Balance</div>
              <div className="font-mono font-bold text-base text-slate-900">{moneyFormat(glAccount.balance, glAccount.currency)}</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Entry Number</th>
                  <th className="py-2.5 px-3">Partner</th>
                  <th className="py-2.5 px-3">Label / Description</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {glLines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No posted journal lines for this account in the selected period.
                    </td>
                  </tr>
                ) : (
                  glLines.map((line, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-600 font-mono">{line.date}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{line.entryNumber}</td>
                      <td className="py-2 px-3 text-slate-700">{line.partner}</td>
                      <td className="py-2 px-3 text-slate-600">{line.label}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                        {line.debit ? moneyFormat(line.debit) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                        {line.credit ? moneyFormat(line.credit) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

