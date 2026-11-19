import type { PartnerType, ResPartner } from './types'
import { countryName, typeLabel } from './options'

export type Tri = 'any' | 'yes' | 'no'
export type Kind = 'all' | 'individual' | 'company'
export type Status = 'active' | 'archived' | 'all'

export interface Filters {
  name: string; email: string; phone: string
  kind: Kind; type: '' | PartnerType
  customer: Tri; supplier: Tri; employee: Tri
  status: Status; country_id: number
}

export const DEFAULT_FILTERS: Filters = { name: '', email: '', phone: '', kind: 'all', type: '', customer: 'any', supplier: 'any', employee: 'any', status: 'active', country_id: 0 }

const tri = (t: Tri, v: boolean) => t === 'any' || (t === 'yes') === v
const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase())

export function applyFilters(list: ResPartner[], f: Filters, term: string): ResPartner[] {
  const t = term.trim().toLowerCase()
  return list.filter(c =>
    (f.status === 'all' || (f.status === 'active') === c.active) &&
    (!f.name.trim() || has(c.name, f.name) || has(c.display_name, f.name)) &&
    (!f.email.trim() || has(c.email, f.email)) &&
    (!f.phone.trim() || has(c.phone, f.phone) || has(c.mobile, f.phone)) &&
    (f.kind === 'all' || (f.kind === 'company') === c.is_company) &&
    (!f.type || c.type === f.type) &&
    tri(f.customer, c.customer) && tri(f.supplier, c.supplier) && tri(f.employee, c.employee) &&
    (!f.country_id || c.country_id === f.country_id) &&
    (!t || [c.name, c.display_name, c.arabic_name, c.email, c.phone, c.mobile, c.city, c.vat, c.ref, c.website, c.customer_code, c.vandor_number, c.cr_number, c.l10n_sa_registered_name].some(v => v.toLowerCase().includes(t))),
  )
}

/** Filters that differ from the defaults, as removable chips. */
export function activeChips(f: Filters): { key: keyof Filters; label: string }[] {
  const out: { key: keyof Filters; label: string }[] = []
  if (f.name.trim()) out.push({ key: 'name', label: `Name: ${f.name.trim()}` })
  if (f.email.trim()) out.push({ key: 'email', label: `Email: ${f.email.trim()}` })
  if (f.phone.trim()) out.push({ key: 'phone', label: `Phone: ${f.phone.trim()}` })
  if (f.kind !== 'all') out.push({ key: 'kind', label: f.kind === 'company' ? 'Company' : 'Individual' })
  if (f.type) out.push({ key: 'type', label: `Type: ${typeLabel(f.type)}` })
  for (const k of ['customer', 'supplier', 'employee'] as const) if (f[k] !== 'any') out.push({ key: k, label: `${f[k] === 'yes' ? '' : 'Not '}${k[0].toUpperCase()}${k.slice(1)}` })
  if (f.status !== 'active') out.push({ key: 'status', label: f.status === 'archived' ? 'Archived' : 'Active & archived' })
  if (f.country_id) out.push({ key: 'country_id', label: `Country: ${countryName(f.country_id)}` })
  return out
}
