import { COUNTRIES as SEED_COUNTRIES, STATES as SEED_STATES, TITLES as SEED_TITLES, COMPANIES as SEED_COMPANIES, TIMEZONES } from '../contacts/usersLookups'
import { RES_USERS } from '../contacts/usersData'
import type { PartnerType } from './types'

/**
 * Dropdown sources for the Contact module.
 *
 * The lists start as the shared sample lookups and are replaced by the real
 * tables through `registerLookups` once the API has been read (lookups.ts). They
 * are mutated in place, because the screens import them directly and render
 * them on every pass. The arrays are private copies, so the shared sample lists
 * used by the other modules are left untouched.
 */
export { TIMEZONES }

export const COUNTRIES: { id: number; name: string }[] = SEED_COUNTRIES.map(c => ({ id: c.id, name: c.name }))
export const STATES: { id: number; name: string; country_id: number }[] = SEED_STATES.map(s => ({ id: s.id, name: s.name, country_id: s.country_id }))
export const TITLES: { id: number; name: string }[] = SEED_TITLES.map(t => ({ id: t.id, name: t.name }))
export const COMPANIES: { id: number; name: string }[] = SEED_COMPANIES.map(c => ({ id: c.id, name: c.name }))

export const PARTNER_TYPES: { id: PartnerType; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'invoice', label: 'Invoice address' },
  { id: 'delivery', label: 'Delivery address' },
  { id: 'other', label: 'Other address' },
  { id: 'private', label: 'Private address' },
  // Added by the Yamama custom addons and present in the live data.
  { id: 'child_company', label: 'Child company' },
  { id: 'manager', label: 'Manager' },
]

export const LANGS: { code: string; name: string }[] = [
  { code: 'en_US', name: 'English' },
  { code: 'ar_001', name: 'Arabic' },
]

/** res.partner.industry. Replaced by the real table when the API is configured. */
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

/** Salespersons (res.users): active internal users. */
export const USERS: { id: number; name: string }[] = RES_USERS.filter(u => u.active && !u.share).map(u => ({ id: u.id, name: u.name }))

/** Kanban colour index (0-11) with its swatch. */
export const COLORS: { id: number; name: string; hex: string }[] = [
  { id: 0, name: 'No color', hex: '#e2e8f0' }, { id: 1, name: 'Red', hex: '#ef4444' }, { id: 2, name: 'Orange', hex: '#f97316' },
  { id: 3, name: 'Yellow', hex: '#eab308' }, { id: 4, name: 'Cyan', hex: '#06b6d4' }, { id: 5, name: 'Purple', hex: '#8b5cf6' },
  { id: 6, name: 'Almond', hex: '#d6b88a' }, { id: 7, name: 'Teal', hex: '#14b8a6' }, { id: 8, name: 'Blue', hex: '#3b82f6' },
  { id: 9, name: 'Raspberry', hex: '#be185d' }, { id: 10, name: 'Green', hex: '#22c55e' }, { id: 11, name: 'Violet', hex: '#6d28d9' },
]

/** Replaces each list with the rows read from the API, keeping the array identity. */
export function registerLookups(live: {
  countries?: { id: number; name: string }[]
  states?: { id: number; name: string; country_id: number }[]
  titles?: { id: number; name: string }[]
  industries?: { id: number; name: string }[]
  companies?: { id: number; name: string }[]
  users?: { id: number; name: string }[]
}) {
  const swap = <T>(target: T[], next?: T[]) => {
    if (!next) return
    target.length = 0
    target.push(...next)
  }
  swap(COUNTRIES, live.countries)
  swap(STATES, live.states)
  swap(TITLES, live.titles)
  swap(INDUSTRIES, live.industries)
  swap(COMPANIES, live.companies)
  swap(USERS, live.users)
}

const nameOf = (list: { id: number; name: string }[], id: number | null) => (id == null ? '' : list.find(x => x.id === id)?.name ?? '')
export const countryName = (id: number | null) => nameOf(COUNTRIES, id)
export const stateName = (id: number | null) => nameOf(STATES, id)
export const titleName = (id: number | null) => nameOf(TITLES, id)
export const industryName = (id: number | null) => nameOf(INDUSTRIES, id)
export const userName = (id: number | null) => nameOf(USERS, id)
export const companyName = (id: number | null) => nameOf(COMPANIES, id)
export const typeLabel = (t: PartnerType) => PARTNER_TYPES.find(x => x.id === t)?.label ?? t
export const langName = (code: string) => LANGS.find(l => l.code === code)?.name ?? code
