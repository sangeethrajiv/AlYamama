import { useRef, useState, type ReactNode } from 'react'
import { Plus, Trash2, Camera, Mail, Phone, FileText, Receipt } from 'lucide-react'
import { moneyFormat } from '../../data/mockAccountingData'
import type { Invoice, Bill } from '../../types/accounting'
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

type TabKey = 'contacts' | 'children' | 'invoices' | 'notes'
const TABS: { id: TabKey; label: string }[] = [
  { id: 'contacts', label: 'Contacts & Addresses' },
  { id: 'children', label: 'Child Company' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'notes', label: 'Internal Notes' },
]

const ic = inputCls.replace('py-2', 'py-1.5')

function AddressFields({ a, set, dis, cols = 'sm:grid-cols-2 lg:grid-cols-4' }: { a: ContactAddress; set: (patch: Partial<ContactAddress>) => void; dis: boolean; cols?: string }) {
  const T = (label: string, key: keyof ContactAddress, extra = '', rtl = false) => (
    <Field dense label={label}><input dir={rtl ? 'rtl' : undefined} className={`${ic} ${extra}`} disabled={dis} value={(a[key] as string) || ''} onChange={e => set({ [key]: e.target.value } as Partial<ContactAddress>)} /></Field>
  )
  return (
    <div className={`grid ${cols} gap-x-3 gap-y-2`}>
      {T('Street', 'street')}{T('Neighborhood', 'neighborhood')}{T('Street (Arabic)', 'streetAr', '', true)}{T('Building number', 'buildingNumber', 'font-mono')}
      {T('City', 'city')}{T('City (Arabic)', 'cityAr', '', true)}{T('State / Region', 'region')}{T('ZIP', 'zip', 'font-mono')}
      {T('Country', 'country')}{T('Plot identification', 'plotId', 'font-mono')}
    </div>
  )
}

/** Boolean switch, same height as a text input so rows stay aligned. */
function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-2 h-[30px]">
      <button type="button" role="switch" aria-checked={checked} aria-label="Cash customer" disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-slate-300'} disabled:opacity-60`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-xs text-slate-600">{checked ? 'Yes' : 'No'}</span>
    </div>
  )
}

type AddType = 'contact' | 'delivery' | 'other'
const blankAddr = (): ContactAddress => ({ id: `ad_${Date.now()}`, type: 'invoice', street: '', city: '', region: '', zip: '', country: 'Saudi Arabia' })

