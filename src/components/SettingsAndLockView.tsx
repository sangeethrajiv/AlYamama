import { useState } from 'react'
import {
  Calendar,
  Building2,
  Coins,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Lock,
} from 'lucide-react'
import type { CompanyId, FiscalPeriodConfig, UserRole } from '../types/accounting'
import { mockCompanies, mockCurrencies } from '../data/mockAccountingData'

interface SettingsAndLockViewProps {
  currentCompanyId: CompanyId
  fiscalConfig: FiscalPeriodConfig
  onAdvanceLockDate: (newHardLock: string, newSoftLock: string) => void
  currentRole: UserRole
}

export default function SettingsAndLockView({
  currentCompanyId,
  fiscalConfig,
  onAdvanceLockDate,
  currentRole,
}: SettingsAndLockViewProps) {
  const [activeTab, setActiveTab] = useState<'periods' | 'companies' | 'currencies' | 'thresholds' | 'migration'>('periods')

  // Close period wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [chkEntriesPosted, setChkEntriesPosted] = useState(true)
  const [chkUnreconciled, setChkUnreconciled] = useState(true)
  const [chkTbBalanced, setChkTbBalanced] = useState(true)
  const [chkRetainedEarnings, setChkRetainedEarnings] = useState(true)

  const [newClosingDate, setNewClosingDate] = useState('2026-10-31')

  const canAdvanceLock =
    currentRole === 'Finance Director' ||
    currentRole === 'Accounts Manager'

  const allChecklistPassed =
    chkEntriesPosted && chkUnreconciled && chkTbBalanced && chkRetainedEarnings

  const handleExecuteClosePeriod = () => {
    if (!canAdvanceLock) {
      alert('Access Denied: Only Accounts Manager or Finance Director can update the closing date.')
      return
    }
    if (!allChecklistPassed) {
      alert('All items in the period-close checklist must be verified before locking.')
      return
    }
    onAdvanceLockDate(newClosingDate, newClosingDate)
    setShowWizard(false)
  }

  const activeCompany = mockCompanies.find(c => c.id === currentCompanyId) || mockCompanies[0]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Settings & Configuration
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage accounting periods, legal entities, foreign currency rates, and approval limits.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('periods')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'periods' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Fiscal Periods
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'companies' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Multi-Company
        </button>
        <button
          onClick={() => setActiveTab('currencies')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'currencies' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Currencies & Rates
        </button>
        <button
          onClick={() => setActiveTab('thresholds')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'thresholds' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Approval Limits
        </button>
        <button
          onClick={() => setActiveTab('migration')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'migration' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Opening Balances
        </button>
      </div>

      {/* 1. FISCAL PERIODS TAB */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Fiscal Year & Accounting Period
                </h2>
                <p className="text-slate-500">
                  Current Entity: <strong className="text-slate-800">{activeCompany.name}</strong>
                </p>
              </div>

              <button
                onClick={() => setShowWizard(true)}
                disabled={!canAdvanceLock}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Calendar size={15} />
                <span>Update Accounting Period</span>
              </button>
            </div>

            {/* Clean summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="text-slate-500 font-bold mb-1">Fiscal Year</div>
                <div className="text-xl font-black font-mono text-slate-900 my-1">
                  Year 2026
                </div>
                <p className="text-[11px] text-slate-500">
                  Starts January 01 • Ends December 31
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="text-slate-500 font-bold mb-1">Active Accounting Period</div>
                <div className="text-xl font-black font-mono text-emerald-800 my-1 flex items-center gap-2">
                  <span>Q4 2026</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    OPEN
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Transactions and invoices can be posted freely
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="text-slate-500 font-bold mb-1">Period Closing Date</div>
                <div className="text-xl font-black font-mono text-slate-900 my-1">
                  {fiscalConfig.periodLockDate}
                </div>
                <p className="text-[11px] text-slate-500">
                  Historical entries on or before this date are finalized
                </p>
              </div>
            </div>

            {/* Information panel */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mt-0.5">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="font-bold text-slate-800">Automated Accounting Controls</div>
                <p className="text-slate-500 mt-0.5 text-[11px]">
                  All transactions, customer billing, and supplier payments automatically validate against the active fiscal period. Closing dates advance periodically after month-end financial reviews.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MULTI-COMPANY SETUP TAB */}
      {activeTab === 'companies' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Multi-Company Configuration
              </h2>
              <p className="text-slate-500">
                Isolated accounting books per legal entity with automatic inter-company synchronization.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockCompanies.map(c => (
              <div
                key={c.id}
                className={`p-4 rounded-xl border text-xs ${
                  c.id === currentCompanyId ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-extrabold text-slate-900 text-sm">{c.name}</span>
                  <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold text-[10px]">
                    {c.code}
                  </span>
                </div>
                <div className="text-slate-500">{c.legalName}</div>
                <div className="mt-3 pt-2 border-t border-slate-100 font-mono text-[11px] space-y-1 text-slate-600">
                  <div>Commercial Reg: <strong>{c.crNumber}</strong></div>
                  <div>Tax ID: <strong>{c.vatNumber}</strong></div>
                  <div>Base Currency: <strong>{c.baseCurrency}</strong></div>
                  <div>Inter-Company Sync: <strong className="text-emerald-700">Enabled</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. MULTI-CURRENCY TAB */}
      {activeTab === 'currencies' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Active Foreign Currencies & Exchange Rates
              </h2>
              <p className="text-slate-500">
                Monetary amounts are tracked in transaction currency and converted to base currency for financial reporting.
              </p>
            </div>
            <button
              onClick={() => alert('Fetching latest daily exchange rates...')}
              className="px-3.5 py-1.5 bg-emerald-700 text-white rounded-lg font-bold"
            >
              Fetch Daily Rates
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Currency Code</th>
                  <th className="py-2.5 px-3">Currency Name</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3 text-right">Rate to SAR</th>
                  <th className="py-2.5 px-3">Effective Date</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockCurrencies.map(c => (
                  <tr key={c.currency} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">{c.currency}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{c.name}</td>
                    <td className="py-2.5 px-3 font-mono">{c.symbol}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      1 {c.currency} = {c.rateToBase.toFixed(4)} SAR
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{c.lastUpdated}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. APPROVAL THRESHOLDS TAB */}
      {activeTab === 'thresholds' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900">
              Approval Thresholds
            </h2>
            <p className="text-slate-500">
              Configured per company. Documents exceeding threshold require manager approval.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-slate-500 font-bold mb-1">Accounts Manager Approval Limit</div>
              <div className="text-2xl font-mono font-extrabold text-blue-900">
                50,000.00 SR
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Invoices and supplier bills above SAR 50,000 require manager approval before posting.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-slate-500 font-bold mb-1">Finance Director Approval Limit</div>
              <div className="text-2xl font-mono font-extrabold text-purple-900">
                200,000.00 SR
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                High-value documents above SAR 200,000 require director approval.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. DATA MIGRATION TAB */}
      {activeTab === 'migration' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900">
              Opening Balances
            </h2>
            <p className="text-slate-500">
              Opening balance migration and Trial Balance Reconciliation report.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
              <div>
                <div className="font-bold text-emerald-900 text-sm">Opening Balance Journal Reconciled</div>
                <div className="text-[11px] text-emerald-700">
                  Cut-off date: Dec 31, 2025. Trial Balance verified and confirmed.
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs">
                COMPLETED
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Period Close Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 text-xs">
            <div className="flex items-center gap-2.5 text-emerald-700 mb-2">
              <Calendar size={20} />
              <h3 className="font-black text-sm text-slate-900">
                Update Accounting Period
              </h3>
            </div>
            <p className="text-slate-500 mb-4">
              Advance the accounting cut-off date after confirming that all entries for the period are complete.
            </p>

            {/* Checklist */}
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Period Verification Checklist
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={chkEntriesPosted}
                  onChange={e => setChkEntriesPosted(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Customer invoices and supplier bills posted</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={chkUnreconciled}
                  onChange={e => setChkUnreconciled(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Bank transactions and receipts reviewed</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={chkTbBalanced}
                  onChange={e => setChkTbBalanced(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Trial Balance balanced</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={chkRetainedEarnings}
                  onChange={e => setChkRetainedEarnings(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Retained earnings and period net profit confirmed</span>
              </label>
            </div>

            {/* Date Picker */}
            <div className="mb-5">
              <label className="block text-slate-700 font-bold mb-1">New Accounting Closing Date</label>
              <input
                type="date"
                value={newClosingDate}
                onChange={e => setNewClosingDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 font-medium"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowWizard(false)}
                className="px-3.5 py-2 border border-slate-200 text-slate-600 rounded-lg font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteClosePeriod}
                disabled={!allChecklistPassed}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition"
              >
                Confirm Closing Date
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
