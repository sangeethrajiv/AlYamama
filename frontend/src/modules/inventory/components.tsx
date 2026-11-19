import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { inputCls } from '../shared/ui'

/** Small form widgets shared by the Inventory screens (Odoo-style status bar, breadcrumb, many2one, smart buttons). */

export const dtInput = (v: string) => v.replace(' ', 'T')
export const dtOutput = (v: string) => v.replace('T', ' ')
export const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000))

export function StatusBar({ steps, value }: { steps: { id: string; label: string }[]; value: string }) {
  const idx = steps.findIndex(s => s.id === value)
  return (
    <ol className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden text-[11px] font-bold" aria-label="Status">
      {steps.map((s, i) => (
        <li key={s.id} aria-current={s.id === value ? 'step' : undefined}
          className={`px-3 py-1.5 border-r last:border-r-0 border-slate-200 ${s.id === value ? 'bg-emerald-600 text-white' : i < idx ? 'text-slate-600 bg-slate-50' : 'text-slate-400'}`}>{s.label}</li>
      ))}
    </ol>
  )
}

export function Breadcrumb({ parent, current, onBack }: { parent: string; current: string; onBack: () => void }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs">
      <button onClick={onBack} className="font-bold text-emerald-700 hover:underline">{parent}</button>
      <ChevronRight size={12} className="text-slate-400" /><span className="font-bold text-slate-700">{current}</span>
    </nav>
  )
}

export function M2O({ value, onChange, options, disabled, placeholder = '', label }: {
  value?: number | string; onChange: (v: number | undefined) => void; options: { id: number; label: string }[]; disabled?: boolean; placeholder?: string; label: string
}) {
  return (
    <select aria-label={label} className={inputCls} disabled={disabled} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex border-b border-slate-200 gap-1 overflow-x-auto" role="tablist">
      {tabs.map(t => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-xs font-bold whitespace-nowrap border-b-2 -mb-px ${value === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t.label}</button>
      ))}
    </div>
  )
}

export function SmartButton({ value, label, onClick }: { value: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="min-w-24 border border-slate-200 bg-white rounded-lg px-3 py-1.5 text-left hover:border-emerald-400 transition">
      <div className="text-sm font-extrabold text-emerald-700 leading-tight">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    </button>
  )
}

export function ErrorBanner({ text }: { text: string }) {
  return text ? <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{text}</div> : null
}

/** Odoo-like form sheet: two columns of label/value pairs. */
export function Sheet({ children }: { children: ReactNode }) {
  return <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-4 sm:p-5 space-y-4">{children}</div>
}
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[130px_1fr] sm:grid-cols-[150px_1fr] items-center gap-2 text-xs">
      <span className="font-bold text-slate-600">{label}</span><div className="min-w-0">{children}</div>
    </label>
  )
}
export const Static = ({ children }: { children: ReactNode }) => <div className="py-2 text-xs text-slate-800 font-medium min-h-[2rem]">{children || <span className="text-slate-300">—</span>}</div>
