import { useState } from 'react'
import type { TabId, UserRole } from '../../types/accounting'
import type { Contact } from '../contacts/types'
import type { InventoryApi } from './useInventory'
import type { PickingTypeCode, ID } from './types'
import { OverviewPage } from './OverviewPage'
import { TransfersPage } from './TransfersPage'
import { AdjustmentsPage } from './AdjustmentsPage'
import { ProductsPage } from './ProductsPage'
import { StockPage, MovesPage, MoveLinesPage } from './ReportPages'
import { WarehousesPage, LocationsPage, PickingTypesPage, CategoriesPage, UomCategoriesPage, UomsPage } from './ConfigPages'
import { ComingSoon } from './ComingSoon'
import { ErrorBanner } from './components'

/** Screens that need stock moves, which are not built yet. With the API they show a placeholder. */
const COMING_SOON: Partial<Record<TabId, string>> = {
  inv_overview: 'Overview', inv_transfers: 'Transfers', inv_receipts: 'Receipts', inv_deliveries: 'Delivery Orders',
  inv_internal: 'Internal Transfers', inventory: 'Inventory Adjustments', inv_stock: 'Inventory Report',
  inv_moves: 'Stock Moves', inv_move_lines: 'Moves History',
}

const TAB_OF: Record<PickingTypeCode, TabId> = { incoming: 'inv_receipts', outgoing: 'inv_deliveries', internal: 'inv_internal' }

interface Props { tab: TabId; inv: InventoryApi; contacts: Contact[]; currentRole: UserRole; searchQuery: string; onSelectTab: (t: TabId) => void }

/** Routes an Inventory sidebar tab to its screen. Screens follow the Odoo 12 Inventory menus. */
export default function InventoryModule(props: Props) {
  const { inv, tab } = props
  const soon = inv.online ? COMING_SOON[tab] : undefined
  return (
    <>
      {inv.error && <div className="mb-3"><ErrorBanner text={inv.error} /></div>}
      {inv.online && inv.loading && inv.s.products.length === 0 && !inv.error
        ? <p className="text-sm text-slate-500 py-10 text-center">Loading inventory…</p>
        : soon ? <ComingSoon title={soon} /> : <InventoryScreens {...props} />}
    </>
  )
}

function InventoryScreens({ tab, inv, contacts, currentRole, searchQuery, onSelectTab }: Props) {
  const readOnly = currentRole === 'Auditor'
  // Overview cards open a transfers list for one operation type
  const [nav, setNav] = useState<{ tab: TabId; typeId: ID } | null>(null)
  const typeId = nav?.tab === tab ? nav.typeId : undefined
  const p = { inv, readOnly, searchQuery }
  switch (tab) {
    case 'inv_transfers': return <TransfersPage key={`${tab}${typeId}`} inv={inv} contacts={contacts} typeId={typeId} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inv_receipts': return <TransfersPage key={`${tab}${typeId}`} inv={inv} contacts={contacts} code="incoming" typeId={typeId} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inv_deliveries': return <TransfersPage key={`${tab}${typeId}`} inv={inv} contacts={contacts} code="outgoing" typeId={typeId} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inv_internal': return <TransfersPage key={`${tab}${typeId}`} inv={inv} contacts={contacts} code="internal" typeId={typeId} readOnly={readOnly} searchQuery={searchQuery} />
    case 'inventory': return <AdjustmentsPage {...p} />
    case 'inv_products': return <ProductsPage {...p} onOpenStock={() => onSelectTab('inv_stock')} />
    case 'inv_stock': return <StockPage inv={inv} searchQuery={searchQuery} />
    case 'inv_moves': return <MovesPage inv={inv} searchQuery={searchQuery} />
    case 'inv_move_lines': return <MoveLinesPage inv={inv} searchQuery={searchQuery} />
    case 'inv_warehouses': return <WarehousesPage {...p} contacts={contacts} />
    case 'inv_locations': return <LocationsPage {...p} contacts={contacts} />
    case 'inv_picking_types': return <PickingTypesPage {...p} />
    case 'inv_categories': return <CategoriesPage {...p} />
    case 'inv_uom_categories': return <UomCategoriesPage {...p} />
    case 'inv_uom': return <UomsPage {...p} />
    default: return <OverviewPage inv={inv} onOpen={(code, id) => { setNav({ tab: TAB_OF[code], typeId: id }); onSelectTab(TAB_OF[code]) }} />
  }
}
