import type { Request, Response } from 'express'
import { Router } from 'express'
import { QueryTypes, type Transaction } from 'sequelize'
import { sequelize } from '../orm'
import { AppError, handle, likeEscape, notFound, ok, paging } from '../common.helper'
import type { RequestEnv } from '../middleware'

/**
 * Small declarative CRUD for the accounting configuration tables.
 * Column types: s string, i integer, b boolean, n numeric (kept as string), d date, t text.
 * Unknown body keys are ignored; the database CHECKs and FKs are the last line of defence.
 */
export type ColType = 's' | 'i' | 'b' | 'n' | 'd' | 't'

export interface Entity {
  table: string
  label: string
  cols: Record<string, ColType>
  required?: string[]
  /** many2one columns -> [table, name column]; returned as {id, name}. */
  m2o?: Record<string, [string, string]>
  search?: string[]
  order?: string
  /** table has company_id: filtered by the request's companies, defaulted on create. */
  company?: boolean
  active?: boolean
  /** extra work after a write, inside the same transaction. */
  after?: (id: number, body: Record<string, unknown>, env: RequestEnv, t: Transaction) => Promise<void>
  /** validation / derived values before a write. */
  before?: (body: Record<string, unknown>, env: RequestEnv, id: number | null, t: Transaction) => Promise<void>
  /** one2many / many2many children returned on detail. */
  detail?: (id: number) => Promise<Record<string, unknown>>
}

const coerce = (type: ColType, v: unknown, col: string): unknown => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  switch (type) {
    case 'i': { const n = Number(typeof v === 'object' ? (v as { id?: unknown }).id : v); if (!Number.isInteger(n)) throw new AppError(`${col}: must be an integer`); return n }
    case 'b': return v === true || v === 'true' || v === 1 || v === '1'
    case 'n': { const s = String(v); if (!/^-?\d+(\.\d+)?$/.test(s)) throw new AppError(`${col}: must be a number`); return s }
    case 'd': { const s = String(v); if (!/^\d{4}-\d{2}-\d{2}/.test(s)) throw new AppError(`${col}: must be a date YYYY-MM-DD`); return s.slice(0, 10) }
    default: return String(v)
  }
}

export const q = <T = Record<string, unknown>>(sql: string, replacements: Record<string, unknown> | unknown[] = {}, t?: Transaction) =>
  sequelize.query(sql, { replacements: replacements as never, type: QueryTypes.SELECT, transaction: t }) as Promise<T[]>

const exec = (sql: string, replacements: Record<string, unknown> | unknown[] = {}, t?: Transaction) =>
  sequelize.query(sql, { replacements: replacements as never, transaction: t })

export function pick(e: Entity, body: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [c, type] of Object.entries(e.cols)) {
    if (!(c in body)) continue
    out[c] = coerce(type, body[c], c)
  }
  if (!partial) for (const r of e.required ?? []) if (out[r] === undefined || out[r] === null) throw new AppError(`${r}: is required`)
  return out
}

async function withM2o(e: Entity, rows: Record<string, unknown>[]) {
  for (const [col, [table, nameCol]] of Object.entries(e.m2o ?? {})) {
    const ids = [...new Set(rows.map(r => r[col]).filter((v): v is number => typeof v === 'number'))]
    const names = new Map<number, string>()
    if (ids.length) (await q<{ id: number; n: string }>(`SELECT id, ${nameCol} AS n FROM ${table} WHERE id IN (:ids)`, { ids })).forEach(r => names.set(r.id, r.n))
    for (const r of rows) r[col] = r[col] == null ? null : { id: r[col], name: names.get(r[col] as number) ?? null }
  }
  return rows
}

