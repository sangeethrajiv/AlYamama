import type { StockState, Location, Product, Uom, PickingType, Warehouse, ID, PickingState, MoveState, Picking, Move, MoveLine } from './types'

/**
 * Sample records for the screens (static, no stock rules).
 * Seed data. Locations, operation types and units follow what a fresh Odoo 12 database creates
 * (Physical / Partner / Virtual Locations, Vendors, Customers, Inventory adjustment, Scrap, Stock, Unit(s) ...).
 */
export function seedStock(findPartner: (name: string) => string | undefined): StockState {
  let seq = 0
  const id = () => ++seq

  // ---- units of measure ----
  const cat = (name: string, measure_type: StockState['uom_categories'][number]['measure_type']) => ({ id: id(), name, measure_type })
  const cUnit = cat('Unit', 'unit'), cWeight = cat('Weight', 'weight'), cTime = cat('Working Time', 'time'), cLen = cat('Length / Distance', 'length'), cVol = cat('Volume', 'volume')
  const u = (name: string, category_id: ID, uom_type: Uom['uom_type'], factor: number, rounding = 0.01): Uom => ({ id: id(), name, category_id, uom_type, factor, rounding, active: true })
  const uUnit = u('Unit(s)', cUnit.id, 'reference', 1, 1), uDozen = u('Dozen(s)', cUnit.id, 'bigger', 1 / 12, 1)
  const uKg = u('kg', cWeight.id, 'reference', 1), uG = u('g', cWeight.id, 'smaller', 1000), uTon = u('t', cWeight.id, 'bigger', 1 / 1000)
  const uHour = u('Hour(s)', cTime.id, 'reference', 1), uDay = u('Day(s)', cTime.id, 'bigger', 1 / 8)
  const uM = u('m', cLen.id, 'reference', 1), uCm = u('cm', cLen.id, 'smaller', 100), uKm = u('km', cLen.id, 'bigger', 1 / 1000)
  const uL = u('Litre(s)', cVol.id, 'reference', 1), uDrum = u('Drum(s)', cVol.id, 'bigger', 1 / 20, 1)

  // ---- product categories ----
  const pc = (name: string, parent_id?: ID) => ({ id: id(), name, parent_id })
  const all = pc('All')
  const cats = [all, ...['Seals & Spares', 'Raw Materials', 'Fabricated Parts', 'Pumps & Motors', 'Consumables', 'Electronics', 'Workshop Services'].map(n => pc(n, all.id))]
  const catId = (n: string) => cats.find(c => c.name === n)!.id

  // ---- locations ----
  const loc = (name: string, usage: Location['usage'], location_id?: ID, extra: Partial<Location> = {}): Location =>
    ({ id: id(), name, usage, location_id, comment: '', posx: 0, posy: 0, posz: 0, scrap_location: false, return_location: false, barcode: '', active: true, ...extra })
  const physical = loc('Physical Locations', 'view'), partners = loc('Partner Locations', 'view'), virtual = loc('Virtual Locations', 'view')
  const vendors = loc('Vendors', 'supplier', partners.id), customers = loc('Customers', 'customer', partners.id)
  const invLoss = loc('Inventory adjustment', 'inventory', virtual.id), scrap = loc('Scrap', 'inventory', virtual.id, { scrap_location: true })
  const whView = loc('WH', 'view', physical.id), whStock = loc('Stock', 'internal', whView.id, { barcode: 'WHSTOCK' })
  const shelf = (n: string, x: number, y: number) => loc(n, 'internal', whStock.id, { posx: x, posy: y })
  const a1 = shelf('Shelf A1', 1, 1), b2 = shelf('Rack B2', 2, 2), b3 = shelf('Rack B3', 2, 3), c1 = shelf('Shelf C1', 3, 1), d1 = shelf('Shelf D1', 4, 1), e1 = shelf('Bay E1', 5, 1), e2 = shelf('Bay E2', 5, 2), f1 = shelf('Shelf F1', 6, 1)
  const wsView = loc('WS', 'view', physical.id), wsStock = loc('Stock', 'internal', wsView.id), bench2 = loc('Bench 2', 'internal', wsStock.id)
  const locations = [physical, partners, vendors, customers, virtual, invLoss, scrap, whView, whStock, a1, b2, b3, c1, d1, e1, e2, f1, wsView, wsStock, bench2]

  // ---- warehouses and their operation types ----
  const picking_types: PickingType[] = []
  const warehouses: Warehouse[] = []
  const mkWarehouse = (name: string, code: string, view: Location, stock: Location) => {
    const wid = id()
    const t = (n: string, kind: PickingType['code'], tag: string, sequence: number, src?: ID, dst?: ID): ID => {
      const pt: PickingType = { id: id(), name: n, code: kind, sequence, sequence_prefix: `${code}/${tag}/`, sequence_next: 1, warehouse_id: wid, default_location_src_id: src, default_location_dest_id: dst, barcode: `${code}-${tag}`, active: true }
      picking_types.push(pt)
      return pt.id
    }
    const in_type_id = t('Receipts', 'incoming', 'IN', 1, vendors.id, stock.id)
    const int_type_id = t('Internal Transfers', 'internal', 'INT', 2, stock.id, stock.id)
    const out_type_id = t('Delivery Orders', 'outgoing', 'OUT', 3, stock.id, customers.id)
    warehouses.push({ id: wid, name, code, active: true, view_location_id: view.id, lot_stock_id: stock.id, reception_steps: 'one_step', delivery_steps: 'ship_only', in_type_id, int_type_id, out_type_id })
    return { in_type_id, int_type_id, out_type_id }
  }
  const wh = mkWarehouse('Main Warehouse', 'WH', whView, whStock)
  mkWarehouse('Workshop Floor', 'WS', wsView, wsStock)

  // ---- products ----
  const prod = (default_code: string, name: string, categ: string, type: Product['type'], uom: Uom, standard_price: number, list_price: number, barcode: string, extra: Partial<Product> = {}): Product => ({
    id: id(), name, default_code, barcode, type, categ_id: catId(categ), uom_id: uom.id, uom_po_id: uom.id, list_price, standard_price, sale_ok: true, purchase_ok: type !== 'service',
    active: true, description: '', description_picking: '', description_pickingin: '', description_pickingout: '', weight: 0, volume: 0, responsible_id: 'Sangeeth R.', ...extra,
  })
  const products: Product[] = [
    prod('SEAL-KIT-80', 'Hydraulic Seal Kit 80mm', 'Seals & Spares', 'product', uUnit, 125, 190, '6281001000013'),
    prod('SEAL-KIT-100', 'Hydraulic Seal Kit 100mm', 'Seals & Spares', 'product', uUnit, 160, 240, '6281001000150'),
    prod('ROD-CHR-60', 'Chrome Piston Rod 60mm', 'Raw Materials', 'product', uM, 310, 470, '6281001000287', { weight: 22 }),
    prod('TUBE-HON-120', 'Honed Steel Tube 120mm', 'Raw Materials', 'product', uM, 440, 650, '6281001000424', { weight: 31 }),
    prod('FAB-MANIFOLD-SS', 'CNC Stainless Steel Hydraulic Manifold', 'Fabricated Parts', 'product', uUnit, 1850, 2650, '6281001000561', { weight: 14 }),
    prod('PUMP-GEAR-25', 'Gear Pump 25cc (Reman)', 'Pumps & Motors', 'product', uUnit, 3200, 4400, '6281001000698', { weight: 9 }),
    prod('OIL-ISO46-20L', 'Hydraulic Oil ISO 46 (20L)', 'Consumables', 'product', uDrum, 210, 320, '6281001000835', { volume: 0.02 }),
    prod('HOSE-2SN-1', 'Hydraulic Hose 2SN 1"', 'Consumables', 'product', uM, 38, 62, '6281001000972'),
    prod('RP25-KIT', 'Repair Kit', 'Seals & Spares', 'product', uUnit, 540, 780, '6281001001109'),
    prod('FMC130', 'Teltonika Tracker', 'Electronics', 'product', uUnit, 195, 290, '6281001001246'),
    prod('WIPE-CLOTH', 'Workshop Wiping Cloth', 'Consumables', 'consu', uKg, 6, 9, ''),
    prod('SRV-REPAIR', 'Hydraulic Cylinder Repair (per job)', 'Workshop Services', 'service', uHour, 0, 1200, '', { description: 'Labour and workshop time' }),
  ]
  const P = (code: string) => products.find(p => p.default_code === code)!

  // ---- stock on hand (stock.quant) ----
  const quants = [
    [P('SEAL-KIT-80'), a1, 48], [P('SEAL-KIT-100'), a1, 32], [P('ROD-CHR-60'), b2, 200], [P('TUBE-HON-120'), b3, 64], [P('FAB-MANIFOLD-SS'), c1, 12],
    [P('PUMP-GEAR-25'), d1, 2], [P('OIL-ISO46-20L'), e1, 26], [P('HOSE-2SN-1'), e2, 150], [P('RP25-KIT'), bench2, 9], [P('FMC130'), f1, 40],
  ].map(([p, l, q]) => ({ id: id(), product_id: (p as Product).id, location_id: (l as Location).id, quantity: q as number, reserved_quantity: 0, in_date: '2026-09-01 08:00' }))

  // ---- transfers (stock.picking with their stock.move and stock.move.line) ----
  const pickings: Picking[] = [], moves: Move[] = [], move_lines: MoveLine[] = []
  const counters: Record<number, number> = {}
  const mk = (type: ID, src: ID, dst: ID, when: string, state: PickingState, lines: [Product, number][], extra: Partial<Picking> = {}) => {
    const pt = picking_types.find(t => t.id === type)!
    counters[type] = (counters[type] || 0) + 1
    const name = `${pt.sequence_prefix}${String(counters[type]).padStart(5, '0')}`
    const pid = id()
    pickings.push({ id: pid, name, origin: '', note: '', move_type: 'direct', state, priority: '1', scheduled_date: when, date: when, date_done: state === 'done' ? when : undefined, location_id: src, location_dest_id: dst, picking_type_id: type, ...extra })
    const ms: MoveState = state === 'waiting' ? 'waiting' : state
    lines.forEach(([p, q], i) => {
      const mid = id()
      moves.push({ id: mid, name: `[${p.default_code}] ${p.name}`, sequence: (i + 1) * 10, date: when, date_expected: when, product_id: p.id, product_uom_qty: q, product_uom: p.uom_id, location_id: src, location_dest_id: dst, picking_id: pid, picking_type_id: type, state: ms, origin: extra.origin ?? '', reference: name, price_unit: p.standard_price })
      if (state === 'done' || state === 'assigned') move_lines.push({ id: id(), picking_id: pid, move_id: mid, product_id: p.id, product_uom_id: p.uom_id, product_uom_qty: state === 'assigned' ? q : 0, qty_done: state === 'done' ? q : 0, date: when, location_id: src, location_dest_id: dst, state: ms, reference: name })
    })
  }
  const steel = findPartner('Dammam Special Steel & Honed Tubes Co.'), riyadh = findPartner('Riyadh Infrastructure Construction Co.')
  mk(wh.in_type_id, vendors.id, b2.id, '2026-10-28 09:00', 'done', [[P('ROD-CHR-60'), 80]], { partner_id: steel, origin: 'PO-0112' })
  mk(wh.in_type_id, vendors.id, whStock.id, '2026-11-12 09:00', 'assigned', [[P('TUBE-HON-120'), 40]], { partner_id: steel, origin: 'PO-0118' })
  mk(wh.out_type_id, e1.id, customers.id, '2026-11-02 10:00', 'done', [[P('OIL-ISO46-20L'), 4]], { partner_id: riyadh })
  mk(wh.out_type_id, whStock.id, customers.id, '2026-11-11 10:00', 'confirmed', [[P('SEAL-KIT-80'), 6]], { partner_id: riyadh })
  mk(wh.int_type_id, a1.id, bench2.id, '2026-11-04 14:00', 'done', [[P('RP25-KIT'), 5]])
  mk(wh.int_type_id, whStock.id, whStock.id, '2026-11-20 10:00', 'draft', [[P('SEAL-KIT-100'), 10]])

  picking_types.forEach(t => { t.sequence_next = (counters[t.id] || 0) + 1 })

  // ---- inventory adjustments (stock.inventory) ----
  const inv1 = id(), inv2 = id()
  const inventories = [
    { id: inv1, name: 'Annual Count 2026', date: '2026-11-10 08:00', location_id: whStock.id, filter: 'none' as const, exhausted: false, state: 'confirm' as const },
    { id: inv2, name: 'Rack B2 Recount', date: '2026-10-30 16:00', location_id: b2.id, filter: 'product' as const, product_id: P('ROD-CHR-60').id, exhausted: false, state: 'done' as const },
  ]
  const il = (inventory_id: ID, p: Product, l: Location, theoretical_qty: number, product_qty: number) => ({ id: id(), inventory_id, product_id: p.id, product_uom_id: p.uom_id, location_id: l.id, theoretical_qty, product_qty })
  const inventory_lines = [il(inv1, P('SEAL-KIT-80'), a1, 48, 46), il(inv1, P('SEAL-KIT-100'), a1, 32, 32), il(inv1, P('HOSE-2SN-1'), e2, 150, 148), il(inv2, P('ROD-CHR-60'), b2, 198, 200)]
  moves.unshift({ id: id(), name: 'INV:Rack B2 Recount', sequence: 10, date: '2026-10-30 16:30', date_expected: '2026-10-30 16:30', product_id: P('ROD-CHR-60').id, product_uom_qty: 2, product_uom: uM.id, location_id: invLoss.id, location_dest_id: b2.id, inventory_id: inv2, state: 'done', origin: 'Rack B2 Recount', reference: 'INV:Rack B2 Recount', price_unit: 310 })
  move_lines.unshift({ id: id(), move_id: moves[0].id, product_id: P('ROD-CHR-60').id, product_uom_id: uM.id, product_uom_qty: 0, qty_done: 2, date: '2026-10-30 16:30', location_id: invLoss.id, location_dest_id: b2.id, state: 'done', reference: 'INV:Rack B2 Recount' })

  return {
    seq, uom_categories: [cUnit, cWeight, cTime, cLen, cVol], uoms: [uUnit, uDozen, uKg, uG, uTon, uHour, uDay, uM, uCm, uKm, uL, uDrum], categories: cats, products, locations,
    warehouses, picking_types, pickings, moves, move_lines, quants, inventories, inventory_lines,
  }
}
