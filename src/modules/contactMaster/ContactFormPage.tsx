import { useMemo, useRef, useState } from 'react'
import { Eraser, Save } from 'lucide-react'
import { Card, ConfirmDialog, GhostButton, PrimaryButton, inputCls } from '../shared/ui'
import { Breadcrumb, Fld, TagPicker, Toggle, errCls } from './parts'
import { COUNTRIES, ID_SCHEMES, LANGS, PARTNER_TYPES, STATES, TAGS, TITLES } from './options'
import { descendantIds } from './store'
import { BLANK, EMAIL_RE, PHONE_RE, SITE_RE, toDraft } from './defaults'
import ChildContacts from './ChildContacts'
import type { PartnerDraft, ResPartner } from './types'

/** Add / Edit Contact form (one component for both). Validation runs on blur and again when Save is pressed. */
interface Props {
  mode: 'add' | 'edit'
  partner?: ResPartner
  partners: ResPartner[]
  onSave: (draft: PartnerDraft) => void
  onCancel: () => void
}

type NumKey = 'customer_discount' | 'discount'
const numStrings = (d: PartnerDraft): Record<NumKey, string> => ({ customer_discount: d.customer_discount ? String(d.customer_discount) : '', discount: d.discount ? String(d.discount) : '' })
const idOrNull = (s: string) => (s === '' ? null : Number(s))
const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">{children}</div>

