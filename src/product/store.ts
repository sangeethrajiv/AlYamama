import { useSyncExternalStore } from 'react'
import { buildSeed } from './seed'
import type { EntityKey, Id, ProductState, Rec } from './types'

/**
 * In-memory store (no backend). `saveRecord`, `setActive` and `removeRecord` are the only mutations.
 * State is replaced immutably so `useSyncExternalStore` re-renders subscribers.
 */
let state: ProductState = buildSeed()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getState = () => state
export const useProduct = (): ProductState => useSyncExternalStore(subscribe, getState)

const nextId = (list: { id: Id }[]) => list.reduce((m, r) => Math.max(m, r.id), 0) + 1

/** Create (no id) or update (id) a record. Returns the record id. */
export function saveRecord(entity: EntityKey, values: Record<string, any>, id?: Id): Id {
  const list = state[entity] as Rec[]
  if (id != null) {
    state = { ...state, [entity]: list.map((r) => (r.id === id ? { ...r, ...values, id } : r)) }
    emit()
    return id
  }
  const newId = nextId(list)
  const record = { active: true, ...values, id: newId } as Rec
  state = { ...state, [entity]: [...list, record] }
  emit()
  return newId
}

export function setActive(entity: EntityKey, id: Id, active: boolean) {
  state = { ...state, [entity]: (state[entity] as Rec[]).map((r) => (r.id === id ? { ...r, active } : r)) }
  emit()
}

export function removeRecord(entity: EntityKey, id: Id) {
  state = { ...state, [entity]: (state[entity] as Rec[]).filter((r) => r.id !== id) }
  emit()
}

// ── Guard rules (Odoo uses ondelete=restrict and similar constraints) ──
export type Guard = string | null

export function archiveBlocker(entity: EntityKey, rec: Rec, s: ProductState): Guard {
  switch (entity) {
    case 'categories': {
      const n = s.products.filter((p) => p.categ_id === rec.id && p.active).length
      const kids = s.categories.filter((c) => c.parent_id === rec.id && c.active).length
      if (n) return `${n} active product${n > 1 ? 's' : ''} use this category. Move or archive them first.`
      if (kids) return `${kids} active sub-categor${kids > 1 ? 'ies' : 'y'} exist under this category.`
      return null
    }
    case 'uomCategories': {
      const n = s.uoms.filter((u) => u.category_id === rec.id && u.active).length
      return n ? `${n} active unit${n > 1 ? 's' : ''} of measure belong to this category. Archive them first.` : null
    }
    case 'uoms': {
      const n = s.products.filter((p) => p.active && (p.uom_id === rec.id || p.uom_po_id === rec.id)).length
      if (n) return `${n} active product${n > 1 ? 's' : ''} use this unit of measure.`
      if (rec.uom_type === 'reference' && s.uoms.some((u) => u.id !== rec.id && u.category_id === rec.category_id && u.active))
        return 'This is the reference unit of its category and other active units depend on it.'
      return null
    }
    default:
      return null
  }
}

export function deleteBlocker(entity: EntityKey, rec: Rec, s: ProductState): Guard {
  switch (entity) {
    case 'products':
      return rec.qty_available ? `This product has ${rec.qty_available} units on hand and stock history. Archive it instead.` : null
    case 'categories': {
      const n = s.products.filter((p) => p.categ_id === rec.id).length
      const kids = s.categories.filter((c) => c.parent_id === rec.id).length
      if (n) return `${n} product${n > 1 ? 's' : ''} use this category.`
      return kids ? `This category has ${kids} sub-categor${kids > 1 ? 'ies' : 'y'}.` : null
    }
    case 'uomCategories': {
      const n = s.uoms.filter((u) => u.category_id === rec.id).length
      return n ? `This category contains ${n} unit${n > 1 ? 's' : ''} of measure.` : null
    }
    case 'uoms': {
      const n = s.products.filter((p) => p.uom_id === rec.id || p.uom_po_id === rec.id).length
      return n ? `${n} product${n > 1 ? 's' : ''} use this unit of measure.` : null
    }
    default:
      return null
  }
}
