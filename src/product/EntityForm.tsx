import { useMemo, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import type { EntityConfig, FieldDef, Mode, Values } from './config'
import { FormField, FieldShell } from './FormField'
import { navigate } from './router'
import { saveRecord, useProduct } from './store'
import { toast } from './toast'
import type { Rec } from './types'
import { Button, Card, EmptyState, PageHeader } from './ui'

const isInput = (f: FieldDef) => f.kind !== 'readonly' && !f.detailOnly

/** Record -> form values (numbers become strings so users can type freely). */
function toForm(cfg: EntityConfig, src: Values): Values {
  const out: Values = { ...src }
  for (const sec of cfg.sections) for (const f of sec.fields) if (f.kind === 'number' && src[f.key] != null) out[f.key] = String(src[f.key])
  return out
}

export function EntityForm({ cfg, id }: { cfg: EntityConfig; id?: number }) {
  const s = useProduct()
  const mode: Mode = id == null ? 'create' : 'edit'
  const existing = id == null ? undefined : (s[cfg.key] as Rec[]).find((r) => r.id === id)
  const [values, setValues] = useState<Values>(() => { const base = existing ?? cfg.defaults(s); return toForm(cfg, { ...base, ...cfg.prepare?.(base, s) }) })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const formId = `form-${cfg.key}`
  const backPath = id != null ? `/${cfg.route}/${id}` : `/${cfg.route}`

  const fields = useMemo(() => cfg.sections.flatMap((sec) => sec.fields), [cfg])
  const visible = (f: FieldDef) => isInput(f) && (!f.showWhen || f.showWhen(values, mode))

  if (id != null && !existing) {
    return (
      <Card><EmptyState title={`${cfg.singular} not found`} message="It may have been deleted." action={<Button onClick={() => navigate(`/${cfg.route}`)}>Back to {cfg.title}</Button>} /></Card>
    )
  }

  /** Validate parsed input values; returns { errors, parsed }. */
  const check = (v: Values) => {
    const errs: Record<string, string> = {}
    const parsed: Values = { ...v }
    for (const f of fields) {
      if (!visible(f)) continue
      const raw = v[f.key]
      if (f.kind === 'number') {
        if (raw === '' || raw == null) {
          if (f.required) errs[f.key] = `${f.label} is required.`
          parsed[f.key] = 0
          continue
        }
        const n = Number(raw)
        if (!Number.isFinite(n)) errs[f.key] = `${f.label} must be a number.`
        else if (f.integer && !Number.isInteger(n)) errs[f.key] = `${f.label} must be a whole number.`
        else if (f.min != null && n < f.min) errs[f.key] = `${f.label} must be at least ${f.min}.`
        else if (f.max != null && n > f.max) errs[f.key] = `${f.label} must be at most ${f.max}.`
        parsed[f.key] = n
      } else if (f.kind === 'boolean') {
        parsed[f.key] = !!raw
      } else if (f.kind === 'relation') {
        if (f.required && raw == null) errs[f.key] = `${f.label} is required.`
        parsed[f.key] = raw ?? null
      } else {
        const t = typeof raw === 'string' ? raw.trim() : raw
        if (f.required && !t) errs[f.key] = `${f.label} is required.`
        else if (f.maxLength && typeof t === 'string' && t.length > f.maxLength) errs[f.key] = `${f.label} must be at most ${f.maxLength} characters.`
        parsed[f.key] = t ?? ''
      }
    }
    if (cfg.validate) Object.assign(errs, { ...cfg.validate(parsed, s, id), ...errs })
    return { errs, parsed }
  }

  const setField = (f: FieldDef, value: any) => {
    let next: Values = { ...values, [f.key]: value }
    if (f.onChange) next = { ...next, ...toForm(cfg, f.onChange(value, next, s)) }
    setValues(next)
    if (submitted) setErrors(check(next).errs)
    else setErrors((e) => { const { [f.key]: _drop, ...rest } = e; return rest })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const { errs, parsed } = check(values)
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast('Please fix the highlighted fields.', 'error')
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`#${formId} [aria-invalid="true"]`)
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.focus({ preventScroll: true })
      })
      return
    }
    // keep only input fields' values in the payload; other record keys (computed values etc.) are preserved by the store
    const payload: Values = {}
    for (const f of fields) if (isInput(f) && f.key in parsed && (visible(f) || mode === 'edit')) payload[f.key] = f.kind === 'number' ? Number(parsed[f.key] || 0) : parsed[f.key]
    const final = cfg.finalize ? cfg.finalize(payload) : payload
    const savedId = saveRecord(cfg.key, final, id)
    toast(`${cfg.singular} "${cfg.nameOf({ ...(existing ?? {}), ...final, id: savedId } as Rec, s)}" ${mode === 'create' ? 'created' : 'saved'}.`)
    navigate(`/${cfg.route}/${savedId}`)
  }

  const title = mode === 'create' ? `New ${cfg.singular}` : `Edit ${cfg.nameOf(existing!, s)}`
  return (
    <div>
      <a href={`#${backPath}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {mode === 'create' ? cfg.title : 'Back to record'}
      </a>
      <PageHeader
        title={title}
        subtitle={<span className="font-mono text-xs">{cfg.model}</span>}
        actions={<><Button onClick={() => navigate(backPath)}>Cancel</Button><Button type="submit" form={formId} variant="primary" icon={<Save className="h-4 w-4" />}>{mode === 'create' ? 'Create' : 'Save changes'}</Button></>}
      />
      {submitted && Object.keys(errors).length > 0 && (
        <div role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {Object.keys(errors).length} field{Object.keys(errors).length > 1 ? 's need' : ' needs'} attention before saving.
        </div>
      )}
      <form id={formId} noValidate onSubmit={submit} className="space-y-5">
        {cfg.sections.map((sec) => {
          const shown = sec.fields.filter(visible)
          const computed = sec.fields.filter((f) => f.kind === 'readonly' && !f.detailOnly && mode === 'edit')
          if (!shown.length && !computed.length) return null
          return (
            <Card key={sec.title} title={sec.title} description={sec.description}>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {shown.map((f) => (
                  <FormField
                    key={f.key} field={f} values={values} s={s} error={errors[f.key]}
                    disabled={f.readonlyWhen?.(values, mode, s)} onChange={(v) => setField(f, v)}
                  />
                ))}
                {computed.map((f) => (
                  <FieldShell key={f.key} field={f} id={`f-${f.key}`}>
                    <div className="flex min-h-9 items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">{existing && f.get ? f.get(existing, s) : '—'}</div>
                  </FieldShell>
                ))}
              </div>
            </Card>
          )
        })}
        <div className="flex justify-end gap-2 pb-2">
          <Button onClick={() => navigate(backPath)}>Cancel</Button>
          <Button type="submit" variant="primary" icon={<Save className="h-4 w-4" />}>{mode === 'create' ? 'Create' : 'Save changes'}</Button>
        </div>
      </form>
    </div>
  )
}
