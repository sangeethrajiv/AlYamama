export interface ActionItem {
  label: string
  onClick?: () => void
  kind?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  title?: string
}

/** A small row of document-level actions; the parent decides which ones apply to the document's stage. */
export default function DocumentActionBar({ items }: { items: ActionItem[] }) {
  if (items.length === 0) return null
  const base = 'h-8 px-3.5 rounded-lg text-xs font-bold transition disabled:opacity-50'
  const cls = {
    primary: `${base} bg-emerald-600 hover:bg-emerald-700 text-white`,
    ghost: `${base} border border-slate-300 hover:bg-slate-50 text-slate-800`,
    danger: `${base} border border-rose-200 text-rose-700 hover:bg-rose-50 ml-auto`,
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3" role="toolbar" aria-label="Document actions">
      {items.map(i => (
        <button key={i.label} type="button" onClick={i.onClick} disabled={i.disabled || !i.onClick} title={i.title} className={cls[i.kind || 'ghost']}>
          {i.label}
        </button>
      ))}
    </div>
  )
}
