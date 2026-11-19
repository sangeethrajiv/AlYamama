import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, X } from 'lucide-react'
import { inputCls } from '../shared/ui'

/** Small widgets for the Contact module, built from the same classes the other modules use. */

export function Breadcrumb({ parent, current, onBack }: { parent: string; current: string; onBack: () => void }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs min-w-0">
      <button onClick={onBack} className="font-bold text-emerald-700 hover:underline">{parent}</button>
      <ChevronRight size={12} className="text-slate-400 flex-shrink-0" /><span className="font-bold text-slate-700 truncate">{current}</span>
    </nav>
  )
}

/** Form field with label, required marker and inline validation message. */
export function Fld({ label, required, error, hint, span = 1, children }: { label: string; required?: boolean; error?: string; hint?: string; span?: 1 | 2; children: ReactNode }) {
  return (
    <label className={`block text-xs ${span === 2 ? 'sm:col-span-2' : ''}`}>
      <span className="block text-slate-600 font-bold mb-0.5 text-[11px]">{label}{required && <span className="text-rose-600" aria-hidden="true"> *</span>}</span>
      {children}
      {error ? <span role="alert" className="block text-[11px] font-semibold text-rose-600 mt-0.5">{error}</span> : hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
    </label>
  )
}
export const errCls = (error?: string) => (error ? `${inputCls} !border-rose-400 !bg-rose-50/40` : inputCls)

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-left py-1 disabled:opacity-50">
      <span className={`relative w-9 h-5 rounded-full transition flex-shrink-0 ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      <span className="text-xs"><span className="font-bold text-slate-800">{label}</span>{hint && <span className="block text-[10px] text-slate-400">{hint}</span>}</span>
    </button>
  )
}

/** Read-only label/value pair on the view page. */
export function Item({ label, children }: { label: string; children?: ReactNode }) {
  const empty = children === undefined || children === null || children === '' || children === false
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-xs text-slate-800 font-medium mt-0.5 break-words">{empty ? <span className="text-slate-300">—</span> : children}</dd>
    </div>
  )
}

/** Many2many tag picker: chips for chosen tags plus a select to add another. */
export function TagPicker({ label, tags, value, onChange }: { label: string; tags: { id: number; name: string }[]; value: number[]; onChange: (v: number[]) => void }) {
  const free = tags.filter(t => !value.includes(t.id))
  return (
    <div className="text-xs">
      <span className="block text-slate-600 font-bold mb-0.5 text-[11px]">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 min-h-[2.25rem]">
        {value.map(id => (
          <span key={id} className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full pl-2 pr-1 py-0.5 text-[11px] font-bold">
            {tags.find(t => t.id === id)?.name ?? `#${id}`}
            <button type="button" aria-label={`Remove tag ${tags.find(t => t.id === id)?.name ?? id}`} onClick={() => onChange(value.filter(v => v !== id))} className="p-0.5 rounded-full hover:bg-emerald-200"><X size={10} /></button>
          </span>
        ))}
        <select aria-label={`Add ${label.toLowerCase()}`} value="" disabled={free.length === 0} onChange={e => e.target.value && onChange([...value, Number(e.target.value)])}
          className="flex-1 min-w-[7rem] bg-transparent text-xs text-slate-500 focus:outline-none">
          <option value="">{free.length ? 'Add a tag…' : 'All tags added'}</option>
          {free.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
    </div>
  )
}

export function Pagination({ page, pages, total, size, onPage, onSize }: { page: number; pages: number; total: number; size: number; onPage: (p: number) => void; onSize: (n: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(total, page * size)
  const nums: number[] = []
  for (let i = Math.max(1, Math.min(page - 2, pages - 4)); i <= Math.min(pages, Math.max(page + 2, 5)); i++) nums.push(i)
  const btn = 'min-w-8 h-8 px-2 rounded-lg border text-xs font-bold flex items-center justify-center transition disabled:opacity-40'
  return (
    <nav aria-label="Pagination" className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
      <div className="flex items-center gap-3">
        <span>Showing <b className="text-slate-900">{from}–{to}</b> of <b className="text-slate-900">{total}</b></span>
        <label className="flex items-center gap-1.5">Rows
          <select aria-label="Rows per page" value={size} onChange={e => onSize(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-600">
            {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button aria-label="First page" disabled={page <= 1} onClick={() => onPage(1)} className={`${btn} border-slate-300 bg-white hover:bg-slate-50`}><ChevronsLeft size={14} /></button>
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${btn} border-slate-300 bg-white hover:bg-slate-50`}><ChevronLeft size={14} /></button>
        {nums.map(n => (
          <button key={n} aria-label={`Page ${n}`} aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)}
            className={`${btn} ${n === page ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{n}</button>
        ))}
        <button aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={`${btn} border-slate-300 bg-white hover:bg-slate-50`}><ChevronRight size={14} /></button>
        <button aria-label="Last page" disabled={page >= pages} onClick={() => onPage(pages)} className={`${btn} border-slate-300 bg-white hover:bg-slate-50`}><ChevronsRight size={14} /></button>
      </div>
    </nav>
  )
}

export function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t) }, [text, onClose])
  return (
    <div role="status" className="fixed bottom-20 right-4 left-4 sm:left-auto sm:max-w-sm pointer-events-none z-[70] bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-2xl px-4 py-3 flex items-start gap-2.5">
      <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-px" />
      <span className="flex-1">{text}</span>
      <button onClick={onClose} aria-label="Dismiss" className="pointer-events-auto text-slate-400 hover:text-white"><X size={14} /></button>
    </div>
  )
}
