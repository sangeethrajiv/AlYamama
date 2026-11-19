import { useSyncExternalStore } from 'react'
import { SEED_PARTNERS } from './data'
import type { PartnerDraft, ResPartner } from './types'
import { apiEnabled, getAll, post, put, get } from '../shared/api'
import { toPartner, toPayload, type PartnerDto } from './mapper'
import { loadLookups } from './lookups'

/**
 * Holder for the contact records, shared by the list, view and form screens.
 *
 * Two modes:
 *   * `VITE_API_URL` set  - records come from the Contacts API and every change
 *     is sent to it. Writes update the local copy first so the screens stay
 *     responsive, then the saved record is read back.
 *   * not set             - the original frontend-only behaviour on the sample
 *     data in data.ts, so the prototype still runs with no backend.
 *
 * `display_name` and `commercial_partner_id` are recomputed locally in the
 * offline mode only; with the API the server owns them, exactly as Odoo does.
 */
function normalize(list: ResPartner[]): ResPartner[] {
  const byId = new Map(list.map(x => [x.id, x]))
  const commercial = (x: ResPartner): number => {
    let cur = x
    for (let i = 0; i < 20 && !cur.is_company && cur.parent_id != null; i++) {
      const up = byId.get(cur.parent_id)
      if (!up) break
      cur = up
    }
    return cur.id
  }
  return list.map(x => {
    const parent = !x.is_company && x.parent_id != null ? byId.get(x.parent_id) : undefined
    const display_name = parent ? `${parent.name}, ${x.name}` : x.name
    const commercial_partner_id = commercial(x)
    return x.display_name === display_name && x.commercial_partner_id === commercial_partner_id ? x : { ...x, display_name, commercial_partner_id }
  })
}

const online = apiEnabled()

let partners: ResPartner[] = online ? [] : normalize(SEED_PARTNERS)
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())
const commit = (next: ResPartner[]) => {
  partners = online ? next : normalize(next)
  notify()
}

export const usePartners = () => useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => partners)

// ------------------------------------------------------------ API loading ---

export type LoadState = { loading: boolean; error: string }
let loadState: LoadState = { loading: online, error: '' }
const loadListeners = new Set<() => void>()
const setLoadState = (s: LoadState) => { loadState = s; loadListeners.forEach(l => l()) }

export const useLoadState = () =>
  useSyncExternalStore(cb => { loadListeners.add(cb); return () => { loadListeners.delete(cb) } }, () => loadState)

let loadPromise: Promise<void> | null = null

/** Reads every contact, archived ones included, so the status filter has something to show. */
export function loadPartners(force = false): Promise<void> {
  if (!online) return Promise.resolve()
  if (loadPromise && !force) return loadPromise
  setLoadState({ loading: true, error: '' })
  loadPromise = (async () => {
    try {
      await loadLookups()
      const rows = await getAll<PartnerDto>('/contacts', { active: 'all' })
      commit(rows.map(toPartner))
      setLoadState({ loading: false, error: '' })
    } catch (e) {
      setLoadState({ loading: false, error: (e as Error).message || 'Could not reach the Contacts API' })
      loadPromise = null
      throw e
    }
  })()
  return loadPromise
}

/** Replaces one record from the server, so computed values and tags are exact. */
async function refreshOne(id: number) {
  const dto = await get<PartnerDto>(`/contacts/${id}`)
  const fresh = toPartner(dto)
  commit(partners.some(p => p.id === id) ? partners.map(p => (p.id === id ? fresh : p)) : [fresh, ...partners])
  return fresh
}

// ------------------------------------------------------------------ writes ---

/**
 * Creates a contact. Offline it returns the new record directly; online it
 * returns a provisional record straight away (the pages navigate using its id)
 * and the server's version replaces it as soon as it arrives.
 */
export function createPartner(draft: PartnerDraft): ResPartner {
  if (!online) {
    const id = partners.reduce((m, x) => Math.max(m, x.id), 0) + 1
    commit([{ ...draft, id, display_name: '', commercial_partner_id: id }, ...partners])
    return partners.find(x => x.id === id)!
  }
  // The caller is synchronous, so the request runs in the background and the
  // record appears in the list when the server answers.
  const provisional: ResPartner = { ...(draft as ResPartner), id: -Date.now(), display_name: draft.name, commercial_partner_id: 0 }
  commit([provisional, ...partners])
  void (async () => {
    try {
      const res = await post<{ id: number; display_name: string }>('/contacts', toPayload(draft))
      commit(partners.filter(p => p.id !== provisional.id))
      await refreshOne(res.id)
      if (typeof window !== 'undefined' && window.location.hash.includes(String(provisional.id))) {
        window.location.hash = `#/cm_contacts/${res.id}`
      }
    } catch (e) {
      commit(partners.filter(p => p.id !== provisional.id))
      setLoadState({ ...loadState, error: `Could not save the contact: ${(e as Error).message}` })
    }
  })()
  return provisional
}

export function updatePartner(id: number, draft: PartnerDraft) {
  if (!online) {
    commit(partners.map(x => (x.id === id ? { ...x, ...draft } : x)))
    return
  }
  const before = partners
  commit(partners.map(x => (x.id === id ? { ...x, ...draft } : x)))
  void (async () => {
    try {
      await put(`/contacts/${id}`, toPayload(draft))
      // A parent's name change rewrites its children's display_name, so reload all.
      await loadPartners(true)
    } catch (e) {
      commit(before)
      setLoadState({ ...loadState, error: `Could not save the contact: ${(e as Error).message}` })
    }
  })()
}

export function setPartnerActive(id: number, active: boolean) {
  if (!online) {
    commit(partners.map(x => (x.id === id ? { ...x, active } : x)))
    return
  }
  const before = partners
  commit(partners.map(x => (x.id === id ? { ...x, active } : x)))
  void post(`/contacts/${id}/${active ? 'unarchive' : 'archive'}`, {}).catch((e: Error) => {
    commit(before)
    setLoadState({ ...loadState, error: `Could not change the contact: ${e.message}` })
  })
}

/** Ids of every contact below `id` in the parent_id tree (used to stop a contact becoming its own ancestor). */
export function descendantIds(list: ResPartner[], id: number): Set<number> {
  const out = new Set<number>()
  let frontier = [id]
  while (frontier.length) {
    const next = list.filter(x => x.parent_id != null && frontier.includes(x.parent_id) && !out.has(x.id)).map(x => x.id)
    next.forEach(n => out.add(n))
    frontier = next
  }
  return out
}

export const isOnline = () => online
