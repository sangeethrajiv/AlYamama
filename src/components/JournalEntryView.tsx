import { useState } from 'react'
import {
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertCircle,
  FileText,
  Search,
  X,
  Layers,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Filter,
  List,
  Grid,
  BarChart3,
  Calendar,
  Building2,
  Tag,
  Hash,
  ExternalLink,
} from 'lucide-react'
import type { JournalEntry, JournalLine, CompanyId, UserRole, AnalyticItem } from '../types/accounting'
import { mockChartOfAccounts, mockAnalyticAccounts, mockAnalyticItems, moneyFormat, mockCompanies } from '../data/mockAccountingData'

interface JournalEntryViewProps {
  entries: JournalEntry[]
  companyId: CompanyId
  onSaveEntry: (entry: JournalEntry) => void
  onReverseEntry: (entryId: string) => void
  currentRole: UserRole
  searchQuery: string
}

type SubTab = 'entries' | 'items' | 'analytics'

export default function JournalEntryView({
  entries,
  companyId,
  onSaveEntry,
  onReverseEntry,
  currentRole,
  searchQuery,
}: JournalEntryViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('entries')

  // Selected for inspection modal
  const [modalOpen, setModalOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null)
  const [selectedJournalItem, setSelectedJournalItem] = useState<{ line: JournalLine; entry: JournalEntry } | null>(null)
  const [selectedAnalyticItem, setSelectedAnalyticItem] = useState<AnalyticItem | null>(null)

  // Current company
  const currentCompany = mockCompanies.find(c => c.id === companyId) || mockCompanies[0]

  // Form State for New/Edit Journal Entry
  const [entryDate, setEntryDate] = useState('2026-11-09')
  const [reference, setReference] = useState('Flame/OUT/00382')
  const [journalName, setJournalName] = useState('Stock Journal (SAR)')
  const [activeFormTab, setActiveFormTab] = useState<'items' | 'other'>('items')
  const [internalNote, setInternalNote] = useState('')
  const [reconciledCount, setReconciledCount] = useState(0)

  // Lines for current form
  const [lines, setLines] = useState<JournalLine[]>([
    {
      id: 'line_1',
      accountId: 'acc_180031',
      accountCode: '180031',
      accountName: 'Stock Interim Account(Delivered)',
      partner: 'A1 Fence Arabia',
      label: 'SOS Button',
      analyticAccountId: 'ana_sinoma',
      analyticAccountName: 'SINOMA / ZBC-2408-X-AZ-05 / 2024',
      amountCurrency: 0,
      currency: 'SAR',
      debit: 2.00,
      credit: 0,
      taxesApplied: '',
      quantity: -2.0,
      dueDate: '2026-09-25',
    },
    {
      id: 'line_2',
      accountId: 'acc_180041',
      accountCode: '180041',
      accountName: 'Stock Valuation Account',
      partner: 'A1 Fence Arabia',
      label: 'SOS Button',
      analyticAccountId: '',
      analyticAccountName: '',
      amountCurrency: 0,
      currency: 'SAR',
      debit: 0,
      credit: 2.00,
      taxesApplied: '',
      quantity: 2.0,
      dueDate: '2026-09-25',
    },
  ])

  // Analytic items state
  const [analyticItemsList, setAnalyticItemsList] = useState<AnalyticItem[]>(mockAnalyticItems)

  const totalDebit = lines.reduce((a, l) => a + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((a, l) => a + (Number(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0

  const addLine = () => {
    const newLine: JournalLine = {
      id: `line_${Date.now()}`,
      accountId: mockChartOfAccounts[0]?.id || '',
      accountCode: mockChartOfAccounts[0]?.code || '',
      accountName: mockChartOfAccounts[0]?.name || '',
      partner: '',
      label: '',
      analyticAccountId: '',
      analyticAccountName: '',
      amountCurrency: 0,
      currency: 'SAR',
      debit: 0,
      credit: 0,
      taxesApplied: '',
      quantity: 1,
      dueDate: entryDate,
    }
    setLines([...lines, newLine])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 1) return
    setLines(lines.filter(l => l.id !== id))
  }

  const updateLine = (id: string, field: keyof JournalLine, value: any) => {
    setLines(
      lines.map(l => {
        if (l.id !== id) return l
        if (field === 'accountId') {
          const acc = mockChartOfAccounts.find(a => a.id === value)
          return {
            ...l,
            accountId: value,
            accountCode: acc?.code || '',
            accountName: acc?.name || '',
          }
        }
        if (field === 'analyticAccountId') {
          const ana = mockAnalyticAccounts.find(a => a.id === value)
          return {
            ...l,
            analyticAccountId: value,
            analyticAccountName: ana ? ana.name : '',
          }
        }
        return { ...l, [field]: value }
      })
    )
  }

  const handleOpenNew = () => {
    setViewEntry(null)
    setEntryDate(new Date().toISOString().slice(0, 10))
    setReference('')
    setJournalName('Miscellaneous Operations (SAR)')
    setInternalNote('')
    setReconciledCount(0)
    setLines([
      {
        id: `line_${Date.now()}_1`,
        accountId: 'acc_180031',
        accountCode: '180031',
        accountName: 'Stock Interim Account(Delivered)',
        partner: '',
        label: '',
        analyticAccountId: '',
        analyticAccountName: '',
        amountCurrency: 0,
        currency: 'SAR',
        debit: 0,
        credit: 0,
        taxesApplied: '',
      },
      {
        id: `line_${Date.now()}_2`,
        accountId: 'acc_180041',
        accountCode: '180041',
        accountName: 'Stock Valuation Account',
        partner: '',
        label: '',
        analyticAccountId: '',
        analyticAccountName: '',
        amountCurrency: 0,
        currency: 'SAR',
        debit: 0,
        credit: 0,
        taxesApplied: '',
      },
    ])
    setModalOpen(true)
  }

  const handleOpenExisting = (entry: JournalEntry) => {
    setViewEntry(entry)
    setEntryDate(entry.entryDate)
    setReference(entry.reference || '')
    setJournalName(entry.journalName || 'Miscellaneous Operations (SAR)')
    setInternalNote(entry.internalNote || entry.narration || '')
    setReconciledCount(entry.reconciledEntriesCount || 0)
    setLines(entry.lines.length > 0 ? entry.lines : [])
    setModalOpen(true)
  }

  const handleSave = (postDirectly = false) => {
    if (!isBalanced) {
      alert('Total Debit must equal Total Credit before saving or posting.')
      return
    }

    const newJe: JournalEntry = {
      id: viewEntry ? viewEntry.id : `je_${Date.now()}`,
      entryNumber: viewEntry ? viewEntry.entryNumber : `STJ/${new Date().getFullYear()}/${String(entries.length + 1).padStart(4, '0')}`,
      companyId,
      entryDate,
      journalId: 'j_stock',
      journalName,
      reference,
      lines,
      state: postDirectly ? 'posted' : (viewEntry ? viewEntry.state : 'draft'),
      internalNote,
      reconciledEntriesCount: reconciledCount,
    }

    onSaveEntry(newJe)
    setModalOpen(false)
  }

  // Filter entries
  const filteredEntries = entries.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchNum = e.entryNumber.toLowerCase().includes(q)
      const matchRef = (e.reference || '').toLowerCase().includes(q)
      const matchJour = e.journalName.toLowerCase().includes(q)
      const matchLines = e.lines.some(l => 
        l.accountName.toLowerCase().includes(q) || 
        l.accountCode.includes(q) || 
        (l.label || '').toLowerCase().includes(q) ||
        (l.partner || '').toLowerCase().includes(q)
      )
      return matchNum || matchRef || matchJour || matchLines
    }
    return true
  })

  // Flatten all journal lines for Journal Items view (matches Screenshot 2)
  const allJournalItems = entries.flatMap(entry => 
    entry.lines.map(line => ({
      line,
      entry,
    }))
  ).filter(item => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      item.line.label.toLowerCase().includes(q) ||
      (item.line.partner || '').toLowerCase().includes(q) ||
      item.line.accountName.toLowerCase().includes(q) ||
      item.line.accountCode.includes(q) ||
      (item.entry.reference || '').toLowerCase().includes(q) ||
      item.entry.entryNumber.toLowerCase().includes(q)
    )
  })

  // Filter Analytic Items (matches Screenshot 4)
  const filteredAnalyticItems = analyticItemsList.filter(item => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      item.description.toLowerCase().includes(q) ||
      item.reference.toLowerCase().includes(q) ||
      item.analyticAccountName.toLowerCase().includes(q) ||
      (item.partner || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Journal & Analytic Operations</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300">
              {currentCompany.name}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review double-entry ledgers, inspect atomic journal lines, and track analytical cost center allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'entries' && (
            <button
              onClick={handleOpenNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium text-sm transition shadow-sm"
            >
              <Plus size={16} />
              <span>Create Journal Entry</span>
            </button>
          )}
          {activeSubTab === 'analytics' && (
            <button
              onClick={() => {
                const newItem: AnalyticItem = {
                  id: `ai_${Date.now()}`,
                  date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
                  reference: `REF-${Math.floor(1000 + Math.random() * 9000)}`,
                  description: 'General Workshop Consumables',
                  analyticAccountId: 'ana_dammam',
                  analyticAccountName: 'New Workshop Construction Dammam 32446',
                  companyName: currentCompany.legalName,
                  quantity: 1,
                  amount: -150.00,
                  financialAccount: '170026 Work in Progress',
                  journalItem: 'MANUAL/2026/001',
                }
                setAnalyticItemsList([newItem, ...analyticItemsList])
                setSelectedAnalyticItem(newItem)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-medium text-sm transition shadow-sm"
            >
              <Plus size={16} />
              <span>Create Analytic Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('entries')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${
            activeSubTab === 'entries'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale size={16} />
          <span>Journal Entries</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
            {filteredEntries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('items')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${
            activeSubTab === 'items'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <List size={16} />
          <span>Journal Items</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
            {allJournalItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 transition flex items-center gap-2 ${
            activeSubTab === 'analytics'
              ? 'border-teal-700 text-teal-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag size={16} />
          <span>Analytic Items</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
            {filteredAnalyticItems.length}
          </span>
        </button>
      </div>

      {/* VIEW 1: JOURNAL ENTRIES LIST */}
      {activeSubTab === 'entries' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Number</th>
                  <th className="py-3 px-4">Journal</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Partner</th>
                  <th className="py-3 px-4 text-right">Total Debit</th>
                  <th className="py-3 px-4 text-right">Total Credit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map(entry => {
                  const entryDebit = entry.lines.reduce((s, l) => s + (l.debit || 0), 0)
                  const entryCredit = entry.lines.reduce((s, l) => s + (l.credit || 0), 0)
                  const partner = entry.lines.find(l => l.partner)?.partner || '-'

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => handleOpenExisting(entry)}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">{entry.entryDate}</td>
                      <td className="py-3.5 px-4 font-bold text-teal-800 whitespace-nowrap">{entry.entryNumber}</td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{entry.journalName}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500">{entry.reference || '-'}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{partner}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                        {moneyFormat(entryDebit)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900">
                        {moneyFormat(entryCredit)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {entry.state === 'posted' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 size={12} />
                            <span>Posted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <span>Draft</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenExisting(entry)}
                          className="px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 rounded border border-teal-200 transition"
                        >
                          View Form
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: JOURNAL ITEMS LIST (Matches Screenshot 2) */}
      {activeSubTab === 'items' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">Journal Items Ledger</span>
              <span className="text-slate-400">|</span>
              <span>Showing {allJournalItems.length} lines</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 shadow-xs">
                <Filter size={12} className="text-slate-400" /> Filters
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 shadow-xs">
                Group By
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/75 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input type="checkbox" className="rounded border-slate-300 text-teal-700" />
                  </th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Journal Entry</th>
                  <th className="py-2.5 px-3">Journal</th>
                  <th className="py-2.5 px-3">Label</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Partner</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Analytic Account</th>
                  <th className="py-2.5 px-3">Matching Number</th>
                  <th className="py-2.5 px-3 text-right">Debit</th>
                  <th className="py-2.5 px-3 text-right">Credit</th>
                  <th className="py-2.5 px-3 text-right">Amount Currency</th>
                  <th className="py-2.5 px-3">Due date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allJournalItems.map((item, idx) => (
                  <tr
                    key={`${item.entry.id}_${item.line.id}_${idx}`}
                    onClick={() => setSelectedJournalItem(item)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-slate-300 text-teal-700" />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{item.entry.entryDate}</td>
                    <td className="py-2.5 px-3 font-semibold text-teal-800 whitespace-nowrap">{item.entry.entryNumber}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">{item.entry.journalName}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[200px] truncate">{item.line.label || '-'}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">{item.entry.reference || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{item.line.partner || '-'}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{item.line.accountCode}</span> {item.line.accountName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate">{item.line.analyticAccountName || '-'}</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{item.line.matchingNumber || ''}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {item.line.debit > 0 ? `${item.line.debit.toFixed(2)} SR` : '0.00 SR'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {item.line.credit > 0 ? `${item.line.credit.toFixed(2)} SR` : '0.00 SR'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                      {(item.line.amountCurrency || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{item.line.dueDate || item.entry.entryDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: ANALYTIC ITEMS LIST (Matches Screenshot 4) */}
      {activeSubTab === 'analytics' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">Analytic Cost Entries</span>
              <span className="text-slate-400">|</span>
              <span>Showing {filteredAnalyticItems.length} lines</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 shadow-xs">
                <Filter size={12} className="text-slate-400" /> Filters
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-200 shadow-xs">
                Group By
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100/75 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-8">
                    <input type="checkbox" className="rounded border-slate-300 text-teal-700" />
                  </th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Ref.</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Analytic Account</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAnalyticItems.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedAnalyticItem(item)}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="py-2.5 px-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-slate-300 text-teal-700" />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">{item.date}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-700 whitespace-nowrap">{item.reference}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{item.description}</td>
                    <td className="py-2.5 px-3 text-teal-800 font-medium">{item.analyticAccountName}</td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{item.companyName}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">{item.quantity.toFixed(2)}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                      item.amount < 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      {item.amount.toFixed(2)} SR
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: JOURNAL ENTRY FORM (Matches Screenshot 1) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-100 rounded-xl shadow-2xl border border-slate-300 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Top Toolbar / Breadcrumbs */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 text-sm font-medium">Journal Entries /</span>
                <span className="text-slate-900 text-sm font-bold">
                  {viewEntry ? viewEntry.entryNumber : 'New'}
                </span>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Action Buttons Row */}
            <div className="bg-white px-6 py-2 border-b border-slate-200 flex items-center gap-2">
              <button
                onClick={() => handleSave(false)}
                className="px-4 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded shadow-xs transition"
              >
                Save
              </button>
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded shadow-xs transition"
              >
                Discard
              </button>
              <div className="h-4 w-px bg-slate-300 mx-1" />
              <button
                onClick={() => handleSave(true)}
                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-xs transition"
              >
                Post
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* White Sheet Document Card */}
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm relative">
                {/* Top-Right Reconciled Entries Stat Box */}
                <div className="absolute top-6 right-6">
                  <div className="border border-slate-300 rounded px-3 py-1.5 flex items-center gap-2 bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs">
                    <Layers size={16} className="text-slate-600" />
                    <div className="text-left">
                      <div className="leading-tight font-bold">{reconciledCount}</div>
                      <div className="text-[10px] text-slate-500 font-normal">Reconciled entries</div>
                    </div>
                  </div>
                </div>

                {/* Form Header Fields: Date, Reference, Journal, Company */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 max-w-2xl mt-2 mb-6">
                  {/* Left Column */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 items-center">
                      <label className="text-xs font-bold text-slate-700">Date</label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={e => setEntryDate(e.target.value)}
                        className="col-span-2 text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center">
                      <label className="text-xs font-bold text-slate-700">Reference</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="e.g. Flame/OUT/00382"
                        className="col-span-2 text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 items-center">
                      <label className="text-xs font-bold text-slate-700">Journal</label>
                      <select
                        value={journalName}
                        onChange={e => setJournalName(e.target.value)}
                        className="col-span-2 text-xs bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                      >
                        <option value="Miscellaneous Operations (SAR)">Miscellaneous Operations (SAR)</option>
                        <option value="Stock Journal (SAR)">Stock Journal (SAR)</option>
                        <option value="Cash Invoices (SAR)">Cash Invoices (SAR)</option>
                        <option value="Customer Invoices (SAR)">Customer Invoices (SAR)</option>
                        <option value="Vendor Bills (SAR)">Vendor Bills (SAR)</option>
                        <option value="Bank (SAR)">Bank (SAR)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-3 items-center">
                      <label className="text-xs font-bold text-slate-700">Company</label>
                      <div className="col-span-2 text-xs font-semibold text-slate-800 py-1.5">
                        {currentCompany.name}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notebook Tabs */}
                <div className="border-b border-slate-200 flex gap-4 text-xs font-bold mb-3">
                  <button
                    onClick={() => setActiveFormTab('items')}
                    className={`pb-2 border-b-2 transition ${
                      activeFormTab === 'items'
                        ? 'border-teal-700 text-teal-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Journal Items
                  </button>
                  <button
                    onClick={() => setActiveFormTab('other')}
                    className={`pb-2 border-b-2 transition ${
                      activeFormTab === 'other'
                        ? 'border-teal-700 text-teal-800'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Other Info
                  </button>
                </div>

                {/* Tab Content: Journal Items Table */}
                {activeFormTab === 'items' && (
                  <div className="space-y-3">
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-2.5">Account</th>
                            <th className="py-2 px-2.5">Partner</th>
                            <th className="py-2 px-2.5">Label</th>
                            <th className="py-2 px-2.5">Analytic Account</th>
                            <th className="py-2 px-2.5 text-right">Amount Currency</th>
                            <th className="py-2 px-2.5">Currency</th>
                            <th className="py-2 px-2.5 text-right">Debit</th>
                            <th className="py-2 px-2.5 text-right">Credit</th>
                            <th className="py-2 px-2.5">Taxes Applied</th>
                            <th className="py-2 px-1 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lines.map((line, idx) => (
                            <tr key={line.id} className="hover:bg-slate-50/70">
                              {/* Account */}
                              <td className="py-1.5 px-2.5 min-w-[180px]">
                                <select
                                  value={line.accountId}
                                  onChange={e => updateLine(line.id, 'accountId', e.target.value)}
                                  className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                                >
                                  {mockChartOfAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.code} {acc.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Partner */}
                              <td className="py-1.5 px-2.5 min-w-[130px]">
                                <input
                                  type="text"
                                  value={line.partner || ''}
                                  onChange={e => updateLine(line.id, 'partner', e.target.value)}
                                  placeholder="Partner..."
                                  className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                                />
                              </td>

                              {/* Label */}
                              <td className="py-1.5 px-2.5 min-w-[140px]">
                                <input
                                  type="text"
                                  value={line.label || ''}
                                  onChange={e => updateLine(line.id, 'label', e.target.value)}
                                  placeholder="Label description..."
                                  className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                                />
                              </td>

                              {/* Analytic Account */}
                              <td className="py-1.5 px-2.5 min-w-[160px]">
                                <select
                                  value={line.analyticAccountId || ''}
                                  onChange={e => updateLine(line.id, 'analyticAccountId', e.target.value)}
                                  className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                                >
                                  <option value="">(None)</option>
                                  {mockAnalyticAccounts.map(ana => (
                                    <option key={ana.id} value={ana.id}>
                                      {ana.name}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Amount Currency */}
                              <td className="py-1.5 px-2.5 min-w-[90px] text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.amountCurrency || 0}
                                  onChange={e => updateLine(line.id, 'amountCurrency', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono"
                                />
                              </td>

                              {/* Currency */}
                              <td className="py-1.5 px-2.5 min-w-[70px]">
                                <input
                                  type="text"
                                  value={line.currency || 'SAR'}
                                  onChange={e => updateLine(line.id, 'currency', e.target.value)}
                                  className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                                />
                              </td>

                              {/* Debit */}
                              <td className="py-1.5 px-2.5 min-w-[95px] text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.debit || 0}
                                  onChange={e => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono font-semibold"
                                />
                              </td>

                              {/* Credit */}
                              <td className="py-1.5 px-2.5 min-w-[95px] text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.credit || 0}
                                  onChange={e => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                                  className="w-full text-right text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700 font-mono font-semibold"
                                />
                              </td>

                              {/* Taxes Applied */}
                              <td className="py-1.5 px-2.5 min-w-[100px]">
                                <input
                                  type="text"
                                  value={line.taxesApplied || ''}
                                  onChange={e => updateLine(line.id, 'taxesApplied', e.target.value)}
                                  placeholder="e.g. VAT 15%"
                                  className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                                />
                              </td>

                              {/* Remove */}
                              <td className="py-1.5 px-1 text-center">
                                <button
                                  onClick={() => removeLine(line.id)}
                                  className="text-slate-400 hover:text-rose-600 transition p-1"
                                  title="Delete line"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Add a line link/button */}
                    <div className="pt-1">
                      <button
                        onClick={addLine}
                        className="text-teal-700 hover:text-teal-900 text-xs font-semibold hover:underline inline-flex items-center gap-1"
                      >
                        <Plus size={14} /> Add a line
                      </button>
                    </div>

                    {/* Dark Solid Summary Total Bar (Matches Screenshot 1) */}
                    <div className="bg-[#1f2937] text-white px-4 py-2.5 rounded flex items-center justify-between text-xs font-mono font-bold mt-3 shadow-inner">
                      <div className="text-slate-300 font-sans font-medium text-xs">
                        {isBalanced ? (
                          <span className="text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Balanced Journal Entry
                          </span>
                        ) : (
                          <span className="text-rose-400 flex items-center gap-1.5">
                            <AlertCircle size={14} /> Difference: {Math.abs(totalDebit - totalCredit).toFixed(2)} SAR
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-8 text-sm">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">Total Debit</span>
                          <span>{totalDebit.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-sans">Total Credit</span>
                          <span>{totalCredit.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeFormTab === 'other' && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded text-xs space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-slate-500 font-medium block">Fiscal Lock Date Check:</span>
                        <span className="font-semibold text-emerald-700">Open Period</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium block">Auto-Reverse Mode:</span>
                        <span className="text-slate-700">None</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add an internal note textarea (Matches Screenshot 1) */}
                <div className="mt-4">
                  <textarea
                    rows={2}
                    value={internalNote}
                    onChange={e => setInternalNote(e.target.value)}
                    placeholder="Add an internal note..."
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-700 text-slate-700 placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: JOURNAL ITEM DETAIL VIEW (Matches Screenshot 3) */}
      {selectedJournalItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Breadcrumb Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Journal Items /</span>
                <span className="text-slate-900 font-bold">
                  {selectedJournalItem.entry.entryNumber}
                  {selectedJournalItem.entry.reference ? `(${selectedJournalItem.entry.reference})` : ''}
                </span>
              </div>
              <button
                onClick={() => setSelectedJournalItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="bg-slate-50 px-6 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleOpenExisting(selectedJournalItem.entry)
                    setSelectedJournalItem(null)
                  }}
                  className="px-3.5 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded transition"
                >
                  Edit
                </button>
                <span className="text-xs text-slate-600 bg-white border border-slate-300 px-2.5 py-1 rounded">
                  Action
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <ChevronLeft size={16} className="cursor-pointer hover:text-slate-900" />
                <ChevronRight size={16} className="cursor-pointer hover:text-slate-900" />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Label:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">
                    {selectedJournalItem.line.label || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Partner:</span>
                  <div className="font-semibold text-slate-800 text-sm mt-0.5">
                    {selectedJournalItem.line.partner || '-'}
                  </div>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="border-b border-slate-200 flex gap-4 text-xs font-bold">
                <span className="pb-2 border-b-2 border-teal-700 text-teal-800">Information</span>
                <span className="pb-2 text-slate-400 cursor-pointer">Analytic Lines</span>
              </div>

              {/* Two Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Amount Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Amount</h4>
                    <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Account</span>
                        <span className="font-semibold text-teal-800">
                          {selectedJournalItem.line.accountCode} {selectedJournalItem.line.accountName}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Debit</span>
                        <span className="font-mono font-bold text-slate-900">
                          {selectedJournalItem.line.debit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Credit</span>
                        <span className="font-mono font-bold text-slate-900">
                          {selectedJournalItem.line.credit.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quantity</span>
                        <span className="font-mono text-slate-700">
                          {(selectedJournalItem.line.quantity || 1).toFixed(3)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dates Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Dates</h4>
                    <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Due date</span>
                        <span className="font-medium text-slate-800">
                          {selectedJournalItem.line.dueDate || selectedJournalItem.entry.entryDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* States Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">States</h4>
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <span className="text-slate-500">No Follow-up</span>
                      <input type="checkbox" className="rounded border-slate-300 text-teal-700" />
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Accounting Documents Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Accounting Documents</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Journal Entry</span>
                        <span className="font-bold text-teal-800 font-mono">
                          {selectedJournalItem.entry.entryNumber}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Journal</span>
                        <span className="text-slate-800">{selectedJournalItem.entry.journalName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Currency Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Currency</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Amount Currency</span>
                        <span className="font-mono text-slate-900">
                          {(selectedJournalItem.line.amountCurrency || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Analytic Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Analytic</h4>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Analytic Account</span>
                        <span className="font-semibold text-teal-800">
                          {selectedJournalItem.line.analyticAccountName || '(None)'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ANALYTIC ITEM DETAIL VIEW (Matches Screenshot 5) */}
      {selectedAnalyticItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Breadcrumb Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Analytic Items /</span>
                <span className="text-slate-900 font-bold">{selectedAnalyticItem.description}</span>
              </div>
              <button
                onClick={() => setSelectedAnalyticItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Actions Bar */}
            <div className="bg-slate-50 px-6 py-2 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedAnalyticItem(null)}
                  className="px-3.5 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded transition"
                >
                  Edit
                </button>
                <button
                  onClick={() => setSelectedAnalyticItem(null)}
                  className="px-3.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded transition"
                >
                  Create
                </button>
                <span className="text-xs text-slate-600 bg-white border border-slate-300 px-2.5 py-1 rounded">
                  Action
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <ChevronLeft size={16} className="cursor-pointer hover:text-slate-900" />
                <ChevronRight size={16} className="cursor-pointer hover:text-slate-900" />
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
                {/* Left Column: Analytic Entry */}
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-3">Analytic Entry</h4>
                  <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 font-medium block">Description</span>
                      <span className="font-bold text-slate-900 text-sm">{selectedAnalyticItem.description}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Analytic Account</span>
                      <span className="font-semibold text-teal-800">{selectedAnalyticItem.analyticAccountName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Tags</span>
                      <span className="text-slate-400">-</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Ref.</span>
                      <span className="font-mono text-slate-700">{selectedAnalyticItem.reference}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Partner</span>
                      <span className="text-slate-800 font-medium">{selectedAnalyticItem.partner || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Date</span>
                      <span className="text-slate-700">{selectedAnalyticItem.date}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block">Company</span>
                      <span className="text-slate-800 font-medium">{selectedAnalyticItem.companyName}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Amount & Accounting */}
                <div className="space-y-6">
                  {/* Amount Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Amount</h4>
                    <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Amount</span>
                        <span className={`font-mono font-bold ${
                          selectedAnalyticItem.amount < 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {selectedAnalyticItem.amount.toFixed(2)} SR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Quantity</span>
                        <span className="font-mono text-slate-800">{selectedAnalyticItem.quantity.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Product</span>
                        <span className="text-slate-400">-</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Unit of Measure</span>
                        <span className="text-slate-400">-</span>
                      </div>
                    </div>
                  </div>

                  {/* Accounting Section */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm mb-3">Accounting</h4>
                    <div className="space-y-2 bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Financial Account</span>
                        <span className="font-medium text-slate-800">
                          {selectedAnalyticItem.financialAccount || '170026 Work in Progress'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Journal Item</span>
                        <span className="font-mono text-teal-800">
                          {selectedAnalyticItem.journalItem || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
