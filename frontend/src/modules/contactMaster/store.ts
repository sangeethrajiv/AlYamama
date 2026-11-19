import { useSyncExternalStore } from 'react'
import { SEED_PARTNERS } from './data'
import type { PartnerDraft, ResPartner } from './types'

/**
 * In-memory holder for the contact records (frontend-only). Changes live until the page is reloaded and are shared by
 * the list, view and form screens. display_name and commercial_partner_id are recomputed on every write, as Odoo does.
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

let partners = normalize(SEED_PARTNERS)
const listeners = new Set<() => void>()
const commit = (next: ResPartner[]) => { partners = normalize(next); listeners.forEach(l => l()) }

export const usePartners = () => useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => partners)

export function createPartner(draft: PartnerDraft): ResPartner {
  const id = partners.reduce((m, x) => Math.max(m, x.id), 0) + 1
  commit([{ ...draft, id, display_name: '', commercial_partner_id: id }, ...partners])
  return partners.find(x => x.id === id)!
}
export function updatePartner(id: number, draft: PartnerDraft) {
  commit(partners.map(x => (x.id === id ? { ...x, ...draft } : x)))
}
export const setPartnerActive = (id: number, active: boolean) => commit(partners.map(x => (x.id === id ? { ...x, active } : x)))

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
