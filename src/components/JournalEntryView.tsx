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
} from 'lucide-react'
import type { JournalEntry, JournalLine, CompanyId, UserRole } from '../types/accounting'
import { mockChartOfAccounts, mockAnalyticAccounts, moneyFormat } from '../data/mockAccountingData'

interface JournalEntryViewProps {
  entries: JournalEntry[]
  companyId: CompanyId
  onSaveEntry: (entry: JournalEntry) => void
  onReverseEntry: (entryId: string) => void
  currentRole: UserRole
  searchQuery: string
}

export default function JournalEntryView({
  entries,
  companyId,
  onSaveEntry,
  onReverseEntry,
  currentRole,
  searchQuery,
}: JournalEntryViewProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [viewEntry, setViewEntry] = useState<JournalEntry | null>(null)

  // New JE Form State
  const [entryDate, setEntryDate] = useState('2026-11-06')
  const [journalName, setJournalName] = useState('Miscellaneous Operations')
  const [reference, setReference] = useState('')
  const [narration, setNarration] = useState('')

  const [lines, setLines] = useState<JournalLine[]>([
    {
      id: 'jel_new_1',
      accountId: 'acc_503',
      accountCode: '502000',
      accountName: 'Hydraulic Oil & Testing Consumables',
      label: 'Testing oil consumption for Dyno test bench',
      debit: 4500,
      credit: 0,
      analyticAccountId: 'ana_4',
    },
    {
      id: 'jel_new_2',
      accountId: 'acc_107',
      accountCode: '120000',
      accountName: 'Workshop Spares & Cylinder Stock',
      label: 'Inventory adjustment from main rack',
      debit: 0,
      credit: 4500,
    },
  ])

  const totalDebit = lines.reduce((a, l) => a + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((a, l) => a + (Number(l.credit) || 0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0

  // Validate mandatory analytic account for Income & Expense (BR-015)
  const incomeOrExpenseMissingAnalytic = lines.some(l => {
    const acc = mockChartOfAccounts.find(a => a.id === l.accountId)
    if (acc && (acc.internalGroup === 'income' || acc.internalGroup === 'expense')) {
      return !l.analyticAccountId
    }
    return false
  })

  const addLine = () => {
    const newLine: JournalLine = {
      id: `jel_${Date.now()}`,
      accountId: 'acc_505',
      accountCode: '504000',
      accountName: 'Bank Charges & Gateway Fees',
      label: 'Direct processing fee',
      debit: 0,
      credit: 0,
      analyticAccountId: 'ana_1',
    }
    setLines([...lines, newLine])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 2) return
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
        return { ...l, [field]: value }
      })
    )
  }

  const handlePostEntry = () => {
    if (!isBalanced) {
      alert('Total Debits must exactly equal Total Credits.')
      return
    }

    if (incomeOrExpenseMissingAnalytic) {
      alert('Cost Centre is mandatory for all Income and Expense accounts.')
      return
    }

    const seq = `MISC/2026/${Math.floor(1000 + Math.random() * 9000)}`
    const newEntry: JournalEntry = {
      id: `je_${Date.now()}`,
      entryNumber: seq,
      companyId,
      entryDate,
      journalId: 'jour_misc',
      journalName,
      reference,
      lines,
      state: 'posted',
      narration,
    }

    onSaveEntry(newEntry)
    setModalOpen(false)
  }

  const filteredEntries = entries.filter(e => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match =
        e.entryNumber.toLowerCase().includes(q) ||
        e.journalName.toLowerCase().includes(q) ||
        (e.reference && e.reference.toLowerCase().includes(q)) ||
        (e.narration && e.narration.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Journal Entries</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-entry bookkeeping journal. System strictly enforces Total Debit = Total Credit and mandatory cost centres.
          </p>
        </div>

        <button
          onClick={() => {
            setViewEntry(null)
            setModalOpen(true)
          }}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus size={16} />
          <span>New Journal Entry</span>
        </button>
      </div>

      {/* Journal Entries List */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-3 px-3.5">Entry Number</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Journal</th>
                <th className="py-3 px-3">Reference / Narration</th>
                <th className="py-3 px-3 text-right">Debit Total</th>
                <th className="py-3 px-3 text-right">Credit Total</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEntries.map(entry => {
                const debitSum = entry.lines.reduce((a, l) => a + l.debit, 0)
                const creditSum = entry.lines.reduce((a, l) => a + l.credit, 0)
                return (
                  <tr
                    key={entry.id}
                    onClick={() => {
                      setViewEntry(entry)
                      setModalOpen(true)
                    }}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3.5 font-bold font-mono text-blue-900 whitespace-nowrap">
                      <div>{entry.entryNumber}</div>
                      {entry.sourceDocument && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Source: {entry.sourceDocument}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{entry.entryDate}</td>
                    <td className="py-3 px-3 font-semibold text-slate-800">{entry.journalName}</td>
                    <td className="py-3 px-3 text-slate-600 max-w-sm truncate">
                      {entry.narration || entry.reference || 'Manual adjustment'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                      {moneyFormat(debitSum)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                      {moneyFormat(creditSum)}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {entry.state.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      {!entry.isReversed && (
                        <button
                          onClick={() => onReverseEntry(entry.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded text-[11px] font-bold flex items-center gap-1 transition ml-auto"
                          title="Reverse Posted Entry"
                        >
                          <RotateCcw size={12} />
                          <span>Reverse</span>
                        </button>
                      )}
                      {entry.isReversed && (
                        <span className="text-[10px] text-rose-600 font-bold italic">
                          Reversed
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* JE Modal / Drawer */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Scale size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">
                    {viewEntry ? `Journal Entry: ${viewEntry.entryNumber}` : 'New Manual Journal Entry'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    General Ledger Entry
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Entry Date *</label>
                  <input
                    type="date"
                    disabled={Boolean(viewEntry)}
                    value={viewEntry ? viewEntry.entryDate : entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">Journal *</label>
                  <select
                    disabled={Boolean(viewEntry)}
                    value={viewEntry ? viewEntry.journalName : journalName}
                    onChange={e => setJournalName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                  >
                    <option>Miscellaneous Operations</option>
                    <option>Bank Journal</option>
                    <option>Customer Invoices</option>
                    <option>Vendor Bills</option>
                    <option>Opening Balance Journal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold mb-1">External Reference</label>
                  <input
                    type="text"
                    disabled={Boolean(viewEntry)}
                    value={viewEntry ? viewEntry.reference || '' : reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. ADJ-OCT-2026"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-slate-600 font-bold mb-1">Narration / Memo</label>
                  <input
                    type="text"
                    disabled={Boolean(viewEntry)}
                    value={viewEntry ? viewEntry.narration || '' : narration}
                    onChange={e => setNarration(e.target.value)}
                    placeholder="Describe transaction purpose for the audit ledger..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                  />
                </div>
              </div>

              {/* Lines Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 flex items-center justify-between font-bold text-slate-700">
                  <span>Double-Entry Journal Lines (min. 2 lines required)</span>
                  {!viewEntry && (
                    <button
                      type="button"
                      onClick={addLine}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded text-xs font-bold text-slate-800 transition"
                    >
                      + Add Line
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                        <th className="py-2.5 px-3">Account</th>
                        <th className="py-2.5 px-3">Label / Description</th>
                        <th className="py-2.5 px-3">Cost Centre</th>
                        <th className="py-2.5 px-3 text-right w-28">Debit</th>
                        <th className="py-2.5 px-3 text-right w-28">Credit</th>
                        {!viewEntry && <th className="py-2.5 px-2 w-10"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(viewEntry ? viewEntry.lines : lines).map(l => (
                        <tr key={l.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3">
                            {viewEntry ? (
                              <div className="font-semibold text-slate-800">
                                <span className="font-mono text-blue-700 mr-1">{l.accountCode}</span>
                                {l.accountName}
                              </div>
                            ) : (
                              <select
                                value={l.accountId}
                                onChange={e => updateLine(l.id, 'accountId', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1"
                              >
                                {mockChartOfAccounts.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name} ({a.internalGroup})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              disabled={Boolean(viewEntry)}
                              value={l.label}
                              onChange={e => updateLine(l.id, 'label', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] disabled:bg-transparent disabled:border-0"
                            />
                          </td>
                          <td className="py-2 px-3">
                            {viewEntry ? (
                              <span className="text-slate-600 font-medium">
                                {mockAnalyticAccounts.find(a => a.id === l.analyticAccountId)?.name || '—'}
                              </span>
                            ) : (
                              <select
                                value={l.analyticAccountId || ''}
                                onChange={e => updateLine(l.id, 'analyticAccountId', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px]"
                              >
                                <option value="">-- None --</option>
                                {mockAnalyticAccounts.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.code} - {a.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={Boolean(viewEntry)}
                              value={l.debit || ''}
                              onChange={e => updateLine(l.id, 'debit', Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right font-mono font-bold text-[11px] disabled:bg-transparent disabled:border-0"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={Boolean(viewEntry)}
                              value={l.credit || ''}
                              onChange={e => updateLine(l.id, 'credit', Number(e.target.value))}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-right font-mono font-bold text-[11px] disabled:bg-transparent disabled:border-0"
                            />
                          </td>
                          {!viewEntry && (
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeLine(l.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Balance validation bar (§6.1 JE-004) */}
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    {isBalanced || viewEntry ? (
                      <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5">
                        <CheckCircle2 size={15} /> Balanced: Total Debits = Total Credits
                      </span>
                    ) : (
                      <span className="text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md font-bold flex items-center gap-1.5">
                        <AlertCircle size={15} /> Unbalanced Difference: {moneyFormat(Math.abs(totalDebit - totalCredit))}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-6 font-mono font-bold text-sm">
                    <div>
                      <span className="text-slate-400 text-xs mr-2 font-sans font-normal">Total Debit:</span>
                      <span className="text-slate-900">{moneyFormat(viewEntry ? viewEntry.lines.reduce((a,l)=>a+l.debit,0) : totalDebit)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs mr-2 font-sans font-normal">Total Credit:</span>
                      <span className="text-slate-900">{moneyFormat(viewEntry ? viewEntry.lines.reduce((a,l)=>a+l.credit,0) : totalCredit)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white px-6 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-bold"
              >
                Close
              </button>
              {!viewEntry && (
                <button
                  onClick={handlePostEntry}
                  disabled={!isBalanced || incomeOrExpenseMissingAnalytic}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-xs transition"
                >
                  Post Journal Entry
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
