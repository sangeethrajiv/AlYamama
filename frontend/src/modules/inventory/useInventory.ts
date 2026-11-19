import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Contact } from '../contacts/types'
import type { DirProduct } from '../shared/directory'
import { apiEnabled } from '../shared/api'
import type { StockState } from './types'
import { seedStock } from './data'
import { qtyAvailable } from './helpers'
import { isApiKey, loadInventory, persist } from './inventoryApi'

type ListKey = Exclude<{ [K in keyof StockState]: StockState[K] extends unknown[] ? K : never }[keyof StockState], never>

/** Nothing in memory: used in API mode, where the master data is read from the database. */
const emptyState = (): StockState => ({
  seq: 0, uom_categories: [], uoms: [], categories: [], products: [], locations: [], warehouses: [], picking_types: [],
  pickings: [], moves: [], move_lines: [], quants: [], inventories: [], inventory_lines: [],
})

/**
 * Holder for the Inventory screens.
 *
 *   - Without `VITE_API_URL` it is the original in-memory prototype on sample data.
 *   - With it, products, categories, units, locations, warehouses and operation
 *     types are read from the API and every edit is sent to it. Pickings, moves
 *     and stock quantities do not exist yet, so those lists stay empty and their
 *     screens show "Coming soon".
 *
 * It applies no stock rules itself: the rules live in the backend.
 */
export function useInventory(contacts: Contact[]) {
  const online = apiEnabled()
  const [s, setS] = useState<StockState>(() => (online ? emptyState() : seedStock(name => contacts.find(c => c.name === name)?.id)))
  const [loading, setLoading] = useState(online)
  const [error, setError] = useState('')
  const ref = useRef(s)

  const commit = useCallback((next: StockState) => { ref.current = next; setS(next) }, [])

  const reload = useCallback(async () => {
    if (!online) return
    setLoading(true)
    try {
      commit({ ...ref.current, ...(await loadInventory()) })
      setError('')
    } catch (e) {
      setError(`Could not load inventory from the API: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [online, commit])

  useEffect(() => { void reload() }, [reload])

  /** Insert or replace a record (matched by id) in one of the lists. Returns its id. */
  const save = useCallback(<K extends ListKey>(key: K, rec: Omit<StockState[K][number], 'id'> & { id?: number }): number => {
    const prev = ref.current
    const list = prev[key] as { id: number }[]
    const before = rec.id ? list.find(x => x.id === rec.id) : undefined
    let next: StockState, id: number
    if (rec.id && before) { id = rec.id; next = { ...prev, [key]: list.map(x => (x.id === id ? (rec as { id: number }) : x)) } }
    else { id = prev.seq + 1; next = { ...prev, seq: id, [key]: [{ ...rec, id }, ...list] } }
    commit(next)

    if (online && isApiKey(key)) {
      // Optimistic: the screen updates now, then the server's answer replaces the provisional id,
      // or the change is undone and the reason is shown.
      void persist(key, { ...rec, id } as Record<string, unknown> & { id: number }, before as Record<string, unknown> | undefined)
        .then(realId => {
          setError('')
          if (!before && realId !== id) {
            const cur = ref.current[key] as { id: number }[]
            commit({ ...ref.current, [key]: cur.map(x => (x.id === id ? { ...x, id: realId } : x)) })
          }
          // The server may have changed more than was sent (a renamed category renames its children).
          return reload()
        })
        .catch((e: Error) => {
          commit(prev)
          setError(e.message)
        })
    }
    return id
  }, [online, commit, reload])

  const removeWhere = useCallback(<K extends ListKey>(key: K, pred: (r: StockState[K][number]) => boolean) => {
    commit({ ...ref.current, [key]: (ref.current[key] as StockState[K][number][]).filter(r => !pred(r)) })
  }, [commit])

  const dirProducts = useMemo<DirProduct[]>(() => s.products.filter(p => p.active).map(p => ({
    id: String(p.id), sku: p.default_code || p.name, name: p.name, salePrice: p.list_price, taxRate: 0.15, canSell: p.sale_ok,
    uom: s.uoms.find(u => u.id === p.uom_id)?.name ?? '', active: p.active,
  })), [s.products, s.uoms])
  const onHand = useCallback((sku: string) => {
    const p = s.products.find(x => (x.default_code || x.name) === sku)
    return p && p.type === 'product' ? qtyAvailable(s, p.id) : 0
  }, [s])

  return { s, save, removeWhere, dirProducts, onHand, online, loading, error, clearError: () => setError(''), reload }
}
export type InventoryApi = ReturnType<typeof useInventory>
