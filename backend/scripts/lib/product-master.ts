/**
 * Product master data migration: Odoo 12 -> this database.
 *
 *   product.template, product.category, uom.uom, uom.category (+ att.product.type and the product <-> tax links)
 *
 * Never touched: product.product (variants), stock, invoices, orders, Accounting, Contacts, Users, HR.
 * (The source's product_product / ir_property tables are only READ, to look up each product's cost.)
 *
 * Rules the whole file follows:
 *  - Target ids are never taken from source ids. A source row is found through its external id in ir_model_data
 *    (module `odoo12`, name `<model>_<source id>`, res_id = target id: the same convention the other importers use),
 *    and only then through a business key. New rows get the next free target id and their external id is written.
 *  - Nothing is removed. Rows that already exist are skipped unless `update` is set. Tax links are only added.
 *  - Everything runs in ONE target transaction. Every batch runs in a savepoint, so each failing record is logged;
 *    unless `allowPartial` is set, any failure rolls the whole run back. Without `execute` the run is always
 *    rolled back (a dry run still does the real inserts, so the real constraints are checked).
 *  - It verifies counts and relationships before it commits.
 */
import type { Client } from 'pg'
import type { Row } from './import-helpers'

export const MODULE = 'odoo12'
export const extName = (model: string, id: number) => `${model.replace(/\./g, '_')}_${id}`

export interface Counts { inserted: number; updated: number; skipped: number; linked: number; failed: number }
export interface Failure { model: string; sourceId: number | string; reason: string }
export interface Check { name: string; ok: boolean; detail: string }
export interface Options {
  /** Commit. Without it the run is rolled back at the end (dry run). */
  execute: boolean
  /** Also update target rows that already exist (default: leave them alone). */
  update: boolean
  /** Commit the records that worked even when some failed (default: any failure rolls everything back). */
  allowPartial: boolean
  /** Copy each product's cost (Odoo keeps it in ir_property, against the variant). */
  cost: boolean
  log?: (line: string) => void
}
export interface Result {
  committed: boolean
  counts: Record<string, Counts>
  failures: Failure[]
  warnings: string[]
  checks: Check[]
  /** Update mode: how many rows change, per column. */
  changes: Record<string, Record<string, number>>
}

// ------------------------------------------------------------------ pure helpers (unit tested) ---

