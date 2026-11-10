import { moneyFormat } from '../../data/mockAccountingData'
import type { Invoice, TabId, UserRole, AdjustmentReason, InventoryAdjustmentLine } from '../../types/accounting'
import type { Contact } from '../contacts/types'
import type { InventoryApi } from './useInventory'
import InventoryAdjustmentView from '../../components/InventoryAdjustmentView'
import { ProductsPage, CategoriesPage } from './ProductsPage'
import { WarehousesPage } from './WarehousesPage'
import { StockOnHandPage, StockMovesPage } from './StockPages'
import { TransfersPage } from './TransfersPage'
import { ReorderPage } from './ReorderPage'
import { PageHeader, Kpi, Card, Pill } from '../shared/ui'

interface Props {
  tab: TabId
  inv: InventoryApi
  contacts: Contact[]
  invoices: Invoice[]
  currentRole: UserRole
  searchQuery: string
  onSelectTab: (t: TabId) => void
  onApplyAdjustment: (meta: { reference: string; accountingDate: string; reason: AdjustmentReason; notes: string }, lines: InventoryAdjustmentLine[]) => void
}

export default function InventoryModule({ tab, inv, contacts, invoices, currentRole, searchQuery, onSelectTab, onApplyAdjustment }: Props) {
  const readOnly = currentRole === 'Auditor'
  switch (tab) {
    case 'inv_products': return <ProductsPage inv={inv} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inv_categories': return <CategoriesPage inv={inv} readOnly={readOnly} />
    case 'inv_warehouses': return <WarehousesPage inv={inv} readOnly={readOnly} />
    case 'inv_stock': return <StockOnHandPage inv={inv} searchQuery={searchQuery} />
    case 'inv_moves': return <StockMovesPage inv={inv} searchQuery={searchQuery} />
    case 'inv_receipts': return <TransfersPage inv={inv} kind="receipt" contacts={contacts} invoices={invoices} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inv_deliveries': return <TransfersPage inv={inv} kind="delivery" contacts={contacts} invoices={invoices} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inv_internal': return <TransfersPage inv={inv} kind="internal" contacts={contacts} invoices={invoices} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inv_reorder': return <ReorderPage inv={inv} readOnly={readOnly} onGoReceipts={() => onSelectTab('inv_receipts')} />
    case 'inventory': return <InventoryAdjustmentView quants={inv.quants} history={inv.adjustments} currentRole={currentRole} onApply={onApplyAdjustment} />
    default: return <Overview inv={inv} onSelectTab={onSelectTab} />
  }
}

function Overview({ inv, onSelectTab }: { inv: InventoryApi; onSelectTab: (t: TabId) => void }) {
  const value = inv.quants.reduce((s, q) => s + q.onHand * q.unitCost, 0)
  const stock = (sku: string, wh: string) => inv.quants.filter(q => q.productCode === sku && q.location.split('/')[0] === wh).reduce((s, q) => s + q.onHand, 0)
  const low = inv.rules.filter(r => stock(r.sku, r.warehouseCode) < r.min)
  const open = (k: string) => inv.transfers.filter(t => t.kind === k && (t.state === 'draft' || t.state === 'ready'))
  const link = 'text-left w-full'
  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" subtitle="Stock position, pending work and what needs reordering." />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button className={link} onClick={() => onSelectTab('inv_products')}><Kpi label="Active products" value={inv.products.filter(p => p.active).length} /></button>
        <button className={link} onClick={() => onSelectTab('inv_stock')}><Kpi label="Stock value" value={moneyFormat(value)} /></button>
        <button className={link} onClick={() => onSelectTab('inv_reorder')}><Kpi label="Below minimum" value={low.length} tone={low.length ? 'red' : undefined} /></button>
        <button className={link} onClick={() => onSelectTab('inv_receipts')}><Kpi label="Receipts to process" value={open('receipt').length} /></button>
        <button className={link} onClick={() => onSelectTab('inv_deliveries')}><Kpi label="Deliveries to process" value={open('delivery').length} /></button>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Needs reordering">
          {low.length === 0 ? <p className="text-xs text-slate-500">Everything is above its minimum.</p> : (
            <ul className="divide-y divide-slate-100 text-xs">
              {low.map(r => <li key={r.id} className="py-2 flex items-center justify-between"><span className="font-bold text-slate-800">{inv.products.find(p => p.sku === r.sku)?.name || r.sku}</span><span className="font-mono text-slate-500">{stock(r.sku, r.warehouseCode)} / min {r.min}</span><Pill tone="red">Low</Pill></li>)}
            </ul>
          )}
        </Card>
        <Card title="Recent movements">
          <ul className="divide-y divide-slate-100 text-xs">
            {inv.moves.slice(0, 6).map(m => <li key={m.id} className="py-2 flex items-center justify-between gap-2"><span className="font-bold text-slate-800 truncate">{m.productName}</span><span className="text-slate-500 whitespace-nowrap">{m.reference}</span><span className="font-mono whitespace-nowrap">{m.qty} {m.uom}</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}
