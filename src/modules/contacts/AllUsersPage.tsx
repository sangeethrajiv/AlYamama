import { useEffect, useMemo, useState } from 'react'
import { Columns3, ArrowUpDown, Check } from 'lucide-react'
import { PageHeader, SearchBox, Segmented, Kpi, Pill, Table, EmptyState, Avatar } from '../shared/ui'
import { useUsers } from './usersStore'
import type { ResUser } from './usersTypes'
import { COMPANIES } from './usersLookups'
import { NOTIFICATION_TYPES, SIDEBAR_TYPES, CHATTER_POSITIONS, ODOOBOT_STATES, labelOf, companyName, countryName, stateName, titleName, teamName, userName } from './usersOptions'
import UserDetailPage from './UserDetailPage'

/** All Users — list of res.users (joined to res.partner). Display only; Odoo is the source of the fields, not of the layout. */
type Group = 'Identity' | 'Company' | 'Contact' | 'Address' | 'Access' | 'Preferences' | 'Sales & Helpdesk' | 'Other' | 'Audit'
interface Col {
  key: string; label: string; group: Group; on?: boolean; right?: boolean
  val: (u: ResUser) => string | number | boolean | undefined
  cell?: (u: ResUser) => React.ReactNode
}
const yes = (v?: boolean) => (v ? 'Yes' : '')
const num = (v?: number) => (v === undefined ? '' : v)

