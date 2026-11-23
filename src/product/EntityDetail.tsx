import type { ReactNode } from 'react'
import { Archive, ArchiveRestore, ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import type { EntityConfig, FieldDef } from './config'
import { isEntityKey, num, relLabel } from './derived'
import { ENTITY_BY_KEY } from './entities'
import { optLabel } from './options'
import { navigate } from './router'
import { useProduct } from './store'
import { useRecordActions } from './useRecordActions'
import type { ProductState, Rec } from './types'
import { Badge, Button, Card, EmptyState, PageHeader, StatusBadge } from './ui'

const Empty = () => <span className="text-slate-400">—</span>

export function renderValue(f: FieldDef, r: Rec, s: ProductState): ReactNode {
  if (f.kind === 'readonly') return f.get ? f.get(r, s) : <Empty />
  const v = r[f.key]
  switch (f.kind) {
    case 'boolean': return v ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>
    case 'number': return v === '' || v == null ? <Empty /> : <span className="tabular-nums">{num(Number(v))}{f.suffix ? <span className="ml-1 text-slate-400">{f.suffix}</span> : null}</span>
    case 'select': return v ? optLabel(f.options!, v) : <Empty />
    case 'relation': {
      if (v == null) return <Empty />
      const label = relLabel(s, f.rel!, v)
      if (!label) return <Empty />
      if (isEntityKey(f.rel!)) return <a className="text-indigo-700 hover:underline" href={`#/${ENTITY_BY_KEY[f.rel!].route}/${v}`}>{label}</a>
      return label
    }
    case 'textarea': return v ? <span className="whitespace-pre-wrap">{v}</span> : <Empty />
    default: return v ? <span dir={f.rtl ? 'rtl' : undefined} className={f.mono ? 'font-mono text-[13px]' : undefined}>{v}</span> : <Empty />
  }
}

export function EntityDetail({ cfg, id }: { cfg: EntityConfig; id: number }) {
  const s = useProduct()
  const rec = (s[cfg.key] as Rec[]).find((r) => r.id === id)
  const actions = useRecordActions(cfg, () => navigate(`/${cfg.route}`))

  const back = (
    <a href={`#/${cfg.route}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> {cfg.title}
    </a>
  )
  if (!rec) {
    return (
      <div>
        {back}
        <Card><EmptyState title={`${cfg.singular} not found`} message="It may have been deleted." action={<Button onClick={() => navigate(`/${cfg.route}`)}>Back to {cfg.title}</Button>} /></Card>
      </div>
    )
  }

  const stats = cfg.stats?.(rec, s) ?? []
  return (
    <div>
      <PageHeader
        back={back}
        title={cfg.nameOf(rec, s)}
        subtitle={<><span className="font-mono text-xs">{cfg.model}</span> · ID {rec.id}</>}
        meta={<><StatusBadge active={rec.active} />{cfg.badges?.(rec, s).map((b) => <Badge key={b.label} tone={b.tone}>{b.label}</Badge>)}</>}
        actions={
          <>
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`/${cfg.route}/${rec.id}/edit`)}>Edit</Button>
            {rec.active
              ? <Button icon={<Archive className="h-4 w-4" />} onClick={() => actions.requestArchive(rec)}>Archive</Button>
              : <Button icon={<ArchiveRestore className="h-4 w-4" />} onClick={() => actions.restore(rec)}>Restore</Button>}
            <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => actions.requestDelete(rec)}>Delete</Button>
          </>
        }
      />
      {!rec.active && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          This {cfg.singular.toLowerCase()} is archived and hidden from selection lists. Restore it to use it again.
        </div>
      )}
      {stats.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((st) => (
            <div key={st.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-medium text-slate-500">{st.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{st.value}</p>
              {st.hint && <p className="mt-0.5 text-xs text-slate-400">{st.hint}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          {cfg.sections.map((sec) => {
            const fields = sec.fields.filter((f) => !f.formOnly && !(f.hideEmpty && (rec[f.key] === '' || rec[f.key] == null || rec[f.key] === false)))
            if (!fields.length) return null
            return (
              <Card key={sec.title} title={sec.title} description={sec.description}>
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.key} className={f.span === 2 || f.kind === 'textarea' ? 'sm:col-span-2' : undefined}>
                      <dt className="text-xs font-medium text-slate-500">{f.label}</dt>
                      <dd className="mt-0.5 break-words text-sm text-slate-900">{renderValue(f, rec, s)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )
          })}
        </div>
        {cfg.related && cfg.related.length > 0 && (
          <div className="min-w-0 space-y-5">
            {cfg.related.map((rel) => {
              const target = ENTITY_BY_KEY[rel.entity]
              const items = rel.items(rec, s)
              return (
                <Card
                  key={rel.title} title={`${rel.title} (${items.length})`}
                  actions={rel.addPath ? <Button className="h-8 px-2.5 text-xs" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate(rel.addPath!)}>Add</Button> : undefined}
                  bodyClassName="p-0"
                >
                  {items.length === 0 ? (
                    <p className="px-5 py-6 text-center text-sm text-slate-400">Nothing here yet.</p>
                  ) : (
                    <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                      {items.slice(0, 50).map((it) => (
                        <li key={it.id}>
                          <a href={`#/${target.route}/${it.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-slate-50">
                            <span className="min-w-0">
                              <span className={`block truncate font-medium ${it.active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{target.nameOf(it, s)}</span>
                              {rel.meta && <span className="block truncate text-xs text-slate-500">{rel.meta(it, s)}</span>}
                            </span>
                            {!it.active && <Badge>Archived</Badge>}
                          </a>
                        </li>
                      ))}
                      {items.length > 50 && <li className="px-5 py-2 text-xs text-slate-400">Showing first 50 of {items.length}.</li>}
                    </ul>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
      {actions.dialogs}
    </div>
  )
}
