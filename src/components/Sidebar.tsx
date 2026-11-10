import { useState, useEffect } from 'react'
import { LayoutDashboard, FileText, Receipt, CreditCard, Scale, BookOpen, Landmark, BarChart3, History, Settings, ChevronDown, FileCheck2, Boxes, Users, Package, Warehouse, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Layers, Activity, SlidersHorizontal, Tags, Gauge } from 'lucide-react'
import type { TabId, DrawerType, InvoiceCategory } from '../types/accounting'

interface SidebarProps {
  activeTab: TabId
  onSelectTab: (tab: TabId) => void
  onOpenDrawer: (drawer: DrawerType, category?: InvoiceCategory) => void
  invoicesCount: number
  billsCount: number
  unreconciledCount: number
  activeInvoiceCategory?: InvoiceCategory | 'all'
  onSelectInvoiceCategory?: (cat: InvoiceCategory | 'all') => void
  cashCount?: number
  creditCount?: number
  proformaCount?: number
  progressiveCount?: number
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  onOpenDrawer,
  invoicesCount,
  billsCount,
  unreconciledCount,
  activeInvoiceCategory = 'all',
  onSelectInvoiceCategory,
  cashCount = 0,
  creditCount = 0,
  proformaCount = 0,
  progressiveCount = 0,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const [invoicesSubmenuOpen, setInvoicesSubmenuOpen] = useState(true)
  const moduleOf = (t: TabId): 'accounting' | 'inventory' | 'contacts' | 'dashboard' =>
    t === 'dashboard' ? 'dashboard' : t === 'contacts' ? 'contacts' : t === 'inventory' || t.startsWith('inv_') ? 'inventory' : 'accounting'
  const [openModule, setOpenModule] = useState<'accounting' | 'inventory' | null>(() => { const m = moduleOf(activeTab); return m === 'inventory' || m === 'accounting' ? m : null })
  useEffect(() => {
    const m = moduleOf(activeTab)
    if (m === 'accounting' || m === 'inventory') setOpenModule(m)
  }, [activeTab])
  const activeModule = moduleOf(activeTab)
  const modBtn = (id: 'accounting' | 'inventory', label: string, icon: JSX.Element) => (
    <button
      onClick={() => setOpenModule(openModule === id ? null : id)}
      aria-expanded={openModule === id}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-bold transition ${activeModule === id ? 'text-emerald-400' : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'}`}
    >
      <span className="flex items-center gap-3">{icon}<span>{label}</span></span>
      <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${openModule === id ? 'rotate-180' : ''}`} />
    </button>
  )
  const invItem = (tab: TabId, label: string, icon: JSX.Element) => (
    <button
      onClick={() => selectTab(tab)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-semibold transition ${activeTab === tab ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
    >{icon}<span>{label}</span></button>
  )

  const selectTab = (tab: TabId) => {
    onSelectTab(tab)
    onCloseMobile?.()
  }

  return (
    <>
    {mobileOpen && (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden" onClick={onCloseMobile} aria-hidden="true" />
    )}
    <aside className={`w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col h-screen fixed lg:sticky top-0 left-0 z-50 lg:z-40 border-r border-slate-800 select-none transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      {/* Brand Header */}
      <div className="p-4 flex items-center gap-3 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-emerald-900/40">
          AY
        </div>
        <div>
          <div className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
            Al-Yamama
          </div>
          <div className="text-[11px] text-slate-400">Workshop ERP</div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1 text-[13px]" aria-label="Main navigation">
        <button
          onClick={() => selectTab('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'dashboard' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <LayoutDashboard size={17} />
          <span>Dashboard</span>
        </button>

        {modBtn('accounting', 'Accounting', <BookOpen size={17} />)}
        {openModule === 'accounting' && (<div className="ml-3 pl-2 border-l border-slate-800 space-y-1">
        <div className="pt-1 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Bookkeeping Workflows
        </div>

        {/* Invoices Group with 4 Sub-Types */}
        <div>
          <button
            onClick={() => {
              selectTab('invoices')
              if (onSelectInvoiceCategory) onSelectInvoiceCategory('all')
              setInvoicesSubmenuOpen(!invoicesSubmenuOpen)
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold transition ${
              activeTab === 'invoices' && activeInvoiceCategory === 'all'
                ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText size={17} />
              <span>Invoices</span>
            </div>
            <div className="flex items-center gap-1.5">
              {invoicesCount > 0 && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full font-mono">
                  {invoicesCount}
                </span>
              )}
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 ${
                  invoicesSubmenuOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {invoicesSubmenuOpen && (
            <div className="pl-6 pr-1 py-1 space-y-0.5 animate-in fade-in slide-in-from-top-1">
              <button
                onClick={() => {
                  selectTab('invoices')
                  if (onSelectInvoiceCategory) onSelectInvoiceCategory('cash')
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
                  activeTab === 'invoices' && activeInvoiceCategory === 'cash'
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                                    <span>Cash Invoices</span>
                </div>
                {cashCount > 0 && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                    {cashCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  selectTab('invoices')
                  if (onSelectInvoiceCategory) onSelectInvoiceCategory('credit')
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
                  activeTab === 'invoices' && activeInvoiceCategory === 'credit'
                    ? 'bg-slate-500/20 text-slate-300 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                                    <span>Credit Invoices</span>
                </div>
                {creditCount > 0 && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                    {creditCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  selectTab('invoices')
                  if (onSelectInvoiceCategory) onSelectInvoiceCategory('proforma')
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
                  activeTab === 'invoices' && activeInvoiceCategory === 'proforma'
                    ? 'bg-slate-500/20 text-slate-300 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                                    <span>Proforma Invoices</span>
                </div>
                {proformaCount > 0 && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                    {proformaCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  selectTab('invoices')
                  if (onSelectInvoiceCategory) onSelectInvoiceCategory('progressive')
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition ${
                  activeTab === 'invoices' && activeInvoiceCategory === 'progressive'
                    ? 'bg-amber-500/20 text-amber-300 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                                    <span>Progressive Invoices</span>
                </div>
                {progressiveCount > 0 && (
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                    {progressiveCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => selectTab('bills')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'bills' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <div className="flex items-center gap-3">
            <Receipt size={17} />
            <span>Vendor Bills</span>
          </div>
          {billsCount > 0 && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-mono">
              {billsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => selectTab('payments')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'payments' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <CreditCard size={17} />
          <span>Payments & Receipts</span>
        </button>

        <button
          onClick={() => selectTab('reconcile')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'reconcile' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <div className="flex items-center gap-3">
            <FileCheck2 size={17} />
            <span>Reconciliation Wizard</span>
          </div>
          {unreconciledCount > 0 && (
            <span className="text-[10px] bg-slate-500/20 text-slate-300 px-1.5 py-0.5 rounded-full font-mono">
              {unreconciledCount}
            </span>
          )}
        </button>

        <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          General Ledger & Banking
        </div>

        <button
          onClick={() => selectTab('journals')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'journals' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <Scale size={17} />
          <span>Journal Entries</span>
        </button>

        <button
          onClick={() => selectTab('coa')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'coa' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <BookOpen size={17} />
          <span>Chart of Accounts</span>
        </button>

        <button
          onClick={() => selectTab('banking')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'banking' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <Landmark size={17} />
          <span>Banking & Cheques</span>
        </button>


        <div className="pt-3 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Governance & Reporting
        </div>

        <button
          onClick={() => selectTab('reports')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'reports' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <BarChart3 size={17} />
          <span>Financial Reports</span>
        </button>

        <button
          onClick={() => selectTab('audit')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'audit' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <History size={17} />
          <span>Audit Log & Chatter</span>
        </button>

        <button
          onClick={() => selectTab('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-semibold transition ${activeTab === 'settings' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <Settings size={17} />
          <span>Settings</span>
        </button>
        </div>)}

        <button
          onClick={() => selectTab('contacts')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold transition ${activeTab === 'contacts' ? 'bg-emerald-600/20 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'}`}
        >
          <Users size={17} />
          <span>Contacts</span>
        </button>

        {modBtn('inventory', 'Inventory', <Boxes size={17} />)}
        {openModule === 'inventory' && (<div className="ml-3 pl-2 border-l border-slate-800 space-y-0.5">
          {invItem('inv_overview', 'Overview', <Gauge size={15} />)}
          <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Catalogue</div>
          {invItem('inv_products', 'Products', <Package size={15} />)}
          {invItem('inv_categories', 'Categories', <Tags size={15} />)}
          <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Operations</div>
          {invItem('inv_receipts', 'Receipts', <ArrowDownToLine size={15} />)}
          {invItem('inv_deliveries', 'Deliveries', <ArrowUpFromLine size={15} />)}
          {invItem('inv_internal', 'Internal Transfers', <ArrowLeftRight size={15} />)}
          {invItem('inventory', 'Adjustments', <SlidersHorizontal size={15} />)}
          <div className="pt-2 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Stock</div>
          {invItem('inv_stock', 'Stock On Hand', <Layers size={15} />)}
          {invItem('inv_moves', 'Stock Movements', <Activity size={15} />)}
          {invItem('inv_reorder', 'Reordering Rules', <Boxes size={15} />)}
          {invItem('inv_warehouses', 'Warehouses & Locations', <Warehouse size={15} />)}
        </div>)}
      </nav>

      {/* Footer System Badge */}
      <div className="p-3 bg-slate-950/60 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
        <div>
          <div className="font-semibold text-slate-300">Al-Yamama ERP</div>
          <div className="text-[10px] text-slate-500">Enterprise Edition</div>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="System Online"></span>
      </div>
    </aside>
    </>
  )
}