const COLS: Col[] = [
  { key: 'id', label: 'ID', group: 'Identity', right: true, val: u => u.id },
  { key: 'name', label: 'Name', group: 'Identity', on: true, val: u => u.name, cell: u => (
    <div className="flex items-center gap-2.5 min-w-[180px]"><Avatar name={u.name} size={28} round /><span className="font-bold text-slate-900">{u.name}</span></div>) },
  { key: 'login', label: 'Login', group: 'Identity', on: true, val: u => u.login },
  { key: 'active', label: 'Status', group: 'Identity', on: true, val: u => (u.active ? 'Active' : 'Archived'), cell: u => <Pill tone={u.active ? 'green' : 'slate'}>{u.active ? 'Active' : 'Archived'}</Pill> },
  { key: 'share', label: 'User Type', group: 'Identity', on: true, val: u => (u.share ? 'Portal / Public' : 'Internal'), cell: u => <Pill tone={u.share ? 'amber' : 'blue'}>{u.share ? 'Portal / Public' : 'Internal'}</Pill> },

  { key: 'company_id', label: 'Company', group: 'Company', on: true, val: u => companyName(u.company_id) },
  { key: 'company_ids', label: 'Allowed Companies', group: 'Company', val: u => u.company_ids.map(companyName).join(', ') },
  { key: 'parent_id', label: 'Related Company', group: 'Company', val: u => (u.parent_id ? `#${u.parent_id}` : '') },

  { key: 'email', label: 'Email', group: 'Contact', on: true, val: u => u.email },
  { key: 'phone', label: 'Phone', group: 'Contact', val: u => u.phone },
  { key: 'mobile', label: 'Mobile', group: 'Contact', val: u => u.mobile },
  { key: 'function', label: 'Job Position', group: 'Contact', val: u => u.function },
  { key: 'title', label: 'Title', group: 'Contact', val: u => titleName(u.title) },
  { key: 'lang', label: 'Language', group: 'Contact', on: true, val: u => u.lang },
  { key: 'tz', label: 'Timezone', group: 'Contact', val: u => u.tz },
  { key: 'website', label: 'Website', group: 'Contact', val: u => u.website },
  { key: 'vat', label: 'Tax ID', group: 'Contact', val: u => u.vat },
  { key: 'ref', label: 'Internal Reference', group: 'Contact', val: u => u.ref },
  { key: 'arabic_name', label: 'Arabic Name', group: 'Contact', val: u => u.arabic_name },
  { key: 'extension_number', label: 'Extension Number', group: 'Contact', val: u => u.extension_number },

  { key: 'street', label: 'Street', group: 'Address', val: u => u.street },
  { key: 'street2', label: 'Street 2', group: 'Address', val: u => u.street2 },
  { key: 'city', label: 'City', group: 'Address', val: u => u.city },
  { key: 'state_id', label: 'State', group: 'Address', val: u => stateName(u.state_id) },
  { key: 'zip', label: 'ZIP', group: 'Address', val: u => u.zip },
  { key: 'country_id', label: 'Country', group: 'Address', val: u => countryName(u.country_id) },

  { key: 'login_date', label: 'Latest Authentication', group: 'Access', on: true, val: u => u.login_date },
  { key: 'groups', label: 'Access Groups', group: 'Access', on: true, right: true, val: u => u.groups.length },
  { key: 'emp', label: 'Employee', group: 'Access', on: true, val: u => u.emp?.name },
  { key: 'employee', label: 'Partner is Employee', group: 'Access', val: u => yes(u.employee) },
  { key: 'signup_type', label: 'Signup Token Type', group: 'Access', val: u => u.signup_type },

  { key: 'notification_type', label: 'Notification Management', group: 'Preferences', val: u => labelOf(NOTIFICATION_TYPES, u.notification_type) },
  { key: 'sidebar_type', label: 'Sidebar Type', group: 'Preferences', val: u => labelOf(SIDEBAR_TYPES, u.sidebar_type) },
  { key: 'chatter_position', label: 'Chatter Position', group: 'Preferences', val: u => labelOf(CHATTER_POSITIONS, u.chatter_position) },
  { key: 'odoobot_state', label: 'OdooBot Status', group: 'Preferences', val: u => labelOf(ODOOBOT_STATES, u.odoobot_state) },
  { key: 'action_id', label: 'Home Action', group: 'Preferences', val: u => (u.action_id ? `#${u.action_id}` : '') },
  { key: 'signature', label: 'Email Signature', group: 'Preferences', val: u => u.signature },

  { key: 'sale_team_id', label: 'Sales Team', group: 'Sales & Helpdesk', val: u => teamName(u.sale_team_id) },
  { key: 'target_sales_won', label: 'Won in Opportunities Target', group: 'Sales & Helpdesk', right: true, val: u => num(u.target_sales_won) },
  { key: 'target_sales_done', label: 'Activities Done Target', group: 'Sales & Helpdesk', right: true, val: u => num(u.target_sales_done) },
  { key: 'target_sales_invoiced', label: 'Invoiced in Sales Orders Target', group: 'Sales & Helpdesk', right: true, val: u => num(u.target_sales_invoiced) },
  { key: 'helpdesk_target_closed', label: 'Target Tickets to Close', group: 'Sales & Helpdesk', right: true, val: u => num(u.helpdesk_target_closed) },
  { key: 'helpdesk_target_rating', label: 'Target Customer Rating', group: 'Sales & Helpdesk', right: true, val: u => num(u.helpdesk_target_rating) },
  { key: 'helpdesk_target_success', label: 'Target Success Rate', group: 'Sales & Helpdesk', right: true, val: u => num(u.helpdesk_target_success) },

  { key: 'is_gcc_user', label: 'GCC User', group: 'Other', val: u => yes(u.is_gcc_user) },
  { key: 'pseudo_name', label: 'Pseudo Name', group: 'Other', val: u => u.pseudo_name },
  { key: 'website_id', label: 'Website (Multi-website)', group: 'Other', val: u => (u.website_id ? `#${u.website_id}` : '') },
  { key: 'comment', label: 'Internal Notes', group: 'Other', val: u => u.comment },

  { key: 'create_date', label: 'Created on', group: 'Audit', val: u => u.create_date },
  { key: 'create_uid', label: 'Created by', group: 'Audit', val: u => userName(u.create_uid) },
  { key: 'write_date', label: 'Last Updated on', group: 'Audit', val: u => u.write_date },
  { key: 'write_uid', label: 'Last Updated by', group: 'Audit', val: u => userName(u.write_uid) },
]
const GROUPS: Group[] = ['Identity', 'Company', 'Contact', 'Address', 'Access', 'Preferences', 'Sales & Helpdesk', 'Other', 'Audit']

type Filter = 'active' | 'archived' | 'internal' | 'portal' | 'all'

