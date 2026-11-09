import { useState } from 'react'
import {
  Search,
  Building2,
  ShieldCheck,
  Lock,
  Globe,
  Bell,
  ChevronDown,
  Coins,
  CheckCircle2,
} from 'lucide-react'
import type { CompanyId, UserRole } from '../types/accounting'
import { mockCompanies, mockFiscalConfig, mockCurrencies } from '../data/mockAccountingData'

interface HeaderProps {
  currentCompanyId: CompanyId
  onSelectCompany: (id: CompanyId) => void
  currentRole: UserRole
  onSelectRole: (role: UserRole) => void
  arabic: boolean
  onToggleLanguage: () => void
  onOpenQuickCreate: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
}

const rolesList: UserRole[] = [
  'Finance Director',
  'Accounts Manager',
  'Senior Accountant',
  'Accountant',
  'Auditor',
]

export default function Header({
  currentCompanyId,
  onSelectCompany,
  currentRole,
  onSelectRole,
  arabic,
  onToggleLanguage,
  searchQuery,
  onSearchChange,
}: HeaderProps) {
  const [showCompanyMenu, setShowCompanyMenu] = useState(false)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)

  const activeCompany = mockCompanies.find(c => c.id === currentCompanyId) || mockCompanies[0]
  const fiscalConfig = mockFiscalConfig[currentCompanyId] || mockFiscalConfig['co_1']

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Finance Director': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Accounts Manager': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'Senior Accountant': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'Accountant': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'Auditor': return 'bg-slate-100 text-slate-700 border-slate-300'
    }
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Quick search and Brand Identity */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search invoices, customers, bills, accounts, vouchers (Ctrl + K)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* Center / Right Controls: Multi-Company, Role, Profile */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* Multi-Company Switcher */}
          <div className="relative">
            <button
              onClick={() => { setShowCompanyMenu(!showCompanyMenu); setShowRoleMenu(false); }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition"
              title="Switch Active Company"
            >
              <Building2 size={15} className="text-emerald-600" />
              <span className="max-w-[150px] truncate font-semibold">{activeCompany.name}</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{activeCompany.code}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>

            {showCompanyMenu && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  Select Legal Entity
                </div>
                {mockCompanies.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onSelectCompany(c.id); setShowCompanyMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 transition ${c.id === currentCompanyId ? 'bg-emerald-50/70 text-emerald-900 font-bold' : 'text-slate-700'}`}
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-400">{c.city} • VAT: {c.vatNumber}</div>
                    </div>
                    {c.id === currentCompanyId && <CheckCircle2 size={15} className="text-emerald-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Role Switcher */}
          <div className="relative">
            <button
              onClick={() => { setShowRoleMenu(!showRoleMenu); setShowCompanyMenu(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${getRoleBadgeColor(currentRole)}`}
              title="Switch Active Role"
            >
              <ShieldCheck size={14} />
              <span>{currentRole}</span>
              <ChevronDown size={12} className="opacity-70" />
            </button>

            {showRoleMenu && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                  Switch Active Role
                </div>
                {rolesList.map(r => (
                  <button
                    key={r}
                    onClick={() => { onSelectRole(r); setShowRoleMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 ${r === currentRole ? 'font-bold text-emerald-700 bg-emerald-50/50' : 'text-slate-700'}`}
                  >
                    <span>{r}</span>
                    {r === currentRole && <CheckCircle2 size={14} className="text-emerald-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Multi-Currency Rate Quick Pill */}
          <button
            onClick={() => setShowCurrencyModal(true)}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono transition"
            title="Active Currencies & Exchange Rates"
          >
            <Coins size={12} className="text-emerald-600" />
            <span>1 USD = 3.75 SR</span>
          </button>

          {/* Language toggle */}
          <button
            onClick={onToggleLanguage}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Toggle Arabic / English"
          >
            <Globe size={14} />
            <span className="font-semibold">{arabic ? 'English' : 'عربي'}</span>
          </button>

          {/* Notifications */}
          <button className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg relative transition">
            <Bell size={16} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white"></span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-sm">
              SR
            </div>
            <div className="hidden md:block leading-tight text-left">
              <div className="text-xs font-bold text-slate-800">Sangeeth R.</div>
              <div className="text-[10px] text-slate-400">Finance & Accounts</div>
            </div>
          </div>
        </div>
      </div>

      {/* Currency Modal */}
      {showCurrencyModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Coins className="text-emerald-600" size={19} />
                <h3 className="font-bold text-sm text-slate-800">Active Currencies & Daily Rates</h3>
              </div>
              <button
                onClick={() => setShowCurrencyModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="py-3">
              <p className="text-xs text-slate-500 mb-3">
                All accounting reports default to company base currency SAR. Transactions in foreign currencies are converted at document date.
              </p>
              <div className="space-y-2">
                {mockCurrencies.map(c => (
                  <div key={c.currency} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{c.currency}</span> — {c.name}
                    </div>
                    <div className="font-mono font-semibold text-emerald-700">
                      1 {c.currency} = {c.rateToBase.toFixed(2)} SAR
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowCurrencyModal(false)}
                className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
