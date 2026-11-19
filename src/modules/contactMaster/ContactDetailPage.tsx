import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react'
import { Avatar, Card, EmptyState, GhostButton, Pill, PrimaryButton } from '../shared/ui'
import { Breadcrumb, Item } from './parts'
import { countryName, langName, schemeName, stateName, tagNames, titleName, typeLabel } from './options'
import type { ResPartner } from './types'

/** Contact view: one read-only card per section, plus Edit / Archive / Restore / Delete actions. */
interface Props {
  partner: ResPartner
  partners: ResPartner[]
  readOnly: boolean
  onBack: () => void
  onOpen: (id: number) => void
  onEdit: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}

const Grid = ({ children }: { children: React.ReactNode }) => <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">{children}</dl>
const YesNo = ({ v }: { v: boolean }) => <Pill tone={v ? 'green' : 'slate'}>{v ? 'Yes' : 'No'}</Pill>
const href = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`)

export function ContactNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Breadcrumb parent="Contacts" current="Not found" onBack={onBack} />
      <div className="bg-white border border-slate-200 rounded-xl"><EmptyState title="Contact not found" text="It may have been removed, or the link is wrong." />
        <div className="pb-6 text-center"><GhostButton onClick={onBack}>Back to Contacts</GhostButton></div></div>
    </div>
  )
}

export default function ContactDetailPage({ partner: c, partners, readOnly, onBack, onOpen, onEdit, onArchive, onRestore, onDelete }: Props) {
  const link = (id: number | null) => {
    if (id == null) return null
    const r = partners.find(x => x.id === id)
    if (!r) return `#${id}`
    return id === c.id ? r.display_name : <button onClick={() => onOpen(id)} className="font-bold text-emerald-700 hover:underline text-left">{r.display_name}</button>
  }
  const children = partners.filter(x => x.parent_id === c.id).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const companies = children.filter(x => x.is_company)
  const people = children.filter(x => !x.is_company)
  const relatedList = (rows: ResPartner[], empty: string) => rows.length === 0
    ? <div className="text-xs text-slate-400 py-4 text-center">{empty}</div>
    : <ul className="divide-y divide-slate-100">
      {rows.map(ch => (
        <li key={ch.id}>
          <button onClick={() => onOpen(ch.id)} className={`w-full flex items-center gap-2.5 py-2 text-left hover:bg-emerald-50/40 rounded-lg px-1 ${ch.active ? '' : 'opacity-60'}`}>
            <Avatar name={ch.name} size={28} round={!ch.is_company} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-slate-900 truncate">{ch.name}</span>
              <span className="block text-[11px] text-slate-500 truncate">{[ch.is_company ? [ch.city, countryName(ch.country_id)].filter(Boolean).join(', ') : ch.function, ch.email].filter(Boolean).join(' · ') || typeLabel(ch.type)}</span>
            </span>
            {ch.type !== 'contact' && <Pill tone="amber">{typeLabel(ch.type)}</Pill>}
            {!ch.active && <Pill>Archived</Pill>}
          </button>
        </li>
      ))}
    </ul>

  return (
    <div className="space-y-3">
      <Breadcrumb parent="Contacts" current={c.display_name || c.name} onBack={onBack} />

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <Avatar name={c.name} size={56} round={!c.is_company} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">{c.display_name}</h1>
          <div className="text-xs text-slate-500 truncate">{[c.function, c.email].filter(Boolean).join(' · ') || `Contact #${c.id}`}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={c.active ? 'green' : 'slate'}>{c.active ? 'Active' : 'Archived'}</Pill>
            <Pill tone={c.is_company ? 'blue' : 'slate'}>{c.is_company ? 'Company' : 'Individual'}</Pill>
            {c.type !== 'contact' && <Pill tone="amber">{typeLabel(c.type)}</Pill>}
            {c.customer && <Pill tone="green">Customer</Pill>}
            {c.supplier && <Pill tone="amber">Supplier</Pill>}
            {c.employee && <Pill tone="blue">Employee</Pill>}
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <PrimaryButton onClick={onEdit}><Pencil size={14} /> Edit</PrimaryButton>
            {c.active
              ? <GhostButton onClick={onArchive}><span className="flex items-center gap-1.5"><Archive size={13} /> Archive</span></GhostButton>
              : <GhostButton onClick={onRestore}><span className="flex items-center gap-1.5"><ArchiveRestore size={13} /> Restore</span></GhostButton>}
            <GhostButton danger onClick={onDelete}><span className="flex items-center gap-1.5"><Trash2 size={13} /> Delete</span></GhostButton>
          </div>
        )}
      </div>

      {!c.active && (
        <div role="status" className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This contact is archived. It is hidden from the default Contacts list{readOnly ? '.' : ' — use Restore to make it active again.'}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3 items-start">
        <div className="space-y-3 min-w-0">
        <Card dense title="General Information">
          <Grid>
            <Item label="Name">{c.name}</Item>
            <Item label="Arabic Name">{c.arabic_name && <span dir="rtl">{c.arabic_name}</span>}</Item>
            <div className="sm:col-span-2"><Item label="Display Name">{c.display_name}</Item></div>
            <Item label="Is a Company">{<YesNo v={c.is_company} />}</Item>
            <Item label="Address Type">{typeLabel(c.type)}</Item>
            <Item label="Title">{titleName(c.title)}</Item>
            <Item label="Job Position">{c.function}</Item>
            <Item label="Related Company">{link(c.parent_id)}</Item>
            <Item label="Commercial Entity">{link(c.commercial_partner_id)}</Item>
            <Item label="Company Name">{c.company_name}</Item>
            <Item label="Internal Reference">{c.ref}</Item>
          </Grid>
        </Card>
        <Card dense title="Contact Information">
          <Grid>
            <Item label="Email">{c.email && <a href={`mailto:${c.email}`} className="text-emerald-700 font-bold hover:underline">{c.email}</a>}</Item>
            <Item label="Phone">{c.phone && <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="hover:underline">{c.phone}</a>}</Item>
            <Item label="Mobile">{c.mobile && <a href={`tel:${c.mobile.replace(/\s/g, '')}`} className="hover:underline">{c.mobile}</a>}</Item>
            <Item label="Fax">{c.fax}</Item>
            <div className="sm:col-span-2"><Item label="Website">{c.website && <a href={href(c.website)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold hover:underline">{c.website}</a>}</Item></div>
          </Grid>
        </Card>
        <Card dense title="Address">
          <Grid>
            <Item label="Street">{c.street}</Item>
            <Item label="Street 2 / Neighborhood">{c.street2}</Item>
            <Item label="Arabic Street 2">{c.arabic_street2_name && <span dir="rtl">{c.arabic_street2_name}</span>}</Item>
            <Item label="City">{c.city}</Item>
            <Item label="Arabic City">{c.arabic_city_name && <span dir="rtl">{c.arabic_city_name}</span>}</Item>
            <Item label="State">{stateName(c.state_id)}</Item>
            <Item label="ZIP">{c.zip}</Item>
            <Item label="Country">{countryName(c.country_id)}</Item>
            <Item label="Building Number">{c.l10n_sa_edi_building_number}</Item>
            <Item label="Plot Identification">{c.l10n_sa_edi_plot_identification}</Item>
          </Grid>
        </Card>
        </div>
        <div className="space-y-3 min-w-0">
        <Card dense title="ZATCA & Tax Identification">
          <Grid>
            <div className="sm:col-span-2"><Item label="ZATCA Registered Name">{c.l10n_sa_registered_name}</Item></div>
            <Item label="Identification Scheme">{schemeName(c.l10n_sa_additional_identification_scheme)}</Item>
            <Item label="Identification Number (SA)">{c.l10n_sa_additional_identification_number}</Item>
            <Item label="Tax ID">{c.vat}</Item>
            <Item label="Tax ID Arabic">{c.vat_arabic && <span dir="rtl">{c.vat_arabic}</span>}</Item>
            <Item label="CR Number">{c.cr_number}</Item>
          </Grid>
        </Card>
        <Card dense title="Additional Information">
          <Grid>
            <Item label="Tags">{c.category_id.length > 0 && <span className="flex flex-wrap gap-1">{tagNames(c.category_id).map(t => <Pill key={t} tone="green">{t}</Pill>)}</span>}</Item>
            <Item label="Language">{langName(c.lang)}</Item>
          </Grid>
        </Card>
        <Card dense title="Business Information">
          <Grid>
            <Item label="Customer"><YesNo v={c.customer} /></Item>
            <Item label="Supplier"><YesNo v={c.supplier} /></Item>
            <Item label="Employee"><YesNo v={c.employee} /></Item>
            <Item label="Cash Customer"><YesNo v={c.cash_customer} /></Item>
            <Item label="Active"><YesNo v={c.active} /></Item>
            <Item label="Customer Discount %">{c.customer_discount.toFixed(2)}</Item>
            <Item label="Discount (%)">{c.discount.toFixed(2)}</Item>
            <Item label="Customer Code">{c.customer_code}</Item>
            <Item label="Vendor No">{c.vandor_number}</Item>
            <Item label="Company Code">{c.company_name_code}</Item>
            <div className="sm:col-span-2"><Item label="Girfalco ID">{c.ext_res_id}</Item></div>
          </Grid>
        </Card>
        {c.is_company && (
          <Card dense title={`Child Companies (${companies.length})`}>
            {relatedList(companies, `No child companies are linked to ${c.name}.`)}
          </Card>
        )}
        <Card dense title={`Contacts & Addresses (${people.length})`}>
          {relatedList(people, `No contacts or addresses are linked to ${c.name}.`)}
        </Card>
        </div>
      </div>
    </div>
  )
}