const idFromHash = () => { const m = window.location.hash.match(/^#\/contacts\/(\d+)/); return m ? Number(m[1]) : 0 }

export default function AllUsersPage({ searchQuery }: { searchQuery: string }) {
  // The open user lives in the URL (#/contacts/<id>) so a refresh or back button stays on it.
  const RES_USERS = useUsers()
  const [openId, setOpenId] = useState(idFromHash)
  useEffect(() => {
    const on = () => setOpenId(idFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const open = (id: number) => { window.location.hash = id ? `#/contacts/${id}` : '#/contacts' }
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('active')
  const [company, setCompany] = useState(0)
  const [shown, setShown] = useState<Set<string>>(() => new Set(COLS.filter(c => c.on).map(c => c.key)))
  const [pick, setPick] = useState(false)
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'name', dir: 1 })

  const count = (f: (u: ResUser) => boolean) => RES_USERS.filter(f).length
  const rows = useMemo(() => {
    const term = (q || searchQuery).trim().toLowerCase()
    const col = COLS.find(c => c.key === sort.key) ?? COLS[1]
    return RES_USERS.filter(u =>
      (filter === 'all' || (filter === 'active' ? u.active : filter === 'archived' ? !u.active : filter === 'portal' ? !!u.share : !u.share)) &&
      (!company || u.company_id === company) &&
      (!term || [u.name, u.login, u.email, u.phone, u.mobile].some(v => v?.toLowerCase().includes(term))),
    ).sort((a, b) => {
      const x = col.val(a) ?? '', y = col.val(b) ?? ''
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir
    })
  }, [RES_USERS, q, searchQuery, filter, company, sort])

  const openUser = openId ? RES_USERS.find(u => u.id === openId) : undefined
  const visible = COLS.filter(c => shown.has(c.key))
  const companyIds = COMPANIES.filter(c => RES_USERS.some(u => u.company_id === c.id))
  const toggle = (k: string) => setShown(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  if (openUser) return <UserDetailPage key={openUser.id} user={openUser} ids={rows.map(r => r.id)} onOpen={open} />

  return (
    <div className="space-y-4">
      <PageHeader title="All Users" subtitle="Every login account (res.users) with its linked partner record" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Total users" value={RES_USERS.length} />
        <Kpi label="Active" value={count(u => u.active)} />
        <Kpi label="Archived" value={count(u => !u.active)} />
        <Kpi label="Portal / Public" value={count(u => !!u.share)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Filter> value={filter} onChange={setFilter} options={[
          { id: 'active', label: 'Active', count: count(u => u.active) },
          { id: 'archived', label: 'Archived', count: count(u => !u.active) },
          { id: 'internal', label: 'Internal', count: count(u => !u.share) },
          { id: 'portal', label: 'Portal / Public', count: count(u => !!u.share) },
          { id: 'all', label: 'All', count: RES_USERS.length },
        ]} />
        <select aria-label="Company" value={company} onChange={e => setCompany(Number(e.target.value))}
          className="w-auto bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600">
          <option value={0}>All companies</option>
          {companyIds.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <select aria-label="Sort by" value={sort.key} onChange={e => setSort(s => ({ ...s, key: e.target.value }))}
            className="w-auto bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600">
            {COLS.map(c => <option key={c.key} value={c.key}>Sort: {c.label}</option>)}
          </select>
          <button onClick={() => setSort(s => ({ ...s, dir: s.dir === 1 ? -1 : 1 }))} aria-label="Toggle sort direction" title={sort.dir === 1 ? 'Ascending' : 'Descending'}
            className="p-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"><ArrowUpDown size={14} /></button>
        </div>
        <div className="ml-auto flex items-center gap-2 relative">
          <SearchBox value={q} onChange={setQ} placeholder="Search name, login, email…" />
          <button onClick={() => setPick(p => !p)} aria-expanded={pick}
            className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
            <Columns3 size={14} /> Columns ({visible.length}/{COLS.length})
          </button>
          {pick && (
            <div className="absolute right-0 top-full mt-1 z-20 w-72 max-h-[60vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-3">
              {GROUPS.map(g => (
                <div key={g}>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{g}</div>
                  {COLS.filter(c => c.group === g).map(c => (
                    <label key={c.key} className="flex items-center gap-2 py-0.5 text-xs text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={shown.has(c.key)} onChange={() => toggle(c.key)} className="accent-emerald-600" />
                      <span className="flex-1">{c.label}</span>
                      {shown.has(c.key) && <Check size={12} className="text-emerald-600" />}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Table
        head={visible.map(c => ({ label: c.label, right: c.right }))}
        empty={rows.length === 0 ? <EmptyState title="No users match" text="Change the filter or search." /> : undefined}
      >
        {rows.map(u => (
          <tr key={u.id} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') open(u.id) }} onClick={() => open(u.id)} className={`cursor-pointer hover:bg-emerald-50/40 ${u.active ? '' : 'text-slate-400'}`}>
            {visible.map(c => {
              const v = c.val(u)
              return <td key={c.key} className={`px-3 py-2.5 whitespace-nowrap ${c.right ? 'text-right tabular-nums' : ''}`}>
                {c.cell ? c.cell(u) : v === undefined || v === '' ? <span className="text-slate-300">—</span> : String(v)}
              </td>
            })}
          </tr>
        ))}
      </Table>
    </div>
  )
}
