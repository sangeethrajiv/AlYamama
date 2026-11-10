import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { InventoryApi } from './useInventory'
import type { Warehouse } from './types'
import { PageHeader, PrimaryButton, Table, Pill, Card, Field, inputCls, Drawer, GhostButton } from '../shared/ui'

export function WarehousesPage({ inv, readOnly }: { inv: InventoryApi; readOnly: boolean }) {
  const [wh, setWh] = useState<Warehouse | null>(null)
  const [err, setErr] = useState('')
  const [locName, setLocName] = useState('')
  const [locWh, setLocWh] = useState(inv.warehouses[0]?.code || 'WH')
  const [locErr, setLocErr] = useState('')

  const saveWh = () => {
    if (!wh) return
    const code = wh.code.trim()
    if (!wh.name.trim() || !code) return setErr('Name and short code are required.')
    if (/[\/\s]/.test(code)) return setErr('Short code cannot contain spaces or slashes.')
    if (inv.warehouses.some(w => w.id !== wh.id && w.code.toLowerCase() === code.toLowerCase())) return setErr('Short code already used.')
    inv.saveWarehouse({ ...wh, code, name: wh.name.trim() }); setWh(null); setErr('')
  }
  const addLoc = () => {
    const n = locName.trim().replace(/^\/+|\/+$/g, '')
    if (!n) return setLocErr('Enter a location name, e.g. Shelf G1.')
    const full = `${locWh}/Stock/${n}`
    if (inv.locations.some(l => l.name.toLowerCase() === full.toLowerCase())) return setLocErr('That location already exists.')
    inv.addLocation(full); setLocName(''); setLocErr('')
  }
  const internal = inv.locations.filter(l => l.usage === 'internal')

  return (
    <div className="space-y-4">
      <PageHeader title="Warehouses & Locations" subtitle="Where stock physically sits."
        actions={!readOnly && <PrimaryButton onClick={() => { setErr(''); setWh({ id: `wh_${Date.now()}`, code: '', name: '', city: '', active: true }) }}><Plus size={16} />New Warehouse</PrimaryButton>} />
      <Table head={['Warehouse', 'Code', 'City', { label: 'Locations', right: true }, { label: 'Units in stock', right: true }, 'Status']}>
        {inv.warehouses.map(w => {
          const locs = internal.filter(l => l.warehouseCode === w.code)
          const units = inv.quants.filter(q => q.location.split('/')[0] === w.code).reduce((s, q) => s + q.onHand, 0)
          return (
            <tr key={w.id} onClick={() => !readOnly && (setErr(''), setWh(w))} className="hover:bg-slate-50 cursor-pointer">
              <td className="px-3 py-2.5 font-bold text-slate-900">{w.name}</td><td className="px-3 py-2.5 font-mono">{w.code}</td><td className="px-3 py-2.5">{w.city || '—'}</td>
              <td className="px-3 py-2.5 text-right font-mono">{locs.length}</td><td className="px-3 py-2.5 text-right font-mono">{units}</td>
              <td className="px-3 py-2.5">{w.active ? <Pill tone="green">Active</Pill> : <Pill tone="red">Archived</Pill>}</td>
            </tr>
          )
        })}
      </Table>
      <Card title="Locations">
        {!readOnly && (
          <div className="flex flex-wrap gap-2 items-end mb-3">
            <div className="w-40"><Field label="Warehouse"><select className={inputCls} value={locWh} onChange={e => setLocWh(e.target.value)}>{inv.warehouses.map(w => <option key={w.id} value={w.code}>{w.code}</option>)}</select></Field></div>
            <div className="w-56"><Field label="New location"><input className={inputCls} value={locName} placeholder="Shelf G1" onChange={e => setLocName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLoc()} /></Field></div>
            <GhostButton onClick={addLoc}>Add location</GhostButton>
          </div>
        )}
        {locErr && <p role="alert" className="text-xs text-rose-600 mb-2">{locErr}</p>}
        <div className="grid sm:grid-cols-2 gap-x-6 text-xs">
          {inv.locations.map(l => (
            <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-slate-100">
              <span className="font-mono text-slate-700">{l.name}</span>
              <span className="text-slate-500">{l.usage === 'internal' ? `${inv.quants.filter(q => q.location === l.name).reduce((s, q) => s + q.onHand, 0)} units` : <Pill>{l.usage}</Pill>}</span>
            </div>
          ))}
        </div>
      </Card>
      {wh && (
        <Drawer title={inv.warehouses.some(w => w.id === wh.id) ? wh.name : 'New Warehouse'} onClose={() => setWh(null)}
          footer={<><GhostButton onClick={() => setWh(null)}>Cancel</GhostButton><PrimaryButton onClick={saveWh}>Save warehouse</PrimaryButton></>}>
          {err && <div role="alert" className="text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-3 py-2">{err}</div>}
          <Card><div className="grid sm:grid-cols-2 gap-3">
            <Field label="Warehouse name *"><input className={inputCls} value={wh.name} onChange={e => setWh({ ...wh, name: e.target.value })} autoFocus /></Field>
            <Field label="Short code *"><input className={`${inputCls} font-mono`} value={wh.code} onChange={e => setWh({ ...wh, code: e.target.value })} /></Field>
            <Field label="City"><input className={inputCls} value={wh.city} onChange={e => setWh({ ...wh, city: e.target.value })} /></Field>
            <Field label="Status"><select className={inputCls} value={wh.active ? 'a' : 'x'} onChange={e => setWh({ ...wh, active: e.target.value === 'a' })}><option value="a">Active</option><option value="x">Archived</option></select></Field>
          </div></Card>
        </Drawer>
      )}
    </div>
  )
}
