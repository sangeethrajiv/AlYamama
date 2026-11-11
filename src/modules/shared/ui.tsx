import type { ReactNode } from 'react'
import { X, Search, Inbox } from 'lucide-react'

/** Shared building blocks for the Contacts and Inventory modules (same look as the Accounting screens). */
export const inputCls =
  'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:opacity-60'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}

export function PrimaryButton({ children, onClick, disabled, title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
      {children}
    </button>
  )
}

export function GhostButton({ children, onClick, disabled, danger, title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; title?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`px-3 py-2 rounded-lg text-xs font-bold border transition disabled:opacity-50 disabled:cursor-not-allowed ${danger ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'}`}>
      {children}
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto" role="tablist">
      {options.map(o => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${value === o.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
          <span>{o.label}</span>
          {o.count !== undefined && <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 rounded-full font-mono">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Search…'} aria-label={placeholder || 'Search'}
        className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-emerald-600" />
    </div>
  )
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const t = {
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
    green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    amber: 'bg-amber-100 text-amber-800 border-amber-300',
    red: 'bg-rose-100 text-rose-800 border-rose-300',
    blue: 'bg-sky-100 text-sky-800 border-sky-300',
  }[tone]
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${t}`}>{children}</span>
}

export function Card({ title, children, actions, dense }: { title?: string; children: ReactNode; actions?: ReactNode; dense?: boolean }) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs">
      {(title || actions) && (
        <div className={`${dense ? 'px-3 py-2' : 'px-4 py-2.5'} border-b border-slate-100 flex items-center justify-between`}>
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">{title}</h3>
          {actions}
        </div>
      )}
      <div className={dense ? 'p-3' : 'p-4'}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'red' | 'amber' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-xl font-extrabold mt-0.5 ${tone === 'red' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>}
    </div>
  )
}

export function Field({ label, children, span = 1, hint, dense }: { label: string; children: ReactNode; span?: 1 | 2; hint?: string; dense?: boolean }) {
  return (
    <label className={`block text-xs ${span === 2 ? 'sm:col-span-2' : ''}`}>
      <span className={`block text-slate-600 font-bold ${dense ? 'mb-0.5 text-[11px]' : 'mb-1'}`}>{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-400 mt-0.5">{hint}</span>}
    </label>
  )
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="py-12 text-center text-slate-500">
      <Inbox size={28} className="mx-auto text-slate-300 mb-2" />
      <div className="text-sm font-bold text-slate-700">{title}</div>
      {text && <div className="text-xs mt-1">{text}</div>}
    </div>
  )
}

export function Table({ head, children, empty }: { head: (string | { label: string; right?: boolean })[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wide">
          <tr>
            {head.map((h, i) => {
              const o = typeof h === 'string' ? { label: h, right: false } : h
              return <th key={i} className={`px-3 py-2.5 font-bold ${o.right ? 'text-right' : 'text-left'}`}>{o.label}</th>
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
      {empty}
    </div>
  )
}

/** Right-hand slide-over, same shell as the invoice and bill forms. */
export function Drawer({ title, subtitle, badge, onClose, children, footer, wide }: {
  title: string; subtitle?: string; badge?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`bg-slate-50 w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden`}>
        <div className="bg-white px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-black text-slate-800 truncate">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">{children}</div>
        {footer && <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, text, confirmLabel, danger, onConfirm, onCancel }: {
  title: string; text: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[60] p-4" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-label={title} className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5">
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-600 mt-1.5">{text}</p>
        <div className="flex justify-end gap-2 mt-4">
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-lg text-xs font-bold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export const today = () => new Date().toISOString().slice(0, 10)

const AVATAR_TONES = ['bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-violet-100 text-violet-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700']
/** Photo, or initials on a tone derived from the name. */
export function Avatar({ name, src, size = 36, round }: { name: string; src?: string; size?: number; round?: boolean }) {
  const initials = name.replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length]
  const style = { width: size, height: size, fontSize: size * 0.36 }
  const shape = round ? 'rounded-full' : 'rounded-xl'
  return src
    ? <img src={src} alt={name} style={style} className={`${shape} object-cover flex-shrink-0 border border-slate-200`} />
    : <span style={style} aria-hidden="true" className={`${shape} ${tone} flex items-center justify-center font-extrabold flex-shrink-0`}>{initials}</span>
}

/** Centered form dialog (full-screen on phones). */
export function CenterDialog({ title, onClose, children, footer, dense }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; dense?: boolean }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-stretch sm:items-center justify-center sm:p-6" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title}
        className="bg-slate-50 w-full max-w-5xl sm:max-h-[94vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-white px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-slate-800 truncate">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className={`flex-1 overflow-y-auto ${dense ? 'p-3 sm:p-4 space-y-3' : 'p-4 sm:p-6 space-y-4'}`}>{children}</div>
        {footer && <div className="bg-white px-5 py-2.5 border-t border-slate-200 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
