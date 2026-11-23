import type { ReactNode } from 'react'
import type { FieldDef, Values } from './config'
import { relOptions } from './derived'
import type { ProductState } from './types'
import { cx } from './ui'

const controlCls = (error?: string, disabled?: boolean) =>
  cx(
    'block w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition',
    'focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500',
    error ? 'border-rose-400 focus:ring-rose-500/30 focus:border-rose-500' : 'border-slate-300',
    disabled && 'cursor-not-allowed bg-slate-100 text-slate-500',
  )

export function FieldShell({ field, error, children, id }: { field: FieldDef; error?: string; children: ReactNode; id: string }) {
  return (
    <div className={cx(field.span === 2 && 'sm:col-span-2')}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {field.label}
        {field.required && <span className="ml-0.5 text-rose-500" aria-hidden>*</span>}
      </label>
      {children}
      {error ? <p id={`${id}-err`} className="mt-1 text-xs text-rose-600">{error}</p> : field.help ? <p className="mt-1 text-xs text-slate-400">{field.help}</p> : null}
    </div>
  )
}

export function FormField({ field, values, s, error, disabled, onChange }: {
  field: FieldDef; values: Values; s: ProductState; error?: string; disabled?: boolean; onChange: (v: any) => void
}) {
  const id = `f-${field.key}`
  const value = values[field.key]
  const aria = { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-err` : undefined } as const

  if (field.kind === 'boolean') {
    return (
      <div className={cx('flex items-start', field.span === 2 && 'sm:col-span-2')}>
        <label htmlFor={id} className={cx('flex items-start gap-3', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
          <input {...aria} type="checkbox" checked={!!value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
          <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500/40 after:absolute after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
          <span>
            <span className="block text-sm font-medium text-slate-800">{field.label}</span>
            {field.help && <span className="block text-xs text-slate-400">{field.help}</span>}
          </span>
        </label>
      </div>
    )
  }

  let control: ReactNode
  switch (field.kind) {
    case 'textarea':
      control = <textarea {...aria} rows={3} value={value ?? ''} disabled={disabled} placeholder={field.placeholder} maxLength={field.maxLength} onChange={(e) => onChange(e.target.value)} className={cx(controlCls(error, disabled), 'py-2')} />
      break
    case 'number':
      control = (
        <div className="relative">
          <input {...aria} type="number" inputMode="decimal" step={field.step ?? 'any'} min={field.min} max={field.max} value={value ?? ''} disabled={disabled} placeholder={field.placeholder ?? '0'} onChange={(e) => onChange(e.target.value)} className={cx(controlCls(error, disabled), 'h-9 tabular-nums', field.suffix && 'pr-12')} />
          {field.suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">{field.suffix}</span>}
        </div>
      )
      break
    case 'select':
      control = (
        <select {...aria} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cx(controlCls(error, disabled), 'h-9')}>
          {!field.required && <option value="">—</option>}
          {field.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
      break
    case 'relation': {
      const opts = relOptions(s, field.rel!, value, field.domain ? (r) => field.domain!(r, values, s) : undefined)
      control = (
        <select {...aria} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={cx(controlCls(error, disabled), 'h-9')}>
          <option value="">{field.placeholder ?? (field.required ? 'Select…' : '—')}</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.label}{o.active ? '' : ' (archived)'}</option>)}
        </select>
      )
      break
    }
    default:
      control = <input {...aria} type="text" value={value ?? ''} disabled={disabled} placeholder={field.placeholder} maxLength={field.maxLength} dir={field.rtl ? 'rtl' : undefined} onChange={(e) => onChange(e.target.value)} className={cx(controlCls(error, disabled), 'h-9', field.mono && 'font-mono')} />
  }
  return <FieldShell field={field} error={error} id={id}>{control}</FieldShell>
}
