import { useMemo, useState } from 'react'
import { Plus, List, LayoutGrid, ArrowUp, ArrowDown, Mail, Phone, Building2 } from 'lucide-react'
import type { Invoice, Bill, UserRole, TabId } from '../../types/accounting'
import type { ContactsApi } from './useContacts'
import type { Contact } from './types'
import ContactDrawer from './ContactDrawer'
import { moneyFormat } from '../../data/mockAccountingData'
import { PageHeader, PrimaryButton, Segmented, SearchBox, Pill, EmptyState, Avatar } from '../shared/ui'

type Section = 'all' | 'customers' | 'vendors' | 'employees' | 'logins' | 'other' | 'archived'
type Filter = 'all' | 'both' | 'companies' | 'individuals'
const SECTION_OF: Partial<Record<TabId, Section>> = { usr_customers: 'customers', usr_vendors: 'vendors', usr_employees: 'employees', usr_logins: 'logins', usr_other: 'other', usr_archived: 'archived' }
const SECTION_INFO: Record<Section, { title: string; sub: string }> = {
  all: { title: 'All Users', sub: 'Customers, vendors and contacts. Staff, logins and special records are under their own menus.' },
  customers: { title: 'Customers', sub: 'Everyone you invoice.' },
  vendors: { title: 'Vendors', sub: 'Everyone who bills you.' },
  employees: { title: 'Employees', sub: 'Staff, used for payroll and expense payments.' },
  logins: { title: 'System Users', sub: 'People who can sign in to this system.' },
  other: { title: 'Company & Banks', sub: 'Your own company record, banks and other special records.' },
  archived: { title: 'Archived', sub: 'Users that were archived. Open one to review it.' },
}
/** Business partners: customers, vendors and plain contacts. Staff, logins and special records are kept out of the default list. */
const isBusiness = (c: Contact) => c.isCustomer || c.isVendor || (!c.isEmployee && !c.isLogin && !c.otherKind)
const OTHER_LABEL = { own_company: 'Our company', bank: 'Bank', other: 'Other' } as const
type SortKey = 'name' | 'phone' | 'email'

interface Props {
  tab: TabId
  api: ContactsApi
  invoices: Invoice[]
  bills: Bill[]
  currentRole: UserRole
  searchQuery: string
  onCreateInvoice: (partner: string) => void
  onOpenInvoice: (inv: Invoice) => void
  onCreateBill: () => void
}

