import type { EntityKey, Id, ProductState, ProductCategory, RelKey, Rec } from './types'

/** Computed fields and lookups shared by the list, detail and form screens. */

export const byId = <T extends { id: Id }>(list: T[], id: Id | null | undefined): T | undefined =>
  id == null ? undefined : list.find((x) => x.id === id)

/** product.category.complete_name */
export function categoryPath(s: ProductState, c: Rec | undefined): string {
  if (!c) return ''
  const seen = new Set<Id>()
  const parts: string[] = []
  let cur: ProductCategory | undefined = c as ProductCategory | undefined
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift(cur.name)
    cur = byId(s.categories, cur.parent_id)
  }
  return parts.join(' / ')
}

export function descendantsOf<T extends { id: Id }>(list: T[], rootId: Id, parentKey: keyof T): T[] {
  const out: T[] = []
  const queue = [rootId]
  const seen = new Set<Id>(queue)
  while (queue.length) {
    const cur = queue.shift()!
    for (const x of list) {
      if ((x[parentKey] as unknown as Id | null) === cur && !seen.has(x.id)) {
        seen.add(x.id)
        out.push(x)
        queue.push(x.id)
      }
    }
  }
  return out
}

export function uomsOfCategory(s: ProductState, categoryId: Id | null) {
  return s.uoms.filter((u) => u.category_id === categoryId)
}

/** Display name of any related record. */
export function relLabel(s: ProductState, rel: RelKey, id: Id | null | undefined): string {
  if (id == null) return ''
  switch (rel) {
    case 'categories': return categoryPath(s, byId(s.categories, id))
    default: return ((s[rel] as { id: Id; name: string }[]).find((x) => x.id === id)?.name) ?? ''
  }
}

export type RelOption = { id: Id; label: string; active: boolean }

/** Options for a relation select: active records, plus the currently selected one even if archived. */
export function relOptions(s: ProductState, rel: RelKey, current?: Id | null, domain?: (r: Rec) => boolean): RelOption[] {
  const list = s[rel] as Rec[]
  return list
    .filter((r) => (r.active !== false || r.id === current) && (!domain || domain(r) || r.id === current))
    .map((r) => ({ id: r.id, label: relLabel(s, rel, r.id), active: r.active !== false }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export const isEntityKey = (k: RelKey): k is EntityKey =>
  ['products', 'categories', 'uoms', 'uomCategories'].includes(k)

export const uomFactorInv = (factor: number) => (factor ? 1 / factor : 0)

/** Trim long floats for display (0.0833333 -> 0.083333). */
export const num = (n: number, max = 4) =>
  Number.isFinite(n) ? new Intl.NumberFormat('en-US', { maximumFractionDigits: max }).format(n) : '—'
export const money = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
