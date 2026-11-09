import { useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import type { Account, AccountType } from '../types/accounting'
import { moneyFormat } from '../data/mockAccountingData'

interface ChartOfAccountsViewProps {
  accounts: Account[]
  onSelectAccountForGl: (accountCode: string) => void
  searchQuery: string
}

export default function ChartOfAccountsView({
  accounts,
  onSelectAccountForGl,
  searchQuery,
}: ChartOfAccountsViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('all')

  const groups = [
    { id: 'all', label: 'All Accounts' },
    { id: 'asset', label: 'Assets (1xxxxx)' },
    { id: 'liability', label: 'Liabilities (2xxxxx)' },
    { id: 'equity', label: 'Equity (3xxxxx)' },
    { id: 'income', label: 'Income / Revenue (4xxxxx)' },
    { id: 'expense', label: 'Expenses & COGS (5xxxxx)' },
  ]

  const filteredAccounts = accounts.filter(acc => {
    if (selectedGroup !== 'all' && acc.internalGroup !== selectedGroup) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match = acc.code.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const getGroupBadge = (group: Account['internalGroup']) => {
    switch (group) {
      case 'asset':
        return <span className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Asset</span>
      case 'liability':
        return <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Liability</span>
      case 'equity':
        return <span className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Equity</span>
      case 'income':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Income</span>
      case 'expense':
        return <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded font-bold uppercase">Expense</span>
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Chart of Accounts (CoA)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Hierarchical ledger accounts scoped per company. Drives financial reports and reconciliation eligibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => alert('Opening CoA CSV Import Wizard (COA-007)...')}
            className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
          >
            
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => alert('New account modal')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={15} />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* Group Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGroup(g.id)}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition ${
              selectedGroup === g.id
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-3 px-3.5">Code</th>
                <th className="py-3 px-3">Account Name</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Internal Group</th>
                <th className="py-3 px-3 text-center">Allow Reconcile</th>
                <th className="py-3 px-3 text-center">Active</th>
                <th className="py-3 px-3 text-right">Current Balance</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map(acc => (
                <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3.5 font-bold font-mono text-emerald-800 whitespace-nowrap">
                    {acc.code}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    <div>{acc.name}</div>
                    {acc.currency && (
                      <span className="text-[10px] text-slate-400 font-mono">Currency: {acc.currency}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{acc.type}</td>
                  <td className="py-3 px-3">{getGroupBadge(acc.internalGroup)}</td>
                  <td className="py-3 px-3 text-center">
                    {acc.reconcile ? (
                      <span className="inline-flex items-center text-emerald-600" title="Reconcile Enabled">
                        <Check size={16} />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-slate-300">
                        <X size={16} />
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {acc.active ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Active"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" title="Archived"></span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-bold font-mono whitespace-nowrap">
                    <span className={acc.balance >= 0 ? 'text-slate-900' : 'text-rose-700'}>
                      {moneyFormat(acc.balance, acc.currency || 'SAR')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => onSelectAccountForGl(acc.code)}
                      className="px-2.5 py-1 text-emerald-700 hover:bg-emerald-50 rounded text-[11px] font-bold flex items-center gap-1 ml-auto transition"
                      title="Drill-down to General Ledger entries"
                    >
                      <span>Ledger</span>
                      
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
          <div>
            Showing <strong className="text-slate-700">{filteredAccounts.length}</strong> of{' '}
            <strong className="text-slate-700">{accounts.length}</strong> accounts
          </div>
          <button
            onClick={() => alert('Exporting Chart of Accounts to CSV...')}
            className="hover:text-emerald-700 font-semibold flex items-center gap-1"
          >
            Export CoA (CSV)
          </button>
        </div>
      </div>
    </div>
  )
}

