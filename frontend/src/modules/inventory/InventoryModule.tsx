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

const TAB_OF: Record<PickingTypeCode, TabId> = { incoming: 'inv_receipts', outgoing: 'inv_deliveries', internal: 'inv_internal' }

interface Props { tab: TabId; inv: InventoryApi; contacts: Contact[]; currentRole: UserRole; searchQuery: string; onSelectTab: (t: TabId) => void }

/** Routes an Inventory sidebar tab to its screen. Screens follow the Odoo 12 Inventory menus. */
export default function InventoryModule({ tab, inv, contacts, currentRole, searchQuery, onSelectTab }: Props) {
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
