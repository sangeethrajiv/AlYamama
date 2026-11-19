import { COUNTRIES, STATES, TITLES, COMPANIES, TIMEZONES } from '../contacts/usersLookups'
import { RES_USERS } from '../contacts/usersData'
import type { PartnerType } from './types'

/** Dropdown sources for the Contact module. Countries, states, titles, companies and timezones are the shared Odoo lookup lists. */
export { COUNTRIES, STATES, TITLES, COMPANIES, TIMEZONES }

export const PARTNER_TYPES: { id: PartnerType; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'invoice', label: 'Invoice address' },
  { id: 'delivery', label: 'Delivery address' },
  { id: 'other', label: 'Other address' },
  { id: 'private', label: 'Private address' },
]

export const LANGS: { code: string; name: string }[] = [
  { code: 'en_US', name: 'English' },
  { code: 'ar_001', name: 'Arabic' },
]

/** res.partner.industry (sample list). */
export const INDUSTRIES: { id: number; name: string }[] = [
  { id: 1, name: 'Agriculture' },
  { id: 2, name: 'Oil & Gas' },
  { id: 3, name: 'Manufacturing' },
  { id: 4, name: 'Construction' },
  { id: 5, name: 'Power & Utilities' },
  { id: 6, name: 'Transportation & Logistics' },
  { id: 7, name: 'Wholesale & Retail' },
  { id: 8, name: 'Engineering Services' },
  { id: 9, name: 'Petrochemicals' },
  { id: 10, name: 'Marine & Shipping' },
  { id: 11, name: 'Financial Services' },
  { id: 12, name: 'Government' },
]

/** l10n_sa_additional_identification_scheme selection. */
export const ID_SCHEMES: { code: string; name: string }[] = [
  { code: 'TIN', name: 'Tax Identification Number' },
  { code: 'CRN', name: 'Commercial Registration Number' },
  { code: 'MOM', name: 'Momra License' },
  { code: 'MLS', name: 'MLSD License' },
  { code: '700', name: '700 Number' },
  { code: 'SAG', name: 'Sagia License' },
  { code: 'OTH', name: 'Other ID' },
]

/** res.partner.category (Tags), sample list. */
export const TAGS: { id: number; name: string }[] = [
  { id: 1, name: 'VIP' }, { id: 2, name: 'Key Account' }, { id: 3, name: 'Industrial' }, { id: 4, name: 'Government' },
  { id: 5, name: 'Overseas Supplier' }, { id: 6, name: 'Distributor' }, { id: 7, name: 'Contractor' },
]

/** Salespersons (res.users): active internal users. */
export const USERS: { id: number; name: string }[] = RES_USERS.filter(u => u.active && !u.share).map(u => ({ id: u.id, name: u.name }))

/** Kanban colour index (0-11) with its swatch. */
export const COLORS: { id: number; name: string; hex: string }[] = [
  { id: 0, name: 'No color', hex: '#e2e8f0' }, { id: 1, name: 'Red', hex: '#ef4444' }, { id: 2, name: 'Orange', hex: '#f97316' },
  { id: 3, name: 'Yellow', hex: '#eab308' }, { id: 4, name: 'Cyan', hex: '#06b6d4' }, { id: 5, name: 'Purple', hex: '#8b5cf6' },
  { id: 6, name: 'Almond', hex: '#d6b88a' }, { id: 7, name: 'Teal', hex: '#14b8a6' }, { id: 8, name: 'Blue', hex: '#3b82f6' },
  { id: 9, name: 'Raspberry', hex: '#be185d' }, { id: 10, name: 'Green', hex: '#22c55e' }, { id: 11, name: 'Violet', hex: '#6d28d9' },
]

const nameOf = (list: { id: number; name: string }[], id: number | null) => (id == null ? '' : list.find(x => x.id === id)?.name ?? '')
export const countryName = (id: number | null) => nameOf(COUNTRIES, id)
export const stateName = (id: number | null) => nameOf(STATES, id)
export const titleName = (id: number | null) => nameOf(TITLES, id)
export const industryName = (id: number | null) => nameOf(INDUSTRIES, id)
export const userName = (id: number | null) => nameOf(USERS, id)
export const companyName = (id: number | null) => nameOf(COMPANIES, id)
export const typeLabel = (t: PartnerType) => PARTNER_TYPES.find(x => x.id === t)?.label ?? t
export const tagNames = (ids: number[]) => ids.map(i => TAGS.find(t => t.id === i)?.name ?? `#${i}`)
export const schemeName = (code: string) => ID_SCHEMES.find(x => x.code === code)?.name ?? code
export const langName = (code: string) => LANGS.find(l => l.code === code)?.name ?? code
