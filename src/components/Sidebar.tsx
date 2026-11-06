import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard,
  FileText,
  Receipt,
  CreditCard,
  Scale,
  BookOpen,
  Landmark,
  BarChart3,
  History,
  Settings,
  Plus,
  ChevronDown,
  ArrowRightLeft,
  FileCheck2,
  Lock,
} from 'lucide-react'
import type { TabId, DrawerType } from '../types/accounting'

interface SidebarProps {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
  onOpenDrawer: (drawer: DrawerType) => void
  invoicesCount: number
  billsCount: number
  unreconciledCount: number
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  onOpenDrawer,
  invoicesCount,
  billsCount,
  unreconciledCount,
}: SidebarProps) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setCreateMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col h-screen sticky top-0 z-40 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-emerald-900/40">
          AY
        </div>
        <div>
          <div className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
            Al-Yamama
          </div>
          <div className="text-[11px] text-slate-400">Workshop Accounting</div>
        </div>
      </div>

      {/* Global "+ New" Action Button */}
      <div className="p-3.5 relative" ref={menuRef}>
        <button
          onClick={() => setCreateMenuOpen(!createMenuOpen)}
          className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-emerald-600/30 transition-all cursor-pointer"
        >
          <Plus size={19} className="stroke-[3]" />
          <span>New Transaction</span>
          <ChevronDown size={15} className={`transition-transform duration-200 ${createMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Mega Popover Menu */}
        {createMenuOpen && (
          <div className="absolute left-3.5 right-3.5 top-16 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Customers Column */}
              <div>
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1.5 px-1">
                  Customers
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => { onOpenDrawer('invoice'); setCreateMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-700 font-medium flex items-center gap-1.5 transition"
                  >
                    <FileText size={13} className="text-emerald-600" />
                    <span>Customer Invoice</span>
                  </button>
                  <button
                    onClick={() => { onOpenDrawer('payment'); setCreateMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-emerald-50 hover:text-emerald-700 font-medium flex items-center gap-1.5 transition"
                  >
                    <CreditCard size={13} className="text-emerald-600" />
                    <span>Receive Payment</span>
                  </button>
                  <button
                    onClick={() => { onOpenDrawer('invoice'); setCreateMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 font-medium flex items-center gap-1.5 transition"
                  >
                    <ArrowRightLeft size={13} className="text-slate-500" />
                    <span>Credit Note</span>
                  </button>
                </div>
              </div>

              {/* Vendors Column */}
              <div>
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1.5 px-1">
                  Vendors
                </div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => { onOpenDrawer('bill'); setCreateMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-amber-50 hover:text-amber-800 font-medium flex items-center gap-1.5 transition"
                  >
                    <Receipt size={13} className="text-amber-600" />
                    <span>Vendor Bill</span>
                  </button>
                  <button
                    onClick={() => { onOpenDrawer('payment'); setCreateMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-amber-50 hover:text-amber-800 font-medium flex items-center gap-1.5 transition"
                  >
                    <CreditCard size={13} className="text-amber-600" />
                    <span>Pay Vendor Bill</span>
                  </button>
                  <button
                    onClick={() => { onOpenDrawer('cheque'); setCreateMenuOpen(false); }}
                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 font-medium flex items-center gap-1.5 transition"
                  >
                    <Landmark size={13} className="text-slate-500" />
                    <span>Issue Cheque</span>
                  </button>
                </div>
              </div>

              {/* Accounting & Other Full Width */}
              <div className="col-span-2 pt-2 border-t border-slate-100">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-1 px-1">
                  General Accounting
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => { onOpenDrawer('journal'); setCreateMenuOpen(false); }}
                    className="text-left px-2 py-1.5 rounded-md hover:bg-blue-50 hover:text-blue-700 font-medium flex items-center gap-1.5 transition"
                  >
                    <Scale size={13} className="text-blue-600" />
                    <span>Journal Entry</span>
                  </button>
                  <button
                    onClick={() => { onSelectTab('reconcile'); setCreateMenuOpen(false); }}
                    className="text-left px-2 py-1.5 rounded-md hover:bg-blue-50 hover:text-blue-700 font-medium flex items-center gap-1.5 transition"
                  >
                    <FileCheck2 size={13} className="text-blue-600" />
                    <span>Reconciliation</span>
                  </button>
                  <button
                    onClick={() => { onOpenDrawer('bank_tx'); setCreateMenuOpen(false); }}
                    className="text-left px-2 py-1.5 rounded-md hover:bg-purple-50 hover:text-purple-700 font-medium flex items-center gap-1.5 transition"
                  >
                    <Landmark size={13} className="text-purple-600" />
                    <span>Direct Bank Tx</span>
                  </button>
                  <button
                    onClick={() => { onOpenDrawer('lock_wizard'); setCreateMenuOpen(false); }}
                    className="text-left px-2 py-1.5 rounded-md hover:bg-amber-50 hover:text-amber-800 font-medium flex items-center gap-1.5 transition"
                  >
                    <Lock size={13} className="text-amber-600" />
                    <span>Close Period</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1 text-xs">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'dashboard' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <LayoutDashboard size={17} />
          <span>Dashboard</span>
        </button>

        <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Bookkeeping Workflows
        </div>

        <button
          onClick={() => onSelectTab('invoices')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'invoices' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <div className="flex items-center gap-3">
            <FileText size={17} />
            <span>Invoices (Customers)</span>
          </div>
          {invoicesCount > 0 && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-mono">
              {invoicesCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('bills')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'bills' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <div className="flex items-center gap-3">
            <Receipt size={17} />
            <span>Expenses (Vendor Bills)</span>
          </div>
          {billsCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-mono">
              {billsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onSelectTab('payments')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'payments' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <CreditCard size={17} />
          <span>Payments & Receipts</span>
        </button>

        <button
          onClick={() => onSelectTab('reconcile')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'reconcile' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <div className="flex items-center gap-3">
            <FileCheck2 size={17} />
            <span>Reconciliation Wizard</span>
          </div>
          {unreconciledCount > 0 && (
            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-mono">
              {unreconciledCount}
            </span>
          )}
        </button>

        <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          General Ledger & Banking
        </div>

        <button
          onClick={() => onSelectTab('journals')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'journals' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <Scale size={17} />
          <span>Journal Entries (GL)</span>
        </button>

        <button
          onClick={() => onSelectTab('coa')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'coa' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <BookOpen size={17} />
          <span>Chart of Accounts</span>
        </button>

        <button
          onClick={() => onSelectTab('banking')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'banking' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <Landmark size={17} />
          <span>Banking & Cheques</span>
        </button>

        <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Governance & Reporting
        </div>

        <button
          onClick={() => onSelectTab('reports')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'reports' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <BarChart3 size={17} />
          <span>Financial Reports</span>
        </button>

        <button
          onClick={() => onSelectTab('audit')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'audit' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <History size={17} />
          <span>Audit Log & Chatter</span>
        </button>

        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'settings' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <Settings size={17} />
          <span>Settings & Period Lock</span>
        </button>
      </nav>

      {/* Footer System Badge */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-300">Al-Yamama Accounting</div>
          <div className="text-[10px] text-slate-500">Enterprise Edition</div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online"></span>
      </div>
    </aside>
  )
}
