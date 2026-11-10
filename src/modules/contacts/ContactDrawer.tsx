import { useRef, useState } from 'react'
import { FileText, Receipt, Camera } from 'lucide-react'
import type { Invoice, Bill } from '../../types/accounting'
import { moneyFormat } from '../../data/mockAccountingData'
import type { Contact, ContactAddress, ContactKind } from './types'
import { newContact } from './data'
import { Drawer, Field, inputCls, PrimaryButton, GhostButton, Pill, Card, Segmented, Kpi, ConfirmDialog, Avatar } from '../shared/ui'

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

function AddressFields({ a, set, dis }: { a: ContactAddress; set: (patch: Partial<ContactAddress>) => void; dis: boolean }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field label="Street"><input className={inputCls} disabled={dis} value={a.street} onChange={e => set({ street: e.target.value })} /></Field>
      <Field label="Neighborhood"><input className={inputCls} disabled={dis} value={a.neighborhood || ''} onChange={e => set({ neighborhood: e.target.value })} /></Field>
      <Field label="Street (Arabic)"><input dir="rtl" className={inputCls} disabled={dis} value={a.streetAr || ''} onChange={e => set({ streetAr: e.target.value })} /></Field>
      <Field label="Building number"><input className={`${inputCls} font-mono`} disabled={dis} value={a.buildingNumber || ''} onChange={e => set({ buildingNumber: e.target.value })} /></Field>
      <Field label="City"><input className={inputCls} disabled={dis} value={a.city} onChange={e => set({ city: e.target.value })} /></Field>
      <Field label="City (Arabic)"><input dir="rtl" className={inputCls} disabled={dis} value={a.cityAr || ''} onChange={e => set({ cityAr: e.target.value })} /></Field>
      <Field label="State / Region"><input className={inputCls} disabled={dis} value={a.region} onChange={e => set({ region: e.target.value })} /></Field>
      <Field label="ZIP"><input className={`${inputCls} font-mono`} disabled={dis} value={a.zip} onChange={e => set({ zip: e.target.value })} /></Field>
      <Field label="Country"><input className={inputCls} disabled={dis} value={a.country} onChange={e => set({ country: e.target.value })} /></Field>
      <Field label="Plot identification"><input className={`${inputCls} font-mono`} disabled={dis} value={a.plotId || ''} onChange={e => set({ plotId: e.target.value })} /></Field>
    </div>
  )
}


