import { useMemo, useState } from 'react'
import { ShieldCheck, Layers, Settings2, ShoppingCart, Boxes, Landmark, Users, FolderCog, CheckCheck, Eraser } from 'lucide-react'
import { Pill, SearchBox } from '../shared/ui'
import { GROUPS } from './usersLookups'

/** Access Rights tab: groups are split into business areas, then into the Odoo application each group belongs to. */
type Group = (typeof GROUPS)[number]
interface Area { id: string; label: string; hint: string; icon: typeof Layers; cats: string[] }

const AREAS: Area[] = [
  { id: 'core', label: 'Core & Administration', hint: 'User type, settings, extra and technical rights', icon: Settings2,
    cats: ['User types', 'Administration', 'Extra Rights', 'Other', 'Technical Settings'] },
  { id: 'sales', label: 'Sales & Service', hint: 'Quotations, installation, after-sales, deliveries', icon: ShoppingCart,
    cats: ['Sales', 'Sales Quotation Management', 'Installation Request', 'Job Estimation', 'After-Sales', 'Subscription User', 'Direct Delivery', 'Consumable Delivery Orders', 'Asset Rental'] },
  { id: 'supply', label: 'Purchasing & Inventory', hint: 'Purchase requests and orders, stock, manufacturing', icon: Boxes,
    cats: ['Purchases', 'Purchase Request', 'Purchase Orders', 'Inventory', 'Manufacturing'] },
  { id: 'finance', label: 'Accounting & Vouchers', hint: 'Accounting, internal and payable vouchers', icon: Landmark,
    cats: ['Accounting & Finance', 'Internal Voucher', 'Payable Voucher'] },
  { id: 'hr', label: 'People & HR', hint: 'Employees, attendance, leaves, overtime', icon: Users,
    cats: ['Employees', 'Attendance', 'Leaves', 'HR Custom', 'Overtime', 'Contracts', 'ZK Machine'] },
  { id: 'tools', label: 'Documents & Tools', hint: 'Documents, website, backups, notifications, API', icon: FolderCog,
    cats: ['Document', 'Website', 'Auto backup access', 'API Configuration Access', 'ATT Menu Access', 'Direct User Creation', 'GCC User Manager', 'User Notify List'] },
]
const AREA_OF = new Map(AREAS.flatMap(a => a.cats.map(c => [c, a.id] as const)))
const catOf = (g: Group) => g.category ?? 'Other'
const areaOf = (g: Group) => AREA_OF.get(catOf(g)) ?? 'core'

