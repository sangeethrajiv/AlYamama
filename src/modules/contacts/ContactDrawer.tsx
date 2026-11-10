import { useRef, useState, type ReactNode } from 'react'
import { Plus, Trash2, FileText, Receipt, Camera, Mail, Phone, MapPin, ExternalLink } from 'lucide-react'
import type { Invoice, Bill } from '../../types/accounting'
import { moneyFormat } from '../../data/mockAccountingData'
import type { Contact, ContactAddress, ContactKind } from './types'
import { newContact } from './data'
import { CenterDialog, Field, inputCls, PrimaryButton, GhostButton, Pill, Card, Kpi, ConfirmDialog, Avatar } from '../shared/ui'

interface Props {
  contact?: Contact
  contacts: Contact[]
  invoices: Invoice[]
  bills: Bill[]
  readOnly: boolean
  onSave: (c: Contact) => void
  onArchive: (id: string, active: boolean) => void
  onClose: () => void
  onCreateInvoice?: (partner: string) => void
  onOpenInvoice?: (inv: Invoice) => void
  onCreateBill?: () => void
}

type TabKey = 'contacts' | 'children' | 'notes' | 'seal' | 'sales' | 'location' | 'invoicing'
const TABS: { id: TabKey; label: string }[] = [
  { id: 'contacts', label: 'Contacts & Addresses' },
  { id: 'children', label: 'Child Company' },
  { id: 'notes', label: 'Internal Notes' },
  { id: 'seal', label: 'Sign and Seal' },
  { id: 'sales', label: 'Sales & Purchases' },
  { id: 'location', label: 'Location Information' },
  { id: 'invoicing', label: 'Invoicing' },
]
const TERMS = ['Immediate', '15 days', '30 days', '45 days', '60 days', 'End of next month']
const REGIMES: Contact['taxRegime'][] = ['VAT registered', 'Not registered', 'Exempt']

function AddressFields({ a, set, dis }: { a: ContactAddress; set: (patch: Partial<ContactAddress>) => void; dis: boolean }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Field label="Street"><input className={inputCls} disabled={dis} value={a.street} onChange={e => set({ street: e.target.value })} /></Field>
      <Field label="Neighborhood"><input className={inputCls} disabled={dis} value={a.neighborhood || ''} onChange={e => set({ neighborhood: e.target.value })} /></Field>
      <Field label="Street (Arabic)"><input dir="rtl" className={inputCls} disabled={dis} value={a.streetAr || ''} onChange={e => set({ streetAr: e.target.value })} /></Field>
      <Field label="City"><input className={inputCls} disabled={dis} value={a.city} onChange={e => set({ city: e.target.value })} /></Field>
      <Field label="City (Arabic)"><input dir="rtl" className={inputCls} disabled={dis} value={a.cityAr || ''} onChange={e => set({ cityAr: e.target.value })} /></Field>
      <Field label="State / Region"><input className={inputCls} disabled={dis} value={a.region} onChange={e => set({ region: e.target.value })} /></Field>
      <Field label="ZIP"><input className={`${inputCls} font-mono`} disabled={dis} value={a.zip} onChange={e => set({ zip: e.target.value })} /></Field>
      <Field label="Country"><input className={inputCls} disabled={dis} value={a.country} onChange={e => set({ country: e.target.value })} /></Field>
      <Field label="Building number"><input className={`${inputCls} font-mono`} disabled={dis} value={a.buildingNumber || ''} onChange={e => set({ buildingNumber: e.target.value })} /></Field>
      <Field label="Plot identification"><input className={`${inputCls} font-mono`} disabled={dis} value={a.plotId || ''} onChange={e => set({ plotId: e.target.value })} /></Field>
    </div>
  )
}

/** Same height as a text input so rows stay aligned. */
function CheckBox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 h-[34px] px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
      <input type="checkbox" disabled={disabled} checked={checked} onChange={e => onChange(e.target.checked)} /> {label}
    </label>
  )
}