export default function ContactDrawer({ contact, contacts, invoices, bills, readOnly, onSave, onArchive, onClose, onCreateInvoice, onOpenInvoice, onCreateBill }: Props) {
  const isNew = !contact
  const [c, setC] = useState<Contact>(() => contact ?? newContact('', { isCustomer: true }))
  const [tab, setTab] = useState<'details' | 'people' | 'accounting'>('details')
  const [error, setError] = useState('')
  const [confirmArchive, setConfirmArchive] = useState(false)
  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setC(p => ({ ...p, [k]: v }))
  const dis = readOnly
  const fileRef = useRef<HTMLInputElement>(null)
  const onPhoto = (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return setError('Please choose an image file (PNG, JPG or WebP).')
    if (f.size > 2 * 1024 * 1024) return setError('Image is larger than 2 MB.')
    setError('')
    const r = new FileReader()
    r.onload = () => set('image', String(r.result))
    r.readAsDataURL(f)
  }

  const people = contacts.filter(p => p.parentId === c.id)
  const myInvoices = invoices.filter(i => i.partner.trim().toLowerCase() === c.name.trim().toLowerCase())
  const myBills = bills.filter(b => b.vendor.trim().toLowerCase() === c.name.trim().toLowerCase())
  const receivable = myInvoices.filter(i => i.state === 'open' || i.state === 'in_payment').reduce((s, i) => s + i.residual, 0)
  const payable = myBills.filter(b => b.state === 'open' || b.state === 'in_payment').reduce((s, b) => s + b.residual, 0)
  const billed = myInvoices.filter(i => i.state !== 'cancel' && i.state !== 'draft' && i.category !== 'proforma').reduce((s, i) => s + i.amountTotal, 0)

  // The invoice (ZATCA registered) address is edited on the Details tab
  const invIdx = c.addresses.findIndex(a => a.type === 'invoice')
  const regAddr: ContactAddress = c.addresses[invIdx] ?? { id: 'ad_reg', type: 'invoice', street: '', city: '', region: '', zip: '', country: 'Saudi Arabia' }
  const setReg = (patch: Partial<ContactAddress>) =>
    set('addresses', invIdx >= 0 ? c.addresses.map((a, i) => (i === invIdx ? { ...a, ...patch } : a)) : [{ ...regAddr, ...patch }, ...c.addresses])

  const validate = (): string => {
    if (!c.name.trim()) return 'Name is required.'
    if (!c.isCustomer && !c.isVendor && c.kind === 'company') return 'Mark the contact as a customer, a vendor or both.'
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) return 'Email address looks invalid.'
    if (c.vat && !/^\d{15}$/.test(c.vat)) return 'Saudi VAT number must be 15 digits.'
    const dup = contacts.find(o => o.id !== c.id && o.name.trim().toLowerCase() === c.name.trim().toLowerCase())
    if (dup) return `A contact named "${dup.name}" already exists.`
    return ''
  }
  const save = () => {
    const e = validate()
    setError(e)
    if (e) return
    onSave({ ...c, name: c.name.trim() })
    onClose()
  }

  const parentName = contacts.find(p => p.id === c.parentId)?.name

  return (
    <Drawer
      title={isNew ? 'New Contact' : c.name || 'Contact'}
      subtitle={c.kind === 'individual' ? (parentName ? `${c.jobTitle || 'Contact'} at ${parentName}` : 'Individual') : 'Company'}
      badge={<>{c.isCustomer && <Pill tone="green">Customer</Pill>}{c.isVendor && <Pill tone="blue">Vendor</Pill>}{!c.active && <Pill tone="red">Archived</Pill>}</>}
      onClose={onClose}
      wide
      footer={<>
        {!isNew && !readOnly && <GhostButton danger={c.active} onClick={() => (c.active ? setConfirmArchive(true) : (onArchive(c.id, true), onClose()))}>{c.active ? 'Archive' : 'Restore'}</GhostButton>}
        <GhostButton onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</GhostButton>
        {!readOnly && <PrimaryButton onClick={save}>Save contact</PrimaryButton>}
      </>}
    >
      <Segmented value={tab} onChange={setTab} options={[
        { id: 'details', label: 'Details' },
        ...(c.kind === 'company' ? [{ id: 'people' as const, label: 'People', count: people.length }] : []),
        ...(!isNew ? [{ id: 'accounting' as const, label: 'Accounting' }] : []),
      ]} />

      {error && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{error}</div>}

      {tab === 'details' && (
        <>
          <Card>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col items-center gap-2">
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
                      <button key={k} disabled={dis} onClick={() => set('kind', k)} className={`px-3 py-1.5 rounded-md capitalize ${c.kind === k ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}>{k}</button>
                    ))}
                  </div>
                </Field>
                <Field label="Relationship">
                  <div className="flex gap-4 py-1.5">
                    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={dis} checked={c.isCustomer} onChange={e => set('isCustomer', e.target.checked)} /> Customer</label>
                    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={dis} checked={c.isVendor} onChange={e => set('isVendor', e.target.checked)} /> Vendor</label>
                  </div>
                </Field>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <Card title="ZATCA & tax">
              <div className="grid gap-3">
                <Field label="ZATCA registered name"><input className={inputCls} disabled={dis} value={c.legalName || ''} onChange={e => set('legalName', e.target.value)} /></Field>
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 -mb-1">Address</div>
                <AddressFields a={regAddr} set={setReg} dis={dis} />
                <Field label="Identification scheme">
                  <select className={inputCls} disabled={dis} value={c.idScheme || 'OTH'} onChange={e => set('idScheme', e.target.value as Contact['idScheme'])}>
                    <option value="CRN">Commercial Registration (CRN)</option><option value="MOM">Momra licence</option><option value="MLS">MHRSD licence</option><option value="SAG">Misa licence</option><option value="TIN">Tax identification (TIN)</option><option value="700">700 Number</option><option value="OTH">Other ID</option>
                  </select>
                </Field>
                <Field label="Identification number (SA)"><input className={`${inputCls} font-mono`} disabled={dis} value={c.idNumber || ''} onChange={e => set('idNumber', e.target.value)} /></Field>
                <Field label="VAT" hint="15 digits"><input className={`${inputCls} font-mono`} disabled={dis} value={c.vat} onChange={e => set('vat', e.target.value.replace(/\D/g, '').slice(0, 15))} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Customer discount %"><input type="number" min={0} max={100} className={inputCls} disabled={dis} value={c.discountPct ?? 0} onChange={e => set('discountPct', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></Field>
                  <Field label="Discount (%)"><input type="number" min={0} max={100} className={inputCls} disabled={dis} value={c.discount ?? 0} onChange={e => set('discount', Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></Field>
                </div>
                <Field label="Vendor no"><input className={`${inputCls} font-mono`} disabled={dis} value={c.vendorNo || ''} onChange={e => set('vendorNo', e.target.value)} /></Field>
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" disabled={dis} checked={!!c.cashCustomer} onChange={e => set('cashCustomer', e.target.checked)} /> Cash customer</label>
                <Field label="Customer code"><input className={`${inputCls} font-mono`} disabled={dis} value={c.customerCode || ''} onChange={e => set('customerCode', e.target.value)} /></Field>
                <Field label="Tax ID (Arabic)"><input dir="rtl" className={inputCls} disabled={dis} value={c.taxIdArabic || ''} onChange={e => set('taxIdArabic', e.target.value)} /></Field>
                <Field label="CR number"><input className={`${inputCls} font-mono`} disabled={dis} value={c.crNumber} onChange={e => set('crNumber', e.target.value)} /></Field>
              </div>
            </Card>

            <Card title="Contact">
              <div className="grid gap-3">
                {c.kind === 'individual' && (
                  <>
                    <Field label="Job position"><input className={inputCls} disabled={dis} value={c.jobTitle || ''} placeholder="e.g. Sales Director" onChange={e => set('jobTitle', e.target.value)} /></Field>
                    <Field label="Company code"><input className={`${inputCls} font-mono`} disabled={dis} value={c.companyCode || ''} onChange={e => set('companyCode', e.target.value)} /></Field>
                    <Field label="Works for">
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
                <Field label="Tags" hint="Comma separated"><input className={inputCls} disabled={dis} value={c.tags.join(', ')} onChange={e => set('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} /></Field>
                <Field label="Girfalco ID"><input type="number" min={0} className={inputCls} disabled={dis} value={c.girfalcoId ?? ''} placeholder="0" onChange={e => set('girfalcoId', e.target.value)} /></Field>
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'people' && (
        <Card title="People at this company">
          {people.length === 0 ? <p className="text-xs text-slate-500">No individuals linked. Create an individual contact and choose this company under "Works for".</p> : (
            <ul className="divide-y divide-slate-100">
              {people.map(p => (
                <li key={p.id} className="py-2 flex items-center justify-between text-xs">
                  <div><div className="font-bold text-slate-800">{p.name}</div><div className="text-slate-500">{p.jobTitle || '—'}</div></div>
                  <div className="text-right text-slate-500"><div>{p.email || '—'}</div><div>{p.mobile || p.phone || ''}</div></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'accounting' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Total invoiced" value={moneyFormat(billed)} />
            <Kpi label="Receivable" value={moneyFormat(receivable)} tone={c.creditLimit > 0 && receivable > c.creditLimit ? 'red' : undefined} hint={c.creditLimit > 0 ? `Limit ${moneyFormat(c.creditLimit)}` : 'No credit limit'} />
            <Kpi label="Payable" value={moneyFormat(payable)} />
            <Kpi label="Documents" value={myInvoices.length + myBills.length} hint={`${myInvoices.length} invoices · ${myBills.length} bills`} />
          </div>
          <Card title="Actions">
            <div className="flex gap-2 flex-wrap">
              {c.isCustomer && onCreateInvoice && <PrimaryButton onClick={() => onCreateInvoice(c.name)}><FileText size={14} />New invoice</PrimaryButton>}
              {c.isVendor && onCreateBill && <GhostButton onClick={onCreateBill}><Receipt size={13} className="inline -mt-0.5 mr-1" />New vendor bill</GhostButton>}
            </div>
          </Card>
          <Card title="Recent invoices">
            {myInvoices.length === 0 ? <p className="text-xs text-slate-500">No invoices for this contact.</p> : (
              <ul className="divide-y divide-slate-100 text-xs">
                {myInvoices.slice(0, 8).map(i => (
                  <li key={i.id} className="py-2 flex items-center justify-between">
                    <button className="font-bold text-emerald-700 hover:underline" onClick={() => onOpenInvoice?.(i)}>{i.number}</button>
                    <span className="text-slate-500">{i.state}</span><span className="font-mono">{moneyFormat(i.amountTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Recent vendor bills">
            {myBills.length === 0 ? <p className="text-xs text-slate-500">No bills for this contact.</p> : (
              <ul className="divide-y divide-slate-100 text-xs">
                {myBills.slice(0, 8).map(b => (
                  <li key={b.id} className="py-2 flex items-center justify-between"><span className="font-bold">{b.number}</span><span className="text-slate-500">{b.state}</span><span className="font-mono">{moneyFormat(b.amountTotal)}</span></li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {confirmArchive && <ConfirmDialog title="Archive contact?" text="Archived contacts are hidden from lists and pickers but their documents are kept." confirmLabel="Archive" danger onCancel={() => setConfirmArchive(false)} onConfirm={() => { onArchive(c.id, false); onClose() }} />}
    </Drawer>
  )
}