export default function UserAccessRights({ selected, onChange }: { selected: number[]; onChange: (ids: number[]) => void }) {
  const [area, setArea] = useState('core')
  const [q, setQ] = useState('')
  const [onlyOn, setOnlyOn] = useState(false)
  const on = useMemo(() => new Set(selected), [selected])
  const term = q.trim().toLowerCase()

  const stats = useMemo(() => {
    const m = new Map<string, { on: number; total: number }>()
    for (const a of AREAS) m.set(a.id, { on: 0, total: 0 })
    for (const g of GROUPS) { const s = m.get(areaOf(g))!; s.total++; if (on.has(g.id)) s.on++ }
    return m
  }, [on])

  const visible = useMemo(() => GROUPS.filter(g =>
    (term ? g.name.toLowerCase().includes(term) || catOf(g).toLowerCase().includes(term) : areaOf(g) === area) && (!onlyOn || on.has(g.id))), [term, area, onlyOn, on])
  const cards = useMemo(() => {
    const m = new Map<string, Group[]>()
    for (const g of visible) m.set(catOf(g), [...(m.get(catOf(g)) ?? []), g])
    const order = AREAS.flatMap(a => a.cats)
    return [...m.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
  }, [visible])

  const toggle = (id: number) => onChange(on.has(id) ? selected.filter(x => x !== id) : [...selected, id].sort((a, b) => a - b))
  const setMany = (ids: number[], value: boolean) => {
    const s = new Set(selected)
    ids.forEach(i => (value ? s.add(i) : s.delete(i)))
    onChange([...s].sort((a, b) => a - b))
  }
  const userTypes = GROUPS.filter(g => g.category === 'User types' && on.has(g.id)).map(g => g.name)
  const current = AREAS.find(a => a.id === area)!

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center"><ShieldCheck size={18} /></span>
          <div>
            <div className="text-sm font-extrabold text-slate-900 tabular-nums">{selected.length} <span className="font-bold text-slate-400">of {GROUPS.length} groups granted</span></div>
            <div className="flex gap-1.5 mt-0.5">{userTypes.length ? userTypes.map(t => <Pill key={t} tone="blue">{t}</Pill>) : <Pill tone="amber">No user type</Pill>}</div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-bold" role="group" aria-label="Show">
            {([[false, 'All groups'], [true, 'Granted only']] as const).map(([v, l]) => (
              <button key={l} onClick={() => setOnlyOn(v)} aria-pressed={onlyOn === v}
                className={`px-3 py-1.5 rounded-md ${onlyOn === v ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500'}`}>{l}</button>
            ))}
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Search all groups…" />
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
        <nav aria-label="Business areas" className="bg-white border border-slate-200 rounded-xl p-2 space-y-1 lg:sticky lg:top-2">
          {AREAS.map(a => {
            const s = stats.get(a.id)!, Icon = a.icon, active = !term && area === a.id
            return (
              <button key={a.id} onClick={() => { setQ(''); setArea(a.id) }} aria-current={active}
                className={`w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition ${active ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-slate-50'}`}>
                <Icon size={16} className={active ? 'text-emerald-700' : 'text-slate-400'} />
                <span className="flex-1 min-w-0">
                  <span className={`block text-xs font-bold truncate ${active ? 'text-emerald-800' : 'text-slate-800'}`}>{a.label}</span>
                  <span className="block h-1 mt-1 rounded-full bg-slate-100 overflow-hidden"><span className="block h-full bg-emerald-500" style={{ width: `${s.total ? (s.on / s.total) * 100 : 0}%` }} /></span>
                </span>
                <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${s.on ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{s.on}/{s.total}</span>
              </button>
            )
          })}
        </nav>

        <div className="space-y-3 min-w-0">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{term ? `Search results for “${q}”` : current.label}</h3>
            <p className="text-[11px] text-slate-500">{term ? `${visible.length} matching groups across all areas` : current.hint}</p>
          </div>
          {cards.length === 0 && <div className="bg-white border border-slate-200 rounded-xl text-xs text-slate-400 py-10 text-center">{onlyOn ? 'No granted groups here.' : 'No group matches.'}</div>}
          <div className="grid xl:grid-cols-2 gap-3">
            {cards.map(([cat, gs]) => {
              const all = GROUPS.filter(g => catOf(g) === cat), n = all.filter(g => on.has(g.id)).length
              return (
                <section key={cat} aria-label={cat} className={`bg-white border rounded-xl overflow-hidden ${cat === 'Technical Settings' ? 'xl:col-span-2' : ''} ${n ? 'border-emerald-200' : 'border-slate-200'}`}>
                  <header className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <h4 className="text-xs font-extrabold text-slate-800 flex-1 truncate">{cat}</h4>
                    <span className="text-[10px] font-bold text-slate-500 tabular-nums">{n}/{all.length}</span>
                    <button onClick={() => setMany(all.map(g => g.id), true)} disabled={n === all.length} title="Grant all in this section" aria-label={`Grant all in ${cat}`}
                      className="p-1 rounded text-slate-500 hover:bg-white hover:text-emerald-700 disabled:opacity-30"><CheckCheck size={14} /></button>
                    <button onClick={() => setMany(all.map(g => g.id), false)} disabled={n === 0} title="Clear this section" aria-label={`Clear ${cat}`}
                      className="p-1 rounded text-slate-500 hover:bg-white hover:text-rose-700 disabled:opacity-30"><Eraser size={14} /></button>
                  </header>
                  <ul className={`p-1.5 ${cat === 'Technical Settings' ? 'grid sm:grid-cols-2 gap-x-2' : ''}`}>
                    {gs.map(g => (
                      <li key={g.id}>
                        <label className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${on.has(g.id) ? 'bg-emerald-50/60 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
                          <input type="checkbox" className="accent-emerald-600" checked={on.has(g.id)} onChange={() => toggle(g.id)} />
                          <span className="flex-1">{g.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
