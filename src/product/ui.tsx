import { useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Inbox, AlertTriangle, Ban } from 'lucide-react'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

// ── Buttons ──
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: ReactNode }
const BTN: Record<string, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600 shadow-sm',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-sm',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-sm',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
}
export function Button({ variant = 'secondary', icon, children, className, type = 'button', ...rest }: BtnProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cx('inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', BTN[variant], className)}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({ label, onClick, tone = 'default', children, disabled }: { label: string; onClick?: () => void; tone?: 'default' | 'danger'; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button" title={label} aria-label={label} onClick={(e) => { e.stopPropagation(); onClick?.() }} disabled={disabled}
      className={cx('inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors disabled:opacity-40', tone === 'danger' ? 'hover:bg-rose-50 hover:text-rose-600' : 'hover:bg-slate-100 hover:text-slate-800')}
    >
      {children}
    </button>
  )
}

// ── Badges ──
export type Tone = 'green' | 'slate' | 'amber' | 'blue' | 'violet' | 'rose' | 'teal'
const TONES: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/20',
}
export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone])}>{children}</span>
}
export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', active ? TONES.green : TONES.slate)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
      {active ? 'Active' : 'Archived'}
    </span>
  )
}

// ── Layout ──
export function Card({ title, description, actions, children, className, bodyClassName }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cx('p-5', bodyClassName)}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, meta, actions, back }: { title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-5">
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            {meta}
          </div>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ title, message, action, icon }: { title: string; message?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}
          className={cx('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors', value === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
        >
          {o.label}
          {o.count != null && <span className={cx('rounded-full px-1.5 text-[11px] tabular-nums', value === o.id ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200/70 text-slate-500')}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Dialogs ──
export function Modal({ open, title, onClose, children, footer, tone = 'default', icon }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; tone?: 'default' | 'danger' | 'warning'; icon?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  const iconTone = tone === 'danger' ? 'bg-rose-100 text-rose-600' : tone === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-xl bg-white shadow-xl outline-none">
        <div className="flex gap-4 p-5">
          <div className={cx('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', iconTone)}>{icon ?? <AlertTriangle className="h-5 w-5" />}</div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <div className="mt-1.5 text-sm text-slate-600">{children}</div>
          </div>
        </div>
        {footer && <div className="flex flex-col-reverse gap-2 rounded-b-xl bg-slate-50 px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel, tone = 'danger', onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel: string; tone?: 'danger' | 'warning'; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal
      open={open} title={title} onClose={onCancel} tone={tone}
      footer={<><Button onClick={onCancel}>Cancel</Button><Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button></>}
    >
      {message}
    </Modal>
  )
}

export function BlockedDialog({ open, title, message, onClose }: { open: boolean; title: string; message: ReactNode; onClose: () => void }) {
  return (
    <Modal open={open} title={title} onClose={onClose} tone="warning" icon={<Ban className="h-5 w-5" />} footer={<Button variant="primary" onClick={onClose}>OK</Button>}>
      {message}
    </Modal>
  )
}

// ── Pagination ──
export function Pagination({ page, pageSize, total, onPage, onPageSize }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; onPageSize: (n: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">{from}–{to} of {total}</span>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Rows
          <select aria-label="Rows per page" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="h-8 rounded-md border border-slate-300 bg-white px-1.5 text-sm text-slate-700">
            {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2 text-xs tabular-nums text-slate-500">Page {page} / {pages}</span>
        <button aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  )
}
