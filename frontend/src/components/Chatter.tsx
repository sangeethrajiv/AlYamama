import { useState } from 'react'
import type { AuditLogEntry } from '../types/accounting'

interface Props {
  recordType: AuditLogEntry['recordType']
  recordId: string
  recordName: string
  logs: AuditLogEntry[]
  onPostNote: (recordType: AuditLogEntry['recordType'], recordId: string, recordName: string, text: string) => void
}

const initials = (name: string) =>
  name.split(/[\s()]+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

type Tone = 'green' | 'amber' | 'rose' | 'slate'

// Friendly headline + colour per event type
const EVENTS: Record<string, { title: string; tone: Tone }> = {
  create: { title: 'Created', tone: 'slate' },
  update: { title: 'Edited', tone: 'slate' },
  state: { title: 'Status changed', tone: 'green' },
  renew: { title: 'Invoiced', tone: 'green' },
  payment: { title: 'Payment registered', tone: 'green' },
  approvalStatus: { title: 'Approval updated', tone: 'amber' },
  zatca_submit: { title: 'Submitted to ZATCA', tone: 'green' },
  reconciliation: { title: 'Reconciled', tone: 'green' },
  bulk_reconciliation: { title: 'Bulk reconciled', tone: 'green' },
  unreconcile: { title: 'Unreconciled', tone: 'amber' },
  convert_proforma: { title: 'Converted to tax invoice', tone: 'green' },
  create_credit_note: { title: 'Credit note issued', tone: 'amber' },
  auto_intercompany: { title: 'Inter-company bill created', tone: 'slate' },
  save_bill: { title: 'Bill saved', tone: 'slate' },
  approved: { title: 'Approved', tone: 'green' },
  rejected: { title: 'Rejected', tone: 'rose' },
  cheque_bounced: { title: 'Cheque bounced', tone: 'rose' },
}

const TONES: Record<Tone, { bar: string; title: string; dot: string }> = {
  green: { bar: 'border-emerald-500 bg-emerald-50/60', title: 'text-emerald-800', dot: 'bg-emerald-500' },
  amber: { bar: 'border-amber-500 bg-amber-50/60', title: 'text-amber-800', dot: 'bg-amber-500' },
  rose: { bar: 'border-rose-500 bg-rose-50/60', title: 'text-rose-800', dot: 'bg-rose-500' },
  slate: { bar: 'border-slate-400 bg-slate-50', title: 'text-slate-800', dot: 'bg-slate-400' },
}

const chip = (v: string) => {
  const k = v.toLowerCase()
  const c = k === 'paid' || k === 'posted' || k === 'reconciled' || k === 'approved'
    ? 'bg-emerald-100 text-emerald-800'
    : k === 'open' || k === 'in_payment' ? 'bg-amber-100 text-amber-800'
    : k === 'cancel' || k === 'rejected' || k === 'bounced' ? 'bg-rose-100 text-rose-800'
    : 'bg-slate-200 text-slate-700'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${c}`}>{v.replace('_', ' ')}</span>
}

/** Conversation-style timeline: write notes, see system events as they happen. */
export default function Chatter({ recordType, recordId, recordName, logs, onPostNote }: Props) {
  const [tab, setTab] = useState<'all' | 'notes' | 'system'>('all')
  const [text, setText] = useState('')

  const filtered = logs
    .filter(l => l.recordId === recordId)
    .filter(l => (tab === 'all' ? true : tab === 'notes' ? l.fieldName === 'note' : l.fieldName !== 'note'))
  // Group field edits saved together into one entry
  const items: (AuditLogEntry & { edits?: AuditLogEntry[] })[] = []
  for (const l of filtered) {
    const last = items[items.length - 1]
    if (l.fieldName.startsWith('edit:') && last?.edits && last.user === l.user && last.timestamp === l.timestamp) last.edits.push(l)
    else items.push(l.fieldName.startsWith('edit:') ? { ...l, edits: [l] } : l)
  }

  const post = () => {
    const t = text.trim()
    if (!t) return
    onPostNote(recordType, recordId, recordName, t)
    setText('')
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" aria-label="Chatter">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h3 className="text-sm font-extrabold text-slate-800">Chatter</h3>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold" role="tablist">
          {(['all', 'notes', 'system'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-2.5 py-1 rounded-md capitalize transition ${tab === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4">
        <div className="rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') post() }}
            rows={2}
            placeholder="Write an internal note…"
            className="w-full resize-none rounded-t-xl bg-transparent px-3 py-2 text-xs outline-none placeholder-slate-400"
          />
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100 bg-slate-50 rounded-b-xl">
            <span className="text-[10px] text-slate-400">Only visible internally · Ctrl+Enter to post</span>
            <button
              type="button"
              onClick={post}
              disabled={!text.trim()}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
            >
              Post note
            </button>
          </div>
        </div>
      </div>

      <ol className="px-5 pb-5 space-y-3 max-h-80 overflow-y-auto">
        {items.length === 0 && (
          <li className="text-xs text-slate-400 py-4 text-center">
            {tab === 'notes' ? 'No notes yet. Be the first to add one.' : 'No activity recorded yet.'}
          </li>
        )}
        {items.map(l => {
          const isNote = l.fieldName === 'note'
          return (
            <li key={l.id} className="flex gap-3">
              <div className={`h-8 w-8 shrink-0 rounded-full grid place-items-center text-[11px] font-bold ${isNote ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                {initials(l.user)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-bold text-slate-800">{l.user}</span>
                  {isNote && <span className="text-[10px] font-semibold text-emerald-700">added a note</span>}
                  <span className="text-[10px] text-slate-400 font-mono">{l.timestamp}</span>
                </div>
                {isNote ? (
                  <p className="mt-1 rounded-xl rounded-tl-sm bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-slate-800 whitespace-pre-wrap break-words">{l.notes}</p>
                ) : l.edits ? (
                  <div className="mt-1 rounded-lg border-l-4 border-slate-400 bg-slate-50 px-3 py-2 text-xs">
                    <div className="font-extrabold text-slate-800 mb-1.5">
                      Edited {l.edits.length} field{l.edits.length > 1 ? 's' : ''}
                    </div>
                    <ul className="space-y-1">
                      {l.edits.map(e => (
                        <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="w-32 shrink-0 text-slate-500">{e.fieldName.slice(5)}</span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 line-through break-all">{e.oldValue}</span>
                          <span className="text-slate-400">→</span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold break-all">{e.newValue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (() => {
                  const ev = EVENTS[l.fieldName] || { title: 'Updated', tone: 'slate' as Tone }
                  const t = TONES[ev.tone]
                  const fresh = l.oldValue === '—' || !l.oldValue
                  const changed = l.newValue && l.oldValue !== l.newValue
                  return (
                    <div className={`mt-1 rounded-lg border-l-4 px-3 py-2 text-xs ${t.bar}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-extrabold ${t.title}`}>{ev.title}</span>
                        {changed && (
                          <span className="inline-flex items-center gap-1.5">
                            {!fresh && <>{chip(l.oldValue)}<span className="text-slate-400">→</span></>}{chip(l.newValue)}
                          </span>
                        )}
                      </div>
                      {l.notes && <p className="mt-0.5 text-slate-600 break-words">{l.notes}</p>}
                    </div>
                  )
                })()}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
