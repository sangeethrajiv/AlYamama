/**
 * Copies the inventory master data from the Odoo 12 database into this one:
 * units of measure, product categories, locations, warehouses, operation types
 * and a varied sample of products.
 *
 *   npm run import:inventory                  all config + 50 varied products
 *   npm run import:inventory -- --products 80 a different sample size
 *   npm run import:inventory -- --unit        load into the test database
 *   npm run import:inventory -- --truncate    empty the inventory tables first
 *
 * Run `npm run import:odoo` first: locations, warehouses and products point at
 * companies, users and partners that import loads.
 *
 * Like the contacts importer it is read-only on Odoo (BEGIN READ ONLY),
 * idempotent (ON CONFLICT (id) DO UPDATE), keeps the Odoo ids and records them
 * in ir_model_data.
 *
 * Only 50 products are loaded on purpose: Odoo has 20,224 and the sample is
 * chosen to cover every case the screens have to handle, not to be the first 50.
 */
import type { Client } from 'pg'
import { config } from '../src/config'
import { makeClient, withOdooReadOnly } from '../src/db'
import { argvFlag, argvValue, recordExternalIds, resetSequences, upsert, type Row } from './lib/import-helpers'

const TARGET_DB = argvFlag('unit') ? config.unitDatabase : config.db.database
const SAMPLE = Number(argvValue('products') ?? 50)
const log = (...a: unknown[]) => console.log(...a)

// -------------------------------------------------------------- selection ---

interface Candidate {
  id: number
  type: string
  tracking: string
  categ_id: number
  uom_id: number
  uom_cat: number
  top_categ: number
  active: boolean
  sale_ok: boolean
  purchase_ok: boolean
  has_barcode: boolean
  has_code: boolean
  has_weight: boolean
  has_price: boolean
}

/**
 * Greedy "most different next" selection. Each round picks the candidate that
 * adds the most that is new to the sample: a category, a unit, a unit category,
 * a top-level category, a tracking mode, an inactive record, a barcode, a
 * weight, a price. Per-type quotas keep the mix realistic (mostly storable, as
 * in the live data) while still covering consumables and services. Ties break
 * on the lowest id, so the same 50 are chosen every run.
 */
export function pickVaried(all: Candidate[], total: number): Candidate[] {
  const quota: Record<string, number> = { product: Math.round(total * 0.6), consu: Math.round(total * 0.24), service: 0 }
  quota.service = total - quota.product - quota.consu

  const seen = {
    categ: new Set<number>(), uom: new Set<number>(), uomCat: new Set<number>(), top: new Set<number>(),
    tracking: new Set<string>(), flags: new Set<string>(),
  }
  const chosen: Candidate[] = []
  const left = new Map<string, number>(Object.entries(quota))
  let pool = all.slice().sort((a, b) => a.id - b.id)

  const score = (c: Candidate) => {
    let s = 0
    if (!seen.categ.has(c.categ_id)) s += 4
    if (!seen.top.has(c.top_categ)) s += 3
    if (!seen.uom.has(c.uom_id)) s += 3
    if (!seen.uomCat.has(c.uom_cat)) s += 3
    if (!seen.tracking.has(`${c.type}:${c.tracking}`)) s += 2
    if (!c.active && !seen.flags.has('inactive')) s += 5
    if (c.has_barcode && !seen.flags.has('barcode')) s += 2
    if (c.has_weight && !seen.flags.has('weight')) s += 1
    if (c.has_price && !seen.flags.has('price')) s += 1
    if (!c.sale_ok && !seen.flags.has('nosale')) s += 2
    if (!c.purchase_ok && !seen.flags.has('nopurchase')) s += 2
    if (!c.has_code && !seen.flags.has('nocode')) s += 1
    return s
  }

  while (chosen.length < total && pool.length) {
    let best: Candidate | null = null
    let bestScore = -1
    for (const c of pool) {
      if ((left.get(c.type) ?? 0) <= 0) continue
      const s = score(c)
      if (s > bestScore) { best = c; bestScore = s }
    }
    // A type with no candidates left: give its quota to whatever remains.
    if (!best) {
      for (const [t, n] of left) if (n > 0 && !pool.some(c => c.type === t)) left.set(t, 0)
      const any = pool[0]
      if (!any) break
      left.set(any.type, (left.get(any.type) ?? 0) + 1)
      continue
    }
    chosen.push(best)
    pool = pool.filter(c => c.id !== best!.id)
    left.set(best.type, (left.get(best.type) ?? 0) - 1)
    seen.categ.add(best.categ_id); seen.top.add(best.top_categ); seen.uom.add(best.uom_id); seen.uomCat.add(best.uom_cat)
    seen.tracking.add(`${best.type}:${best.tracking}`)
    if (!best.active) seen.flags.add('inactive')
    if (best.has_barcode) seen.flags.add('barcode')
    if (best.has_weight) seen.flags.add('weight')
    if (best.has_price) seen.flags.add('price')
    if (!best.sale_ok) seen.flags.add('nosale')
    if (!best.purchase_ok) seen.flags.add('nopurchase')
    if (!best.has_code) seen.flags.add('nocode')
  }
  return chosen
}

