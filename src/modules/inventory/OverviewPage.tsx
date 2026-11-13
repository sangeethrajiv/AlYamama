import type { InventoryApi } from './useInventory'
import type { PickingTypeCode, ID } from './types'
import { nowStr } from './helpers'
import { PageHeader } from '../shared/ui'

/** Overview: one card per operation type (Odoo's stock.picking.type kanban). */
export function OverviewPage({ inv, onOpen }: { inv: InventoryApi; onOpen: (code: PickingTypeCode, typeId: ID) => void }) {
  const { s } = inv
  const now = nowStr()
  const types = [...s.picking_types].filter(t => t.active).sort((a, b) => a.warehouse_id - b.warehouse_id || a.sequence - b.sequence)
  return (
    <div className="space-y-4">
      <PageHeader title="Inventory Overview" />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {types.map(t => {
          const ps = s.pickings.filter(p => p.picking_type_id === t.id)
          const open = ps.filter(p => p.state === 'assigned' || p.state === 'confirmed' || p.state === 'waiting')
          const stat = (label: string, n: number) => <div className="flex justify-between text-xs"><span className="text-slate-500">{label}</span><span className={`font-mono font-bold ${n ? 'text-slate-800' : 'text-slate-300'}`}>{n}</span></div>
          return (
            <section key={t.id} className="bg-white border border-slate-200 rounded-xl shadow-xs p-4 space-y-3">
              <div><div className="text-sm font-extrabold text-slate-900">{t.name}</div><div className="text-[11px] text-slate-500">{s.warehouses.find(w => w.id === t.warehouse_id)?.name}</div></div>
              <button onClick={() => onOpen(t.code, t.id)} className="w-full px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">{ps.filter(p => p.state === 'assigned').length} To Process</button>
              <div className="space-y-1">{stat('Waiting', ps.filter(p => p.state === 'confirmed' || p.state === 'waiting').length)}{stat('Late', open.filter(p => p.scheduled_date < now).length)}{stat('Back Orders', ps.filter(p => p.backorder_id && open.includes(p)).length)}</div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
