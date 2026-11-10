export type ProductType = 'storable' | 'consumable' | 'service'

export interface Product {
  id: string
  sku: string
  barcode: string
  name: string
  categoryId: string
  type: ProductType
  uom: string
  cost: number
  salePrice: number
  taxRate: number
  canSell: boolean
  canPurchase: boolean
  tracking: 'none' | 'lot' | 'serial'
  description: string
  vendor: string
  active: boolean
}

export interface ProductCategory { id: string; name: string; parentId?: string }

export interface Warehouse { id: string; code: string; name: string; city: string; active: boolean }

export type LocationUsage = 'internal' | 'vendor' | 'customer' | 'scrap'
export interface StockLocation { id: string; name: string; usage: LocationUsage; warehouseCode?: string }

export type MoveType = 'receipt' | 'delivery' | 'internal' | 'adjustment'
export interface StockMove {
  id: string
  date: string
  reference: string
  type: MoveType
  sku: string
  productName: string
  from: string
  to: string
  qty: number
  uom: string
  lot?: string
}

export type TransferKind = 'receipt' | 'delivery' | 'internal'
export type TransferState = 'draft' | 'ready' | 'done' | 'cancel'
export interface TransferLine { id: string; sku: string; productName: string; uom: string; demand: number; lot?: string }
export interface Transfer {
  id: string
  reference: string
  kind: TransferKind
  state: TransferState
  partner: string
  sourceDoc: string
  scheduled: string
  from: string
  to: string
  lines: TransferLine[]
  doneAt?: string
  notes: string
}

export interface ReorderRule { id: string; sku: string; warehouseCode: string; min: number; max: number; multiple: number }