// ------------------------------------------------------------------- main ---

interface Spec { table: string; model: string; columns: string[]; select: string }

const UOM_SPECS: Spec[] = [
  {
    table: 'uom_category', model: 'uom.category',
    columns: ['id', 'name', 'measure_type'],
    select: `SELECT id, name, measure_type FROM uom_category ORDER BY id`,
  },
  {
    table: 'uom_uom', model: 'uom.uom',
    columns: ['id', 'name', 'category_id', 'factor', 'rounding', 'active', 'uom_type', 'measure_type', 'view_name'],
    select: `SELECT id, name, category_id, factor, rounding, active, uom_type, measure_type, view_name FROM uom_uom ORDER BY id`,
  },
  {
    table: 'product_category', model: 'product.category',
    columns: ['id', 'name', 'complete_name', 'parent_id', 'parent_path', 'arabic_name', 'sequence_code', 'sequence_id', 'lot_sequence_id', 'removal_strategy_id'],
    // parents before children, so the self-referencing FK is satisfied row by row
    select: `SELECT id, name, complete_name, parent_id, parent_path, arabic_name, sequence_code, sequence_id, lot_sequence_id, removal_strategy_id
               FROM product_category ORDER BY coalesce(length(parent_path), 0), id`,
  },
]

const LOCATION_COLUMNS = ['id', 'name', 'complete_name', 'active', 'usage', 'location_id', 'parent_path', 'partner_id', 'comment',
  'posx', 'posy', 'posz', 'company_id', 'scrap_location', 'return_location', 'barcode']
const WAREHOUSE_COLUMNS = ['id', 'name', 'active', 'company_id', 'partner_id', 'view_location_id', 'lot_stock_id', 'code',
  'reception_steps', 'delivery_steps', 'wh_input_stock_loc_id', 'wh_qc_stock_loc_id', 'wh_output_stock_loc_id', 'wh_pack_stock_loc_id',
  'in_type_id', 'out_type_id', 'int_type_id', 'pick_type_id', 'pack_type_id', 'buy_to_resupply', 'manufacture_to_resupply']
const PICKING_COLUMNS = ['id', 'name', 'color', 'sequence', 'sequence_id', 'default_location_src_id', 'default_location_dest_id', 'code',
  'show_entire_packs', 'warehouse_id', 'active', 'use_create_lots', 'use_existing_lots', 'show_operations', 'show_reserved', 'barcode']

const TEMPLATE_COLUMNS = ['id', 'name', 'sequence', 'description', 'description_purchase', 'description_sale', 'description_picking',
  'description_pickingout', 'description_pickingin', 'type', 'tracking', 'rental', 'categ_id', 'list_price', 'volume', 'weight',
  'sale_ok', 'purchase_ok', 'uom_id', 'uom_po_id', 'company_id', 'active', 'color', 'default_code', 'responsible_id', 'sale_delay',
  'arabic_name', 'internal_short_code', 'no_discount', 'is_teltonika_product', 'is_vehicle_subscription', 'purchase_request',
  'product_type_id', 'create_date', 'write_date']
const VARIANT_COLUMNS = ['id', 'product_tmpl_id', 'default_code', 'barcode', 'active', 'volume', 'weight', 'no_discount', 'create_date', 'write_date']

