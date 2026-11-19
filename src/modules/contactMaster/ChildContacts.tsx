import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Archive, ArchiveRestore, Pencil, Plus, X } from 'lucide-react'
import { Avatar, Card, ConfirmDialog, Pill, inputCls } from '../shared/ui'
import { Fld, errCls } from './parts'
import { BLANK, EMAIL_RE, PHONE_RE, toDraft } from './defaults'
import { COUNTRIES, PARTNER_TYPES, STATES, typeLabel } from './options'
import { createPartner, setPartnerActive, updatePartner } from './store'
import type { PartnerDraft, ResPartner } from './types'

/**
 * "Contacts & Addresses" section of a company's edit form: the contacts, child companies and
 * invoice/delivery addresses whose parent_id is this company. Changes here are written straight to the
 * contact list (they do not wait for the form's Save button).
 */
type Fields = Pick<PartnerDraft, 'is_company' | 'name' | 'type' | 'function' | 'email' | 'phone' | 'mobile' | 'street' | 'city' | 'zip' | 'country_id' | 'state_id'>
const pick = (d: PartnerDraft): Fields => ({ is_company: d.is_company, name: d.name, type: d.type, function: d.function, email: d.email, phone: d.phone, mobile: d.mobile, street: d.street, city: d.city, zip: d.zip, country_id: d.country_id, state_id: d.state_id })

const idOrNull = (s: string) => (s === '' ? null : Number(s))
const iconBtn = 'p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition'

