/**
 * Live lookup lists from the API (countries, states, titles, industries,
 * companies, salespersons).
 *
 * The prototype ships static sample lists in options.ts whose ids do not match
 * the real Odoo database, so a contact imported from Odoo would otherwise show
 * the wrong country or title. When the API is configured these lists replace the
 * static ones through `registerLookups` in options.ts.
 */
import { apiEnabled, getAll, get, type ListResult } from '../shared/api'
import { registerLookups } from './options'

export interface Named {
  id: number
  name: string
}
interface StateDto extends Named {
  country_id: number
}

let loaded = false
let loading: Promise<void> | null = null

export function loadLookups(): Promise<void> {
  if (!apiEnabled() || loaded) return Promise.resolve()
  if (loading) return loading
  loading = (async () => {
    const [countries, titles, industries, companies, users] = await Promise.all([
      getAll<Named & { code?: string; local_name?: string }>('/countries', { active: 'all' }),
      getAll<Named & { shortcut?: string }>('/partner-titles'),
      getAll<Named & { full_name?: string }>('/partner-industries', { active: 'all' }),
      get<ListResult<Named>>('/companies').then(r => r.records),
      get<ListResult<Named & { login: string }>>('/users').then(r => r.records),
    ])

    // States are fetched per country, so only load them for the countries in use.
    const states: StateDto[] = []
    const used = new Set(countries.map(c => c.id))
    await Promise.all(
      [...used].map(async cid => {
        try {
          const r = await get<ListResult<StateDto>>(`/countries/${cid}/states`)
          r.records.forEach(st => states.push({ ...st, country_id: cid }))
        } catch {
          /* a country with no states is normal */
        }
      }),
    )

    registerLookups({
      countries: countries.map(c => ({ id: c.id, name: c.name })),
      states: states.map(s => ({ id: s.id, name: s.name, country_id: s.country_id })),
      titles: titles.map(t => ({ id: t.id, name: t.name })),
      industries: industries.map(i => ({ id: i.id, name: i.name })),
      companies: companies.map(c => ({ id: c.id, name: c.name })),
      users: users.map(u => ({ id: u.id, name: u.name || u.login })),
    })
    loaded = true
  })()
  return loading
}