function ImagePicker({ label, value, onChange, dis }: { label: string; value?: string; onChange: (v?: string) => void; dis: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [err, setErr] = useState('')
  const pick = (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setErr('Choose an image file.')
    if (f.size > 2 * 1024 * 1024) return setErr('Image is larger than 2 MB.')
    setErr('')
    const r = new FileReader(); r.onload = () => onChange(String(r.result)); r.readAsDataURL(f)
  }
  return (
    <div>
      <div className="text-xs font-bold text-slate-600 mb-1">{label}</div>
      <div className="h-32 border border-dashed border-slate-300 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
        {value ? <img src={value} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-slate-400">No image</span>}
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" aria-label={`Upload ${label}`} onChange={e => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {!dis && <div className="flex gap-3 mt-1.5 text-[11px] font-bold">
        <button type="button" onClick={() => ref.current?.click()} className="text-emerald-700">{value ? 'Change' : 'Upload'}</button>
        {value && <button type="button" onClick={() => onChange(undefined)} className="text-rose-600">Remove</button>}
      </div>}
      {err && <p className="text-[11px] text-rose-600 mt-1">{err}</p>}
    </div>
  )
}

/** Small inline "add" row for people and child companies. Saves the new contact straight away. */
function QuickAdd({ kind, parent, onSave, disabled }: { kind: ContactKind; parent: Contact; onSave: (c: Contact) => void; disabled: boolean }) {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [email, setEmail] = useState('')
  const add = () => {
    if (!name.trim()) return
    onSave(newContact(name.trim(), { kind, parentId: parent.id, phone, email, isCustomer: parent.isCustomer, isVendor: parent.isVendor }))
    setName(''); setPhone(''); setEmail('')
  }
  return (
    <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
      <Field label={kind === 'individual' ? 'Person name' : 'Company name'}><input className={inputCls} disabled={disabled} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} /></Field>
      <Field label="Phone"><input className={inputCls} disabled={disabled} value={phone} onChange={e => setPhone(e.target.value)} /></Field>
      <Field label="Email"><input className={inputCls} disabled={disabled} value={email} onChange={e => setEmail(e.target.value)} /></Field>
      <PrimaryButton onClick={add} disabled={disabled || !name.trim()}><Plus size={14} />Add</PrimaryButton>
    </div>
  )
}

