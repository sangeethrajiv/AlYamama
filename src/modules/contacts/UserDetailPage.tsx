import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Save, Undo2, CheckCircle2 } from 'lucide-react'
import { Avatar, Card, Field, GhostButton, Pill, PrimaryButton, inputCls } from '../shared/ui'
import { Breadcrumb, TabBar } from '../inventory/components'
import UserAccessRights from './UserAccessRights'
import type { Employee, ResUser } from './usersTypes'
import { saveUser } from './usersStore'
import { COMPANIES, COUNTRIES, EMPLOYEES, DEPARTMENTS, JOBS, LANGUAGES, SALES_TEAMS, STATES, TIMEZONES, TITLES } from './usersLookups'
import { CHATTER_POSITIONS, NOTIFICATION_TYPES, ODOOBOT_STATES, SIDEBAR_TYPES, WORKING_STATUSES, userName, type Sel } from './usersOptions'

/** User form — editable view of one res.users record (changes are kept in memory only). */
type TabId = 'general' | 'access' | 'companies' | 'preferences' | 'employee' | 'activity'

const Grid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">{children}</div>
const num = (s: string) => (s === '' ? undefined : Number(s))
const opt = (s: string) => (s === '' ? undefined : s)
const id = (s: string) => (s === '' ? undefined : Number(s))