/** "Create Contacts" dialog: opened by the Add buttons. Nothing is shown on the tab until something is added. */
function AddDialog({ kind, parent, isNew, onCreate, onAddAddress, onClose }: {
  kind: 'person' | 'company'; parent: Contact; isNew: boolean; onCreate: (c: Contact) => void; onAddAddress: (a: ContactAddress) => void; onClose: () => void
}) {
  const [type, setType] = useState<AddType>('contact')
  const [f, setF] = useState({ name: '', title: '', jobTitle: '', companyCode: '', email: '', phone: '', mobile: '', fax: '', website: '', vat: '', notes: '' })
  const [addr, setAddr] = useState<ContactAddress>(blankAddr)
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))
  const isAddress = kind === 'person' && type !== 'contact'
  const person = kind === 'person' && type === 'contact'
  const title = kind === 'company' ? 'Create Child Company' : 'Create Contacts'

  const save = () => {
    if (isAddress) {
      if (!addr.street.trim() && !addr.city.trim()) return setErr('Enter at least a street or a city.')
      onAddAddress({ ...addr, id: `ad_${Date.now()}`, type: type as 'delivery' | 'other' }); return onClose()
    }
    if (isNew) return setErr('Save this contact first, then add people and companies to it.')
    if (!f.name.trim()) return setErr(kind === 'company' ? 'Company name is required.' : 'Contact name is required.')
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setErr('Email address looks invalid.')
    if (f.vat && !/^\d{15}$/.test(f.vat)) return setErr('VAT number must be 15 digits.')
    onCreate(newContact(f.name.trim(), {
      kind: kind === 'company' ? 'company' : 'individual', parentId: parent.id, isCustomer: parent.isCustomer, isVendor: parent.isVendor,
      title: f.title || undefined, jobTitle: f.jobTitle || undefined, companyCode: f.companyCode || undefined, email: f.email, phone: f.phone, mobile: f.mobile,
      fax: f.fax || undefined, website: f.website, vat: f.vat, notes: f.notes, addresses: [],
    }))
    onClose()
  }
  const T = (label: string, k: keyof typeof f, ph = '', cls = '') => <Field dense label={label}><input className={`${ic} ${cls}`} placeholder={ph} value={f[k]} onChange={e => set(k, e.target.value)} /></Field>

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[60] flex items-center justify-center p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between"><h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 text-lg leading-none px-1">&times;</button></div>
        <div className="p-4 space-y-3 overflow-y-auto">
          {err && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{err}</div>}
          {kind === 'person' && (
            <select aria-label="Type" className={ic} value={type} onChange={e => { setType(e.target.value as AddType); setErr('') }}>
              <option value="contact">Contact</option><option value="delivery">Delivery address</option><option value="other">Other address</option>
            </select>
          )}
          {!isAddress && (
            <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2">
              <div className="sm:col-span-2">{T(kind === 'company' ? 'Company name *' : 'Contact name *', 'name')}</div>
              {person && <>
                <Field dense label="Title"><select className={ic} value={f.title} onChange={e => set('title', e.target.value)}><option value="">e.g. Mr.</option>{['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Eng.', 'Sheikh'].map(t => <option key={t}>{t}</option>)}</select></Field>
                {T('Job position', 'jobTitle', 'e.g. Sales Director')}
                {T('Company code', 'companyCode', '', 'font-mono')}
              </>}
              {kind === 'company' && <>{T('VAT', 'vat', '15 digits', 'font-mono')}{T('Website', 'website', 'e.g. www.example.com')}</>}
              {T('Email', 'email')}{T('Phone', 'phone')}{T('Mobile', 'mobile')}
              {person && T('Fax', 'fax')}
              <div className="sm:col-span-2"><Field dense label="Notes"><textarea rows={2} className={`${ic} resize-none`} placeholder="internal note…" value={f.notes} onChange={e => set('notes', e.target.value)} /></Field></div>
            </div>
          )}
          {isAddress && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Address</div>
              <AddressFields a={addr} set={patch => setAddr(p => ({ ...p, ...patch }))} dis={false} cols="sm:grid-cols-2" />
            </div>
          )}
        </div>
        <div className="px-4 py-2.5 border-t border-slate-200 flex justify-end gap-2"><PrimaryButton onClick={save}>Save</PrimaryButton><GhostButton onClick={onClose}>Discard</GhostButton></div>
      </div>
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
  const [adding, setAdding] = useState<'person' | 'company' | null>(null)
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setC(p => ({ ...p, [k]: v }))
  const dis = readOnly

  const onPhoto = (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Please choose an image file (PNG, JPG or WebP).')
    if (f.size > 2 * 1024 * 1024) return setError('Image is larger than 2 MB.')
    setError('')
    const r = new FileReader(); r.onload = () => set('image', String(r.result)); r.readAsDataURL(f)
  }

  const extra = c.addresses.filter(a => a.type !== 'invoice')

  const people = contacts.filter(p => p.parentId === c.id && p.kind === 'individual')
  const children = contacts.filter(p => p.parentId === c.id && p.kind === 'company')

  // Documents are matched to this contact by exact name (no foreign key exists)
  const sameName = (n: string) => n.trim().toLowerCase() === c.name.trim().toLowerCase()
  const myInvoices = invoices.filter(i => sameName(i.partner))
  const myBills = bills.filter(b => sameName(b.vendor))
  const open = (st: string) => st === 'open' || st === 'in_payment'
  const receivable = myInvoices.filter(i => open(i.state)).reduce((a, i) => a + i.residual, 0)
  const billed = myInvoices.filter(i => i.state !== 'cancel' && i.state !== 'draft' && i.category !== 'proforma').reduce((a, i) => a + i.amountTotal, 0)
  const payable = myBills.filter(b => open(b.state)).reduce((a, b) => a + b.residual, 0)
  const STATE: Record<string, string> = { draft: 'Draft', open: 'Posted', in_payment: 'In payment', paid: 'Paid', cancel: 'Cancelled' }
  const TONE: Record<string, 'slate' | 'amber' | 'blue' | 'green' | 'red'> = { draft: 'slate', open: 'amber', in_payment: 'blue', paid: 'green', cancel: 'red' }

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

  const parentName = contacts.find(p => p.id === c.parentId)?.name

  return (
    <CenterDialog
      dense
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
      <section className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs" aria-label="Profile">
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
          <div className="flex-1 grid sm:grid-cols-2 gap-x-3 gap-y-2 content-start">
            <Field dense label={c.kind === 'company' ? 'Company name *' : 'Full name *'} span={2}>
              <input className={`${ic} text-sm font-bold`} disabled={dis} value={c.name} onChange={e => set('name', e.target.value)} autoFocus={isNew} />
            </Field>
            <Field dense label="Contact type">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                {(['company', 'individual'] as ContactKind[]).map(k => (
                  <button key={k} disabled={dis} onClick={() => set('kind', k)} className={`px-3.5 py-1.5 rounded-md capitalize ${c.kind === k ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}>{k}</button>
                ))}
              </div>
            </Field>
            <Field dense label="Relationship">
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
        <Card dense title="ZATCA & Tax">
          <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2">
            <Field dense label="ZATCA registered name" span={2}><input className={ic} disabled={dis} value={c.legalName || ''} onChange={e => set('legalName', e.target.value)} /></Field>
            <Field dense label="Identification scheme">
              <select className={ic} disabled={dis} value={c.idScheme || 'OTH'} onChange={e => set('idScheme', e.target.value as Contact['idScheme'])}>
                <option value="CRN">Commercial Registration</option><option value="MOM">Momra licence</option><option value="MLS">MHRSD licence</option><option value="SAG">Misa licence</option><option value="TIN">Tax identification</option><option value="700">700 Number</option><option value="OTH">Other ID</option>
              </select>
            </Field>
            <Field dense label="Identification number (SA)"><input className={`${ic} font-mono`} disabled={dis} value={c.idNumber || ''} onChange={e => set('idNumber', e.target.value)} /></Field>
            <Field dense label="VAT"><input className={`${ic} font-mono`} placeholder="15 digits" disabled={dis} value={c.vat} onChange={e => set('vat', e.target.value.replace(/\D/g, '').slice(0, 15))} /></Field>
            <Field dense label="CR number"><input className={`${ic} font-mono`} disabled={dis} value={c.crNumber} onChange={e => set('crNumber', e.target.value)} /></Field>
            <Field dense label="Tax ID (Arabic)"><input dir="rtl" className={ic} disabled={dis} value={c.taxIdArabic || ''} onChange={e => set('taxIdArabic', e.target.value)} /></Field>
            <Field dense label="Customer code"><input className={`${ic} font-mono`} disabled={dis} value={c.customerCode || ''} onChange={e => set('customerCode', e.target.value)} /></Field>
            <Field dense label="Vendor no"><input className={`${ic} font-mono`} disabled={dis} value={c.vendorNo || ''} onChange={e => set('vendorNo', e.target.value)} /></Field>
            <Field dense label="Customer discount %"><input type="number" min={0} max={100} className={ic} disabled={dis} value={c.discountPct ?? 0} onChange={e => set('discountPct', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></Field>
            <Field dense label="Discount (%)"><input type="number" min={0} max={100} className={ic} disabled={dis} value={c.discount ?? 0} onChange={e => set('discount', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></Field>
            <Field dense label="Cash customer"><Switch disabled={dis} checked={!!c.cashCustomer} onChange={v => set('cashCustomer', v)} /></Field>
          </div>
        </Card>

        <Card dense title="Contact">
          <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2">
            {c.kind === 'individual' && (
              <>
                <Field dense label="Job position"><input className={ic} disabled={dis} value={c.jobTitle || ''} placeholder="e.g. Sales Director" onChange={e => set('jobTitle', e.target.value)} /></Field>
                <Field dense label="Company code"><input className={`${ic} font-mono`} disabled={dis} value={c.companyCode || ''} onChange={e => set('companyCode', e.target.value)} /></Field>
                <Field dense label="Works for" span={2}>
                  <select className={ic} disabled={dis} value={c.parentId || ''} onChange={e => set('parentId', e.target.value || undefined)}>
                    <option value="">— None —</option>
                    {contacts.filter(p => p.kind === 'company' && p.id !== c.id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field dense label="Phone"><input className={ic} disabled={dis} value={c.phone} onChange={e => set('phone', e.target.value)} /></Field>
            <Field dense label="Mobile"><input className={ic} disabled={dis} value={c.mobile} onChange={e => set('mobile', e.target.value)} /></Field>
            <Field dense label="Email"><input className={ic} disabled={dis} value={c.email} onChange={e => set('email', e.target.value)} /></Field>
            <Field dense label="Website"><input className={ic} disabled={dis} value={c.website} placeholder="e.g. www.example.com" onChange={e => set('website', e.target.value)} /></Field>
            <Field dense label="Fax"><input className={ic} disabled={dis} value={c.fax || ''} onChange={e => set('fax', e.target.value)} /></Field>
            <Field dense label="Title"><select className={ic} disabled={dis} value={c.title || ''} onChange={e => set('title', e.target.value || undefined)}><option value="">—</option>{['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Eng.', 'Sheikh'].map(t => <option key={t}>{t}</option>)}</select></Field>
            <Field dense label="Language"><select className={ic} disabled={dis} value={c.language || 'English'} onChange={e => set('language', e.target.value)}><option>English</option><option>Arabic</option></select></Field>
            <Field dense label="Girfalco ID"><input type="number" min={0} className={ic} disabled={dis} value={c.girfalcoId ?? ''} placeholder="0" onChange={e => set('girfalcoId', e.target.value)} /></Field>
            <Field dense label="Tags" span={2}><input className={ic} disabled={dis} placeholder="Comma separated" value={c.tags.join(', ')} onChange={e => set('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} /></Field>
          </div>
        </Card>
      </div>

      {/* Tabs live inside the main form, directly under the profile and sections */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div role="tablist" aria-label="Contact sections" className="flex overflow-x-auto border-b border-slate-200 bg-slate-50/70 px-2">
          {TABS.map(t => (
            <button key={t.id} role="tab" id={`ctab-${t.id}`} aria-selected={tab === t.id} aria-controls={`cpanel-${t.id}`} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 -mb-px transition ${tab === t.id ? 'border-emerald-600 text-emerald-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`cpanel-${tab}`} aria-labelledby={`ctab-${tab}`} className="p-3 sm:p-4 space-y-3 min-h-[140px]">
          {tab === 'contacts' && (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Contacts &amp; addresses</h3>
                  {!dis && <GhostButton onClick={() => setAdding('person')}><Plus size={12} className="inline -mt-0.5 mr-1" />Add</GhostButton>}
                </div>
                {(people.length > 0 || extra.length > 0) && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                    {people.map(p => (
                      <div key={p.id} className="border border-slate-200 rounded-lg p-2.5 flex gap-2.5 bg-white">
                        <Avatar name={p.name} src={p.image} size={38} round />
                        <div className="min-w-0 text-xs">
                          <div className="font-bold text-slate-900 truncate">{p.title ? `${p.title} ` : ''}{p.name}</div>
                          {p.jobTitle && <div className="text-slate-500 truncate">{p.jobTitle}</div>}
                          {p.email && <div className="text-emerald-700 flex items-center gap-1 truncate"><Mail size={11} />{p.email}</div>}
                          {(p.mobile || p.phone) && <div className="text-slate-600 flex items-center gap-1 font-mono"><Phone size={11} />{p.mobile || p.phone}</div>}
                        </div>
                      </div>
                    ))}
                    {extra.map(a => (
                      <div key={a.id} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/60 text-xs relative">
                        <Pill>{a.type === 'delivery' ? 'Delivery address' : 'Other address'}</Pill>
                        <div className="mt-1 text-slate-700 leading-snug">{[a.street, a.neighborhood, [a.city, a.zip].filter(Boolean).join(' '), a.region, a.country].filter(Boolean).join(', ') || '—'}</div>
                        {!dis && <button onClick={() => set('addresses', c.addresses.filter(x => x.id !== a.id))} aria-label="Remove address" className="absolute top-2 right-2 text-slate-400 hover:text-rose-600"><Trash2 size={13} /></button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'children' && (
            <>
              {parentName && <p className="text-xs text-slate-600">This company belongs to <span className="font-bold">{parentName}</span>.</p>}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Child companies</h3>
                {!dis && c.kind === 'company' && <GhostButton onClick={() => setAdding('company')}><Plus size={12} className="inline -mt-0.5 mr-1" />Add</GhostButton>}
              </div>
              {children.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {children.map(p => (
                    <div key={p.id} className="border border-slate-200 rounded-lg p-2.5 flex gap-2.5">
                      <Avatar name={p.name} src={p.image} size={38} />
                      <div className="min-w-0 text-xs"><div className="font-bold text-slate-900 truncate">{p.name}</div><div className="text-slate-500 truncate">{p.email || p.phone || '—'}</div><div className="font-mono text-slate-400">{p.vat || ''}</div></div>
                    </div>
                  ))}
                </div>
              )}
              {c.kind === 'individual' && <p className="text-xs text-slate-400">Child companies can only be added to a company.</p>}
            </>
          )}

          {tab === 'invoices' && (
            isNew ? <p className="text-xs text-slate-500">Save this contact first. Invoices appear here once the contact exists and has documents under the same name.</p> : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Kpi label="Invoices" value={myInvoices.length} />
                  <Kpi label="Total invoiced" value={moneyFormat(billed)} />
                  <Kpi label="Amount due" value={moneyFormat(receivable)} tone={receivable > 0 ? 'amber' : undefined} />
                  {c.isVendor && <Kpi label="Payable (bills)" value={moneyFormat(payable)} />}
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Customer invoices</h3>
                  <div className="flex gap-2">
                    {c.isVendor && onCreateBill && <GhostButton onClick={onCreateBill}><Receipt size={13} className="inline -mt-0.5 mr-1" />New vendor bill</GhostButton>}
                    {onCreateInvoice && <PrimaryButton onClick={() => onCreateInvoice(c.name)}><FileText size={14} />New invoice</PrimaryButton>}
                  </div>
                </div>
                {myInvoices.length === 0 ? <p className="text-xs text-slate-500">No invoices for this customer yet.</p> : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wide"><tr>
                        <th className="px-3 py-2 text-left font-bold">Invoice #</th><th className="px-3 py-2 text-left font-bold">Type</th><th className="px-3 py-2 text-left font-bold">Date</th>
                        <th className="px-3 py-2 text-left font-bold">Due</th><th className="px-3 py-2 text-right font-bold">Total</th><th className="px-3 py-2 text-right font-bold">Amount due</th><th className="px-3 py-2 text-left font-bold">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {myInvoices.map(i => (
                          <tr key={i.id} onClick={() => onOpenInvoice?.(i)} className="hover:bg-slate-50 cursor-pointer">
                            <td className="px-3 py-2 font-bold text-emerald-700">{i.number}</td>
                            <td className="px-3 py-2 text-slate-600 capitalize">{i.category || 'credit'}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{i.dateInvoice}</td>
                            <td className="px-3 py-2 font-mono text-slate-600">{i.dateDue}</td>
                            <td className="px-3 py-2 text-right font-mono">{moneyFormat(i.amountTotal)}</td>
                            <td className="px-3 py-2 text-right font-mono">{i.residual ? moneyFormat(i.residual) : '—'}</td>
                            <td className="px-3 py-2"><Pill tone={TONE[i.state]}>{STATE[i.state]}</Pill></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {c.isVendor && myBills.length > 0 && (
                  <>
                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide pt-2">Vendor bills</h3>
                    <ul className="divide-y divide-slate-100 text-xs border border-slate-200 rounded-lg px-3">
                      {myBills.map(b => (
                        <li key={b.id} className="py-2 flex items-center justify-between gap-3"><span className="font-bold">{b.number}</span><span className="font-mono text-slate-500">{b.dateBill}</span><Pill tone={TONE[b.state]}>{STATE[b.state]}</Pill><span className="font-mono">{moneyFormat(b.amountTotal)}</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )
          )}

          {tab === 'notes' && (
            <Field dense label="Internal notes" hint="Only visible to your team. Never printed on documents.">
              <textarea rows={8} className={`${ic} resize-y`} disabled={dis} value={c.notes} onChange={e => set('notes', e.target.value)} placeholder="Add anything your team should know about this contact…" />
            </Field>
          )}
        </div>
      </section>

      {adding && (
        <AddDialog kind={adding} parent={c} isNew={isNew} onClose={() => setAdding(null)} onCreate={onSave}
          onAddAddress={a => set('addresses', [...c.addresses, a])} />
      )}

      {confirmArchive && <ConfirmDialog title="Archive contact?" text="Archived contacts are hidden from lists and pickers but their documents are kept." confirmLabel="Archive" danger onCancel={() => setConfirmArchive(false)} onConfirm={() => { onArchive(c.id, false); onClose() }} />}
    </CenterDialog>
  )
}
