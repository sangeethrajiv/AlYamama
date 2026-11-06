import { useState } from 'react'
import {
  Settings,
  Lock,
  Building2,
  Coins,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Database,
  ArrowRight,
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
  const [activeTab, setActiveTab] = useState<'lock' | 'companies' | 'currencies' | 'thresholds' | 'migration'>('lock')

  // Close period wizard state (§15.1 FY-011)
  const [showWizard, setShowWizard] = useState(false)
  const [chkEntriesPosted, setChkEntriesPosted] = useState(true)
  const [chkUnreconciled, setChkUnreconciled] = useState(true)
  const [chkTbBalanced, setChkTbBalanced] = useState(true)
  const [chkRetainedEarnings, setChkRetainedEarnings] = useState(true)

  const [newHardLockDate, setNewHardLockDate] = useState('2026-10-31')
  const [newSoftLockDate, setNewSoftLockDate] = useState('2026-11-30')

  // Permission check based on §15.4 Lock-Date Permission Matrix:
  // Accountant: ❌
  // Accounts Manager: ✅
  // Finance Director: ✅
  // Sys Admin: ✅
  const canAdvanceLock =
    currentRole === 'Finance Director' ||
    currentRole === 'Accounts Manager'

  const allChecklistPassed =
    chkEntriesPosted && chkUnreconciled && chkTbBalanced && chkRetainedEarnings

  const handleExecuteClosePeriod = () => {
    if (!canAdvanceLock) {
      alert('Access Denied: Only Accounts Manager or Finance Director can advance the lock date (§15.4).')
      return
    }
    if (!allChecklistPassed) {
      alert('All items in the period-close checklist must be verified before locking.')
      return
    }
    onAdvanceLockDate(newHardLockDate, newSoftLockDate)
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
            Manage fiscal lock dates, 5-company inter-company pairs, foreign currencies, and approval thresholds.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('lock')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'lock' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Fiscal Year & Lock Period
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'companies' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Multi-Company Setup
        </button>
        <button
          onClick={() => setActiveTab('currencies')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'currencies' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Multi-Currency & Rates
        </button>
        <button
          onClick={() => setActiveTab('thresholds')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'thresholds' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Approval Thresholds
        </button>
        <button
          onClick={() => setActiveTab('migration')}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
            activeTab === 'migration' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Data Migration & Opening Balances
        </button>
      </div>

      {/* 1. FISCAL YEAR & LOCK PERIOD TAB */}
      {activeTab === 'lock' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Fiscal Periods & Accounting Lock Dates
                </h2>
                <p className="text-slate-500">
                  Current Entity: <strong className="text-slate-800">{activeCompany.name}</strong>
                </p>
              </div>

              <button
                onClick={() => setShowWizard(true)}
                disabled={!canAdvanceLock}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-sm transition"
              >
                <Lock size={15} />
                <span>Advance Lock Date (Close Period Wizard)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hard Lock Card */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50">
                <div className="flex items-center gap-2 text-rose-800 font-bold mb-1">
                  <Lock size={16} />
                  <span>Hard Lock Date (Period Lock)</span>
                </div>
                <div className="text-2xl font-black font-mono text-rose-900 my-2">
                  {fiscalConfig.periodLockDate}
                </div>
                <p className="text-[11px] text-rose-700">
                  Blocks <strong>ALL</strong> users (including Accountants and Accounts Managers) from posting, modifying, or reversing any journal entry on or before this date. Only Finance Director has emergency override capability with audit log tracking.
                </p>
              </div>

              {/* Soft Lock Card */}
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                <div className="flex items-center gap-2 text-amber-800 font-bold mb-1">
                  <ShieldCheck size={16} />
                  <span>Soft Lock Date (Review Period)</span>
                </div>
                <div className="text-2xl font-black font-mono text-amber-900 my-2">
                  {fiscalConfig.fiscalYearLockDate}
                </div>
                <p className="text-[11px] text-amber-700">
                  Blocks draft invoice creation for past periods. Allows Senior Accountants and Accounts Managers to review and make period adjustments before hard lock.
                </p>
              </div>
            </div>

            {/* Lock Date Permission Matrix Table */}
            <div>
              <h3 className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                Lock-Date Permission Matrix
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Accounting Action</th>
                      <th className="py-2.5 px-3 text-center">Accountant</th>
                      <th className="py-2.5 px-3 text-center">Accounts Mgr</th>
                      <th className="py-2.5 px-3 text-center">Finance Dir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3">Set / advance hard lock date</td>
                      <td className="py-2 px-3 text-center text-rose-600 font-bold">❌</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">Post entry in open period</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">Post entry after soft lock (tax override)</td>
                      <td className="py-2 px-3 text-center text-rose-600 font-bold">❌</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">Post entry after hard lock (emergency)</td>
                      <td className="py-2 px-3 text-center text-rose-600 font-bold">❌</td>
                      <td className="py-2 px-3 text-center text-rose-600 font-bold">❌</td>
                      <td className="py-2 px-3 text-center text-emerald-600 font-bold">✅ (Audited)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MULTI-COMPANY SETUP TAB (§10) */}
      {activeTab === 'companies' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Multi-Company Scope (5 Companies Configured)
              </h2>
              <p className="text-slate-500">
                Isolated accounting books per entity with automatic inter-company lifecycle (§23).
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
                  <div>ZATCA VAT ID: <strong>{c.vatNumber}</strong></div>
                  <div>Base Currency: <strong>{c.baseCurrency}</strong> (Saudi Riyal)</div>
                  <div>Inter-Company Sync: <strong className="text-emerald-700">Enabled (Auto-Vendor Bill)</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. MULTI-CURRENCY TAB (§11) */}
      {activeTab === 'currencies' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Active Foreign Currencies & Exchange Rates
              </h2>
              <p className="text-slate-500">
                Maintained in `res.currency.rate`. Monetary amounts stored in both transaction and base currency.
              </p>
            </div>
            <button
              onClick={() => alert('Fetching latest daily rates from SAMA FX Gateway...')}
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
                  <th className="py-2.5 px-3 text-right">Rate to SAR (Base)</th>
                  <th className="py-2.5 px-3">Last Effective Date</th>
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

      {/* 4. APPROVAL THRESHOLDS TAB (§19) */}
      {activeTab === 'thresholds' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900">
              Approval Thresholds & Segregation of Duties (§19)
            </h2>
            <p className="text-slate-500">
              Configured per company. Documents above threshold require managerial approval.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-slate-500 font-bold mb-1">Level 1 Threshold (Accounts Manager)</div>
              <div className="text-2xl font-mono font-extrabold text-blue-900">
                50,000.00 SR
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Invoices, Vendor Bills, and manual JEs at or above SAR 50,000 require Accounts Manager approval before posting.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-slate-500 font-bold mb-1">Level 2 Threshold (Finance Director)</div>
              <div className="text-2xl font-mono font-extrabold text-purple-900">
                200,000.00 SR
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                High-value documents at or above SAR 200,000 require final Finance Director approval. Creator cannot approve own document (SoD).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. DATA MIGRATION TAB (§20) */}
      {activeTab === 'migration' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-extrabold text-slate-900">
              Data Migration & Opening Balances (§20)
            </h2>
            <p className="text-slate-500">
              Cut-off balance migration, open invoices import, and Trial Balance Reconciliation report.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
              <div>
                <div className="font-bold text-emerald-900 text-sm">Opening Balance Journal Reconciled</div>
                <div className="text-[11px] text-emerald-700">
                  Cut-off date: Dec 31, 2025. Trial Balance Debits = Credits confirmed by Finance Director sign-off (MIG-008).
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs">
                SIGNED OFF
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Close Period Wizard Modal */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 text-xs">
            <div className="flex items-center gap-2.5 text-amber-600 mb-2">
              <Lock size={20} />
              <h3 className="font-black text-sm text-slate-900">
                Period-Close Wizard & Checklist
              </h3>
            </div>
            <p className="text-slate-500 mb-4">
              Closing a period is irreversible; the lock date can only move forward, never backward.
            </p>

            {/* Checklist */}
            <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Mandatory Period-Close Checklist
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={chkEntriesPosted}
                  onChange={e => setChkEntriesPosted(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>All required customer invoices and supplier bills posted</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={chkUnreconciled}
                  onChange={e => setChkUnreconciled(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Unreconciled bank statement items reviewed</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={chkTbBalanced}
                  onChange={e => setChkTbBalanced(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Trial Balance checked (Total Debits = Total Credits)</span>
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

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">New Hard Lock Date</label>
                <input
                  type="date"
                  value={newHardLockDate}
                  onChange={e => setNewHardLockDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">New Soft Lock Date</label>
                <input
                  type="date"
                  value={newSoftLockDate}
                  onChange={e => setNewSoftLockDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5"
                />
              </div>
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
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition"
              >
                Confirm & Lock Period
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

