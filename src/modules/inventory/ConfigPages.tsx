import { useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { Contact } from '../contacts/types'
import type { InventoryApi } from './useInventory'
import type { Location, LocationUsage, Warehouse, PickingType, ProductCategory, UomCategory, Uom, MeasureType, UomType, PickingTypeCode, ID } from './types'
import { completeName, categoryName, factorInv, getUom } from './helpers'
import { M2O, ErrorBanner } from './components'
import { PageHeader, PrimaryButton, GhostButton, SearchBox, Table, Pill, EmptyState, CenterDialog, Field, inputCls } from '../shared/ui'

/** Generic list + form dialog used by the Configuration screens. */
function Crud<T extends { id: number }>({ title, subtitle, head, rows, cells, blank, form, validate, onSave, readOnly, searchText, searchQuery }: {
  title: string; subtitle?: string; head: (string | { label: string; right?: boolean })[]; rows: T[]; cells: (r: T) => ReactNode[]
  blank: () => T; form: (r: T, set: <K extends keyof T>(k: K, v: T[K]) => void, dis: boolean) => ReactNode; validate: (r: T) => string; onSave: (r: T) => void
  readOnly: boolean; searchText: (r: T) => string; searchQuery: string
}) {
  const [local, setLocal] = useState('')
  const [rec, setRec] = useState<T | null>(null)
  const [err, setErr] = useState('')
  const q = (local || searchQuery).trim().toLowerCase()
  const shown = rows.filter(r => !q || searchText(r).toLowerCase().includes(q))
  const set = <K extends keyof T>(k: K, v: T[K]) => setRec(r => (r ? { ...r, [k]: v } : r))
  const save = () => { if (!rec) return; const e = validate(rec); setErr(e); if (e) return; onSave(rec); setRec(null) }
  return (
    <div className="space-y-4">
      <PageHeader title={title} subtitle={subtitle} actions={<>
        <SearchBox value={local} onChange={setLocal} />
        {!readOnly && <PrimaryButton onClick={() => { setErr(''); setRec(blank()) }}><Plus size={16} />Create</PrimaryButton>}
      </>} />
      <Table head={head} empty={shown.length === 0 ? <EmptyState title={`No ${title.toLowerCase()} found`} /> : null}>
        {shown.map(r => (
          <tr key={r.id} onClick={() => { setErr(''); setRec({ ...r }) }} className="hover:bg-slate-50 cursor-pointer">
            {cells(r).map((c, i) => <td key={i} className={`px-3 py-2.5 ${i === 0 ? 'font-bold text-slate-900' : 'text-slate-600'}`}>{c}</td>)}
          </tr>
        ))}
      </Table>
      {rec && (
        <CenterDialog dense title={rec.id ? title.replace(/s$/, '') : `New ${title.replace(/s$/, '')}`} onClose={() => setRec(null)}
          footer={<>{!readOnly && <PrimaryButton onClick={save}>Save</PrimaryButton>}<GhostButton onClick={() => setRec(null)}>Discard</GhostButton></>}>
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 max-w-3xl mx-auto w-full">
            <ErrorBanner text={err} />
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">{form(rec, set, readOnly)}</div>
          </div>
        </CenterDialog>
      )}
    </div>
  )
}
const txt = (v: string, on: (v: string) => void, dis: boolean, label: string, mono = false) => <input aria-label={label} disabled={dis} className={`${inputCls} ${mono ? 'font-mono' : ''}`} value={v} onChange={e => on(e.target.value)} />
const chk = (v: boolean, on: (v: boolean) => void, dis: boolean, label: string) => <input aria-label={label} type="checkbox" disabled={dis} checked={v} onChange={e => on(e.target.checked)} />
const num = (v: number, on: (v: number) => void, dis: boolean, label: string) => <input aria-label={label} type="number" disabled={dis} className={inputCls} value={v} onChange={e => on(Number(e.target.value) || 0)} />
interface P { inv: InventoryApi; readOnly: boolean; searchQuery: string }
const yes = (b: boolean) => (b ? <Pill tone="green">Active</Pill> : <Pill>Archived</Pill>)

// ---- stock.warehouse ----
const STEPS_IN: Record<Warehouse['reception_steps'], string> = { one_step: 'Receive goods directly (1 step)', two_steps: 'Receive goods in input and then stock (2 steps)', three_steps: 'Receive goods in input, then quality and then stock (3 steps)' }
const STEPS_OUT: Record<Warehouse['delivery_steps'], string> = { ship_only: 'Deliver goods directly (1 step)', pick_ship: 'Send goods in output and then deliver (2 steps)', pick_pack_ship: 'Pack goods, send goods in output and then deliver (3 steps)' }
export function WarehousesPage({ inv, readOnly, searchQuery, contacts }: P & { contacts: Contact[] }) {
  const { s } = inv
  const blank = (): Warehouse => ({ id: 0, name: '', code: '', active: true, view_location_id: 0, lot_stock_id: 0, reception_steps: 'one_step', delivery_steps: 'ship_only', in_type_id: 0, int_type_id: 0, out_type_id: 0 })
  return <Crud<Warehouse> title="Warehouses" head={['Warehouse', 'Short Name', 'Location Stock', 'Address', 'Status']} rows={s.warehouses} readOnly={readOnly} searchQuery={searchQuery} searchText={w => `${w.name} ${w.code}`}
    cells={w => [w.name, w.code, completeName(s, w.lot_stock_id) || '—', contacts.find(c => c.id === w.partner_id)?.name || '—', yes(w.active)]} blank={blank}
    validate={w => (!w.name.trim() || !w.code.trim() ? 'Warehouse and Short Name are required.' : s.warehouses.some(x => x.id !== w.id && x.code.toLowerCase() === w.code.trim().toLowerCase()) ? 'The short name of the warehouse must be unique.' : '')}
    onSave={w => inv.save('warehouses', w)}
    form={(w, set, dis) => <>
      <Field dense label="Warehouse">{txt(w.name, v => set('name', v), dis, 'Warehouse')}</Field>
      <Field dense label="Short Name">{txt(w.code, v => set('code', v), dis, 'Short Name', true)}</Field>
      <Field dense label="Address"><select aria-label="Address" disabled={dis} className={inputCls} value={w.partner_id ?? ''} onChange={e => set('partner_id', e.target.value || undefined)}><option value="" />{contacts.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field dense label="Active">{chk(w.active, v => set('active', v), dis, 'Active')}</Field>
      <Field dense label="Incoming Shipments"><select aria-label="Incoming Shipments" disabled={dis} className={inputCls} value={w.reception_steps} onChange={e => set('reception_steps', e.target.value as Warehouse['reception_steps'])}>{Object.entries(STEPS_IN).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
      <Field dense label="Outgoing Shipments"><select aria-label="Outgoing Shipments" disabled={dis} className={inputCls} value={w.delivery_steps} onChange={e => set('delivery_steps', e.target.value as Warehouse['delivery_steps'])}>{Object.entries(STEPS_OUT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
    </>} />
}

// ---- stock.location ----
const USAGE: Record<LocationUsage, string> = { supplier: 'Vendor Location', view: 'View', internal: 'Internal Location', customer: 'Customer Location', inventory: 'Inventory Loss', procurement: 'Procurement', production: 'Production', transit: 'Transit Location' }
export function LocationsPage({ inv, readOnly, searchQuery, contacts }: P & { contacts: Contact[] }) {
  const { s } = inv
  const blank = (): Location => ({ id: 0, name: '', usage: 'internal', comment: '', posx: 0, posy: 0, posz: 0, scrap_location: false, return_location: false, barcode: '', active: true })
  return <Crud<Location> title="Locations" head={['Location', 'Location Type', 'Status']} rows={s.locations} readOnly={readOnly} searchQuery={searchQuery} searchText={l => `${completeName(s, l.id)} ${l.barcode}`}
    cells={l => [completeName(s, l.id), USAGE[l.usage], yes(l.active)]} blank={blank} validate={l => (l.name.trim() ? '' : 'Location Name is required.')} onSave={l => inv.save('locations', { ...l, name: l.name.trim() })}
    form={(l, set, dis) => <>
      <Field dense label="Location Name">{txt(l.name, v => set('name', v), dis, 'Location Name')}</Field>
      <Field dense label="Parent Location"><M2O label="Parent Location" disabled={dis} value={l.location_id} onChange={v => set('location_id', v)} options={s.locations.filter(x => x.id !== l.id).map(x => ({ id: x.id, label: completeName(s, x.id) }))} /></Field>
      <Field dense label="Location Type"><select aria-label="Location Type" disabled={dis} className={inputCls} value={l.usage} onChange={e => set('usage', e.target.value as LocationUsage)}>{Object.entries(USAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field dense label="Owner"><select aria-label="Owner" disabled={dis} className={inputCls} value={l.partner_id ?? ''} onChange={e => set('partner_id', e.target.value || undefined)}><option value="" />{contacts.filter(c => c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field dense label="Is a Scrap Location?">{chk(l.scrap_location, v => set('scrap_location', v), dis, 'Is a Scrap Location?')}</Field>
      <Field dense label="Is a Return Location?">{chk(l.return_location, v => set('return_location', v), dis, 'Is a Return Location?')}</Field>
      <Field dense label="Corridor (X)">{num(l.posx, v => set('posx', v), dis, 'Corridor (X)')}</Field>
      <Field dense label="Shelves (Y)">{num(l.posy, v => set('posy', v), dis, 'Shelves (Y)')}</Field>
      <Field dense label="Height (Z)">{num(l.posz, v => set('posz', v), dis, 'Height (Z)')}</Field>
      <Field dense label="Barcode">{txt(l.barcode, v => set('barcode', v), dis, 'Barcode', true)}</Field>
      <Field dense label="Additional Information" span={2}><textarea aria-label="Additional Information" rows={2} disabled={dis} className={`${inputCls} resize-none`} value={l.comment} onChange={e => set('comment', e.target.value)} /></Field>
      <Field dense label="Active">{chk(l.active, v => set('active', v), dis, 'Active')}</Field>
    </>} />
}

// ---- stock.picking.type ----
const CODE: Record<PickingTypeCode, string> = { incoming: 'Vendors', outgoing: 'Customers', internal: 'Internal' }
export function PickingTypesPage({ inv, readOnly, searchQuery }: P) {
  const { s } = inv
  const blank = (): PickingType => ({ id: 0, name: '', code: 'incoming', sequence: 10, sequence_prefix: '', sequence_next: 1, warehouse_id: s.warehouses[0]?.id ?? 0, barcode: '', active: true })
  const locs = s.locations.filter(l => l.active && l.usage !== 'view').map(l => ({ id: l.id, label: completeName(s, l.id) }))
  return <Crud<PickingType> title="Operation Types" head={['Operation Type', 'Warehouse', 'Type of Operation', 'Reference Sequence', 'Status']} rows={s.picking_types} readOnly={readOnly} searchQuery={searchQuery} searchText={t => `${t.name} ${t.sequence_prefix}`}
    cells={t => [t.name, s.warehouses.find(w => w.id === t.warehouse_id)?.name ?? '—', CODE[t.code], `${t.sequence_prefix}${String(t.sequence_next).padStart(5, '0')}`, yes(t.active)]} blank={blank}
    validate={t => (!t.name.trim() ? 'Operation Type is required.' : !t.sequence_prefix.trim() ? 'Reference Sequence prefix is required.' : '')} onSave={t => inv.save('picking_types', { ...t, name: t.name.trim() })}
    form={(t, set, dis) => <>
      <Field dense label="Operation Type">{txt(t.name, v => set('name', v), dis, 'Operation Type')}</Field>
      <Field dense label="Type of Operation"><select aria-label="Type of Operation" disabled={dis} className={inputCls} value={t.code} onChange={e => set('code', e.target.value as PickingTypeCode)}>{Object.entries(CODE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field dense label="Warehouse"><M2O label="Warehouse" disabled={dis} value={t.warehouse_id} onChange={v => set('warehouse_id', v ?? 0)} options={s.warehouses.map(w => ({ id: w.id, label: w.name }))} /></Field>
      <Field dense label="Reference Sequence">{txt(t.sequence_prefix, v => set('sequence_prefix', v), dis, 'Reference Sequence', true)}</Field>
      <Field dense label="Default Source Location"><M2O label="Default Source Location" disabled={dis} value={t.default_location_src_id} onChange={v => set('default_location_src_id', v)} options={locs} /></Field>
      <Field dense label="Default Destination Location"><M2O label="Default Destination Location" disabled={dis} value={t.default_location_dest_id} onChange={v => set('default_location_dest_id', v)} options={locs} /></Field>
      <Field dense label="Barcode">{txt(t.barcode, v => set('barcode', v), dis, 'Barcode', true)}</Field>
      <Field dense label="Sequence">{num(t.sequence, v => set('sequence', v), dis, 'Sequence')}</Field>
      <Field dense label="Active">{chk(t.active, v => set('active', v), dis, 'Active')}</Field>
    </>} />
}

// ---- product.category ----
export function CategoriesPage({ inv, readOnly, searchQuery }: P) {
  const { s } = inv
  return <Crud<ProductCategory> title="Product Categories" head={['Name', { label: '# Products', right: true }]} rows={s.categories} readOnly={readOnly} searchQuery={searchQuery} searchText={c => categoryName(s, c.id)}
    cells={c => [categoryName(s, c.id), s.products.filter(p => p.categ_id === c.id).length]} blank={() => ({ id: 0, name: '' })} validate={c => (c.name.trim() ? '' : 'Name is required.')} onSave={c => inv.save('categories', { ...c, name: c.name.trim() })}
    form={(c, set, dis) => <>
      <Field dense label="Name">{txt(c.name, v => set('name', v), dis, 'Name')}</Field>
      <Field dense label="Parent Category"><M2O label="Parent Category" disabled={dis} value={c.parent_id} onChange={v => set('parent_id', v)} options={s.categories.filter(x => x.id !== c.id).map(x => ({ id: x.id, label: categoryName(s, x.id) }))} /></Field>
    </>} />
}

// ---- uom.category ----
const MEASURE: Record<MeasureType, string> = { unit: 'Units', weight: 'Weight', time: 'Time', length: 'Length', volume: 'Volume' }
export function UomCategoriesPage({ inv, readOnly, searchQuery }: P) {
  const { s } = inv
  return <Crud<UomCategory> title="UoM Categories" head={['Unit of Measure Category', 'Type of Measure']} rows={s.uom_categories} readOnly={readOnly} searchQuery={searchQuery} searchText={c => c.name}
    cells={c => [c.name, MEASURE[c.measure_type]]} blank={() => ({ id: 0, name: '', measure_type: 'unit' })} validate={c => (c.name.trim() ? '' : 'Unit of Measure Category is required.')} onSave={c => inv.save('uom_categories', { ...c, name: c.name.trim() })}
    form={(c, set, dis) => <>
      <Field dense label="Unit of Measure Category">{txt(c.name, v => set('name', v), dis, 'Unit of Measure Category')}</Field>
      <Field dense label="Type of Measure"><select aria-label="Type of Measure" disabled={dis} className={inputCls} value={c.measure_type} onChange={e => set('measure_type', e.target.value as MeasureType)}>{Object.entries(MEASURE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
    </>} />
}

// ---- uom.uom ----
const UOM_TYPE: Record<UomType, string> = { bigger: 'Bigger than the reference Unit of Measure', reference: 'Reference Unit of Measure for this category', smaller: 'Smaller than the reference Unit of Measure' }
const uomType = (u: Uom) => (u.uom_type)
export function UomsPage({ inv, readOnly, searchQuery }: P) {
  const { s } = inv
  const catName = (id: ID) => s.uom_categories.find(c => c.id === id)?.name ?? ''
  return <Crud<Uom> title="Units of Measure" head={['Unit of Measure', 'Category', 'Type']} rows={s.uoms} readOnly={readOnly} searchQuery={searchQuery} searchText={u => `${u.name} ${catName(u.category_id)}`}
    cells={u => [u.name, catName(u.category_id), UOM_TYPE[uomType(u)].split(' ')[0]]} blank={() => ({ id: 0, name: '', category_id: s.uom_categories[0]?.id ?? 0, uom_type: 'reference', factor: 1, rounding: 0.01, active: true })}
    validate={u => (!u.name.trim() ? 'Unit of Measure is required.' : !u.category_id ? 'Category is required.' : u.factor <= 0 ? 'Ratio must be greater than zero.' : '')}
    onSave={u => inv.save('uoms', { ...u, name: u.name.trim(), factor: u.uom_type === 'reference' ? 1 : u.factor })}
    form={(u, set, dis) => <>
      <Field dense label="Unit of Measure">{txt(u.name, v => set('name', v), dis, 'Unit of Measure')}</Field>
      <Field dense label="Category"><M2O label="Category" disabled={dis} value={u.category_id} onChange={v => set('category_id', v ?? 0)} options={s.uom_categories.map(c => ({ id: c.id, label: c.name }))} /></Field>
      <Field dense label="Type" span={2}><select aria-label="Type" disabled={dis} className={inputCls} value={u.uom_type} onChange={e => set('uom_type', e.target.value as UomType)}>{Object.entries(UOM_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      {u.uom_type === 'smaller' && <Field dense label="Ratio" hint="How many of this unit make one reference unit.">{num(u.factor, v => set('factor', v), dis, 'Ratio')}</Field>}
      {u.uom_type === 'bigger' && <Field dense label="Bigger Ratio" hint="How many reference units make one of this unit.">{num(factorInv(u), v => set('factor', v ? Math.round((1 / v) * 1e9) / 1e9 : 0), dis, 'Bigger Ratio')}</Field>}
      <Field dense label="Rounding Precision">{num(u.rounding, v => set('rounding', v), dis, 'Rounding Precision')}</Field>
      <Field dense label="Active">{chk(u.active, v => set('active', v), dis, 'Active')}</Field>
    </>} />
}
void getUom
