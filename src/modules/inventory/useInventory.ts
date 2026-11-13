import { useCallback, useMemo, useRef, useState } from 'react'
import type { Contact } from '../contacts/types'
import type { DirProduct } from '../shared/directory'
import type { StockState } from './types'
import { seedStock } from './data'
import { qtyAvailable } from './helpers'

type ListKey = Exclude<{ [K in keyof StockState]: StockState[K] extends unknown[] ? K : never }[keyof StockState], never>

/** In-memory holder for the Inventory screens. It stores the records the forms edit; it applies no stock rules. */
export function useInventory(contacts: Contact[]) {
  const [s, setS] = useState<StockState>(() => seedStock(name => contacts.find(c => c.name === name)?.id))
  const ref = useRef(s)

  /** Insert or replace a record (matched by id) in one of the lists. Returns its id. */
  const save = useCallback(<K extends ListKey>(key: K, rec: Omit<StockState[K][number], 'id'> & { id?: number }): number => {
    const prev = ref.current
    const list = prev[key] as { id: number }[]
    let next: StockState, id: number
    if (rec.id && list.some(x => x.id === rec.id)) { id = rec.id; next = { ...prev, [key]: list.map(x => (x.id === id ? (rec as { id: number }) : x)) } }
    else { id = prev.seq + 1; next = { ...prev, seq: id, [key]: [{ ...rec, id }, ...list] } }
    ref.current = next
    setS(next)
    return id
  }, [])

  const removeWhere = useCallback(<K extends ListKey>(key: K, pred: (r: StockState[K][number]) => boolean) => {
    const next = { ...ref.current, [key]: (ref.current[key] as StockState[K][number][]).filter(r => !pred(r)) }
    ref.current = next
    setS(next)
  }, [])

  const dirProducts = useMemo<DirProduct[]>(() => s.products.filter(p => p.active).map(p => ({
    id: String(p.id), sku: p.default_code || p.name, name: p.name, salePrice: p.list_price, taxRate: 0.15, canSell: p.sale_ok,
    uom: s.uoms.find(u => u.id === p.uom_id)?.name ?? '', active: p.active,
  })), [s.products, s.uoms])
  const onHand = useCallback((sku: string) => {
    const p = s.products.find(x => (x.default_code || x.name) === sku)
    return p && p.type === 'product' ? qtyAvailable(s, p.id) : 0
  }, [s])

  return { s, save, removeWhere, dirProducts, onHand }
}
export type InventoryApi = ReturnType<typeof useInventory>
