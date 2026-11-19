import { useMemo, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArchiveRestore, Archive, Check, Columns3, Eye, Filter, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Avatar, EmptyState, GhostButton, Kpi, PageHeader, Pill, PrimaryButton, SearchBox, inputCls } from '../shared/ui'
import { Pagination } from './parts'
import { DEFAULT_FILTERS, activeChips, applyFilters, type Filters, type Tri } from './filters'
import { COUNTRIES, PARTNER_TYPES, countryName, stateName, typeLabel, companyName, schemeName, tagNames } from './options'
import type { ResPartner } from './types'

/** Contacts list: search, advanced filters, sortable/selectable columns, pagination and row actions. */
export interface SortState { key: keyof ResPartner; dir: 1 | -1 }
export interface ListState {
  q: string
  draft: Filters
  applied: Filters
  sort: SortState
  page: number
  size: number
  panel: boolean
  picker: boolean
  cols: string[]
}
export const initialListState = (): ListState => ({
  q: '', draft: DEFAULT_FILTERS, applied: DEFAULT_FILTERS, sort: { key: 'name', dir: 1 }, page: 1, size: 10, panel: false, picker: false,
  cols: ['name', 'is_company', 'email', 'phone', 'customer', 'supplier', 'employee', 'active'],
})

type Lookup = Map<number, ResPartner>
interface Col {
  key: keyof ResPartner; label: string
  val: (c: ResPartner, by: Lookup) => string | number | boolean
  cell?: (c: ResPartner, by: Lookup) => ReactNode
}
const yes = (v: boolean) => (v ? <Pill tone="green">Yes</Pill> : <span className="text-slate-300">—</span>)
const refName = (id: number | null, by: Lookup) => (id == null ? '' : by.get(id)?.display_name ?? `#${id}`)

const COLS: Col[] = [
  { key: 'id', label: 'ID', val: c => c.id },
  { key: 'name', label: 'Name', val: c => c.name, cell: c => (
    <div className="flex items-center gap-2.5 min-w-[180px]"><Avatar name={c.name} size={28} round={!c.is_company} /><span className="font-bold text-slate-900">{c.name}</span></div>) },
  { key: 'display_name', label: 'Display Name', val: c => c.display_name },
  { key: 'is_company', label: 'Is a Company', val: c => (c.is_company ? 'Company' : 'Individual'), cell: c => <Pill tone={c.is_company ? 'blue' : 'slate'}>{c.is_company ? 'Company' : 'Individual'}</Pill> },
  { key: 'type', label: 'Address Type', val: c => typeLabel(c.type) },
  { key: 'email', label: 'Email', val: c => c.email },
  { key: 'phone', label: 'Phone', val: c => c.phone },
  { key: 'mobile', label: 'Mobile', val: c => c.mobile },
  { key: 'street', label: 'Street', val: c => c.street },
  { key: 'street2', label: 'Street 2', val: c => c.street2 },
  { key: 'city', label: 'City', val: c => c.city },
  { key: 'state_id', label: 'State', val: c => stateName(c.state_id) },
  { key: 'zip', label: 'ZIP', val: c => c.zip },
  { key: 'country_id', label: 'Country', val: c => countryName(c.country_id) },
  { key: 'parent_id', label: 'Related Company', val: (c, by) => refName(c.parent_id, by) },
  { key: 'commercial_partner_id', label: 'Commercial Entity', val: (c, by) => refName(c.commercial_partner_id, by) },
  { key: 'customer', label: 'Customer', val: c => c.customer, cell: c => yes(c.customer) },
  { key: 'supplier', label: 'Supplier', val: c => c.supplier, cell: c => yes(c.supplier) },
  { key: 'employee', label: 'Employee', val: c => c.employee, cell: c => yes(c.employee) },
  { key: 'active', label: 'Status', val: c => (c.active ? 'Active' : 'Archived'), cell: c => <Pill tone={c.active ? 'green' : 'slate'}>{c.active ? 'Active' : 'Archived'}</Pill> },
  { key: 'vat', label: 'Tax ID', val: c => c.vat },
  { key: 'website', label: 'Website', val: c => c.website },
  { key: 'company_id', label: 'Company', val: c => companyName(c.company_id) },
  { key: 'arabic_name', label: 'Arabic Name', val: c => c.arabic_name },
  { key: 'fax', label: 'Fax', val: c => c.fax },
  { key: 'category_id', label: 'Tags', val: c => tagNames(c.category_id).join(', ') },
  { key: 'arabic_street2_name', label: 'Arabic Street 2', val: c => c.arabic_street2_name },
  { key: 'arabic_city_name', label: 'Arabic City', val: c => c.arabic_city_name },
  { key: 'l10n_sa_edi_building_number', label: 'Building Number', val: c => c.l10n_sa_edi_building_number },
  { key: 'l10n_sa_edi_plot_identification', label: 'Plot Identification', val: c => c.l10n_sa_edi_plot_identification },
  { key: 'l10n_sa_registered_name', label: 'ZATCA Registered Name', val: c => c.l10n_sa_registered_name },
  { key: 'l10n_sa_additional_identification_scheme', label: 'Identification Scheme', val: c => schemeName(c.l10n_sa_additional_identification_scheme) },
  { key: 'l10n_sa_additional_identification_number', label: 'Identification Number (SA)', val: c => c.l10n_sa_additional_identification_number },
  { key: 'vat_arabic', label: 'Tax ID Arabic', val: c => c.vat_arabic },
  { key: 'cr_number', label: 'CR Number', val: c => c.cr_number },
  { key: 'cash_customer', label: 'Cash Customer', val: c => c.cash_customer, cell: c => yes(c.cash_customer) },
  { key: 'customer_discount', label: 'Customer Discount %', val: c => c.customer_discount },
  { key: 'discount', label: 'Discount (%)', val: c => c.discount },
  { key: 'customer_code', label: 'Customer Code', val: c => c.customer_code },
  { key: 'vandor_number', label: 'Vendor No', val: c => c.vandor_number },
  { key: 'company_name_code', label: 'Company Code', val: c => c.company_name_code },
  { key: 'ext_res_id', label: 'Girfalco ID', val: c => c.ext_res_id ?? '' },
]