export default function ContactDrawer({ contact, contacts, invoices, bills, readOnly, onSave, onArchive, onClose, onCreateInvoice, onOpenInvoice, onCreateBill }: Props) {
  const isNew = !contact
  // All form state lives here, so switching tabs never loses data
  const [c, setC] = useState<Contact>(() => contact ?? newContact('', { isCustomer: true }))
  const [tab, setTab] = useState<TabKey>('contacts')
  const [error, setError] = useState('')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setC(p => ({ ...p, [k]: v }))
  const dis = readOnly

  const onPhoto = (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Please choose an image file (PNG, JPG or WebP).')
    if (f.size > 2 * 1024 * 1024) return setError('Image is larger than 2 MB.')
    setError('')
    const r = new FileReader(); r.onload = () => set('image', String(r.result)); r.readAsDataURL(f)
  }

  // Registered (invoice) address is the first address; extra ones are delivery / other
  const invIdx = c.addresses.findIndex(a => a.type === 'invoice')
  const regAddr: ContactAddress = c.addresses[invIdx] ?? { id: 'ad_reg', type: 'invoice', street: '', city: '', region: '', zip: '', country: 'Saudi Arabia' }
  const setReg = (patch: Partial<ContactAddress>) =>
    set('addresses', invIdx >= 0 ? c.addresses.map((a, i) => (i === invIdx ? { ...a, ...patch } : a)) : [{ ...regAddr, ...patch }, ...c.addresses])
  const extra = c.addresses.filter(a => a.type !== 'invoice')
  const addExtra = () => set('addresses', [...c.addresses, { id: `ad_${Date.now()}`, type: 'delivery', street: '', city: '', region: '', zip: '', country: 'Saudi Arabia' }])
  const setExtra = (id: string, patch: Partial<ContactAddress>) => set('addresses', c.addresses.map(a => (a.id === id ? { ...a, ...patch } : a)))

  const people = contacts.filter(p => p.parentId === c.id && p.kind === 'individual')
  const children = contacts.filter(p => p.parentId === c.id && p.kind === 'company')
  const myInvoices = invoices.filter(i => i.partner.trim().toLowerCase() === c.name.trim().toLowerCase())
  const myBills = bills.filter(b => b.vendor.trim().toLowerCase() === c.name.trim().toLowerCase())
  const receivable = myInvoices.filter(i => i.state === 'open' || i.state === 'in_payment').reduce((s, i) => s + i.residual, 0)
  const payable = myBills.filter(b => b.state === 'open' || b.state === 'in_payment').reduce((s, b) => s + b.residual, 0)
  const billed = myInvoices.filter(i => i.state !== 'cancel' && i.state !== 'draft' && i.category !== 'proforma').reduce((s, i) => s + i.amountTotal, 0)

  const validate = (): string => {
    if (!c.name.trim()) return 'Name is required.'
    if (!c.isCustomer && !c.isVendor && c.kind === 'company') return 'Mark the contact as a customer, a vendor or both.'
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) return 'Email address looks invalid.'
    if (c.billingEmail && !/^\S+@\S+\.\S+$/.test(c.billingEmail)) return 'Billing email address looks invalid.'
    if (c.vat && !/^\d{15}$/.test(c.vat)) return 'Saudi VAT number must be 15 digits.'
    const dup = contacts.find(o => o.id !== c.id && o.name.trim().toLowerCase() === c.name.trim().toLowerCase())
    if (dup) return `A contact named "${dup.name}" already exists.`
    return ''
  }
  const save = () => {
    const e = validate(); setError(e); if (e) return
    onSave({ ...c, name: c.name.trim() }); onClose()
  }

  const mapsHref = c.latitude && c.longitude ? `https://www.google.com/maps?q=${encodeURIComponent(`${c.latitude},${c.longitude}`)}` : ''
  const parentName = contacts.find(p => p.id === c.parentId)?.name
  const needSaved: ReactNode = <p className="text-[11px] text-slate-400">Save this contact first, then add {''}people and companies to it.</p>

  return (
    <CenterDialog
      title={isNew ? 'New Contact' : c.name || 'Contact'}
      onClose={onClose}
      footer={<>
        {!isNew && !readOnly && <GhostButton danger={c.active} onClick={() => (c.active ? setConfirmArchive(true) : (onArchive(c.id, true), onClose()))}>{c.active ? 'Archive' : 'Restore'}</GhostButton>}
        <GhostButton onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</GhostButton>
        {!readOnly && <PrimaryButton onClick={save}>Save contact</PrimaryButton>}
      </>}
    >
      {error && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{error}</div>}

      {/* Profile header: always the same, whatever tab is open */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs" aria-label="Profile">
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="flex flex-col items-center gap-2 sm:w-28 flex-shrink-0">
            <div className="relative">
              <Avatar name={c.name || 'New'} src={c.image} size={96} round={c.kind === 'individual'} />
              {!dis && <button type="button" onClick={() => fileRef.current?.click()} aria-label="Change photo" className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow"><Camera size={14} /></button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Upload photo" onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = '' }} />
            {!dis && (c.image
              ? <button type="button" onClick={() => set('image', undefined)} className="text-[11px] text-rose-600 font-bold">Remove photo</button>
              : <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] text-emerald-700 font-bold">Upload photo</button>)}
          </div>
          <div className="flex-1 grid sm:grid-cols-2 gap-3 content-start">
            <Field label={c.kind === 'company' ? 'Company name *' : 'Full name *'} span={2}>
              <input className={`${inputCls} text-sm font-bold`} disabled={dis} value={c.name} onChange={e => set('name', e.target.value)} autoFocus={isNew} />
            </Field>
            <Field label="Contact type">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                {(['company', 'individual'] as ContactKind[]).map(k => (
                  <button key={k} disabled={dis} onClick={() => set('kind', k)} className={`px-3.5 py-1.5 rounded-md capitalize ${c.kind === k ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}>{k}</button>
                ))}
              </div>
            </Field>
            <Field label="Relationship">
              <div className="flex gap-4 py-1.5">
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={dis} checked={c.isCustomer} onChange={e => set('isCustomer', e.target.checked)} /> Customer</label>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={dis} checked={c.isVendor} onChange={e => set('isVendor', e.target.checked)} /> Vendor</label>
                {!c.active && <Pill tone="red">Archived</Pill>}
              </div>
            </Field>
          </div>
        </div>
      </section>

      {/* Two equal columns with identical field rows */}
      <div className="grid lg:grid-cols-2 gap-4 items-stretch">
        <Card title="ZATCA & Tax">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="ZATCA registered name" span={2}><input className={inputCls} disabled={dis} value={c.legalName || ''} onChange={e => set('legalName', e.target.value)} /></Field>
            <Field label="Identification scheme">
              <select className={inputCls} disabled={dis} value={c.idScheme || 'OTH'} onChange={e => set('idScheme', e.target.value as Contact['idScheme'])}>
                <option value="CRN">Commercial Registration</option><option value="MOM">Momra licence</option><option value="MLS">MHRSD licence</option><option value="SAG">Misa licence</option><option value="TIN">Tax identification</option><option value="700">700 Number</option><option value="OTH">Other ID</option>
              </select>
            </Field>
            <Field label="Identification number (SA)"><input className={`${inputCls} font-mono`} disabled={dis} value={c.idNumber || ''} onChange={e => set('idNumber', e.target.value)} /></Field>
            <Field label="VAT"><input className={`${inputCls} font-mono`} placeholder="15 digits" disabled={dis} value={c.vat} onChange={e => set('vat', e.target.value.replace(/\D/g, '').slice(0, 15))} /></Field>
            <Field label="CR number"><input className={`${inputCls} font-mono`} disabled={dis} value={c.crNumber} onChange={e => set('crNumber', e.target.value)} /></Field>
            <Field label="Tax ID (Arabic)"><input dir="rtl" className={inputCls} disabled={dis} value={c.taxIdArabic || ''} onChange={e => set('taxIdArabic', e.target.value)} /></Field>
            <Field label="Customer code"><input className={`${inputCls} font-mono`} disabled={dis} value={c.customerCode || ''} onChange={e => set('customerCode', e.target.value)} /></Field>
            <Field label="Vendor no"><input className={`${inputCls} font-mono`} disabled={dis} value={c.vendorNo || ''} onChange={e => set('vendorNo', e.target.value)} /></Field>
            <Field label="Customer discount %"><input type="number" min={0} max={100} className={inputCls} disabled={dis} value={c.discountPct ?? 0} onChange={e => set('discountPct', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></Field>
            <Field label="Discount (%)"><input type="number" min={0} max={100} className={inputCls} disabled={dis} value={c.discount ?? 0} onChange={e => set('discount', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></Field>
            <Field label="Cash customer"><CheckBox disabled={dis} checked={!!c.cashCustomer} onChange={v => set('cashCustomer', v)} label="Walk-in, no credit" /></Field>
          </div>
        </Card>

        <Card title="Contact">
          <div className="grid sm:grid-cols-2 gap-3">
            {c.kind === 'individual' && (
              <>
                <Field label="Job position"><input className={inputCls} disabled={dis} value={c.jobTitle || ''} placeholder="e.g. Sales Director" onChange={e => set('jobTitle', e.target.value)} /></Field>
                <Field label="Company code"><input className={`${inputCls} font-mono`} disabled={dis} value={c.companyCode || ''} onChange={e => set('companyCode', e.target.value)} /></Field>
                <Field label="Works for" span={2}>
                  <select className={inputCls} disabled={dis} value={c.parentId || ''} onChange={e => set('parentId', e.target.value || undefined)}>
                    <option value="">— None —</option>
                    {contacts.filter(p => p.kind === 'company' && p.id !== c.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Phone"><input className={inputCls} disabled={dis} value={c.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field label="Mobile"><input className={inputCls} disabled={dis} value={c.mobile} onChange={e => set('mobile', e.target.value)} /></Field>
            <Field label="Email"><input className={inputCls} disabled={dis} value={c.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field label="Website"><input className={inputCls} disabled={dis} value={c.website} placeholder="e.g. www.example.com" onChange={e => set('website', e.target.value)} /></Field>
            <Field label="Fax"><input className={inputCls} disabled={dis} value={c.fax || ''} onChange={e => set('fax', e.target.value)} /></Field>
            <Field label="Title"><select className={inputCls} disabled={dis} value={c.title || ''} onChange={e => set('title', e.target.value || undefined)}><option value="">—</option>{['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Eng.', 'Sheikh'].map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Language"><select className={inputCls} disabled={dis} value={c.language || 'English'} onChange={e => set('language', e.target.value)}><option>English</option><option>Arabic</option></select></Field>
            <Field label="Girfalco ID"><input type="number" min={0} className={inputCls} disabled={dis} value={c.girfalcoId ?? ''} placeholder="0" onChange={e => set('girfalcoId', e.target.value)} /></Field>
            <Field label="Tags" span={2}><input className={inputCls} disabled={dis} placeholder="Comma separated" value={c.tags.join(', ')} onChange={e => set('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} /></Field>
          </div>
        </Card>
      </div>

      {/* Tabs live inside the main form, directly under the profile and sections */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div role="tablist" aria-label="Contact sections" className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-2">
          {TABS.map(t => (
            <button key={t.id} role="tab" id={`ctab-${t.id}`} aria-selected={tab === t.id} aria-controls={`cpanel-${t.id}`} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition ${tab === t.id ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`cpanel-${tab}`} aria-labelledby={`ctab-${tab}`} className="p-4 sm:p-5 space-y-5 min-h-[220px]">
          {tab === 'contacts' && (
            <>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-2">Registered address</h3>
                <AddressFields a={regAddr} set={setReg} dis={dis} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Other addresses</h3>
                  {!dis && <GhostButton onClick={addExtra}><Plus size={12} className="inline -mt-0.5 mr-1" />Add address</GhostButton>}
                </div>
                {extra.length === 0 ? <p className="text-xs text-slate-500">No delivery or other addresses.</p> : (
                  <div className="space-y-3">
                    {extra.map(a => (
                      <div key={a.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
                        <div className="flex items-end justify-between gap-3">
                          <div className="w-48"><Field label="Address type"><select className={inputCls} disabled={dis} value={a.type} onChange={e => setExtra(a.id, { type: e.target.value as ContactAddress['type'] })}><option value="delivery">Delivery address</option><option value="other">Other</option></select></Field></div>
                          {!dis && <button onClick={() => set('addresses', c.addresses.filter(x => x.id !== a.id))} className="text-[11px] text-rose-600 font-bold inline-flex items-center gap-1 pb-2"><Trash2 size={12} />Remove</button>}
                        </div>
                        <AddressFields a={a} set={patch => setExtra(a.id, patch)} dis={dis} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide mb-2">Contact persons</h3>
                {people.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                    {people.map(p => (
                      <div key={p.id} className="border border-slate-200 rounded-lg p-3 flex gap-3 bg-white">
                        <Avatar name={p.name} src={p.image} size={44} round />
                        <div className="min-w-0 text-xs">
                          <div className="font-bold text-slate-900 truncate">{p.name}</div>
                          {p.jobTitle && <div className="text-slate-500 truncate">{p.jobTitle}</div>}
                          {p.email && <div className="text-emerald-700 flex items-center gap-1 truncate"><Mail size={11} />{p.email}</div>}
                          {(p.mobile || p.phone) && <div className="text-slate-600 flex items-center gap-1 font-mono"><Phone size={11} />{p.mobile || p.phone}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {people.length === 0 && <p className="text-xs text-slate-500 mb-2">No contact persons yet.</p>}
                {!dis && (isNew ? needSaved : <QuickAdd kind="individual" parent={c} onSave={onSave} disabled={dis} />)}
              </div>
            </>
          )}

          {tab === 'children' && (
            <>
              {parentName && <p className="text-xs text-slate-600">This company belongs to <span className="font-bold">{parentName}</span>.</p>}
              {children.length === 0 ? <p className="text-xs text-slate-500">No child companies.</p> : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {children.map(p => (
                    <div key={p.id} className="border border-slate-200 rounded-lg p-3 flex gap-3">
                      <Avatar name={p.name} src={p.image} size={44} />
                      <div className="min-w-0 text-xs"><div className="font-bold text-slate-900 truncate">{p.name}</div><div className="text-slate-500 truncate">{p.email || p.phone || '—'}</div><div className="font-mono text-slate-400">{p.vat || ''}</div></div>
                    </div>
                  ))}
                </div>
              )}
              {!dis && c.kind === 'company' && (isNew ? needSaved : <QuickAdd kind="company" parent={c} onSave={onSave} disabled={dis} />)}
              {c.kind === 'individual' && <p className="text-xs text-slate-400">Child companies can only be added to a company.</p>}
            </>
          )}

          {tab === 'notes' && (
            <Field label="Internal notes" hint="Only visible to your team. Never printed on documents.">
              <textarea rows={8} className={`${inputCls} resize-y`} disabled={dis} value={c.notes} onChange={e => set('notes', e.target.value)} placeholder="Add anything your team should know about this contact…" />
            </Field>
          )}

          {tab === 'seal' && (
            <div className="grid sm:grid-cols-2 gap-5">
              <ImagePicker label="Signature" value={c.signature} onChange={v => set('signature', v)} dis={dis} />
              <ImagePicker label="Company seal" value={c.seal} onChange={v => set('seal', v)} dis={dis} />
              <Field label="Authorised signatory"><input className={inputCls} disabled={dis} value={c.signatory || ''} onChange={e => set('signatory', e.target.value)} /></Field>
              <Field label="Signatory title"><input className={inputCls} disabled={dis} value={c.signatoryTitle || ''} onChange={e => set('signatoryTitle', e.target.value)} /></Field>
            </div>
          )}

          {tab === 'sales' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Salesperson"><input className={inputCls} disabled={dis} value={c.salesperson || ''} onChange={e => set('salesperson', e.target.value)} /></Field>
              <Field label="Customer payment terms"><select className={inputCls} disabled={dis} value={c.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}>{TERMS.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Vendor payment terms"><select className={inputCls} disabled={dis} value={c.vendorPaymentTerms || c.paymentTerms} onChange={e => set('vendorPaymentTerms', e.target.value)}>{TERMS.map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Credit limit (SAR)"><input type="number" min={0} className={inputCls} disabled={dis} value={c.creditLimit} onChange={e => set('creditLimit', Math.max(0, Number(e.target.value) || 0))} /></Field>
              <Field label="Currency"><select className={inputCls} disabled={dis} value={c.currency} onChange={e => set('currency', e.target.value)}>{['SAR', 'USD', 'EUR', 'AED'].map(t => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Tax status"><select className={inputCls} disabled={dis} value={c.taxRegime} onChange={e => set('taxRegime', e.target.value as Contact['taxRegime'])}>{REGIMES.map(t => <option key={t}>{t}</option>)}</select></Field>
            </div>
          )}

          {tab === 'location' && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Latitude"><input className={`${inputCls} font-mono`} disabled={dis} value={c.latitude || ''} placeholder="24.7136" onChange={e => set('latitude', e.target.value)} /></Field>
                <Field label="Longitude"><input className={`${inputCls} font-mono`} disabled={dis} value={c.longitude || ''} placeholder="46.6753" onChange={e => set('longitude', e.target.value)} /></Field>
              </div>
              <Field label="Site notes & directions"><textarea rows={4} className={`${inputCls} resize-y`} disabled={dis} value={c.locationNotes || ''} onChange={e => set('locationNotes', e.target.value)} placeholder="Gate number, delivery hours, nearest landmark…" /></Field>
              <div className="flex items-center gap-3 text-xs">
                <MapPin size={14} className="text-slate-400" />
                {mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer" className="text-emerald-700 font-bold inline-flex items-center gap-1">Open in Maps <ExternalLink size={12} /></a> : <span className="text-slate-400">Enter latitude and longitude to open the location in Maps.</span>}
              </div>
            </div>
          )}

          {tab === 'invoicing' && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Billing email"><input className={inputCls} disabled={dis} value={c.billingEmail || ''} placeholder={c.email || 'accounts@example.com'} onChange={e => set('billingEmail', e.target.value)} /></Field>
                <Field label="Invoice delivery"><select className={inputCls} disabled={dis} value={c.invoiceDelivery || 'email'} onChange={e => set('invoiceDelivery', e.target.value as Contact['invoiceDelivery'])}><option value="email">By email</option><option value="print">Printed copy</option><option value="both">Email and print</option></select></Field>
                <Field label="Bank name"><input className={inputCls} disabled={dis} value={c.bankName || ''} onChange={e => set('bankName', e.target.value)} /></Field>
                <Field label="IBAN" span={2}><input className={`${inputCls} font-mono`} disabled={dis} value={c.iban || ''} placeholder="SA00 0000 0000 0000 0000 0000" onChange={e => set('iban', e.target.value.toUpperCase())} /></Field>
                <Field label="SWIFT / BIC"><input className={`${inputCls} font-mono`} disabled={dis} value={c.swift || ''} onChange={e => set('swift', e.target.value.toUpperCase())} /></Field>
              </div>
              {isNew ? <p className="text-[11px] text-slate-400">Invoices and bills for this contact appear here once it is saved.</p> : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Kpi label="Total invoiced" value={moneyFormat(billed)} />
                    <Kpi label="Receivable" value={moneyFormat(receivable)} tone={c.creditLimit > 0 && receivable > c.creditLimit ? 'red' : undefined} hint={c.creditLimit > 0 ? `Limit ${moneyFormat(c.creditLimit)}` : 'No credit limit'} />
                    <Kpi label="Payable" value={moneyFormat(payable)} />
                    <Kpi label="Documents" value={myInvoices.length + myBills.length} hint={`${myInvoices.length} invoices · ${myBills.length} bills`} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {c.isCustomer && onCreateInvoice && <PrimaryButton onClick={() => onCreateInvoice(c.name)}><FileText size={14} />New invoice</PrimaryButton>}
                    {c.isVendor && onCreateBill && <GhostButton onClick={onCreateBill}><Receipt size={13} className="inline -mt-0.5 mr-1" />New vendor bill</GhostButton>}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <h3 className="font-extrabold text-slate-800 uppercase tracking-wide mb-1">Recent invoices</h3>
                      {myInvoices.length === 0 ? <p className="text-slate-500">None.</p> : <ul className="divide-y divide-slate-100">{myInvoices.slice(0, 6).map(i => (
                        <li key={i.id} className="py-1.5 flex items-center justify-between"><button className="font-bold text-emerald-700 hover:underline" onClick={() => onOpenInvoice?.(i)}>{i.number}</button><span className="text-slate-500">{i.state}</span><span className="font-mono">{moneyFormat(i.amountTotal)}</span></li>))}</ul>}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 uppercase tracking-wide mb-1">Recent vendor bills</h3>
                      {myBills.length === 0 ? <p className="text-slate-500">None.</p> : <ul className="divide-y divide-slate-100">{myBills.slice(0, 6).map(b => (
                        <li key={b.id} className="py-1.5 flex items-center justify-between"><span className="font-bold">{b.number}</span><span className="text-slate-500">{b.state}</span><span className="font-mono">{moneyFormat(b.amountTotal)}</span></li>))}</ul>}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </section>

      {confirmArchive && <ConfirmDialog title="Archive contact?" text="Archived contacts are hidden from lists and pickers but their documents are kept." confirmLabel="Archive" danger onCancel={() => setConfirmArchive(false)} onConfirm={() => { onArchive(c.id, false); onClose() }} />}
    </CenterDialog>
  )
}
