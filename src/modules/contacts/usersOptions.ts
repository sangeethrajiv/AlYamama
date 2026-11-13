import { COMPANIES, COUNTRIES, STATES, TITLES, SALES_TEAMS, JOBS, DEPARTMENTS, EMPLOYEES, type Opt } from './usersLookups'
import { RES_USERS } from './usersData'

/** Selection fields: [stored value, label] exactly as defined in the Odoo 12 source. */
export type Sel = [string, string][]
export const NOTIFICATION_TYPES: Sel = [['email', 'Handle by Emails'], ['inbox', 'Handle in Odoo']]
export const SIDEBAR_TYPES: Sel = [['invisible', 'Invisible'], ['small', 'Small'], ['large', 'Large']]
export const CHATTER_POSITIONS: Sel = [['normal', 'Normal'], ['sided', 'Sided']]
export const ODOOBOT_STATES: Sel = [
  ['not_initialized', 'Not initialized'], ['onboarding_emoji', 'Onboarding emoji'], ['onboarding_attachement', 'Onboarding attachement'],
  ['onboarding_command', 'Onboarding command'], ['onboarding_ping', 'Onboarding ping'], ['idle', 'Idle'], ['disabled', 'Disabled'],
]
export const WORKING_STATUSES: Sel = [['presently_working', 'Presently Working'], ['on_vacation', 'On Vacation'], ['resigned', 'Resigned'], ['terminated', 'Terminated']]

export const labelOf = (sel: Sel, v?: string) => (v ? sel.find(s => s[0] === v)?.[1] ?? v : '')
export const nameOf = (list: Opt[], id?: number) => (id ? list.find(o => o.id === id)?.name ?? `#${id}` : '')
export const companyName = (id?: number) => nameOf(COMPANIES, id)
export const countryName = (id?: number) => nameOf(COUNTRIES, id)
export const stateName = (id?: number) => nameOf(STATES, id)
export const titleName = (id?: number) => nameOf(TITLES, id)
export const teamName = (id?: number) => nameOf(SALES_TEAMS, id)
export const jobName = (id?: number) => nameOf(JOBS, id)
export const departmentName = (id?: number) => nameOf(DEPARTMENTS, id)
export const employeeName = (id?: number) => nameOf(EMPLOYEES, id)
/** create_uid / write_uid display: the user's name. */
export const userName = (id?: number) => (id ? RES_USERS.find(u => u.id === id)?.name ?? `#${id}` : '')
