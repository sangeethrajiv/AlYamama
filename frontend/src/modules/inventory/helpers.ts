import type { StockState, ID, Product, Uom } from './types'

/** Display helpers that mirror Odoo's computed display names. No stock rules live here. */
export const getLocation = (s: StockState, id?: ID) => s.locations.find(l => l.id === id)
export const getUom = (s: StockState, id?: ID) => s.uoms.find(u => u.id === id)
export const getProduct = (s: StockState, id?: ID) => s.products.find(p => p.id === id)
export const productLabel = (p?: Product) => (p ? (p.default_code ? `[${p.default_code}] ${p.name}` : p.name) : '')

/** complete_name: a view location shows only its own name; others are prefixed by their parent. */
export function completeName(s: StockState, id?: ID): string {
  const l = getLocation(s, id)
  if (!l) return ''
  const parent = getLocation(s, l.location_id)
  return parent && l.usage !== 'view' ? `${completeName(s, parent.id)}/${l.name}` : l.name
}
/** complete_name of a product category ("All / Consumables"). */
export function categoryName(s: StockState, id?: ID): string {
  const c = s.categories.find(x => x.id === id)
  return c ? (c.parent_id ? `${categoryName(s, c.parent_id)} / ${c.name}` : c.name) : ''
}
/** factor_inv (Bigger Ratio) is 1 / factor. */
export const factorInv = (u: Pick<Uom, 'factor'>) => (u.factor ? Math.round((1 / u.factor) * 1e6) / 1e6 : 0)
/** qty_available shown on a product: sum of its quants in internal locations. */
export const qtyAvailable = (s: StockState, productId: ID) =>
  Math.round(s.quants.filter(q => q.product_id === productId && getLocation(s, q.location_id)?.usage === 'internal').reduce((a, q) => a + q.quantity, 0) * 1000) / 1000

export const nowStr = () => new Date().toISOString().slice(0, 16).replace('T', ' ')
/** theoretical_qty shown on an inventory line: what the system holds at that exact location. */
export const theoreticalQty = (s: StockState, productId: ID, locationId: ID) =>
  Math.round(s.quants.filter(q => q.product_id === productId && q.location_id === locationId).reduce((a, q) => a + q.quantity, 0) * 1000) / 1000
