import { useCallback, useMemo, useState } from 'react'
import type { StockQuant, InventoryAdjustment } from '../../types/accounting'
import { mockStockQuants } from '../../data/mockInventory'
import type { Product, ProductCategory, Warehouse, StockMove, Transfer, ReorderRule, MoveType, TransferKind } from './types'
import { mockCategories, mockWarehouses, mockMoves, mockTransfers, mockRules, seedProducts, buildLocations } from './data'

const now = () => new Date().toISOString().slice(0, 10)

export function useInventory(companyId: string) {
  const [quantsAll, setQuants] = useState<StockQuant[]>(mockStockQuants)
  const [products, setProducts] = useState<Product[]>(() => seedProducts(mockStockQuants))
  const [categories, setCategories] = useState<ProductCategory[]>(mockCategories)
  const [warehouses, setWarehouses] = useState<Warehouse[]>(mockWarehouses)
  const [extraLocations, setExtraLocations] = useState<string[]>([])
  const [moves, setMoves] = useState<StockMove[]>(mockMoves)
  const [transfers, setTransfers] = useState<Transfer[]>(mockTransfers)
  const [rules, setRules] = useState<ReorderRule[]>(mockRules)
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([])

  const quants = useMemo(() => quantsAll.filter(q => q.companyId === companyId), [quantsAll, companyId])
  const locations = useMemo(() => {
    const base = buildLocations(quants)
    const extra = extraLocations.filter(n => !base.some(b => b.name === n)).map(n => ({ id: `loc_${n}`, name: n, usage: 'internal' as const, warehouseCode: n.split('/')[0] }))
    return [...base.filter(b => b.usage === 'internal'), ...extra, ...base.filter(b => b.usage !== 'internal')]
  }, [quants, extraLocations])

  const onHand = useCallback((sku: string, location?: string) =>
    quants.filter(q => q.productCode === sku && (!location || q.location === location)).reduce((s, q) => s + q.onHand, 0), [quants])

  const recordMoves = (ms: Omit<StockMove, 'id'>[]) =>
    setMoves(prev => [...ms.map((m, i) => ({ ...m, id: `mv_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}` })), ...prev])

  // ---- Catalogue ----
  const saveProduct = (p: Product) => setProducts(prev => (prev.some(x => x.id === p.id) ? prev.map(x => (x.id === p.id ? p : x)) : [p, ...prev]))
  const saveCategory = (c: ProductCategory) => setCategories(prev => (prev.some(x => x.id === c.id) ? prev.map(x => (x.id === c.id ? c : x)) : [...prev, c]))
  const deleteCategory = (id: string): string => {
    if (products.some(p => p.categoryId === id)) return 'Category still has products. Move them first.'
    if (categories.some(c => c.parentId === id)) return 'Category has sub-categories.'
    setCategories(prev => prev.filter(c => c.id !== id))
    return ''
  }
  const saveWarehouse = (w: Warehouse) => setWarehouses(prev => (prev.some(x => x.id === w.id) ? prev.map(x => (x.id === w.id ? w : x)) : [...prev, w]))
  const addLocation = (name: string) => setExtraLocations(prev => (prev.includes(name) ? prev : [...prev, name]))
  const saveRule = (r: ReorderRule) => setRules(prev => (prev.some(x => x.id === r.id) ? prev.map(x => (x.id === r.id ? r : x)) : [...prev, r]))
  const deleteRule = (id: string) => setRules(prev => prev.filter(r => r.id !== id))

  // ---- Stock mutation helpers ----
  const applyOut = (list: StockQuant[], sku: string, location: string, qty: number, lot?: string) => {
    let left = qty
    const next = list.map(q => ({ ...q }))
    const candidates = next.filter(q => q.productCode === sku && q.location === location && q.companyId === companyId && (!lot || q.lot === lot))
    for (const q of candidates) {
      if (left <= 0) break
      const take = Math.min(q.onHand, left)
      q.onHand -= take
      left -= take
    }
    return { next, short: left }
  }
  const applyIn = (list: StockQuant[], p: Product | undefined, sku: string, name: string, location: string, qty: number, uom: string, lot?: string) => {
    const idx = list.findIndex(q => q.productCode === sku && q.location === location && q.companyId === companyId && (q.lot || '') === (lot || ''))
    if (idx >= 0) return list.map((q, i) => (i === idx ? { ...q, onHand: q.onHand + qty } : q))
    const catName = categories.find(c => c.id === p?.categoryId)?.name || 'All'
    return [...list, { id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`, companyId, productCode: sku, productName: name, category: catName, location, lot, uom, onHand: qty, unitCost: p?.cost ?? 0 } as StockQuant]
  }

  // ---- Transfers ----
  const nextRef = (kind: TransferKind, wh: string) => {
    const tag = kind === 'receipt' ? 'IN' : kind === 'delivery' ? 'OUT' : 'INT'
    const n = transfers.filter(t => t.kind === kind).length + 1
    return `${wh}/${tag}/${String(n).padStart(4, '0')}`
  }
  const saveTransfer = (t: Transfer) => setTransfers(prev => (prev.some(x => x.id === t.id) ? prev.map(x => (x.id === t.id ? t : x)) : [t, ...prev]))
  const setTransferState = (id: string, state: 'ready' | 'cancel' | 'draft') => setTransfers(prev => prev.map(t => (t.id === id && t.state !== 'done' ? { ...t, state } : t)))

  /** Validates a transfer: moves the stock. Returns an error message, or '' on success. */
  const validateTransfer = (t: Transfer): string => {
    const existing = transfers.find(x => x.id === t.id)
    if (existing && (existing.state === 'done' || existing.state === 'cancel')) return 'This transfer is already closed.'
    if (t.state === 'done' || t.state === 'cancel') return 'This transfer is already closed.'
    if (t.lines.length === 0) return 'Add at least one product line.'
    let list = quantsAll
    for (const l of t.lines) {
      const p = products.find(x => x.sku === l.sku)
      if (p?.type === 'service') continue
      if (t.kind !== 'receipt') {
        const { next, short } = applyOut(list, l.sku, t.from, l.demand, l.lot)
        if (short > 0) return `Not enough stock of ${l.sku} in ${t.from}: short by ${short} ${l.uom}.`
        list = next
      }
      if (t.kind !== 'delivery') list = applyIn(list, p, l.sku, l.productName, t.to, l.demand, l.uom, l.lot)
    }
    setQuants(list)
    recordMoves(t.lines.filter(l => products.find(x => x.sku === l.sku)?.type !== 'service').map(l => ({ date: now(), reference: t.reference, type: t.kind as MoveType, sku: l.sku, productName: l.productName, from: t.from, to: t.to, qty: l.demand, uom: l.uom, lot: l.lot })))
    const done: Transfer = { ...t, state: 'done', doneAt: now() }
    setTransfers(prev => (prev.some(x => x.id === t.id) ? prev.map(x => (x.id === t.id ? done : x)) : [done, ...prev]))
    return ''
  }

  // ---- Adjustments (accounting side is booked by App) ----
  const applyCounts = (counts: Map<string, number>, record: InventoryAdjustment) => {
    const moveList: Omit<StockMove, 'id'>[] = []
    record.lines.forEach(l => {
      const diff = l.countedQty - l.previousQty
      if (diff === 0) return
      moveList.push({ date: record.accountingDate, reference: record.reference, type: 'adjustment', sku: l.productCode, productName: l.productName, from: diff > 0 ? 'Virtual/Adjustment' : l.location, to: diff > 0 ? l.location : 'Virtual/Adjustment', qty: Math.abs(diff), uom: l.uom, lot: l.lot })
    })
    setQuants(prev => prev.map(q => (counts.has(q.id) ? { ...q, onHand: counts.get(q.id) as number } : q)))
    setAdjustments(prev => [record, ...prev])
    recordMoves(moveList)
  }

  return {
    products, categories, warehouses, locations, quants, moves, transfers, rules, adjustments,
    onHand, saveProduct, saveCategory, deleteCategory, saveWarehouse, addLocation, saveRule, deleteRule,
    saveTransfer, setTransferState, validateTransfer, nextRef, applyCounts,
  }
}
export type InventoryApi = ReturnType<typeof useInventory>