function Check({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer py-1">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="accent-emerald-600 mt-0.5" />
      <span><span className="font-bold">{label}</span>{hint && <span className="block text-[10px] text-slate-400">{hint}</span>}</span>
    </label>
  )
}
const Options = ({ list }: { list: { id: number; name: string }[] }) => <>{list.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</>
const SelOptions = ({ sel }: { sel: Sel }) => <>{sel.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</>

export default function UserDetailPage({ user, ids, onOpen }: { user: ResUser; ids: number[]; onOpen: (id: number) => void }) {
  const [u, setU] = useState<ResUser>(user)
  const [tab, setTab] = useState<TabId>('general')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const dirty = JSON.stringify(u) !== JSON.stringify(user)
  const pos = ids.indexOf(user.id)
  const set = <K extends keyof ResUser>(k: K, v: ResUser[K]) => { setSaved(false); setError(''); setU(p => ({ ...p, [k]: v })) }
  const emp = u.emp
  const setEmp = <K extends keyof Employee>(k: K, v: Employee[K]) => emp && set('emp', { ...emp, [k]: v })

  const save = () => {
    if (!u.name.trim()) return setError('Name is required.')
    if (!u.login.trim()) return setError('Login is required.')
    saveUser(u); setSaved(true)
  }
  const leave = (to: number) => { if (!dirty || window.confirm('Discard unsaved changes?')) onOpen(to) }

  const setCompany = (cid: number) => { set('company_id', cid); if (!u.company_ids.includes(cid)) setU(p => ({ ...p, company_id: cid, company_ids: [...p.company_ids, cid] })) }
  const toggleCompany = (cid: number) => {
    if (cid === u.company_id) return
    set('company_ids', u.company_ids.includes(cid) ? u.company_ids.filter(x => x !== cid) : [...u.company_ids, cid])
  }
  const tabs: { id: TabId; label: string }[] = [
    { id: 'general', label: 'General' }, { id: 'access', label: `Access Rights (${u.groups.length})` },
    { id: 'companies', label: `Companies (${u.company_ids.length})` }, { id: 'preferences', label: 'Preferences' },
    { id: 'employee', label: 'Employee' }, { id: 'activity', label: 'Activity & Audit' },
  ]
  const states = STATES.filter(s => s.country_id === u.country_id)
  const tzs = u.tz && !TIMEZONES.includes(u.tz) ? [u.tz, ...TIMEZONES] : TIMEZONES

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb parent="All Users" current={u.name || 'New user'} onBack={() => leave(0)} />
        <div className="flex items-center gap-1 text-xs text-slate-500">
          <span className="tabular-nums">{pos >= 0 ? `${pos + 1} / ${ids.length}` : ''}</span>
          <button aria-label="Previous user" disabled={pos <= 0} onClick={() => leave(ids[pos - 1])} className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronLeft size={14} /></button>
          <button aria-label="Next user" disabled={pos < 0 || pos >= ids.length - 1} onClick={() => leave(ids[pos + 1])} className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <Avatar name={u.name || '?'} size={56} round />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">{u.name || 'Unnamed user'}</h1>
          <div className="text-xs text-slate-500 truncate">{u.login}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={u.active ? 'green' : 'slate'}>{u.active ? 'Active' : 'Archived'}</Pill>
            <Pill tone={u.share ? 'amber' : 'blue'}>{u.share ? 'Portal / Public' : 'Internal'}</Pill>
            {u.is_gcc_user && <Pill tone="blue">GCC User</Pill>}
            {emp && <Pill tone="slate">Employee</Pill>}
            <Pill tone="slate">{COMPANIES.find(c => c.id === u.company_id)?.name}</Pill>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && !dirty && <span className="text-xs font-bold text-emerald-700 flex items-center gap-1"><CheckCircle2 size={14} /> Saved</span>}
          <GhostButton onClick={() => { setU(user); setError(''); setSaved(false) }} disabled={!dirty}><span className="flex items-center gap-1.5"><Undo2 size={13} /> Discard</span></GhostButton>
          <PrimaryButton onClick={save} disabled={!dirty}><Save size={14} /> Save</PrimaryButton>
        </div>
      </div>
      {error && <div role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'general' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Login account">
            <Grid>
              <Field label="Name" dense><input className={inputCls} value={u.name} onChange={e => set('name', e.target.value)} /></Field>
              <Field label="Login" dense><input className={inputCls} value={u.login} onChange={e => set('login', e.target.value)} /></Field>
              <Field label="Arabic Name" dense><input className={inputCls} dir="rtl" value={u.arabic_name ?? ''} onChange={e => set('arabic_name', opt(e.target.value))} /></Field>
              <Field label="Signup Token Type" dense><input className={inputCls} value={u.signup_type ?? ''} onChange={e => set('signup_type', opt(e.target.value))} /></Field>
              <div className="sm:col-span-2 flex flex-wrap gap-x-6">
                <Check label="Active" checked={u.active} onChange={v => set('active', v)} hint="Untick to archive the user" />
                <Check label="Employee" checked={!!u.employee} onChange={v => set('employee', v)} hint="Marks the contact as an employee" />
              </div>
            </Grid>
          </Card>
          <Card title="Contact details">
            <Grid>
              <Field label="Email" dense><input type="email" className={inputCls} value={u.email ?? ''} onChange={e => set('email', opt(e.target.value))} /></Field>
              <Field label="Phone" dense><input type="tel" className={inputCls} value={u.phone ?? ''} onChange={e => set('phone', opt(e.target.value))} /></Field>
              <Field label="Mobile" dense><input type="tel" className={inputCls} value={u.mobile ?? ''} onChange={e => set('mobile', opt(e.target.value))} /></Field>
              <Field label="Extension Number" dense><input className={inputCls} value={u.extension_number ?? ''} onChange={e => set('extension_number', opt(e.target.value))} /></Field>
              <Field label="Job Position" dense><input className={inputCls} value={u.function ?? ''} onChange={e => set('function', opt(e.target.value))} /></Field>
              <Field label="Title" dense>
                <select className={inputCls} value={u.title ?? ''} onChange={e => set('title', id(e.target.value))}><option value="" /><Options list={TITLES} /></select>
              </Field>
              <Field label="Website" dense><input className={inputCls} value={u.website ?? ''} onChange={e => set('website', opt(e.target.value))} /></Field>
            </Grid>
          </Card>
          <Card title="Address">
            <Grid>
              <Field label="Street" dense><input className={inputCls} value={u.street ?? ''} onChange={e => set('street', opt(e.target.value))} /></Field>
              <Field label="Street 2" dense><input className={inputCls} value={u.street2 ?? ''} onChange={e => set('street2', opt(e.target.value))} /></Field>
              <Field label="City" dense><input className={inputCls} value={u.city ?? ''} onChange={e => set('city', opt(e.target.value))} /></Field>
              <Field label="ZIP" dense><input className={inputCls} value={u.zip ?? ''} onChange={e => set('zip', opt(e.target.value))} /></Field>
              <Field label="Country" dense>
                <select className={inputCls} value={u.country_id ?? ''} onChange={e => { set('country_id', id(e.target.value)); setU(p => ({ ...p, country_id: id(e.target.value), state_id: undefined })) }}><option value="" /><Options list={COUNTRIES} /></select>
              </Field>
              <Field label="State" dense>
                <select className={inputCls} value={u.state_id ?? ''} disabled={!u.country_id} onChange={e => set('state_id', id(e.target.value))}><option value="" /><Options list={states} /></select>
              </Field>
            </Grid>
          </Card>
          <Card title="Tax & notes">
            <Grid>
              <Field label="Tax ID" dense><input className={inputCls} value={u.vat ?? ''} onChange={e => set('vat', opt(e.target.value))} /></Field>
              <Field label="Internal Reference" dense><input className={inputCls} value={u.ref ?? ''} onChange={e => set('ref', opt(e.target.value))} /></Field>
              <Field label="Internal Notes" span={2} dense><textarea rows={3} className={inputCls} value={u.comment ?? ''} onChange={e => set('comment', opt(e.target.value))} /></Field>
            </Grid>
          </Card>
        </div>
      )}

      {tab === 'access' && <UserAccessRights selected={u.groups} onChange={g => set('groups', g)} />}

      {tab === 'companies' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Default company">
            <Field label="Company" dense hint="Must be one of the allowed companies">
              <select className={inputCls} value={u.company_id} onChange={e => setCompany(Number(e.target.value))}><Options list={COMPANIES} /></select>
            </Field>
          </Card>
          <div className="lg:col-span-2">
            <Card title="Allowed Companies">
              <div className="grid sm:grid-cols-2 gap-2">
                {COMPANIES.map(c => (
                  <label key={c.id} className={`border rounded-lg px-3 py-2.5 flex items-center gap-2 cursor-pointer ${u.company_ids.includes(c.id) ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}>
                    <input type="checkbox" className="accent-emerald-600" checked={u.company_ids.includes(c.id)} disabled={c.id === u.company_id} onChange={() => toggleCompany(c.id)} />
                    <span className="text-xs font-bold text-slate-900 flex-1">{c.name}</span>
                    {c.id === u.company_id && <Pill tone="green">Default</Pill>}
                  </label>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'preferences' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Preferences">
            <Grid>
              <Field label="Language" dense><select className={inputCls} value={u.lang} onChange={e => set('lang', e.target.value)}>{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select></Field>
              <Field label="Timezone" dense><select className={inputCls} value={u.tz ?? ''} onChange={e => set('tz', opt(e.target.value))}><option value="" />{tzs.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Notification Management" dense><select className={inputCls} value={u.notification_type} onChange={e => set('notification_type', e.target.value)}><SelOptions sel={NOTIFICATION_TYPES} /></select></Field>
              <Field label="Sidebar Type" dense><select className={inputCls} value={u.sidebar_type} onChange={e => set('sidebar_type', e.target.value)}><SelOptions sel={SIDEBAR_TYPES} /></select></Field>
              <Field label="Chatter Position" dense><select className={inputCls} value={u.chatter_position} onChange={e => set('chatter_position', e.target.value)}><SelOptions sel={CHATTER_POSITIONS} /></select></Field>
              <Field label="OdooBot Status" dense><select className={inputCls} value={u.odoobot_state} onChange={e => set('odoobot_state', e.target.value)}><SelOptions sel={ODOOBOT_STATES} /></select></Field>
              <Field label="Email Signature" span={2} dense><textarea rows={3} className={inputCls} value={u.signature ?? ''} onChange={e => set('signature', opt(e.target.value))} /></Field>
            </Grid>
          </Card>
          <Card title="Sales & helpdesk">
            <Grid>
              <Field label="Sales Team" dense><select className={inputCls} value={u.sale_team_id ?? ''} onChange={e => set('sale_team_id', id(e.target.value))}><option value="" /><Options list={SALES_TEAMS} /></select></Field>
              <span />
              <Field label="Won in Opportunities Target" dense><input type="number" className={inputCls} value={u.target_sales_won ?? ''} onChange={e => set('target_sales_won', num(e.target.value))} /></Field>
              <Field label="Activities Done Target" dense><input type="number" className={inputCls} value={u.target_sales_done ?? ''} onChange={e => set('target_sales_done', num(e.target.value))} /></Field>
              <Field label="Invoiced in Sales Orders Target" dense><input type="number" className={inputCls} value={u.target_sales_invoiced ?? ''} onChange={e => set('target_sales_invoiced', num(e.target.value))} /></Field>
              <Field label="Target Tickets to Close" dense><input type="number" step="any" className={inputCls} value={u.helpdesk_target_closed ?? ''} onChange={e => set('helpdesk_target_closed', num(e.target.value))} /></Field>
              <Field label="Target Customer Rating" dense><input type="number" step="any" className={inputCls} value={u.helpdesk_target_rating ?? ''} onChange={e => set('helpdesk_target_rating', num(e.target.value))} /></Field>
              <Field label="Target Success Rate" dense><input type="number" step="any" className={inputCls} value={u.helpdesk_target_success ?? ''} onChange={e => set('helpdesk_target_success', num(e.target.value))} /></Field>
            </Grid>
          </Card>
          <Card title="Other">
            <Grid>
              <Field label="Pseudo Name" dense><input className={inputCls} value={u.pseudo_name ?? ''} onChange={e => set('pseudo_name', opt(e.target.value))} /></Field>
              <div className="flex items-end"><Check label="GCC User" checked={!!u.is_gcc_user} onChange={v => set('is_gcc_user', v)} /></div>
            </Grid>
          </Card>
        </div>
      )}

      {tab === 'employee' && (
        emp ? (
          <Card title="Linked employee">
            <Grid>
              <Field label="Employee Name" dense><input className={inputCls} value={emp.name} onChange={e => setEmp('name', e.target.value)} /></Field>
              <Field label="Employee Code" dense><input className={inputCls} value={emp.employee_code ?? ''} onChange={e => setEmp('employee_code', opt(e.target.value))} /></Field>
              <Field label="Job Title" dense><input className={inputCls} value={emp.job_title ?? ''} onChange={e => setEmp('job_title', opt(e.target.value))} /></Field>
              <Field label="Job Position" dense><select className={inputCls} value={emp.job_id ?? ''} onChange={e => setEmp('job_id', id(e.target.value))}><option value="" /><Options list={JOBS} /></select></Field>
              <Field label="Department" dense><select className={inputCls} value={emp.department_id ?? ''} onChange={e => setEmp('department_id', id(e.target.value))}><option value="" /><Options list={DEPARTMENTS} /></select></Field>
              <Field label="Company" dense><select className={inputCls} value={emp.company_id ?? ''} onChange={e => setEmp('company_id', id(e.target.value))}><option value="" /><Options list={COMPANIES} /></select></Field>
              <Field label="Manager" dense><select className={inputCls} value={emp.parent_id ?? ''} onChange={e => setEmp('parent_id', id(e.target.value))}><option value="" /><Options list={EMPLOYEES} /></select></Field>
              <Field label="Coach" dense><select className={inputCls} value={emp.coach_id ?? ''} onChange={e => setEmp('coach_id', id(e.target.value))}><option value="" /><Options list={EMPLOYEES} /></select></Field>
              <Field label="Working Status" dense><select className={inputCls} value={emp.working_status ?? ''} onChange={e => setEmp('working_status', opt(e.target.value))}><option value="" /><SelOptions sel={WORKING_STATUSES} /></select></Field>
              <Field label="Work Location" dense><input className={inputCls} value={emp.work_location ?? ''} onChange={e => setEmp('work_location', opt(e.target.value))} /></Field>
              <Field label="Work Email" dense><input type="email" className={inputCls} value={emp.work_email ?? ''} onChange={e => setEmp('work_email', opt(e.target.value))} /></Field>
              <Field label="Work Phone" dense><input type="tel" className={inputCls} value={emp.work_phone ?? ''} onChange={e => setEmp('work_phone', opt(e.target.value))} /></Field>
              <Field label="Work Mobile" dense><input type="tel" className={inputCls} value={emp.mobile_phone ?? ''} onChange={e => setEmp('mobile_phone', opt(e.target.value))} /></Field>
              <span />
              <Field label="Date of Joining" dense><input type="date" className={inputCls} value={emp.date_of_joining ?? ''} onChange={e => setEmp('date_of_joining', opt(e.target.value))} /></Field>
              <Field label="Date of Relieving" dense><input type="date" className={inputCls} value={emp.date_of_relieving ?? ''} onChange={e => setEmp('date_of_relieving', opt(e.target.value))} /></Field>
              <div className="sm:col-span-2"><Check label="Active" checked={emp.active} onChange={v => setEmp('active', v)} /></div>
            </Grid>
          </Card>
        ) : <Card title="Linked employee"><div className="text-xs text-slate-400 py-6 text-center">No employee record is linked to this user.</div></Card>
      )}

      {tab === 'activity' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Authentication">
            <p className="text-[11px] text-slate-400 mb-3">Latest 5 sign-ins</p>
            {u.logins?.length
              ? <ul className="divide-y divide-slate-100 text-xs">{u.logins.map((l, i) => <li key={l} className="py-1.5 flex justify-between"><span className="tabular-nums">{l}</span>{i === 0 && <Pill tone="green">Latest</Pill>}</li>)}</ul>
              : <div className="text-xs text-slate-400 py-4 text-center">This user has never signed in.</div>}
          </Card>
          <Card title="Record audit">
            <Grid>
              {([['Created on', u.create_date], ['Created by', userName(u.create_uid)], ['Last Updated on', u.write_date], ['Last Updated by', userName(u.write_uid)]] as const).map(([l, v]) => (
                <Field key={l} label={l} dense><input className={inputCls} value={v} readOnly disabled /></Field>
              ))}
            </Grid>
          </Card>
        </div>
      )}
    </div>
  )
}