export function crudRouter(e: Entity): Router {
  const r = Router()
  r.param('id', e.company ? companyParam(e.table, e.label) : (_rq, _rs, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound(e.label)))
  const cols = ['id', ...Object.keys(e.cols)]
  const order = e.order ?? 'id'

  r.get('/', handle(async (req: Request, res: Response) => {
    const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
    const where: string[] = []; const rep: Record<string, unknown> = {}
    const term = String(req.query.q ?? '').trim()
    if (term && e.search?.length) { where.push('(' + e.search.map(c => `${c}::text ILIKE :q`).join(' OR ') + ')'); rep.q = `%${likeEscape(term)}%` }
    if (e.company && (req.env.allowedCompanyIds.length || req.env.companyId)) {
      where.push('company_id IN (:cids)'); rep.cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : [req.env.companyId]
    }
    if (e.active) { const a = String(req.query.active ?? 'true'); if (a !== 'all') { where.push('active = :act'); rep.act = a === 'true' } }
    for (const c of Object.keys(e.cols)) if (req.query[c] !== undefined && ['i', 's', 'b'].includes(e.cols[c]) && !['q', 'page', 'limit', 'active'].includes(c)) {
      const raw = String(req.query[c])
      if (e.cols[c] === 's' && raw.includes(',')) { where.push(`${c} IN (:f_${c})`); rep[`f_${c}`] = raw.split(',') }   // type=bank,cash
      else { where.push(`${c} = :f_${c}`); rep[`f_${c}`] = coerce(e.cols[c], req.query[c], c) }
    }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const rows = await q(`SELECT ${cols.join(', ')} FROM ${e.table} ${w} ORDER BY ${order} LIMIT :limit OFFSET :offset`, { ...rep, limit, offset })
    const [{ n }] = await q<{ n: string }>(`SELECT count(*) AS n FROM ${e.table} ${w}`, rep)
    return ok(res, { records: await withM2o(e, rows), total: Number(n), page, limit })
  }))

  r.get('/:id', handle(async (req: Request, res: Response) => {
    const [row] = await q(`SELECT ${cols.join(', ')} FROM ${e.table} WHERE id = :id`, { id: req.params.id })
    if (!row) throw notFound(e.label)
    await withM2o(e, [row])
    return ok(res, { ...row, ...(e.detail ? await e.detail(Number(req.params.id)) : {}) })
  }))

  r.post('/', handle(async (req: Request, res: Response) => {
    const id = await sequelize.transaction(async t => {
      const vals = pick(e, req.body ?? {}, false)
      if (e.company && vals.company_id == null) vals.company_id = req.env.companyId
      if (e.company && vals.company_id == null) throw new AppError('company_id: is required (send X-Company-Id)')
      await e.before?.(vals, req.env, null, t)
      vals.create_uid = req.env.uid; vals.write_uid = req.env.uid
      const keys = Object.keys(vals)
      const [row] = await q<{ id: number }>(`INSERT INTO ${e.table} (${keys.join(',')}) VALUES (${keys.map(k => ':' + k).join(',')}) RETURNING id`, vals, t)
      await e.after?.(row.id, req.body ?? {}, req.env, t)
      return row.id
    })
    return ok(res, { id }, `${e.label} created`, 201)
  }))

  r.put('/:id', handle(async (req: Request, res: Response) => {
    const id = Number(req.params.id)
    await sequelize.transaction(async t => {
      const [exists] = await q(`SELECT id FROM ${e.table} WHERE id = :id FOR UPDATE`, { id }, t)
      if (!exists) throw notFound(e.label)
      const vals = pick(e, req.body ?? {}, true)
      await e.before?.(vals, req.env, id, t)
      vals.write_uid = req.env.uid; vals.write_date = new Date()
      const keys = Object.keys(vals)
      await exec(`UPDATE ${e.table} SET ${keys.map(k => `${k} = :${k}`).join(', ')} WHERE id = :id`, { ...vals, id }, t)
      await e.after?.(id, req.body ?? {}, req.env, t)
    })
    return ok(res, { id }, `${e.label} updated`)
  }))

  if (e.active) {
    for (const [path, v] of [['archive', false], ['unarchive', true]] as const) {
      r.post(`/:id/${path}`, handle(async (req: Request, res: Response) => {
        const [row] = await q<{ id: number }>(`UPDATE ${e.table} SET active = :v, write_uid = :uid, write_date = now() WHERE id = :id RETURNING id`, { v, uid: req.env.uid, id: req.params.id })
        if (!row) throw notFound(e.label)
        return ok(res, { id: row.id, active: v }, v ? `${e.label} restored` : `${e.label} archived`)
      }))
    }
  }

  r.delete('/:id', handle(async (req: Request, res: Response) => {
    const rows = await q<{ id: number }>(`DELETE FROM ${e.table} WHERE id = :id RETURNING id`, { id: req.params.id })
    if (!rows.length) throw notFound(e.label)
    return ok(res, { id: rows[0].id }, `${e.label} deleted`)
  }))
  return r
}

/** The companies the caller may see: the allowed list, or just the current one. Empty means no restriction (stub auth without headers). */
export const visibleCompanies = (env: RequestEnv): number[] => (env.allowedCompanyIds.length ? env.allowedCompanyIds : env.companyId ? [env.companyId] : [])

/** A record of another company is reported as missing, never as forbidden, so ids cannot be probed. */
export function assertCompany(env: RequestEnv, companyId: number | null | undefined, what: string): void {
  const ids = visibleCompanies(env)
  if (ids.length && companyId != null && !ids.includes(companyId)) throw notFound(what)
}

/** Express `router.param('id')` handler: 404 for a malformed id or a record that belongs to a company the caller cannot see. */
export const companyParam = (table: string, what: string) => (req: Request, _res: Response, next: (e?: unknown) => void, v: string) => {
  if (!/^\d+$/.test(String(v))) return next(notFound(what))
  const ids = visibleCompanies(req.env)
  if (!ids.length) return next()
  q<{ company_id: number | null }>(`SELECT company_id FROM ${table} WHERE id = :id`, { id: v })
    .then(([r]) => next(r && r.company_id != null && !ids.includes(r.company_id) ? notFound(what) : undefined), next)
}

export { exec }