export default function ChildContacts({ parent, partners }: { parent: ResPartner; partners: ResPartner[] }) {
  const children = partners.filter(x => x.parent_id === parent.id).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const [dialog, setDialog] = useState<{ child?: ResPartner } | null>(null)
  const [archiving, setArchiving] = useState<ResPartner | null>(null)
  const [note, setNote] = useState('')
  const say = (t: string) => { setNote(t); setTimeout(() => setNote(''), 4000) }

  return (
    <Card dense title={`Contacts & Addresses (${children.length})`}
      actions={<button type="button" onClick={() => setDialog({})} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1"><Plus size={12} /> Add</button>}>
      <p className="text-[11px] text-slate-400 mb-2">Contacts, child companies and addresses of {parent.name}. Changes here are saved immediately.</p>
      {children.length === 0
        ? <div className="text-xs text-slate-400 py-4 text-center">No contacts or addresses yet. Use Add to create one.</div>
        : <ul className="divide-y divide-slate-100">
          {children.map(ch => (
            <li key={ch.id} className={`flex items-center gap-2.5 py-1.5 ${ch.active ? '' : 'opacity-60'}`}>
              <Avatar name={ch.name} size={28} round={!ch.is_company} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-slate-900 truncate">{ch.name}</span>
                <span className="block text-[11px] text-slate-500 truncate">{[ch.is_company ? 'Company' : ch.function, ch.email || ch.phone].filter(Boolean).join(' · ') || typeLabel(ch.type)}</span>
              </span>
              {ch.type !== 'contact' && <Pill tone="amber">{typeLabel(ch.type)}</Pill>}
              {!ch.active && <Pill>Archived</Pill>}
              <span className="flex items-center">
                <button type="button" aria-label={`Edit ${ch.name}`} title="Edit" onClick={() => setDialog({ child: ch })} className={iconBtn}><Pencil size={13} /></button>
                {ch.active
                  ? <button type="button" aria-label={`Archive ${ch.name}`} title="Archive" onClick={() => setArchiving(ch)} className={iconBtn}><Archive size={13} /></button>
                  : <button type="button" aria-label={`Restore ${ch.name}`} title="Restore" onClick={() => { setPartnerActive(ch.id, true); say(`${ch.name} restored.`) }} className={iconBtn}><ArchiveRestore size={13} /></button>}
              </span>
            </li>
          ))}
        </ul>}
      {note && <div role="status" className="mt-2 text-[11px] font-bold text-emerald-700">{note}</div>}

      {dialog && createPortal(
        <ChildDialog parent={parent} child={dialog.child} onClose={() => setDialog(null)}
          onDone={t => { setDialog(null); say(t) }} />, document.body)}
      {archiving && createPortal(
        <ConfirmDialog title={`Archive ${archiving.name}?`} text="It will be hidden from the default contact list. You can restore it from here at any time." confirmLabel="Archive"
          onConfirm={() => { setPartnerActive(archiving.id, false); say(`${archiving.name} archived.`); setArchiving(null) }} onCancel={() => setArchiving(null)} />, document.body)}
    </Card>
  )
}

function ChildDialog({ parent, child, onClose, onDone }: { parent: ResPartner; child?: ResPartner; onClose: () => void; onDone: (note: string) => void }) {
  const [f, setF] = useState<Fields>(() => child ? pick(toDraft(child)) : {
    is_company: false, name: '', type: 'contact', function: '', email: '', phone: '', mobile: '',
    street: parent.street, city: parent.city, zip: parent.zip, country_id: parent.country_id, state_id: parent.state_id,
  })
  const [submitted, setSubmitted] = useState(false)
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => setF(p => ({ ...p, [k]: v }))

  const e: Partial<Record<keyof Fields, string>> = {}
  if (!f.name.trim()) e.name = f.is_company ? 'Company name is required.' : 'Name is required.'
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.'
  if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) e.phone = 'Enter a valid phone number.'
  if (f.mobile.trim() && !PHONE_RE.test(f.mobile.trim())) e.mobile = 'Enter a valid mobile number.'
  const err = (k: keyof Fields) => (submitted ? e[k] : undefined)
  const states = STATES.filter(s => s.country_id === f.country_id)

  const save = () => {
    setSubmitted(true)
    if (Object.keys(e).length) return
    const clean: Fields = { ...f, name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), mobile: f.mobile.trim() }
    if (child) { updatePartner(child.id, { ...toDraft(child), ...clean }); onDone(`${clean.name} updated.`) }
    else {
      createPartner({ ...BLANK, ...clean, parent_id: parent.id, company_id: parent.company_id, lang: parent.lang, tz: parent.tz })
      onDone(`${clean.name} added to ${parent.name}.`)
    }
  }
  const title = child ? `Edit ${child.name}` : `Add contact to ${parent.name}`

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-slate-50 w-full max-w-xl max-h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-sm font-extrabold text-slate-800 truncate">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          <div className="sm:col-span-2">
            <span className="block text-slate-600 font-bold mb-0.5 text-[11px]">Kind</span>
            <div role="radiogroup" aria-label="Individual or Company" className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
              {([['Individual', false], ['Company', true]] as const).map(([label, v]) => (
                <button key={label} type="button" role="radio" aria-checked={f.is_company === v} onClick={() => set('is_company', v)}
                  className={`px-3 py-1 rounded-lg transition ${f.is_company === v ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>{label}</button>
              ))}
            </div>
          </div>
          <Fld label={f.is_company ? 'Company Name' : 'Name'} required error={err('name')}>
            <input aria-label="Name" className={errCls(err('name'))} value={f.name} onChange={e => set('name', e.target.value)} autoFocus />
          </Fld>
          <Fld label="Contact Type">
            <select aria-label="Contact Type" className={inputCls} value={f.type} onChange={e => set('type', e.target.value as Fields['type'])}>
              {PARTNER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Fld>
          {!f.is_company && <Fld label="Job Position"><input aria-label="Job Position" className={inputCls} value={f.function} onChange={e => set('function', e.target.value)} /></Fld>}
          <Fld label="Email" error={err('email')}><input aria-label="Email" type="email" className={errCls(err('email'))} value={f.email} onChange={e => set('email', e.target.value)} /></Fld>
          <Fld label="Phone" error={err('phone')}><input aria-label="Phone" type="tel" className={errCls(err('phone'))} value={f.phone} onChange={e => set('phone', e.target.value)} /></Fld>
          <Fld label="Mobile" error={err('mobile')}><input aria-label="Mobile" type="tel" className={errCls(err('mobile'))} value={f.mobile} onChange={e => set('mobile', e.target.value)} /></Fld>
          <Fld label="Street" span={2}><input aria-label="Street" className={inputCls} value={f.street} onChange={e => set('street', e.target.value)} /></Fld>
          <Fld label="City"><input aria-label="City" className={inputCls} value={f.city} onChange={e => set('city', e.target.value)} /></Fld>
          <Fld label="ZIP"><input aria-label="ZIP" className={inputCls} value={f.zip} onChange={e => set('zip', e.target.value)} /></Fld>
          <Fld label="Country">
            <select aria-label="Country" className={inputCls} value={f.country_id ?? ''} onChange={e => setF(p => ({ ...p, country_id: idOrNull(e.target.value), state_id: null }))}>
              <option value="" />{COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Fld>
          <Fld label="State">
            <select aria-label="State" className={inputCls} value={f.state_id ?? ''} disabled={!f.country_id || states.length === 0} onChange={e => set('state_id', idOrNull(e.target.value))}>
              <option value="" />{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Fld>
        </div>
        <div className="bg-white px-4 py-2.5 border-t border-slate-200 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-700 bg-white hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={save} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm">{child ? 'Save' : 'Add Contact'}</button>
        </div>
      </div>
    </div>
  )
}
