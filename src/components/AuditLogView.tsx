import { useState } from 'react'
import {
  History,
  ShieldAlert,
  Lock,
  FileDown,
  Filter,
  CheckCircle2,
  Calendar,
  User,
} from 'lucide-react'
import type { AuditLogEntry } from '../types/accounting'

interface AuditLogViewProps {
  logs: AuditLogEntry[]
  searchQuery: string
}

// Helper for user-friendly field names
const formatFieldName = (fieldName: string) => {
  const map: Record<string, string> = {
    state: 'Document Status',
    amount_total: 'Total Amount',
    approvalStatus: 'Approval Status',
    period_lock_date: 'Hard Lock Date',
    fiscalyear_lock_date: 'Soft Lock Date',
    supplierInvoiceNumber: 'Supplier Invoice #',
    dateInvoice: 'Invoice Date',
    dateDue: 'Due Date',
    partner_id: 'Partner / Customer',
    partner: 'Partner / Customer',
    reconciliation: 'Reconciliation',
    direct_bank_tx: 'Direct Bank Tx',
    cheque_bounced: 'Cheque Status',
    auto_intercompany: 'Inter-Company Sync',
    save_bill: 'Bill Submission',
    create_credit_note: 'Credit Note',
    create: 'Creation',
    update: 'Update',
  }
  return map[fieldName] || fieldName
}

export default function AuditLogView({ logs, searchQuery }: AuditLogViewProps) {
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredLogs = logs.filter(log => {
    if (typeFilter !== 'all' && log.recordType !== typeFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const match =
        log.recordName.toLowerCase().includes(q) ||
        log.user.toLowerCase().includes(q) ||
        log.fieldName.toLowerCase().includes(q) ||
        (log.notes && log.notes.toLowerCase().includes(q))
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
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Audit Log & Activity History
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Full compliance audit trail with before/after changes, user accountability, and 7-year regulatory retention policy.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting Audit Trail to Excel...')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
        >
          <FileDown size={15} />
          <span>Export Audit Log (CSV/XLSX)</span>
        </button>
      </div>

      {/* Regulatory Banner */}
      <div className="bg-slate-900 text-slate-200 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-slate-800 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 mt-0.5">
            <Lock size={18} />
          </div>
          <div>
            <div className="font-bold text-xs text-white flex items-center gap-2">
              <span>Regulatory Compliance & Immutability Enforced</span>
              <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                Retention: 7 Years
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-2xl">
              Audit log entries cannot be modified or silently deleted by any user or automated job. Purges from cold storage require written Finance Director authorisation and generate an immutable audit record.
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 font-mono text-right shrink-0">
          <div>Retention Standard:</div>
          <code className="text-emerald-400 text-xs">Statutory 7-Year Accounting Policy</code>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1">
        {['all', 'Invoice', 'Vendor Bill', 'Payment', 'Journal Entry', 'Lock Date', 'Chart of Accounts'].map(t => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition ${
              typeFilter === t
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t === 'all' ? `All Records (${logs.length})` : t}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200 select-none">
                <th className="py-3 px-3.5">Timestamp</th>
                <th className="py-3 px-3">User (Changed By)</th>
                <th className="py-3 px-3">Record Type</th>
                <th className="py-3 px-3">Record Identifier</th>
                <th className="py-3 px-3">Field / Action</th>
                <th className="py-3 px-3">Before (Old Value)</th>
                <th className="py-3 px-3">After (New Value)</th>
                <th className="py-3 px-3">Notes & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3.5 font-mono text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap flex items-center gap-1.5">
                    <User size={13} className="text-slate-400" />
                    <span>{log.user}</span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                      {log.recordType}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                    {log.recordName}
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-semibold">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700">
                      {formatFieldName(log.fieldName)}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-rose-700 bg-rose-50/40 px-2 py-1 rounded">
                    {log.oldValue || '—'}
                  </td>
                  <td className="py-3 px-3 font-mono text-emerald-800 bg-emerald-50/40 px-2 py-1 rounded font-bold">
                    {log.newValue}
                  </td>
                  <td className="py-3 px-3 text-slate-500 text-[11px] max-w-sm truncate" title={log.notes}>
                    {log.notes || 'Tracked system update'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex justify-between">
          <span>Showing {filteredLogs.length} audit entries</span>
          <span className="text-slate-400">System Audit Trail Active</span>
        </div>
      </div>
    </div>
  )
}