const selCls = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600'
const triOpts = (
  <>
    <option value="any">Any</option><option value="yes">Yes</option><option value="no">No</option>
  </>
)

interface Props {
  partners: ResPartner[]
  searchQuery: string
  readOnly: boolean
  loading: boolean
  ls: ListState
  patch: (p: Partial<ListState>) => void
  onOpen: (id: number) => void
  onAdd: () => void
  onEdit: (c: ResPartner) => void
  onArchive: (c: ResPartner) => void
  onRestore: (c: ResPartner) => void
  onDelete: (c: ResPartner) => void
}

export default function ContactListPage({ partners, searchQuery, readOnly, loading, ls, patch, onOpen, onAdd, onEdit, onArchive, onRestore, onDelete }: Props) {
  const by = useMemo<Lookup>(() => new Map(partners.map(c => [c.id, c])), [partners])
  const term = ls.q.trim() || searchQuery
  const rows = useMemo(() => {
    const col = COLS.find(c => c.key === ls.sort.key) ?? COLS[1]
    return applyFilters(partners, ls.applied, term).sort((a, b) => {
      const x = col.val(a, by), y = col.val(b, by)
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : typeof x === 'boolean' && typeof y === 'boolean' ? Number(x) - Number(y) : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })
      return (r || a.id - b.id) * ls.sort.dir
    })
  }, [partners, ls.applied, ls.sort, term, by])

  const pages = Math.max(1, Math.ceil(rows.length / ls.size))
  const page = Math.min(ls.page, pages)
  const pageRows = rows.slice((page - 1) * ls.size, page * ls.size)
  const visible = COLS.filter(c => ls.cols.includes(c.key))
  const chips = activeChips(ls.applied)
  const draftChanged = JSON.stringify(ls.draft) !== JSON.stringify(ls.applied)
  const draftCount = useMemo(() => (ls.panel ? applyFilters(partners, ls.draft, term).length : 0), [ls.panel, ls.draft, partners, term])
  const filtered = chips.length > 0 || !!term

  const setDraft = (p: Partial<Filters>) => patch({ draft: { ...ls.draft, ...p } })
  const apply = () => patch({ applied: ls.draft, page: 1 })
  const clear = () => patch({ draft: DEFAULT_FILTERS, applied: DEFAULT_FILTERS, q: '', page: 1 })
  const removeChip = (k: keyof Filters) => { const n = { ...ls.applied, [k]: DEFAULT_FILTERS[k] }; patch({ applied: n, draft: { ...ls.draft, [k]: DEFAULT_FILTERS[k] }, page: 1 }) }
  const toggleCol = (k: string) => patch({ cols: ls.cols.includes(k) ? ls.cols.filter(x => x !== k) : [...ls.cols, k] })
  const sortBy = (key: keyof ResPartner) => patch({ sort: { key, dir: ls.sort.key === key ? (ls.sort.dir === 1 ? -1 : 1) : 1 }, page: 1 })

  const active = partners.filter(c => c.active).length

  return (
    <div className="space-y-4">
      <PageHeader title="Contacts" subtitle={`${partners.length} contacts in total · ${active} active`}
        actions={!readOnly && <PrimaryButton onClick={onAdd}><Plus size={14} /> Add Contact</PrimaryButton>} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Total contacts" value={partners.length} />
        <Kpi label="Active" value={active} />
        <Kpi label="Archived" value={partners.length - active} />
        <Kpi label="Companies" value={partners.filter(c => c.is_company).length} hint={`${partners.filter(c => !c.is_company).length} individuals`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={ls.q} onChange={q => patch({ q, page: 1 })} placeholder="Search name, email, phone, city…" />
        <button onClick={() => patch({ panel: !ls.panel })} aria-expanded={ls.panel}
          className={`px-3 py-2 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${ls.panel || chips.length ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
          <Filter size={14} /> Filters
          {chips.length > 0 && <span className="text-[10px] bg-emerald-600 text-white rounded-full px-1.5 font-mono">{chips.length}</span>}
        </button>
        <div className="ml-auto relative">
          <button onClick={() => patch({ picker: !ls.picker })} aria-expanded={ls.picker}
            className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <Columns3 size={14} /> Columns ({visible.length}/{COLS.length})
          </button>
          {ls.picker && (
            <div className="absolute right-0 top-full mt-1 z-20 w-64 max-h-[60vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-3">
              {COLS.map(c => (
                <label key={c.key} className="flex items-center gap-2 py-0.5 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={ls.cols.includes(c.key)} disabled={c.key === 'name'} onChange={() => toggleCol(c.key)} className="accent-emerald-600" />
                  <span className="flex-1">{c.label}</span>
                  {ls.cols.includes(c.key) && <Check size={12} className="text-emerald-600" />}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {ls.panel && (
        <form onSubmit={e => { e.preventDefault(); apply() }} aria-label="Advanced filters" className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label><span className="block font-bold text-slate-600 mb-1">Contact name</span><input className={inputCls} value={ls.draft.name} onChange={e => setDraft({ name: e.target.value })} placeholder="e.g. Faisal" /></label>
            <label><span className="block font-bold text-slate-600 mb-1">Email</span><input className={inputCls} value={ls.draft.email} onChange={e => setDraft({ email: e.target.value })} placeholder="e.g. @gulfpetrochem" /></label>
            <label><span className="block font-bold text-slate-600 mb-1">Phone / Mobile</span><input className={inputCls} value={ls.draft.phone} onChange={e => setDraft({ phone: e.target.value })} placeholder="e.g. +966 13" /></label>
            <label><span className="block font-bold text-slate-600 mb-1">Individual / Company</span>
              <select className={selCls} value={ls.draft.kind} onChange={e => setDraft({ kind: e.target.value as Filters['kind'] })}>
                <option value="all">All</option><option value="individual">Individual</option><option value="company">Company</option>
              </select></label>
            <label><span className="block font-bold text-slate-600 mb-1">Contact type</span>
              <select className={selCls} value={ls.draft.type} onChange={e => setDraft({ type: e.target.value as Filters['type'] })}>
                <option value="">All types</option>{PARTNER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select></label>
            <label><span className="block font-bold text-slate-600 mb-1">Customer</span>
              <select className={selCls} value={ls.draft.customer} onChange={e => setDraft({ customer: e.target.value as Tri })}>{triOpts}</select></label>
            <label><span className="block font-bold text-slate-600 mb-1">Supplier</span>
              <select className={selCls} value={ls.draft.supplier} onChange={e => setDraft({ supplier: e.target.value as Tri })}>{triOpts}</select></label>
            <label><span className="block font-bold text-slate-600 mb-1">Employee</span>
              <select className={selCls} value={ls.draft.employee} onChange={e => setDraft({ employee: e.target.value as Tri })}>{triOpts}</select></label>
            <label><span className="block font-bold text-slate-600 mb-1">Active / Archived</span>
              <select className={selCls} value={ls.draft.status} onChange={e => setDraft({ status: e.target.value as Filters['status'] })}>
                <option value="active">Active</option><option value="archived">Archived</option><option value="all">Active & archived</option>
              </select></label>
            <label><span className="block font-bold text-slate-600 mb-1">Country</span>
              <select className={selCls} value={ls.draft.country_id} onChange={e => setDraft({ country_id: Number(e.target.value) })}>
                <option value={0}>All countries</option>{COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></label>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <PrimaryButton onClick={apply}>Apply Filters</PrimaryButton>
            <GhostButton onClick={clear}>Clear Filters</GhostButton>
            <span className="text-xs text-slate-500 ml-1" aria-live="polite">
              {draftChanged ? <>{draftCount} contact{draftCount === 1 ? '' : 's'} would match · apply to update the list</> : 'Filters applied'}
            </span>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs" aria-live="polite">
        <span className="font-bold text-slate-700" data-testid="result-count">{rows.length} of {partners.length} contacts{chips.length === 0 && !term ? ' (active only)' : ''}</span>
        {chips.map(c => (
          <span key={c.key} className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full pl-2.5 pr-1 py-0.5 font-bold">
            {c.label}
            <button onClick={() => removeChip(c.key)} aria-label={`Remove filter ${c.label}`} className="p-0.5 rounded-full hover:bg-emerald-100"><X size={11} /></button>
          </span>
        ))}
        {term && (
          <span className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-800 rounded-full pl-2.5 pr-1 py-0.5 font-bold">
            Search: {term}
            <button onClick={() => patch({ q: '' })} aria-label="Clear search" className="p-0.5 rounded-full hover:bg-sky-100"><X size={11} /></button>
          </span>
        )}
        {filtered && <button onClick={clear} className="font-bold text-emerald-700 hover:underline">Clear all</button>}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs" aria-busy={loading}>
          <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wide">
            <tr>
              {visible.map(c => (
                <th key={c.key} scope="col" aria-sort={ls.sort.key === c.key ? (ls.sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className="px-3 py-2.5 font-bold text-left whitespace-nowrap">
                  <button onClick={() => sortBy(c.key)} className={`inline-flex items-center gap-1 uppercase tracking-wide font-bold hover:text-slate-900 ${ls.sort.key === c.key ? 'text-emerald-700' : ''}`}>
                    {c.label}
                    {ls.sort.key === c.key && (ls.sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </button>
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 font-bold text-right sticky right-0 bg-slate-50">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 8 }, (_, i) => (
                <tr key={i} aria-hidden="true">
                  {visible.concat(visible[0]).map((c, j) => <td key={j} className="px-3 py-3"><div className={`h-3 rounded bg-slate-100 animate-pulse ${j === 0 ? 'w-36' : 'w-16'}`} /></td>)}
                </tr>
              ))
              : pageRows.map(c => (
                <tr key={c.id} tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={e => { if (e.key === 'Enter') onOpen(c.id) }}
                  className={`group cursor-pointer hover:bg-emerald-50/40 ${c.active ? '' : 'text-slate-400'}`}>
                  {visible.map(col => {
                    const v = col.val(c, by)
                    return <td key={col.key} className="px-3 py-2.5 whitespace-nowrap">
                      {col.cell ? col.cell(c, by) : v === '' ? <span className="text-slate-300">—</span> : String(v)}
                    </td>
                  })}
                  <td className="px-3 py-1.5 whitespace-nowrap text-right sticky right-0 bg-white group-hover:bg-emerald-50" onClick={e => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5">
                      <RowBtn label={`View ${c.name}`} onClick={() => onOpen(c.id)}><Eye size={14} /></RowBtn>
                      {!readOnly && <RowBtn label={`Edit ${c.name}`} onClick={() => onEdit(c)}><Pencil size={14} /></RowBtn>}
                      {!readOnly && (c.active
                        ? <RowBtn label={`Archive ${c.name}`} onClick={() => onArchive(c)}><Archive size={14} /></RowBtn>
                        : <RowBtn label={`Restore ${c.name}`} onClick={() => onRestore(c)}><ArchiveRestore size={14} /></RowBtn>)}
                      {!readOnly && <RowBtn label={`Delete ${c.name}`} danger onClick={() => onDelete(c)}><Trash2 size={14} /></RowBtn>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {loading && <div role="status" className="py-3 text-center text-xs text-slate-500">Loading contacts…</div>}
        {!loading && rows.length === 0 && (
          partners.length === 0
            ? <div><EmptyState title="No contacts yet" text="Create your first contact to get started." />{!readOnly && <div className="pb-6 text-center"><PrimaryButton onClick={onAdd}><Plus size={14} /> Add Contact</PrimaryButton></div>}</div>
            : <div><EmptyState title="No contacts match" text="Change the search or filters to see more contacts." /><div className="pb-6 text-center"><GhostButton onClick={clear}>Clear Filters</GhostButton></div></div>
        )}
      </div>

      {!loading && rows.length > 0 && <Pagination page={page} pages={pages} total={rows.length} size={ls.size} onPage={p => patch({ page: p })} onSize={n => patch({ size: n, page: 1 })} />}
    </div>
  )
}

function RowBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={`p-1.5 rounded-lg transition ${danger ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'}`}>{children}</button>
  )
}