export default function ContactFormPage({ mode, partner, partners, onSave, onCancel }: Props) {
  const initial = useMemo(() => toDraft(partner), [partner])
  const initialNums = useMemo(() => numStrings(initial), [initial])
  const [f, setF] = useState<PartnerDraft>(initial)
  const [nums, setNums] = useState(initialNums)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const dirty = JSON.stringify([f, nums]) !== JSON.stringify([initial, initialNums])
  const set = <K extends keyof PartnerDraft>(k: K, v: PartnerDraft[K]) => setF(p => ({ ...p, [k]: v }))
  const touch = (k: string) => setTouched(t => (t.has(k) ? t : new Set(t).add(k)))

  const errors = useMemo(() => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e.name = f.is_company ? 'Company name is required.' : 'Contact name is required.'
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address, e.g. name@company.com.'
    if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) e.phone = 'Enter a valid phone number (digits, spaces, + ( ) - .).'
    if (f.mobile.trim() && !PHONE_RE.test(f.mobile.trim())) e.mobile = 'Enter a valid mobile number (digits, spaces, + ( ) - .).'
    if (f.website.trim() && !SITE_RE.test(f.website.trim())) e.website = 'Enter a valid website, e.g. www.example.com.'
    if (f.fax.trim() && !PHONE_RE.test(f.fax.trim())) e.fax = 'Enter a valid fax number (digits, spaces, + ( ) - .).'
    if (f.l10n_sa_edi_building_number.trim() && !/^\d{4}$/.test(f.l10n_sa_edi_building_number.trim())) e.l10n_sa_edi_building_number = 'Building number must be 4 digits.'
    const bad = (k: NumKey, max?: number) => nums[k].trim() && (!Number.isFinite(Number(nums[k])) || Number(nums[k]) < 0 || (max !== undefined && Number(nums[k]) > max))
    if (bad('customer_discount', 100)) e.customer_discount = 'Enter a percentage between 0 and 100.'
    if (bad('discount', 100)) e.discount = 'Enter a percentage between 0 and 100.'
    return e
  }, [f, nums])
  const show = (k: string) => (submitted || touched.has(k) ? errors[k] : undefined)
  const bind = (k: string) => ({ 'data-f': k, onBlur: () => touch(k), 'aria-invalid': show(k) ? true : undefined })

  const parents = useMemo(() => {
    const banned = partner ? new Set([partner.id, ...descendantIds(partners, partner.id)]) : new Set<number>()
    return partners.filter(x => x.is_company && !banned.has(x.id) && (x.active || x.id === f.parent_id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [partners, partner, f.parent_id])
  const states = STATES.filter(s => s.country_id === f.country_id)
  const parent = partners.find(x => x.id === f.parent_id)
  const displayName = f.name.trim() ? (!f.is_company && parent ? `${parent.name}, ${f.name.trim()}` : f.name.trim()) : ''
  const errorCount = Object.keys(errors).length

  const save = () => {
    setSubmitted(true)
    const first = Object.keys(errors)[0]
    if (first) { root.current?.querySelector<HTMLElement>(`[data-f="${first}"]`)?.focus(); return }
    onSave({ ...f, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), mobile: f.mobile.trim(), website: f.website.trim(), fax: f.fax.trim(), customer_discount: Number(nums.customer_discount) || 0, discount: Number(nums.discount) || 0 })
  }
  const clear = () => { setF(BLANK); setNums(numStrings(BLANK)); setTouched(new Set()); setSubmitted(false) }
  const cancel = () => (dirty ? setConfirmLeave(true) : onCancel())
  const setKind = (company: boolean) => setF(p => company
    ? { ...p, is_company: true, title: null, function: '', company_name: '' }
    : { ...p, is_company: false })

  const title = mode === 'add' ? 'New Contact' : `Edit ${partner?.name ?? 'Contact'}`

  return (
    <div ref={root} className="space-y-3">
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

      <form onSubmit={e => { e.preventDefault(); save() }} noValidate className="space-y-3">
        <div className="grid lg:grid-cols-2 gap-3 items-start">
          <div className="space-y-3 min-w-0">
<Card dense title="General Information">
            <Grid>
              <div className="sm:col-span-2">
                <span className="block text-slate-600 font-bold mb-0.5 text-[11px]">Contact kind</span>
                <div role="radiogroup" aria-label="Individual or Company" className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
                  {([['Individual', false], ['Company', true]] as const).map(([label, v]) => (
                    <button key={label} type="button" role="radio" aria-checked={f.is_company === v} onClick={() => setKind(v)}
                      className={`px-3 py-1 rounded-lg transition ${f.is_company === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <Fld label={f.is_company ? 'Company Name' : 'Contact Name'} required error={show('name')} span={2}>
                <input {...bind('name')} className={errCls(show('name'))} value={f.name} onChange={e => set('name', e.target.value)} placeholder={f.is_company ? 'e.g. Gulf Petrochem Industries' : 'e.g. Faisal Al-Harbi'} />
              </Fld>
              <Fld label="Arabic Name" span={2}><input {...bind('arabic_name')} dir="rtl" className={inputCls} value={f.arabic_name} onChange={e => set('arabic_name', e.target.value)} placeholder="الاسم بالعربية" /></Fld>
              <Fld label="Display Name">
                <input className={inputCls} value={displayName || (mode === 'edit' ? partner?.display_name ?? '' : '')} readOnly disabled />
              </Fld>
              <Fld label="Commercial Entity">
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
          <Card dense title="Address">
            <Grid>
              <Fld label="Street"><input {...bind('street')} className={inputCls} value={f.street} onChange={e => set('street', e.target.value)} /></Fld>
              <Fld label="Street 2 / Neighborhood"><input {...bind('street2')} className={inputCls} value={f.street2} onChange={e => set('street2', e.target.value)} placeholder="Neighborhood" /></Fld>
              <Fld label="Arabic Street 2"><input {...bind('arabic_street2_name')} dir="rtl" className={inputCls} value={f.arabic_street2_name} onChange={e => set('arabic_street2_name', e.target.value)} /></Fld>
              <Fld label="Arabic City"><input {...bind('arabic_city_name')} dir="rtl" className={inputCls} value={f.arabic_city_name} onChange={e => set('arabic_city_name', e.target.value)} /></Fld>
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
              <Fld label="Building Number" error={show('l10n_sa_edi_building_number')}><input {...bind('l10n_sa_edi_building_number')} inputMode="numeric" maxLength={4} className={errCls(show('l10n_sa_edi_building_number'))} value={f.l10n_sa_edi_building_number} onChange={e => set('l10n_sa_edi_building_number', e.target.value)} placeholder="4 digits" /></Fld>
              <Fld label="Plot Identification"><input {...bind('l10n_sa_edi_plot_identification')} className={inputCls} value={f.l10n_sa_edi_plot_identification} onChange={e => set('l10n_sa_edi_plot_identification', e.target.value)} /></Fld>
            </Grid>
          </Card>
          <Card dense title="Business Information">
            <Grid>
              <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4">
                <Toggle label="Customer" checked={f.customer} onChange={v => set('customer', v)} />
                <Toggle label="Supplier" checked={f.supplier} onChange={v => set('supplier', v)} />
                <Toggle label="Employee" checked={f.employee} onChange={v => set('employee', v)} />
                <Toggle label="Cash Customer" checked={f.cash_customer} onChange={v => set('cash_customer', v)} />
              </div>
              <Fld label="Customer Discount %" error={show('customer_discount')}><input {...bind('customer_discount')} type="number" min="0" max="100" step="any" className={errCls(show('customer_discount'))} value={nums.customer_discount} onChange={e => setNums(n => ({ ...n, customer_discount: e.target.value }))} placeholder="0.00" /></Fld>
              <Fld label="Discount (%)" error={show('discount')}><input {...bind('discount')} type="number" min="0" max="100" step="any" className={errCls(show('discount'))} value={nums.discount} onChange={e => setNums(n => ({ ...n, discount: e.target.value }))} placeholder="0.00" /></Fld>
              <Fld label="Customer Code"><input {...bind('customer_code')} className={inputCls} value={f.customer_code} onChange={e => set('customer_code', e.target.value)} /></Fld>
              <Fld label="Vendor No"><input {...bind('vandor_number')} className={inputCls} value={f.vandor_number} onChange={e => set('vandor_number', e.target.value)} /></Fld>
              <Fld label="Company Code"><input {...bind('company_name_code')} className={inputCls} value={f.company_name_code} onChange={e => set('company_name_code', e.target.value)} /></Fld>
              <Fld label="Girfalco ID" hint="External Resource ID, read-only"><input className={inputCls} readOnly disabled value={f.ext_res_id ?? ''} /></Fld>
              <div className="sm:col-span-2">
                <Toggle label="Active" hint={f.active ? 'Untick to archive this contact' : 'Archived — hidden from the default list'} checked={f.active} onChange={v => set('active', v)} />
              </div>
            </Grid>
          </Card>
          </div>
          <div className="space-y-3 min-w-0">
          <Card dense title="Contact Information">
            <Grid>
              <Fld label="Email" error={show('email')}><input {...bind('email')} type="email" className={errCls(show('email'))} value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@company.com" /></Fld>
              <Fld label="Website" error={show('website')}><input {...bind('website')} className={errCls(show('website'))} value={f.website} onChange={e => set('website', e.target.value)} placeholder="www.example.com" /></Fld>
              <Fld label="Phone" error={show('phone')}><input {...bind('phone')} type="tel" className={errCls(show('phone'))} value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+966 13 000 0000" /></Fld>
              <Fld label="Mobile" error={show('mobile')}><input {...bind('mobile')} type="tel" className={errCls(show('mobile'))} value={f.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+966 50 000 0000" /></Fld>
              <Fld label="Fax" error={show('fax')}><input {...bind('fax')} type="tel" className={errCls(show('fax'))} value={f.fax} onChange={e => set('fax', e.target.value)} /></Fld>
            </Grid>
          </Card>
          <Card dense title="ZATCA & Tax Identification">
            <Grid>
              <Fld label="ZATCA Registered Name" span={2}><input {...bind('l10n_sa_registered_name')} className={inputCls} value={f.l10n_sa_registered_name} onChange={e => set('l10n_sa_registered_name', e.target.value)} /></Fld>
              <Fld label="Identification Scheme">
                <select {...bind('l10n_sa_additional_identification_scheme')} className={inputCls} value={f.l10n_sa_additional_identification_scheme} onChange={e => set('l10n_sa_additional_identification_scheme', e.target.value)}>
                  {ID_SCHEMES.map(x => <option key={x.code} value={x.code}>{x.name}</option>)}
                </select>
              </Fld>
              <Fld label="Identification Number (SA)"><input {...bind('l10n_sa_additional_identification_number')} className={inputCls} value={f.l10n_sa_additional_identification_number} onChange={e => set('l10n_sa_additional_identification_number', e.target.value)} /></Fld>
              <Fld label="Tax ID Arabic"><input {...bind('vat_arabic')} dir="rtl" className={inputCls} value={f.vat_arabic} onChange={e => set('vat_arabic', e.target.value)} /></Fld>
              <Fld label="CR Number"><input {...bind('cr_number')} className={inputCls} value={f.cr_number} onChange={e => set('cr_number', e.target.value)} /></Fld>
            </Grid>
          </Card>
          <Card dense title="Additional Information">
            <Grid>
              <Fld label="Tax ID"><input {...bind('vat')} className={inputCls} value={f.vat} onChange={e => set('vat', e.target.value)} /></Fld>
              <Fld label="Language">
                <select {...bind('lang')} className={inputCls} value={f.lang} onChange={e => set('lang', e.target.value)}>{LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
              </Fld>
              <div className="sm:col-span-2"><TagPicker label="Tags" tags={TAGS} value={f.category_id} onChange={v => set('category_id', v)} /></div>
            </Grid>
          </Card>
          {mode === 'edit' && partner?.is_company && <ChildContacts parent={partner} partners={partners} />}
          {mode === 'add' && f.is_company && (
            <Card dense title="Child Companies, Contacts & Addresses">
              <p className="text-xs text-slate-500 py-2">Save this company first, then edit it to add its child companies, contacts, and delivery and invoice addresses.</p>
            </Card>
          )}
          </div>
        </div>
      </form>

      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-slate-100/95 backdrop-blur border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
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
