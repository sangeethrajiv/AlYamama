import type { StockQuant } from '../../types/accounting'
import type { Product, ProductCategory, Warehouse, StockLocation, StockMove, Transfer, ReorderRule } from './types'

export const mockCategories: ProductCategory[] = [
  { id: 'cat_all', name: 'All' },
  { id: 'cat_seals', name: 'Seals & Spares', parentId: 'cat_all' },
  { id: 'cat_raw', name: 'Raw Materials', parentId: 'cat_all' },
  { id: 'cat_fab', name: 'Fabricated Parts', parentId: 'cat_all' },
  { id: 'cat_pump', name: 'Pumps & Motors', parentId: 'cat_all' },
  { id: 'cat_cons', name: 'Consumables', parentId: 'cat_all' },
  { id: 'cat_elec', name: 'Electronics', parentId: 'cat_all' },
  { id: 'cat_srv', name: 'Workshop Services', parentId: 'cat_all' },
]

export const mockWarehouses: Warehouse[] = [
  { id: 'wh_1', code: 'WH', name: 'Main Warehouse', city: 'Riyadh', active: true },
  { id: 'wh_2', code: 'Workshop', name: 'Workshop Floor', city: 'Riyadh', active: true },
]

const virtual: StockLocation[] = [
  { id: 'loc_ven', name: 'Partners/Vendors', usage: 'vendor' },
  { id: 'loc_cus', name: 'Partners/Customers', usage: 'customer' },
  { id: 'loc_scr', name: 'Virtual/Scrap', usage: 'scrap' },
]

export const buildLocations = (quants: StockQuant[]): StockLocation[] => {
  const internal = [...new Set(['WH/Stock', ...quants.map(q => q.location)])].sort().map(name => ({
    id: `loc_${name}`, name, usage: 'internal' as const, warehouseCode: name.split('/')[0],
  }))
  return [...internal, ...virtual]
}

const catByName: Record<string, string> = Object.fromEntries(mockCategories.map(c => [c.name, c.id]))
const price: Record<string, number> = { 'SEAL-KIT-80': 190, 'SEAL-KIT-100': 240, 'ROD-CHR-60': 470, 'TUBE-HON-120': 650, 'FAB-MANIFOLD-SS': 2650, 'PUMP-GEAR-25': 4400, 'OIL-ISO46-20L': 320, 'HOSE-2SN-1': 62, 'RP25-KIT': 780, 'FMC130': 290 }

export function seedProducts(quants: StockQuant[]): Product[] {
  const seen = new Map<string, Product>()
  quants.forEach((q, i) => {
    if (seen.has(q.productCode)) return
    seen.set(q.productCode, {
      id: `prd_${seen.size + 1}`, sku: q.productCode, barcode: `62810${String(10000 + i * 137).padStart(7, '0')}`.slice(0, 13),
      name: q.productName.replace(/^\[[^\]]+\]\s*/, ''), categoryId: catByName[q.category] || 'cat_all', type: 'storable', uom: q.uom,
      cost: q.unitCost, salePrice: price[q.productCode] ?? Math.round(q.unitCost * 1.35), taxRate: 0.15, canSell: true, canPurchase: true,
      tracking: q.lot ? 'lot' : 'none', description: '', vendor: '', active: true,
    })
  })
  seen.set('SRV-REPAIR', { id: 'prd_srv1', sku: 'SRV-REPAIR', barcode: '', name: 'Hydraulic Cylinder Repair (per job)', categoryId: 'cat_srv', type: 'service', uom: 'Job', cost: 0, salePrice: 1200, taxRate: 0.15, canSell: true, canPurchase: false, tracking: 'none', description: 'Labour and workshop time', vendor: '', active: true })
  return [...seen.values()]
}

export const mockMoves: StockMove[] = [
  { id: 'mv_1', date: '2026-10-28', reference: 'WH/IN/0001', type: 'receipt', sku: 'ROD-CHR-60', productName: 'Chrome Piston Rod 60mm', from: 'Partners/Vendors', to: 'WH/Stock/Rack B2', qty: 80, uom: 'Meters', lot: 'LOT-2026-131' },
  { id: 'mv_2', date: '2026-11-02', reference: 'WH/OUT/0001', type: 'delivery', sku: 'OIL-ISO46-20L', productName: 'Hydraulic Oil ISO 46 (20L)', from: 'WH/Stock/Bay E1', to: 'Partners/Customers', qty: 4, uom: 'Drums' },
  { id: 'mv_3', date: '2026-11-04', reference: 'WH/INT/0001', type: 'internal', sku: 'RP25-KIT', productName: 'Repair Kit', from: 'WH/Stock/Shelf A1', to: 'Workshop/Bench 2', qty: 5, uom: 'Units' },
]

export const mockTransfers: Transfer[] = [
  { id: 'tr_1', reference: 'WH/IN/0001', kind: 'receipt', state: 'done', partner: 'Dammam Special Steel & Honed Tubes Co.', sourceDoc: 'PO-0112', scheduled: '2026-10-28', from: 'Partners/Vendors', to: 'WH/Stock/Rack B2', lines: [{ id: 'l1', sku: 'ROD-CHR-60', productName: 'Chrome Piston Rod 60mm', uom: 'Meters', demand: 80, lot: 'LOT-2026-131' }], doneAt: '2026-10-28', notes: '' },
  { id: 'tr_2', reference: 'WH/IN/0002', kind: 'receipt', state: 'ready', partner: 'Dammam Special Steel & Honed Tubes Co.', sourceDoc: 'PO-0118', scheduled: '2026-11-12', from: 'Partners/Vendors', to: 'WH/Stock/Rack B3', lines: [{ id: 'l1', sku: 'TUBE-HON-120', productName: 'Honed Steel Tube 120mm', uom: 'Meters', demand: 40, lot: 'LOT-2026-140' }], notes: '' },
  { id: 'tr_3', reference: 'WH/OUT/0002', kind: 'delivery', state: 'ready', partner: 'Riyadh Infrastructure Construction Co.', sourceDoc: '', scheduled: '2026-11-11', from: 'WH/Stock/Shelf A1', to: 'Partners/Customers', lines: [{ id: 'l1', sku: 'SEAL-KIT-80', productName: 'Hydraulic Seal Kit 80mm', uom: 'Units', demand: 6 }], notes: '' },
]

export const mockRules: ReorderRule[] = [
  { id: 'rr_1', sku: 'SEAL-KIT-80', warehouseCode: 'WH', min: 50, max: 100, multiple: 10 },
  { id: 'rr_2', sku: 'SEAL-KIT-100', warehouseCode: 'WH', min: 20, max: 60, multiple: 10 },
  { id: 'rr_3', sku: 'OIL-ISO46-20L', warehouseCode: 'WH', min: 10, max: 40, multiple: 1 },
  { id: 'rr_4', sku: 'PUMP-GEAR-25', warehouseCode: 'WH', min: 3, max: 6, multiple: 1 },
]