export const chunk = <T>(list: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Parents before children: shallowest `parent_path` first, then id. */
export const byDepth = <T extends { parent_path?: unknown; id: unknown }>(rows: T[]): T[] => {
  const depth = (r: T) => (typeof r.parent_path === 'string' ? r.parent_path.split('/').filter(Boolean).length : 0)
  return [...rows].sort((a, b) => depth(a) - depth(b) || Number(a.id) - Number(b.id))
}

/** `parent_path` of a category, built from TARGET ids: "<parent's path><own id>/". */
export const buildPath = (parentPath: string | null | undefined, id: number): string => `${parentPath ?? ''}${id}/`

/** Equal as the database would see it: numbers compare as numbers ('10.0000' = 10), dates by instant, null only equals null. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null
  if (a instanceof Date || b instanceof Date) return new Date(a as string).getTime() === new Date(b as string).getTime()
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b)
  const numeric = (v: unknown) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()))
  if (numeric(a) && numeric(b)) return Number(a) === Number(b)
  return String(a) === String(b)
}

/** Columns whose value differs between what the source says and what the target has. */
export const changedColumns = (columns: string[], wanted: Row, existing: Row): string[] => columns.filter(c => !sameValue(wanted[c], existing[c]))

/**
 * A product's cost out of Odoo's company-dependent ir_property rows: the row of the product's own company first,
 * then the company-less one, then the lowest company id. Undefined when it has none.
 */
export function pickCost(rows: Array<{ company_id: number | null; value: number }>, productCompany: number | null): number | undefined {
  const rank = (r: { company_id: number | null }) => [r.company_id === productCompany ? 0 : 1, r.company_id == null ? 1 : 0, r.company_id ?? 0]
  const best = [...rows].sort((a, b) => {
    const x = rank(a), y = rank(b)
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  })[0]
  return best?.value
}

// --------------------------------------------------------------------------------- the models ---

class IdMap {
  private readonly m = new Map<string, Map<number, number>>()
  get(model: string, src: number | null | undefined): number | undefined { return src == null ? undefined : this.m.get(model)?.get(Number(src)) }
  set(model: string, src: number, target: number) {
    if (!this.m.has(model)) this.m.set(model, new Map())
    this.m.get(model)!.set(Number(src), target)
  }
  unset(model: string, src: number) { this.m.get(model)?.delete(Number(src)) }
  entries(model: string): Array<[number, number]> { return [...(this.m.get(model) ?? [])] }
}

interface Ctx {
  ids: IdMap
  /** A reference to something that is not migrated: NULL, and counted in the warnings. */
  soft: (model: string, srcId: number | null | undefined, what: string) => number | null
}

interface Spec {
  model: string
  table: string
  label: string
  /** Target columns written besides `id` (all of them are compared in update mode). */
  columns: string[]
  select: string
  /** The target values of one source row, or a string reason why it cannot be migrated. */
  values: (src: Row, ctx: Ctx) => Row | string
  /** Business key of a source row (target ids already substituted) and of a target row, or null when it has none. */
  sourceKey?: (src: Row, ctx: Ctx) => string | null
  targetKey?: (tgt: Row) => string | null
}

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()

const UOM_CATEGORY: Spec = {
  model: 'uom.category', table: 'uom_category', label: 'UoM categories',
  columns: ['name', 'measure_type'],
  select: 'SELECT id, name, measure_type FROM uom_category ORDER BY id',
  values: s => ({ name: s.name, measure_type: s.measure_type ?? null }),
  // measure_type is unique in both databases; a category without one is matched by name
  sourceKey: s => (s.measure_type ? `t:${s.measure_type}` : `n:${norm(s.name)}`),
  targetKey: t => (t.measure_type ? `t:${t.measure_type}` : `n:${norm(t.name)}`),
}

const UOM: Spec = {
  model: 'uom.uom', table: 'uom_uom', label: 'Units of measure',
  columns: ['name', 'category_id', 'factor', 'rounding', 'active', 'uom_type', 'measure_type', 'view_name'],
  select: 'SELECT id, name, category_id, factor, rounding, active, uom_type, measure_type, view_name FROM uom_uom ORDER BY id',
  values: (s, c) => {
    const category = c.ids.get('uom.category', Number(s.category_id))
    if (category == null) return `its UoM category ${s.category_id} was not migrated`
    return { name: s.name, category_id: category, factor: s.factor, rounding: s.rounding, active: s.active ?? true, uom_type: s.uom_type, measure_type: s.measure_type ?? null, view_name: s.view_name ?? null }
  },
  sourceKey: (s, c) => `${c.ids.get('uom.category', Number(s.category_id))}|${norm(s.name)}`,
  targetKey: t => `${t.category_id}|${norm(t.name)}`,
}

const CATEGORY: Spec = {
  model: 'product.category', table: 'product_category', label: 'Product categories',
  columns: ['name', 'complete_name', 'parent_id', 'arabic_name', 'sequence_code'],
  // parents before children; sequence_id, lot_sequence_id and removal_strategy_id point at tables this database does not have
  select: `SELECT id, name, complete_name, parent_id, parent_path, arabic_name, sequence_code FROM product_category
            ORDER BY coalesce(array_length(string_to_array(trim(both '/' from parent_path), '/'), 1), 0), id`,
  values: (s, c) => {
    let parent: number | null = null
    if (s.parent_id != null) {
      parent = c.ids.get('product.category', Number(s.parent_id)) ?? null
      if (parent == null) return `its parent category ${s.parent_id} was not migrated`
    }
    return { name: s.name, complete_name: s.complete_name, parent_id: parent, arabic_name: s.arabic_name ?? null, sequence_code: s.sequence_code ?? null }
  },
  sourceKey: s => norm(s.complete_name),
  targetKey: t => norm(t.complete_name),
}

const GENRE: Spec = {
  model: 'att.product.type', table: 'att_product_type', label: 'Product genres',
  columns: ['name', 'active'],
  select: 'SELECT id, name, active FROM att_product_type ORDER BY id',
  values: s => ({ name: s.name, active: s.active ?? true }),
  sourceKey: s => norm(s.name),
  targetKey: t => norm(t.name),
}

/** Odoo columns copied as they are (the target has no place for the other 14 Odoo columns of product.template). */
const PRODUCT_PLAIN = [
  'name', 'sequence', 'description', 'description_purchase', 'description_sale', 'description_picking', 'description_pickingout', 'description_pickingin',
  'type', 'tracking', 'rental', 'list_price', 'volume', 'weight', 'sale_ok', 'purchase_ok', 'active', 'color', 'default_code', 'sale_delay',
  'arabic_name', 'internal_short_code', 'no_discount', 'is_teltonika_product', 'is_vehicle_subscription', 'purchase_request', 'margin_perc',
  'internal_type', 'create_date', 'write_date',
]
const PRODUCT_REFS = ['categ_id', 'uom_id', 'uom_po_id', 'company_id', 'responsible_id', 'product_type_id']

const PRODUCT: Spec = {
  model: 'product.template', table: 'product_template', label: 'Products',
  // standard_price is added to `columns` by the runner when cost is on
  columns: [...PRODUCT_PLAIN, ...PRODUCT_REFS],
  select: `SELECT id, name, sequence, description, description_purchase, description_sale, description_picking,
       description_pickingout, description_pickingin, type, tracking, rental, categ_id, uom_id, uom_po_id, company_id, responsible_id, product_type_id,
       round(list_price::numeric, 4) AS list_price, round(volume::numeric, 4) AS volume, round(weight::numeric, 4) AS weight,
       sale_ok, purchase_ok, active, color, default_code, round(sale_delay::numeric, 2) AS sale_delay, arabic_name, internal_short_code,
       no_discount, is_teltonika_product, is_vehicle_subscription, purchase_request,
       coalesce(round(margin_perc::numeric, 4), 0) AS margin_perc, nullif(internal_type, '') AS internal_type, create_date, write_date
  FROM product_template ORDER BY id`,
  values: (s, c) => {
    const categ = c.ids.get('product.category', Number(s.categ_id))
    if (categ == null) return `its category ${s.categ_id} was not migrated`
    const uom = c.ids.get('uom.uom', Number(s.uom_id))
    if (uom == null) return `its unit of measure ${s.uom_id} was not migrated`
    const out: Row = {}
    for (const k of PRODUCT_PLAIN) out[k] = s[k] ?? null
    out.categ_id = categ
    out.uom_id = uom
    // the purchase unit defaults to the sales unit, as in Odoo
    out.uom_po_id = s.uom_po_id == null ? uom : c.ids.get('uom.uom', Number(s.uom_po_id)) ?? uom
    out.company_id = c.soft('res.company', s.company_id as number | null, 'company')
    out.responsible_id = c.soft('res.users', s.responsible_id as number | null, 'responsible user')
    out.product_type_id = c.soft('att.product.type', s.product_type_id as number | null, 'product genre')
    return out
  },
}

// ---------------------------------------------------------------------------------- the runner ---

const emptyCounts = (): Counts => ({ inserted: 0, updated: 0, skipped: 0, linked: 0, failed: 0 })
const q = async <T extends Row = Row>(c: Client, sql: string, params: unknown[] = []) => (await c.query<T>(sql, params)).rows

/** Runs `fn` inside a savepoint; returns the error message (and undoes the work) when it throws. */
async function guarded(target: Client, fn: () => Promise<void>): Promise<string | null> {
  await target.query('SAVEPOINT guarded')
  try {
    await fn()
    await target.query('RELEASE SAVEPOINT guarded')
    return null
  } catch (e) {
    await target.query('ROLLBACK TO SAVEPOINT guarded')
    await target.query('RELEASE SAVEPOINT guarded')
    return (e as Error).message
  }
}

const insertSql = (table: string, columns: string[], rows: number) => {
  const cols = columns.map(c => `"${c}"`).join(',')
  const tuples = Array.from({ length: rows }, (_, r) => `(${columns.map((_, i) => `$${r * columns.length + i + 1}`).join(',')})`)
  return `INSERT INTO ${table} (${cols}) VALUES ${tuples.join(',')}`
}

export async function migrateProductMaster(source: Client, target: Client, opts: Options): Promise<Result> {
  const log = opts.log ?? (() => undefined)
  const result: Result = { committed: false, counts: {}, failures: [], warnings: [], checks: [], changes: {} }
  const ids = new IdMap()
  const softMisses = new Map<string, number>()
  const ctx: Ctx = {
    ids,
    soft: (model, srcId, what) => {
      if (srcId == null) return null
      const t = ids.get(model, Number(srcId))
      if (t == null) softMisses.set(what, (softMisses.get(what) ?? 0) + 1)
      return t ?? null
    },
  }
  const fail = (model: string, sourceId: number | string, reason: string) => {
    result.failures.push({ model, sourceId, reason })
    result.counts[model].failed++
  }

  await target.query('BEGIN')
  try {
    await target.query("SET LOCAL lock_timeout = '15s'")
    await target.query('SET CONSTRAINTS ALL DEFERRED')
    await target.query('LOCK TABLE product_template, product_category, uom_uom, uom_category, att_product_type, product_taxes_rel IN SHARE ROW EXCLUSIVE MODE')
    const variantsBefore = Number((await q(target, 'SELECT count(*)::int AS n FROM product_product'))[0].n)

    // ---- the id map that already exists in the target (this script and the earlier importers write it)
    const mapped = ['uom.category', 'uom.uom', 'product.category', 'att.product.type', 'product.template', 'account.tax', 'res.company', 'res.users']
    for (const k of await q<{ model: string; name: string; res_id: number }>(target, 'SELECT model, name, res_id FROM ir_model_data WHERE module = $1', [MODULE])) {
      if (!mapped.includes(k.model)) continue
      const prefix = `${k.model.replace(/\./g, '_')}_`
      if (!k.name.startsWith(prefix)) continue
      const src = Number(k.name.slice(prefix.length))
      if (Number.isInteger(src)) ids.set(k.model, src, Number(k.res_id))
    }

    const nextId: Record<string, number> = {}
    const takeId = async (table: string) => {
      nextId[table] ??= Number((await q(target, `SELECT coalesce(max(id), 0)::int AS n FROM ${table}`))[0].n)
      return ++nextId[table]
    }
    const recordExternal = async (model: string, pairs: Array<[number, number]>) => {
      for (const part of chunk(pairs, 1000)) {
        const params: unknown[] = []
        const tuples = part.map(([src, tgt]) => {
          params.push(MODULE, extName(model, src), model, tgt)
          return `($${params.length - 3},$${params.length - 2},$${params.length - 1},$${params.length})`
        })
        await target.query(`INSERT INTO ir_model_data (module, name, model, res_id) VALUES ${tuples.join(',')}
                            ON CONFLICT (module, name) DO UPDATE SET res_id = EXCLUDED.res_id`, params)
      }
    }

    // ---- cost lookup (read-only on the source; variants are only used to find the template)
    let costOf: (templateId: number, company: number | null) => number | undefined = () => undefined
    const product: Spec = { ...PRODUCT, columns: [...PRODUCT.columns] }
    if (opts.cost) {
      product.columns.push('standard_price')
      const variants = await q<{ id: number; product_tmpl_id: number }>(source, 'SELECT id, product_tmpl_id FROM product_product')
      const tmplOf = new Map(variants.map(v => [Number(v.id), Number(v.product_tmpl_id)]))
      const props = await q<{ res_id: string; company_id: number | null; value_float: number }>(source,
        `SELECT res_id, company_id, value_float FROM ir_property WHERE name = 'standard_price' AND res_id LIKE 'product.product,%' AND value_float IS NOT NULL`)
      const byTemplate = new Map<number, Array<{ company_id: number | null; value: number }>>()
      for (const p of props) {
        const tmpl = tmplOf.get(Number(p.res_id.split(',')[1]))
        if (tmpl == null) continue
        byTemplate.set(tmpl, [...(byTemplate.get(tmpl) ?? []), { company_id: p.company_id == null ? null : Number(p.company_id), value: Number(p.value_float) }])
      }
      // the column is numeric(16,4): round here so a comparison with what is stored is exact
      costOf = (t, company) => {
        const v = pickCost(byTemplate.get(t) ?? [], company)
        return v === undefined ? undefined : Number(v.toFixed(4))
      }
    }

    const specs = [UOM_CATEGORY, UOM, CATEGORY, GENRE, product]
    const sourceRows: Record<string, Row[]> = {}
    /** Rows this run wrote (inserted or updated): the ones the verification reads back. */
    const written: Record<string, Row[]> = {}

    for (const spec of specs) {
      result.counts[spec.model] = emptyCounts()
      const counts = result.counts[spec.model]
      const rows = await q(source, spec.select)
      sourceRows[spec.model] = rows
      written[spec.model] = []
      log(`${spec.label}: ${rows.length} in the source`)
      const isProduct = spec.model === 'product.template'
      const isCategory = spec.model === 'product.category'
      const insertCols = ['id', ...spec.columns, ...(isCategory ? ['parent_path'] : [])]

      // what the target already has: small tables whole, products only for the rows that are mapped
      const mappedTargets = rows.map(r => ids.get(spec.model, Number(r.id))).filter((x): x is number => x != null)
      const existing = new Map<number, Row>()
      const selectCols = ['id', ...spec.columns, ...(isCategory ? ['parent_path'] : [])].join(', ')
      const have = isProduct
        ? await q(target, `SELECT ${selectCols} FROM ${spec.table} WHERE id = ANY($1)`, [mappedTargets])
        : await q(target, `SELECT ${selectCols} FROM ${spec.table}`)
      for (const r of have) existing.set(Number(r.id), r)
      const claimed = new Set<number>(mappedTargets)
      const byKey = new Map<string, number[]>()
      if (spec.targetKey && !isProduct) {
        for (const r of existing.values()) {
          const k = spec.targetKey(r)
          if (k) byKey.set(k, [...(byKey.get(k) ?? []), Number(r.id)])
        }
      }
      const paths = new Map<number, string>()
      if (isCategory) for (const r of existing.values()) paths.set(Number(r.id), String(r.parent_path ?? ''))

      // products have no business key (codes and names repeat in Odoo): a look-alike already in the target is only a warning
      const lookAlike = new Set<string>()
      if (isProduct) {
        for (const r of await q(target, 'SELECT name, default_code FROM product_template WHERE id <> ALL($1)', [mappedTargets])) lookAlike.add(`${norm(r.name)}|${norm(r.default_code)}`)
      }

      const pending: Array<{ src: Row; row: Row }> = []
      const links: Array<[number, number]> = []
      const changes: Record<string, number> = {}
      let differing = 0
      let lookAlikes = 0

      for (const src of rows) {
        const srcId = Number(src.id)
        const wanted = spec.values(src, ctx)
        if (typeof wanted === 'string') { fail(spec.model, srcId, wanted); continue }
        if (isProduct && opts.cost) wanted.standard_price = costOf(srcId, src.company_id == null ? null : Number(src.company_id)) ?? 0

        let targetId = ids.get(spec.model, srcId)
        let tgt = targetId != null ? existing.get(targetId) : undefined
        if (targetId != null && !tgt) {
          result.warnings.push(`${spec.label}: source ${srcId} is mapped to target ${targetId}, which no longer exists; it is inserted again`)
          targetId = undefined
        }
        if (targetId == null && spec.sourceKey && !isProduct) {
          const key = spec.sourceKey(src, ctx)
          const hit = key ? (byKey.get(key) ?? []).filter(i => !claimed.has(i)) : []
          // a business key counts only when it points at exactly one row nobody else has taken
          if (hit.length === 1) {
            targetId = hit[0]
            tgt = existing.get(targetId)
            claimed.add(targetId)
            links.push([srcId, targetId])
            ids.set(spec.model, srcId, targetId)
            counts.linked++
          }
        }

        if (targetId != null && tgt) {
          const diff = changedColumns(spec.columns, wanted, tgt)
          if (opts.update && diff.length) {
            for (const c of diff) changes[c] = (changes[c] ?? 0) + 1
            const err = await guarded(target, async () => {
              const set = diff.map((c, i) => `"${c}" = $${i + 1}`).join(', ')
              await target.query(`UPDATE ${spec.table} SET ${set} WHERE id = $${diff.length + 1}`, [...diff.map(c => wanted[c]), targetId])
            })
            if (err) fail(spec.model, srcId, err)
            else { counts.updated++; written[spec.model].push(src) }
          } else {
            counts.skipped++
            if (diff.length) differing++
          }
          continue
        }

        if (isProduct && lookAlike.has(`${norm(src.name)}|${norm(src.default_code)}`)) lookAlikes++
        const id = await takeId(spec.table)
        const row: Row = { id, ...wanted }
        if (isCategory) {
          const parent = wanted.parent_id as number | null
          row.parent_path = buildPath(parent == null ? null : paths.get(parent), id)
          paths.set(id, String(row.parent_path))
        }
        pending.push({ src, row })
        ids.set(spec.model, srcId, id)
      }
      result.changes[spec.model] = changes

      // ---- insert in batches; a failing batch is retried row by row so each bad record is named
      const done: Array<[number, number]> = []
      for (const part of chunk(pending, 500)) {
        const params = part.flatMap(p => insertCols.map(c => p.row[c] ?? null))
        const err = await guarded(target, async () => { await target.query(insertSql(spec.table, insertCols, part.length), params) })
        if (!err) { for (const p of part) done.push([Number(p.src.id), Number(p.row.id)]); continue }
        for (const p of part) {
          const e = await guarded(target, async () => { await target.query(insertSql(spec.table, insertCols, 1), insertCols.map(c => p.row[c] ?? null)) })
          if (e) { fail(spec.model, Number(p.src.id), e); ids.unset(spec.model, Number(p.src.id)) } else done.push([Number(p.src.id), Number(p.row.id)])
        }
      }
      const doneSrc = new Set(done.map(d => d[0]))
      for (const p of pending) if (doneSrc.has(Number(p.src.id))) written[spec.model].push(p.src)
      counts.inserted += done.length
      await recordExternal(spec.model, [...links, ...done])
      if (differing) result.warnings.push(`${spec.label}: ${differing} row(s) already in the target differ from the source and were left as they are (--update changes them)`)
      if (lookAlikes) result.warnings.push(`${spec.label}: ${lookAlikes} new product(s) have the same name and code as a product already in the target; inserted anyway (Odoo repeats names and codes)`)
      log(`  inserted ${counts.inserted}, updated ${counts.updated}, linked ${counts.linked}, skipped ${counts.skipped}, failed ${counts.failed}`)
    }
    for (const [what, n] of softMisses) result.warnings.push(`${n} product(s): the ${what} has no counterpart in the target and was left empty`)

    // ---- product <-> customer tax links: only ever added
    result.counts['product.taxes'] = emptyCounts()
    const taxCounts = result.counts['product.taxes']
    const sourceLinks = await q<{ prod_id: number; tax_id: number }>(source, 'SELECT prod_id, tax_id FROM product_taxes_rel ORDER BY prod_id, tax_id')
    const wantedLinks: Array<[number, number]> = []
    const unmappable = new Map<string, number>()
    for (const l of sourceLinks) {
      const p = ids.get('product.template', Number(l.prod_id)), t = ids.get('account.tax', Number(l.tax_id))
      if (p == null || t == null) {
        taxCounts.skipped++
        const why = t == null ? `tax ${l.tax_id} is not in the target` : `product ${l.prod_id} was not migrated`
        unmappable.set(why, (unmappable.get(why) ?? 0) + 1)
        continue
      }
      wantedLinks.push([p, t])
    }
    for (const [why, n] of unmappable) result.warnings.push(`${n} tax link(s) skipped: ${why}`)
    for (const part of chunk(wantedLinks, 5000)) {
      const before = Number((await q(target, 'SELECT count(*)::int AS n FROM product_taxes_rel'))[0].n)
      const sql = `INSERT INTO product_taxes_rel (prod_id, tax_id) VALUES ${part.map((_, i) => `($${i * 2 + 1},$${i * 2 + 2})`).join(',')} ON CONFLICT DO NOTHING`
      const err = await guarded(target, async () => { await target.query(sql, part.flat()) })
      if (err) { taxCounts.failed += part.length; result.failures.push({ model: 'product.taxes', sourceId: `${part.length} links`, reason: err }); continue }
      const added = Number((await q(target, 'SELECT count(*)::int AS n FROM product_taxes_rel'))[0].n) - before
      taxCounts.inserted += added
      taxCounts.skipped += part.length - added
    }
    log(`Product tax links: inserted ${taxCounts.inserted}, already there or skipped ${taxCounts.skipped}, failed ${taxCounts.failed}`)

    // ---- verification (inside the transaction, so a dry run proves the same things)
    const check = (name: string, ok: boolean, detail: string) => result.checks.push({ name, ok, detail })
    for (const spec of specs) {
      const c = result.counts[spec.model]
      const total = sourceRows[spec.model].length
      const inTarget = sourceRows[spec.model].filter(r => ids.get(spec.model, Number(r.id)) != null).length
      check(`${spec.label}: every source row is in the target`, inTarget === total && c.failed === 0, `${inTarget} of ${total} mapped, ${c.failed} failed`)
    }
    const want = (model: string, v: unknown) => (v == null ? null : ids.get(model, Number(v)) ?? null)

    const back = new Map<number, Row>()
    const productTargets = ids.entries('product.template').map(([, t]) => t)
    for (const part of chunk(productTargets, 5000)) {
      for (const r of await q(target, 'SELECT id, categ_id, uom_id, uom_po_id, product_type_id, name, default_code, list_price, active, type FROM product_template WHERE id = ANY($1)', [part])) back.set(Number(r.id), r)
    }
    const bad: string[] = []
    for (const src of written['product.template']) {
      const t = back.get(ids.get('product.template', Number(src.id)) as number)
      if (!t) { bad.push(`product ${src.id}: missing`); continue }
      if (!sameValue(t.categ_id, want('product.category', src.categ_id))) bad.push(`product ${src.id}: category`)
      if (!sameValue(t.uom_id, want('uom.uom', src.uom_id))) bad.push(`product ${src.id}: sales unit`)
      if (!sameValue(t.uom_po_id, want('uom.uom', src.uom_po_id ?? src.uom_id))) bad.push(`product ${src.id}: purchase unit`)
      if (!sameValue(t.product_type_id, want('att.product.type', src.product_type_id))) bad.push(`product ${src.id}: genre`)
      for (const k of ['name', 'default_code', 'list_price', 'active', 'type']) if (!sameValue(t[k], src[k])) bad.push(`product ${src.id}: ${k}`)
    }
    check('Products written by this run: category, units, genre and values match the source', bad.length === 0, bad.length ? `${bad.length} differ, e.g. ${bad.slice(0, 3).join('; ')}` : `${written['product.template'].length} checked`)

    const cats = new Map((await q(target, 'SELECT id, parent_id, parent_path FROM product_category')).map(r => [Number(r.id), r]))
    const catBad: string[] = []
    for (const src of written['product.category']) {
      const t = cats.get(ids.get('product.category', Number(src.id)) as number)
      if (!t || !sameValue(t.parent_id, want('product.category', src.parent_id))) catBad.push(`category ${src.id}: parent`)
      else if (t.parent_id != null && !String(t.parent_path).startsWith(String(cats.get(Number(t.parent_id))?.parent_path ?? '#'))) catBad.push(`category ${src.id}: path`)
    }
    check('Categories written by this run: hierarchy matches the source', catBad.length === 0, catBad.length ? catBad.slice(0, 3).join('; ') : `${written['product.category'].length} checked`)

    const uoms = new Map((await q(target, 'SELECT id, category_id, factor, uom_type FROM uom_uom')).map(r => [Number(r.id), r]))
    const uomBad: string[] = []
    for (const src of written['uom.uom']) {
      const t = uoms.get(ids.get('uom.uom', Number(src.id)) as number)
      if (!t || !sameValue(t.category_id, want('uom.category', src.category_id)) || !sameValue(t.factor, src.factor) || t.uom_type !== src.uom_type) uomBad.push(`unit ${src.id}`)
    }
    check('Units written by this run: category and conversion factor match the source', uomBad.length === 0, uomBad.length ? uomBad.slice(0, 3).join('; ') : `${written['uom.uom'].length} checked`)

    const haveLinks = new Set<string>()
    for (const part of chunk(productTargets, 5000)) {
      for (const r of await q<{ prod_id: number; tax_id: number }>(target, 'SELECT prod_id, tax_id FROM product_taxes_rel WHERE prod_id = ANY($1)', [part])) haveLinks.add(`${r.prod_id}:${r.tax_id}`)
    }
    const missing = wantedLinks.filter(([p, t]) => !haveLinks.has(`${p}:${t}`)).length
    check('Tax links: every mappable source link is in the target', missing === 0, `${wantedLinks.length - missing} of ${wantedLinks.length}`)

    const variantsAfter = Number((await q(target, 'SELECT count(*)::int AS n FROM product_product'))[0].n)
    check('Variants (product_product) were not touched', variantsBefore === variantsAfter, `${variantsBefore} before, ${variantsAfter} after`)

    const failed = result.failures.length > 0
    const good = !failed && result.checks.every(c => c.ok)
    if (opts.execute && (good || opts.allowPartial)) {
      await target.query('COMMIT')
      result.committed = true
      // keep the serials above the highest id (after COMMIT: setval is not transactional)
      for (const t of ['uom_category', 'uom_uom', 'product_category', 'att_product_type', 'product_template']) {
        await target.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST(COALESCE((SELECT max(id) FROM ${t}), 0), 1))`, [t])
      }
    } else {
      await target.query('ROLLBACK')
    }
    return result
  } catch (e) {
    await target.query('ROLLBACK').catch(() => undefined)
    throw e
  }
}