async function targetIds(target: Client, table: string): Promise<Set<number>> {
  const { rows } = await target.query<{ id: number }>(`SELECT id FROM ${table}`)
  return new Set(rows.map(r => r.id))
}

async function run() {
  if (!config.odoo.database) throw new Error('ODOO_PGDATABASE is not set in backend/.env')
  log(`source: ${config.odoo.database} (read-only)  ->  target: ${TARGET_DB}`)

  const target = makeClient({ ...config.db, database: TARGET_DB })
  await target.connect()
  const report: Array<[string, number, number]> = []

  try {
    await target.query('BEGIN')
    await target.query('SET CONSTRAINTS ALL DEFERRED')

    if (argvFlag('truncate')) {
      await target.query(`TRUNCATE product_product, product_template, stock_picking_type, stock_warehouse, stock_location,
        product_category, uom_uom, uom_category RESTART IDENTITY CASCADE`)
      await target.query(`DELETE FROM ir_model_data WHERE model IN ('product.template','product.product','stock.picking.type',
        'stock.warehouse','stock.location','product.category','uom.uom','uom.category')`)
      log('inventory tables truncated')
    }

    const companies = await targetIds(target, 'res_company')
    const partners = await targetIds(target, 'res_partner')
    const users = await targetIds(target, 'res_users')
    if (!companies.size) throw new Error('res_company is empty: run `npm run import:odoo` first')
    const keep = <T extends number | null | undefined>(v: T, set: Set<number>) => (v != null && set.has(Number(v)) ? v : null)

    await withOdooReadOnly(async odoo => {
      // ------------------------------------------- units and categories ---
      for (const spec of UOM_SPECS) {
        const { rows } = await odoo.query<Row>(spec.select)
        const n = await upsert(target, spec.table, spec.columns, rows)
        await recordExternalIds(target, spec.model, rows.map(r => Number(r.id)))
        report.push([spec.table, rows.length, n])
      }

      // --------------------------------------------------------- locations ---
      const { rows: locs } = await odoo.query<Row>(
        `SELECT ${LOCATION_COLUMNS.join(', ')} FROM stock_location ORDER BY coalesce(length(parent_path), 0), id`,
      )
      for (const l of locs) {
        l.company_id = keep(l.company_id as number | null, companies)
        l.partner_id = keep(l.partner_id as number | null, partners)
        if (!l.name) l.name = `[location ${l.id}]`
      }
      const nL = await upsert(target, 'stock_location', LOCATION_COLUMNS, locs)
      await recordExternalIds(target, 'stock.location', locs.map(r => Number(r.id)))
      report.push(['stock_location', locs.length, nL])

      // --------------------------------------------- warehouses and types ---
      const { rows: whs } = await odoo.query<Row>(`SELECT ${WAREHOUSE_COLUMNS.join(', ')} FROM stock_warehouse ORDER BY id`)
      const usableWh = whs.filter(w => companies.has(Number(w.company_id)))
      for (const w of usableWh) w.partner_id = keep(w.partner_id as number | null, partners)
      const nW = await upsert(target, 'stock_warehouse', WAREHOUSE_COLUMNS, usableWh)
      await recordExternalIds(target, 'stock.warehouse', usableWh.map(r => Number(r.id)))
      report.push(['stock_warehouse', whs.length, nW])

      const { rows: types } = await odoo.query<Row>(
        `SELECT ${PICKING_COLUMNS.join(', ')}, return_picking_type_id FROM stock_picking_type ORDER BY id`,
      )
      const nT = await upsert(target, 'stock_picking_type', PICKING_COLUMNS, types)
      await recordExternalIds(target, 'stock.picking.type', types.map(r => Number(r.id)))
      // return_picking_type_id points at another row of the same table: second pass.
      for (const t of types) {
        if (t.return_picking_type_id != null) {
          await target.query('UPDATE stock_picking_type SET return_picking_type_id = $1 WHERE id = $2', [t.return_picking_type_id, t.id])
        }
      }
      report.push(['stock_picking_type', types.length, nT])

      // ---------------------------------------------------------- products ---
      const { rows: cands } = await odoo.query<Candidate>(`
        SELECT t.id, t.type, t.tracking, t.categ_id, t.uom_id, u.category_id AS uom_cat,
               coalesce((regexp_split_to_array(c.parent_path, '/'))[1]::int, c.id) AS top_categ,
               coalesce(t.active, true) AS active, coalesce(t.sale_ok, true) AS sale_ok, coalesce(t.purchase_ok, true) AS purchase_ok,
               (p.barcode IS NOT NULL AND p.barcode <> '') AS has_barcode,
               (t.default_code IS NOT NULL AND t.default_code <> '') AS has_code,
               (coalesce(t.weight, 0) > 0) AS has_weight,
               (coalesce(t.list_price, 0) > 0) AS has_price
          FROM product_template t
          JOIN product_product p ON p.product_tmpl_id = t.id
          JOIN uom_uom u ON u.id = t.uom_id
          JOIN product_category c ON c.id = t.categ_id`)
      const picked = pickVaried(cands, SAMPLE)
      const ids = picked.map(p => p.id)

      const { rows: tmpls } = await odoo.query<Row>(`
        SELECT id, name, sequence, description, description_purchase, description_sale, description_picking,
               description_pickingout, description_pickingin, type, tracking, rental, categ_id,
               round(list_price::numeric, 4) AS list_price, round(volume::numeric, 4) AS volume, round(weight::numeric, 4) AS weight,
               sale_ok, purchase_ok, uom_id, uom_po_id, company_id, active, color, default_code, responsible_id,
               round(sale_delay::numeric, 2) AS sale_delay, arabic_name, internal_short_code, no_discount,
               is_teltonika_product, is_vehicle_subscription, purchase_request, product_type_id, create_date, write_date
          FROM product_template WHERE id = ANY($1) ORDER BY id`, [ids])
      for (const t of tmpls) {
        t.company_id = keep(t.company_id as number | null, companies)
        t.responsible_id = keep(t.responsible_id as number | null, users)
      }
      const nP = await upsert(target, 'product_template', TEMPLATE_COLUMNS, tmpls)
      await recordExternalIds(target, 'product.template', tmpls.map(r => Number(r.id)))
      report.push(['product_template', ids.length, nP])

      const { rows: variants } = await odoo.query<Row>(`
        SELECT id, product_tmpl_id, default_code, nullif(barcode, '') AS barcode, active,
               round(volume::numeric, 4) AS volume, round(weight::numeric, 4) AS weight, no_discount, create_date, write_date
          FROM product_product WHERE product_tmpl_id = ANY($1) ORDER BY id`, [ids])
      const nV = await upsert(target, 'product_product', VARIANT_COLUMNS, variants)
      await recordExternalIds(target, 'product.product', variants.map(r => Number(r.id)))
      report.push(['product_product', variants.length, nV])

      // What the sample covers, so the choice can be checked at a glance.
      const by = (f: (c: Candidate) => string | number | boolean) =>
        [...picked.reduce((m, c) => m.set(String(f(c)), (m.get(String(f(c))) ?? 0) + 1), new Map<string, number>())]
          .map(([k, v]) => `${k}:${v}`).join('  ')
      log('\nsample of', picked.length, 'products')
      log('  type        ', by(c => c.type))
      log('  tracking    ', by(c => c.tracking))
      log('  inactive    ', picked.filter(c => !c.active).length)
      log('  with barcode', picked.filter(c => c.has_barcode).length)
      log('  categories  ', new Set(picked.map(c => c.categ_id)).size, 'distinct')
      log('  units       ', new Set(picked.map(c => c.uom_id)).size, 'distinct,', new Set(picked.map(c => c.uom_cat)).size, 'unit categories')
    })

    await resetSequences(target, [
      'uom_category', 'uom_uom', 'product_category', 'stock_location', 'stock_warehouse',
      'stock_picking_type', 'product_template', 'product_product', 'ir_model_data',
    ])
    await target.query('COMMIT')

    log('\n table                    source   loaded   now in target')
    log(' ---------------------------------------------------------')
    for (const [table, src, loaded] of report) {
      const { rows } = await target.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`)
      log(` ${table.padEnd(24)} ${String(src).padStart(6)} ${String(loaded).padStart(8)} ${rows[0].n.padStart(14)}`)
    }
  } catch (e) {
    await target.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    await target.end()
  }
}

if (require.main === module) {
  run().catch(e => {
    console.error(`import failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
