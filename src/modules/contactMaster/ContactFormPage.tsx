import { useMemo, useRef, useState } from 'react'
import { Eraser, Save } from 'lucide-react'
import { Card, ConfirmDialog, GhostButton, PrimaryButton, inputCls } from '../shared/ui'
import { Breadcrumb, Fld, Toggle, errCls } from './parts'
import { COLORS, COMPANIES, COUNTRIES, INDUSTRIES, LANGS, PARTNER_TYPES, STATES, TIMEZONES, TITLES, USERS } from './options'
import { descendantIds } from './store'
import type { PartnerDraft, ResPartner } from './types'

/** Add / Edit Contact form (one component for both). Validation runs on blur and again when Save is pressed. */
interface Props {
  mode: 'add' | 'edit'
  partner?: ResPartner
  partners: ResPartner[]
  onSave: (draft: PartnerDraft) => void
  onCancel: () => void
}

const BLANK: PartnerDraft = {
  name: '', is_company: false, type: 'contact', title: null, function: '', parent_id: null, company_name: '', ref: '',
  email: '', phone: '', mobile: '', website: '',
  street: '', street2: '', city: '', state_id: null, zip: '', country_id: null,
  vat: '', barcode: '', date: '', comment: '', lang: 'en_US', tz: 'Asia/Riyadh', industry_id: null,
  customer: false, supplier: false, employee: false, credit_limit: 0, user_id: null, company_id: 1, partner_share: true, color: 0, active: true,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?[0-9\s().-]{6,20}$/
const SITE_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i

const toDraft = (c?: ResPartner): PartnerDraft => {
  if (!c) return BLANK
  const { id: _i, display_name: _d, commercial_partner_id: _c, ...rest } = c
  return rest
}
const idOrNull = (s: string) => (s === '' ? null : Number(s))
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">{children}</div>

export default function ContactFormPage({ mode, partner, partners, onSave, onCancel }: Props) {
  const initial = useMemo(() => toDraft(partner), [partner])
  const initialCredit = initial.credit_limit ? String(initial.credit_limit) : ''
  const [f, setF] = useState<PartnerDraft>(initial)
  const [credit, setCredit] = useState(initialCredit)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const dirty = JSON.stringify([f, credit]) !== JSON.stringify([initial, initialCredit])
  const set = <K extends keyof PartnerDraft>(k: K, v: PartnerDraft[K]) => setF(p => ({ ...p, [k]: v }))
  const touch = (k: string) => setTouched(t => (t.has(k) ? t : new Set(t).add(k)))

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = f.is_company ? 'Company name is required.' : 'Contact name is required.'
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address, e.g. name@company.com.'
    if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) e.phone = 'Enter a valid phone number (digits, spaces, + ( ) - .).'
    if (f.mobile.trim() && !PHONE_RE.test(f.mobile.trim())) e.mobile = 'Enter a valid mobile number (digits, spaces, + ( ) - .).'
    if (f.website.trim() && !SITE_RE.test(f.website.trim())) e.website = 'Enter a valid website, e.g. www.example.com.'
    if (credit.trim() && (!Number.isFinite(Number(credit)) || Number(credit) < 0)) e.credit_limit = 'Credit limit must be a number of 0 or more.'
    return e
  }, [f, credit])
  const show = (k: string) => (submitted || touched.has(k) ? errors[k] : undefined)
  const bind = (k: string) => ({ 'data-f': k, onBlur: () => touch(k), 'aria-invalid': show(k) ? true : undefined })

  const parents = useMemo(() => {
    const banned = partner ? new Set([partner.id, ...descendantIds(partners, partner.id)]) : new Set<number>()
    return partners.filter(x => x.is_company && !banned.has(x.id) && (x.active || x.id === f.parent_id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [partners, partner, f.parent_id])
  const states = STATES.filter(s => s.country_id === f.country_id)
  const tzs = f.tz && !TIMEZONES.includes(f.tz) ? [f.tz, ...TIMEZONES] : TIMEZONES
  const parent = partners.find(x => x.id === f.parent_id)
  const displayName = f.name.trim() ? (!f.is_company && parent ? `${parent.name}, ${f.name.trim()}` : f.name.trim()) : ''
  const errorCount = Object.keys(errors).length

  const save = () => {
    setSubmitted(true)
    const first = Object.keys(errors)[0]
    if (first) { root.current?.querySelector<HTMLElement>(`[data-f="${first}"]`)?.focus(); return }
    onSave({ ...f, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), mobile: f.mobile.trim(), website: f.website.trim(), credit_limit: credit.trim() ? Number(credit) : 0 })
  }
  const clear = () => { setF(BLANK); setCredit(''); setTouched(new Set()); setSubmitted(false) }
  const cancel = () => (dirty ? setConfirmLeave(true) : onCancel())
  const setKind = (company: boolean) => setF(p => company
    ? { ...p, is_company: true, title: null, function: '', company_name: '' }
    : { ...p, is_company: false })

  const title = mode === 'add' ? 'New Contact' : `Edit ${partner?.name ?? 'Contact'}`

  return (
    <div ref={root} className="space-y-4">
      <Breadcrumb parent="Contacts" current={title} onBack={cancel} />
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
        <p className="text-xs text-slate-500 mt-0.5">Fields marked <span className="text-rose-600 font-bold">*</span> are required.</p>
      </div>

      {submitted && errorCount > 0 && (
        <div role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          Please fix {errorCount} field{errorCount === 1 ? '' : 's'} before saving: {Object.values(errors).join(' ')}
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); save() }} noValidate className="space-y-4">
        <div className="grid lg:grid-cols-2 gap-4 items-start">
          <Card title="General Information">
            <Grid>
              <div className="sm:col-span-2">
                <span className="block text-slate-600 font-bold mb-1 text-[11px]">Contact kind</span>
                <div role="radiogroup" aria-label="Individual or Company" className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
                  {([['Individual', false], ['Company', true]] as const).map(([label, v]) => (
                    <button key={label} type="button" role="radio" aria-checked={f.is_company === v} onClick={() => setKind(v)}
                      className={`px-4 py-1.5 rounded-lg transition ${f.is_company === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <Fld label={f.is_company ? 'Company Name' : 'Contact Name'} required error={show('name')} span={2}>
                <input {...bind('name')} className={errCls(show('name'))} value={f.name} onChange={e => set('name', e.target.value)} placeholder={f.is_company ? 'e.g. Gulf Petrochem Industries' : 'e.g. Faisal Al-Harbi'} />
              </Fld>
              <Fld label="Display Name" hint="Built from the related company and the name">
                <input className={inputCls} value={displayName || (mode === 'edit' ? partner?.display_name ?? '' : '')} readOnly disabled />
              </Fld>
              <Fld label="Commercial Entity" hint="Set automatically from the related company">
                <input className={inputCls} readOnly disabled value={f.is_company || !parent ? (displayName || 'This contact') : parent.name} />
              </Fld>
              <Fld label="Contact Type">
                <select {...bind('type')} className={inputCls} value={f.type} onChange={e => set('type', e.target.value as PartnerDraft['type'])}>
                  {PARTNER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Fld>
              <Fld label={f.is_company ? 'Parent Company' : 'Related Company'}>
                <select {...bind('parent_id')} className={inputCls} value={f.parent_id ?? ''} onChange={e => set('parent_id', idOrNull(e.target.value))}>
                  <option value="">— None —</option>
                  {parents.map(p => <option key={p.id} value={p.id}>{p.name}{p.active ? '' : ' (archived)'}</option>)}
                </select>
              </Fld>
              {!f.is_company && (
                <>
                  <Fld label="Title">
                    <select {...bind('title')} className={inputCls} value={f.title ?? ''} onChange={e => set('title', idOrNull(e.target.value))}>
                      <option value="" />{TITLES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </Fld>
                  <Fld label="Job Position"><input {...bind('function')} className={inputCls} value={f.function} onChange={e => set('function', e.target.value)} /></Fld>
                  {!f.parent_id && <Fld label="Company Name" hint="Free text when no related company is chosen"><input {...bind('company_name')} className={inputCls} value={f.company_name} onChange={e => set('company_name', e.target.value)} /></Fld>}
                </>
              )}
              <Fld label="Internal Reference"><input {...bind('ref')} className={inputCls} value={f.ref} onChange={e => set('ref', e.target.value)} /></Fld>
            </Grid>
          </Card>

          <Card title="Contact Information">
            <Grid>
              <Fld label="Email" error={show('email')}><input {...bind('email')} type="email" className={errCls(show('email'))} value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" /></Fld>
              <Fld label="Website" error={show('website')}><input {...bind('website')} className={errCls(show('website'))} value={f.website} onChange={e => set('website', e.target.value)} placeholder="www.example.com" /></Fld>
              <Fld label="Phone" error={show('phone')}><input {...bind('phone')} type="tel" className={errCls(show('phone'))} value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+966 13 000 0000" /></Fld>
              <Fld label="Mobile" error={show('mobile')}><input {...bind('mobile')} type="tel" className={errCls(show('mobile'))} value={f.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+966 50 000 0000" /></Fld>
            </Grid>
          </Card>

          <Card title="Address">
            <Grid>
              <Fld label="Street"><input {...bind('street')} className={inputCls} value={f.street} onChange={e => set('street', e.target.value)} /></Fld>
              <Fld label="Street 2"><input {...bind('street2')} className={inputCls} value={f.street2} onChange={e => set('street2', e.target.value)} /></Fld>
              <Fld label="City"><input {...bind('city')} className={inputCls} value={f.city} onChange={e => set('city', e.target.value)} /></Fld>
              <Fld label="ZIP"><input {...bind('zip')} className={inputCls} value={f.zip} onChange={e => set('zip', e.target.value)} /></Fld>
              <Fld label="Country">
                <select {...bind('country_id')} className={inputCls} value={f.country_id ?? ''} onChange={e => setF(p => ({ ...p, country_id: idOrNull(e.target.value), state_id: null }))}>
                  <option value="" />{COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Fld>
              <Fld label="State" hint={!f.country_id ? 'Choose a country first' : states.length === 0 ? 'No states listed for this country' : undefined}>
                <select {...bind('state_id')} className={inputCls} value={f.state_id ?? ''} disabled={!f.country_id || states.length === 0} onChange={e => set('state_id', idOrNull(e.target.value))}>
                  <option value="" />{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Fld>
            </Grid>
          </Card>

          <Card title="Additional Information">
            <Grid>
              <Fld label="Tax ID"><input {...bind('vat')} className={inputCls} value={f.vat} onChange={e => set('vat', e.target.value)} /></Fld>
              <Fld label="Barcode"><input {...bind('barcode')} className={inputCls} value={f.barcode} onChange={e => set('barcode', e.target.value)} /></Fld>
              <Fld label="Industry">
                <select {...bind('industry_id')} className={inputCls} value={f.industry_id ?? ''} onChange={e => set('industry_id', idOrNull(e.target.value))}>
                  <option value="" />{INDUSTRIES.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Fld>
              <Fld label="Date"><input {...bind('date')} type="date" className={inputCls} value={f.date} onChange={e => set('date', e.target.value)} /></Fld>
              <Fld label="Language">
                <select {...bind('lang')} className={inputCls} value={f.lang} onChange={e => set('lang', e.target.value)}>{LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
              </Fld>
              <Fld label="Timezone">
                <select {...bind('tz')} className={inputCls} value={f.tz} onChange={e => set('tz', e.target.value)}><option value="" />{tzs.map(t => <option key={t}>{t}</option>)}</select>
              </Fld>
              <Fld label="Internal Notes" span={2}><textarea {...bind('comment')} rows={3} className={inputCls} value={f.comment} onChange={e => set('comment', e.target.value)} /></Fld>
            </Grid>
          </Card>

          <Card title="Business Information">
            <Grid>
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-x-6">
                <Toggle label="Customer" checked={f.customer} onChange={v => set('customer', v)} />
                <Toggle label="Supplier" checked={f.supplier} onChange={v => set('supplier', v)} />
                <Toggle label="Employee" checked={f.employee} onChange={v => set('employee', v)} />
              </div>
              <Fld label="Credit Limit" error={show('credit_limit')}><input {...bind('credit_limit')} type="number" min="0" step="any" className={errCls(show('credit_limit'))} value={credit} onChange={e => setCredit(e.target.value)} placeholder="0.00" /></Fld>
              <Fld label="Salesperson">
                <select {...bind('user_id')} className={inputCls} value={f.user_id ?? ''} onChange={e => set('user_id', idOrNull(e.target.value))}>
                  <option value="" />{USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Fld>
              <Fld label="Company">
                <select {...bind('company_id')} className={inputCls} value={f.company_id ?? ''} onChange={e => set('company_id', idOrNull(e.target.value))}>
                  <option value="">— Shared —</option>{COMPANIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Fld>
              <Fld label="Color Index">
                <select {...bind('color')} className={inputCls} value={f.color} onChange={e => set('color', Number(e.target.value))}>
                  {COLORS.map(c => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
                </select>
              </Fld>
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <Toggle label="Active" hint={f.active ? 'Untick to archive this contact' : 'Archived — hidden from the default list'} checked={f.active} onChange={v => set('active', v)} />
                <Toggle label="Share Partner" hint="External contact without an internal user" checked={f.partner_share} onChange={v => set('partner_share', v)} />
              </div>
            </Grid>
          </Card>
        </div>
      </form>

      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-slate-100/95 backdrop-blur border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
          <GhostButton onClick={cancel}>Cancel</GhostButton>
          {mode === 'add' && <GhostButton onClick={clear}><span className="flex items-center gap-1.5"><Eraser size={13} /> Clear</span></GhostButton>}
          <PrimaryButton onClick={save}><Save size={14} /> {mode === 'add' ? 'Save Contact' : 'Save Changes'}</PrimaryButton>
      </div>

      {confirmLeave && (
        <ConfirmDialog title="Discard changes?" text="You have unsaved changes. Leaving this page will lose them." confirmLabel="Discard" danger
          onConfirm={() => { setConfirmLeave(false); onCancel() }} onCancel={() => setConfirmLeave(false)} />
      )}
    </div>
  )
}
