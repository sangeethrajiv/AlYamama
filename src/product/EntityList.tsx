import { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ChevronsUpDown, Eye, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import type { EntityConfig } from './config'
import { useProduct } from './store'
import { navigate } from './router'
import { useRecordActions } from './useRecordActions'
import type { Rec } from './types'
import { Button, Card, cx, EmptyState, IconButton, PageHeader, Pagination, Segmented, StatusBadge } from './ui'

type Status = 'active' | 'archived' | 'all'
type ListState = { q: string; status: Status; filters: Record<string, string>; sort: { key: string; dir: 'asc' | 'desc' }; page: number; pageSize: number }
/** Keeps search / filters / sort when navigating to a record and back. */
const remembered = new Map<string, ListState>()

const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell', '2xl': 'hidden 2xl:table-cell' } as const

export function EntityList({ cfg }: { cfg: EntityConfig }) {
  const s = useProduct()
  const all = s[cfg.key] as Rec[]
  const [st, setSt] = useState<ListState>(() => remembered.get(cfg.key) ?? { q: '', status: 'active', filters: {}, sort: cfg.defaultSort, page: 1, pageSize: 10 })
  const [filtersOpen, setFiltersOpen] = useState(cfg.filters.length <= 4 || Object.values((remembered.get(cfg.key)?.filters) ?? {}).some(Boolean))
  useEffect(() => { remembered.set(cfg.key, st) }, [cfg.key, st])
  const patch = (p: Partial<ListState>) => setSt((cur) => ({ ...cur, page: 1, ...p }))
  const actions = useRecordActions(cfg)

  const rows = useMemo(() => {
    const tokens = st.q.toLowerCase().split(/\s+/).filter(Boolean)
    const col = cfg.columns.find((c) => c.key === st.sort.key)
    const out = all.filter((r) => {
      if (st.status === 'active' && !r.active) return false
      if (st.status === 'archived' && r.active) return false
      for (const f of cfg.filters) {
        const v = st.filters[f.key]
        if (v && !f.match(r, v, s)) return false
      }
      if (tokens.length) {
        const text = cfg.searchText(r, s).toLowerCase()
        if (!tokens.every((t) => text.includes(t))) return false
      }
      return true
    })
    if (col?.sort) {
      const dir = st.sort.dir === 'asc' ? 1 : -1
      out.sort((a, b) => {
        const x = col.sort!(a, s), y = col.sort!(b, s)
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * dir
      })
    }
    return out
  }, [all, s, st, cfg])

  const pages = Math.max(1, Math.ceil(rows.length / st.pageSize))
  const page = Math.min(st.page, pages)
  const visible = rows.slice((page - 1) * st.pageSize, page * st.pageSize)
  const activeFilters = cfg.filters.filter((f) => st.filters[f.key]).length
  const hasCriteria = !!st.q || activeFilters > 0
  const clear = () => patch({ q: '', filters: {} })
  const toggleSort = (key: string) =>
    setSt((c) => ({ ...c, page: 1, sort: c.sort.key === key ? { key, dir: c.sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' } }))
  const counts = { active: all.filter((r) => r.active).length, archived: all.filter((r) => !r.active).length }

  return (
    <div>
      <PageHeader
        title={cfg.title}
        subtitle={<>{cfg.subtitle} <span className="font-mono text-xs text-slate-400">{cfg.model}</span></>}
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/${cfg.route}/new`)}>New {cfg.singular}</Button>}
      />

      <Card className="overflow-hidden" bodyClassName="p-0">
        {/* Toolbar */}
        <div className="space-y-3 border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative max-w-md flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search" value={st.q} onChange={(e) => patch({ q: e.target.value })} placeholder={cfg.searchPlaceholder} aria-label={`Search ${cfg.title}`}
                  className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 [&::-webkit-search-cancel-button]:hidden"
                />
                {st.q && <button aria-label="Clear search" onClick={() => patch({ q: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}
              </div>
              {cfg.filters.length > 0 && (
                <Button icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
                  Filters{activeFilters > 0 && <span className="ml-0.5 rounded-full bg-indigo-600 px-1.5 text-[11px] text-white">{activeFilters}</span>}
                </Button>
              )}
            </div>
            <Segmented<Status>
              value={st.status} onChange={(status) => patch({ status })}
              options={[{ id: 'active', label: 'Active', count: counts.active }, { id: 'archived', label: 'Archived', count: counts.archived }, { id: 'all', label: 'All', count: all.length }]}
            />
          </div>
          {cfg.filters.length > 0 && (
            <div className={cx('grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5', filtersOpen ? 'grid' : 'hidden')}>
              {cfg.filters.map((f) => (
                <label key={f.key} className="block">
                  <span className="sr-only">{f.label}</span>
                  <select
                    value={st.filters[f.key] ?? ''} onChange={(e) => patch({ filters: { ...st.filters, [f.key]: e.target.value } })} aria-label={f.label}
                    className={cx('h-9 w-full rounded-lg border bg-white px-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30', st.filters[f.key] ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900' : 'border-slate-300 text-slate-600')}
                  >
                    <option value="">{f.label}: All</option>
                    {f.options(s).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}
          {hasCriteria && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{rows.length} result{rows.length === 1 ? '' : 's'}</span>
              <button onClick={clear} className="font-medium text-indigo-600 hover:underline">Clear search &amp; filters</button>
            </div>
          )}
        </div>

        {/* Table */}
        {visible.length === 0 ? (
          <EmptyState
            title={hasCriteria ? `No ${cfg.title.toLowerCase()} match your search` : st.status === 'archived' ? `No archived ${cfg.title.toLowerCase()}` : `No ${cfg.title.toLowerCase()} yet`}
            message={hasCriteria ? 'Try different keywords or clear the filters.' : undefined}
            action={hasCriteria ? <Button onClick={clear}>Clear search &amp; filters</Button> : st.status === 'active' ? <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/${cfg.route}/new`)}>New {cfg.singular}</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {cfg.columns.map((c) => {
                    const sorted = st.sort.key === c.key
                    return (
                      <th key={c.key} scope="col" aria-sort={sorted ? (st.sort.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cx('whitespace-nowrap px-3 py-2.5 font-semibold', c.align === 'right' && 'text-right', c.hide && HIDE[c.hide])}>
                        {c.sort ? (
                          <button onClick={() => toggleSort(c.key)} className={cx('inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900', sorted && 'text-slate-900', c.align === 'right' && 'flex-row-reverse')}>
                            {c.label}
                            {sorted ? (st.sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                        ) : c.label}
                      </th>
                    )
                  })}
                  <th scope="col" className="px-3 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/${cfg.route}/${r.id}`)} className={cx('group cursor-pointer hover:bg-indigo-50/40', !r.active && 'bg-slate-50/60 text-slate-500')}>
                    {cfg.columns.map((c) => (
                      <td key={c.key} className={cx('px-3 py-3 align-middle', c.primary ? 'min-w-[200px]' : !c.wrap && 'whitespace-nowrap', c.align === 'right' && 'text-right tabular-nums', c.hide && HIDE[c.hide])}>
                        {c.primary ? (
                          <a href={`#/${cfg.route}/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">{c.render(r, s)}</a>
                        ) : c.render(r, s)}
                      </td>
                    ))}
                    <td className="px-3 py-3"><StatusBadge active={r.active} /></td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconButton label={`View ${cfg.nameOf(r, s)}`} onClick={() => navigate(`/${cfg.route}/${r.id}`)}><Eye className="h-4 w-4" /></IconButton>
                        <IconButton label={`Edit ${cfg.nameOf(r, s)}`} onClick={() => navigate(`/${cfg.route}/${r.id}/edit`)}><Pencil className="h-4 w-4" /></IconButton>
                        {r.active
                          ? <IconButton label={`Archive ${cfg.nameOf(r, s)}`} onClick={() => actions.requestArchive(r)}><Archive className="h-4 w-4" /></IconButton>
                          : <IconButton label={`Restore ${cfg.nameOf(r, s)}`} onClick={() => actions.restore(r)}><ArchiveRestore className="h-4 w-4" /></IconButton>}
                        <IconButton label={`Delete ${cfg.nameOf(r, s)}`} tone="danger" onClick={() => actions.requestDelete(r)}><Trash2 className="h-4 w-4" /></IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && <Pagination page={page} pageSize={st.pageSize} total={rows.length} onPage={(p) => setSt((c) => ({ ...c, page: p }))} onPageSize={(n) => patch({ pageSize: n })} />}
      </Card>
      {actions.dialogs}
    </div>
  )
}