export default function ContactsModule({ tab, api, invoices, bills, currentRole, searchQuery, onCreateInvoice, onOpenInvoice, onCreateBill }: Props) {
  const { contacts, saveContact, archiveContact } = api
  const section: Section = SECTION_OF[tab] ?? 'all'
  const info = SECTION_INFO[section]
  const [filter, setFilter] = useState<Filter>('all')
  const [local, setLocal] = useState('')
  const [view, setView] = useState<'list' | 'cards'>('list')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 })
  const [open, setOpen] = useState<{ contact?: Contact } | null>(null)
  const readOnly = currentRole === 'Auditor'

  const q = (local || searchQuery).trim().toLowerCase()
  const inSection = (c: Contact): boolean => {
    if (section === 'archived') return !c.active
    if (!c.active) return false
    switch (section) {
      case 'customers': return c.isCustomer
      case 'vendors': return c.isVendor
      case 'employees': return !!c.isEmployee
      case 'logins': return !!c.isLogin
      case 'other': return !!c.otherKind
      default: return isBusiness(c)
    }
  }
  const scoped = contacts.filter(inSection)
  const counts = {
    all: scoped.length,
    both: scoped.filter(c => c.isCustomer && c.isVendor).length,
    companies: scoped.filter(c => c.kind === 'company').length,
    individuals: scoped.filter(c => c.kind === 'individual').length,
  }
  const phoneOf = (c: Contact) => c.phone || c.mobile

  const rows = useMemo(() => {
    const list = scoped.filter(c => {
      if (filter === 'both' && !(c.isCustomer && c.isVendor)) return false
      if (filter === 'companies' && c.kind !== 'company') return false
      if (filter === 'individuals' && c.kind !== 'individual') return false
      return !q || [c.name, c.email, c.phone, c.mobile, c.vat, c.crNumber, c.customerCode, ...c.tags].some(v => v?.toLowerCase().includes(q))
    })
    const val = (c: Contact) => (sort.key === 'name' ? c.name : sort.key === 'email' ? c.email : phoneOf(c)).toLowerCase()
    // Empty values always sink to the bottom
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b)
      if (!x !== !y) return x ? -1 : 1
      return x.localeCompare(y) * sort.dir
    })
  }, [contacts, section, filter, q, sort])

  // Net balance by exact name: receivable (customer invoices) minus payable (vendor bills)
  const balance = useMemo(() => {
    const m = new Map<string, { rec: number; pay: number }>()
    const e = (n: string) => { const k = n.trim().toLowerCase(); if (!m.has(k)) m.set(k, { rec: 0, pay: 0 }); return m.get(k)! }
    invoices.forEach(i => { if (i.state === 'open' || i.state === 'in_payment') e(i.partner).rec += i.residual })
    bills.forEach(b => { if (b.state === 'open' || b.state === 'in_payment') e(b.vendor).pay += b.residual })
    return m
  }, [invoices, bills])
  const balanceOf = (c: Contact) => balance.get(c.name.trim().toLowerCase()) ?? { rec: 0, pay: 0 }
  const BalanceCell = ({ c }: { c: Contact }) => {
    const { rec, pay } = balanceOf(c)
    const net = rec - pay
    if (!rec && !pay) return <span className="text-slate-300">—</span>
    const both = c.isCustomer && c.isVendor
    return (
      <div className="text-right leading-tight">
        <div className={`font-mono font-bold ${net > 0 ? 'text-emerald-700' : net < 0 ? 'text-amber-700' : 'text-slate-600'}`}>{moneyFormat(Math.abs(net))}</div>
        <div className="text-[10px] text-slate-500">{both ? (net > 0 ? 'net: they owe you' : net < 0 ? 'net: you owe them' : 'net: settled') : net > 0 ? 'they owe you' : 'you owe them'}</div>
      </div>
    )
  }
  const parentName = (c: Contact) => contacts.find(p => p.id === c.parentId)?.name
  const toggleSort = (key: SortKey) => setSort(s => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))
  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2.5 text-left font-bold" aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800">
        {label}{sort.key === k && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
      </button>
    </th>
  )
  const roles = (c: Contact) => <div className="flex gap-1 flex-wrap">{c.isCustomer && <Pill tone="green">Customer</Pill>}{c.isVendor && <Pill tone="blue">Vendor</Pill>}{c.isEmployee && <Pill tone="amber">Employee</Pill>}{c.isLogin && <Pill tone="slate">Login</Pill>}{c.otherKind && <Pill>{OTHER_LABEL[c.otherKind]}</Pill>}{c.kind === 'individual' && !c.isCustomer && !c.isVendor && !c.isEmployee && !c.isLogin && !c.otherKind && <Pill>Person</Pill>}</div>

  return (
    <div className="space-y-4">
      <PageHeader title={info.title} subtitle={info.sub}
        actions={<>
          <SearchBox value={local} onChange={setLocal} placeholder="Search name, phone, email, VAT…" />
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="View">
            {([['list', List, 'List view'], ['cards', LayoutGrid, 'Card view']] as const).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v} aria-label={label} title={label}
                className={`p-2 rounded-md ${view === v ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}><Icon size={14} /></button>
            ))}
          </div>
          {!readOnly && <PrimaryButton onClick={() => setOpen({})}><Plus size={16} />New User</PrimaryButton>}
        </>} />

      <Segmented value={filter} onChange={setFilter} options={[
        { id: 'all', label: 'All', count: counts.all }, { id: 'companies', label: 'Companies', count: counts.companies },
        { id: 'individuals', label: 'Individuals', count: counts.individuals },
        ...(section === 'customers' || section === 'vendors' ? [{ id: 'both' as const, label: 'Customer & Vendor', count: counts.both }] : []),
      ]} />

      {rows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl"><EmptyState title="No users found" text="Try another filter or create a new user." /></div>
      ) : view === 'list' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500 text-[10px]">
              <tr><th className="px-3 py-2.5 w-14 text-left font-bold uppercase tracking-wide">Image</th><Th k="name" label="Name" /><Th k="phone" label="Phone" /><Th k="email" label="Email" /><th className="px-3 py-2.5 text-left font-bold uppercase tracking-wide">Type</th><th className="px-3 py-2.5 text-right font-bold uppercase tracking-wide">Balance</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(c => (
                <tr key={c.id} onClick={() => setOpen({ contact: c })} className="hover:bg-slate-50 cursor-pointer">
                  <td className="px-3 py-2"><Avatar name={c.name} src={c.image} size={36} round={c.kind === 'individual'} /></td>
                  <td className="px-3 py-2"><div className="font-bold text-slate-900 truncate max-w-[300px]">{c.name}</div>{parentName(c) && <div className="text-[10px] text-slate-500">{c.jobTitle ? `${c.jobTitle} · ` : ''}{parentName(c)}</div>}</td>
                  <td className="px-3 py-2 text-slate-600 font-mono">{phoneOf(c) || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2 text-slate-600">{c.email || <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2">{roles(c)}</td>
                  <td className="px-3 py-2"><BalanceCell c={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map(c => (
            <button key={c.id} onClick={() => setOpen({ contact: c })} className="text-left bg-white border border-slate-200 rounded-xl p-3 flex gap-3 hover:border-emerald-400 hover:shadow-sm transition">
              <Avatar name={c.name} src={c.image} size={56} round={c.kind === 'individual'} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-extrabold text-sm text-slate-900 truncate">{c.name}</div>
                {parentName(c) && <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate"><Building2 size={11} />{c.jobTitle ? `${c.jobTitle} · ` : ''}{parentName(c)}</div>}
                {c.email && <div className="text-[11px] text-slate-600 flex items-center gap-1 truncate"><Mail size={11} />{c.email}</div>}
                {phoneOf(c) && <div className="text-[11px] text-slate-600 flex items-center gap-1 font-mono"><Phone size={11} />{phoneOf(c)}</div>}
                <div className="pt-0.5">{roles(c)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="text-[11px] text-slate-400">{rows.length} user{rows.length === 1 ? '' : 's'}</div>

      {open && (
        <ContactDrawer key={open.contact?.id ?? 'new'} contact={open.contact} contacts={contacts} invoices={invoices} bills={bills} readOnly={readOnly}
          onSave={saveContact} onArchive={archiveContact} onClose={() => setOpen(null)}
          onCreateInvoice={p => { setOpen(null); onCreateInvoice(p) }} onOpenInvoice={inv => { setOpen(null); onOpenInvoice(inv) }}
          onCreateBill={() => { setOpen(null); onCreateBill() }} />
      )}
    </div>
  )
}
