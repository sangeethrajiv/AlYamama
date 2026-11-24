import Decimal from 'decimal.js'
import { sequelize } from '../orm'
import { AppError, notFound } from '../common.helper'
import type { RequestEnv } from '../middleware'
import { assertCompany, exec, q } from './crud'
import { createMove, postMove } from './move.service'

/**
 * Assets and deferred revenue (Odoo 12 `om_account_asset`, as used in yamama_LIVE_sep_26:
 * account_asset_category, account_asset_asset, account_asset_depreciation_line).
 *
 * An asset copies its defaults from its category, then computes a depreciation board.
 * Confirming it ("open") freezes the board; Generate Assets Entries posts the lines whose
 * date has come: debit depreciation expense, credit accumulated depreciation.
 * A sale-type category reverses that (deferred revenue recognised into income).
 *
 * EXTERNAL and not implemented: asset rental (ext_asset_rental_id), disposal/sale of an
 * asset against a customer invoice, and revaluation.
 */
Decimal.set({ precision: 40 })
const D = (v: unknown) => new Decimal((v ?? 0) as Decimal.Value)
const dstr = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** Adds `months` to an ISO date, clamping the day to the month's length (31 Jan + 1 month = 28 Feb). */
function addMonths(date: string, months: number): string {
  const d = new Date(date + 'T00:00:00Z')
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + months, day = d.getUTCDate()
  const ny = y + Math.floor(m / 12), nm = ((m % 12) + 12) % 12
  return iso(new Date(Date.UTC(ny, nm, Math.min(day, lastDay(ny, nm)))))
}
/** Odoo posts a non-prorata depreciation on the last day of its period. */
const endOfMonth = (date: string) => { const d = new Date(date + 'T00:00:00Z'); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))) }

export interface AssetValues {
  name?: string; code?: string | null; category_id?: number; value?: string | number; salvage_value?: string | number
  date?: string; partner_id?: number | null; product_id?: number | null; invoice_id?: number | null
  account_analytic_id?: number | null; currency_id?: number | null; note?: string | null
  method?: 'linear' | 'degressive'; method_number?: number; method_period?: number
  method_progress_factor?: string | number; method_time?: 'number' | 'end'; method_end?: string | null
  prorata?: boolean; date_first_depreciation?: 'asset' | 'manual'; first_depreciation_manual_date?: string | null
}

const COPY_FROM_CATEGORY = ['method', 'method_number', 'method_period', 'method_progress_factor', 'method_time', 'method_end', 'prorata'] as const

export async function createAsset(v: AssetValues, env: RequestEnv): Promise<number> {
  if (!v.name?.trim()) throw new AppError('name: is required')
  if (!v.category_id) throw new AppError('category_id: is required')
  const value = D(v.value)
  if (value.lte(0)) throw new AppError('The gross value must be strictly positive.')
  if (D(v.salvage_value).gte(value)) throw new AppError('The salvage value must be lower than the gross value.')
  const [cat] = await q<Record<string, any>>('SELECT * FROM account_asset_category WHERE id = :id AND active', { id: v.category_id })
  if (!cat) throw new AppError('category_id: asset type not found or archived')
  assertCompany(env, cat.company_id, 'category_id: asset type')
  const vals: Record<string, unknown> = {
    name: v.name.trim(), code: v.code ?? null, category_id: v.category_id, company_id: cat.company_id,
    currency_id: v.currency_id ?? null, partner_id: v.partner_id ?? null, product_id: v.product_id ?? null,
    invoice_id: v.invoice_id ?? null, account_analytic_id: v.account_analytic_id ?? cat.account_analytic_id ?? null,
    value: value.toString(), salvage_value: D(v.salvage_value).toString(), date: (v.date ?? new Date().toISOString()).slice(0, 10),
    date_first_depreciation: v.date_first_depreciation ?? 'asset', first_depreciation_manual_date: v.first_depreciation_manual_date ?? null,
    note: v.note ?? null,
  }
  // the board settings come from the category unless the caller overrides them
  for (const f of COPY_FROM_CATEGORY) vals[f] = (v as Record<string, unknown>)[f] ?? cat[f]
  if (vals.method_time === 'end' && !vals.method_end) throw new AppError('method_end is required when method_time is "end".')
  if (vals.date_first_depreciation === 'manual' && !vals.first_depreciation_manual_date) throw new AppError('first_depreciation_manual_date is required when date_first_depreciation is "manual".')
  const keys = Object.keys(vals)
  const [row] = await q<{ id: number }>(
    `INSERT INTO account_asset_asset (${keys.join(', ')}, create_uid, write_uid) VALUES (${keys.map(k => ':' + k).join(', ')}, :uid, :uid) RETURNING id`, { ...vals, uid: env.uid })
  await computeBoard(row.id)
  if (cat.open_asset) await confirmAsset(row.id, env)
  return row.id
}

export async function updateAsset(id: number, v: AssetValues, env: RequestEnv) {
  const a = await loadAsset(id)
  if (a.state === 'close') throw new AppError('A closed asset cannot be modified.')
  const posted = await postedCount(id)
  const boardFields = ['value', 'salvage_value', 'date', 'method', 'method_number', 'method_period', 'method_progress_factor', 'method_time', 'method_end', 'prorata', 'date_first_depreciation', 'first_depreciation_manual_date']
  if (posted > 0 && boardFields.some(f => (v as Record<string, unknown>)[f] !== undefined))
    throw new AppError('You cannot change the depreciation settings of an asset that already has posted depreciation entries.')
  const allowed = [...boardFields, 'name', 'code', 'partner_id', 'product_id', 'invoice_id', 'account_analytic_id', 'currency_id', 'note', 'category_id']
  const vals: Record<string, unknown> = {}
  for (const f of allowed) if ((v as Record<string, unknown>)[f] !== undefined) vals[f] = (v as Record<string, unknown>)[f]
  if (!Object.keys(vals).length) throw new AppError('Nothing to update.')
  if (vals.value !== undefined && D(vals.value).lte(0)) throw new AppError('The gross value must be strictly positive.')
  if (D(vals.salvage_value ?? a.salvage_value).gte(D(vals.value ?? a.value))) throw new AppError('The salvage value must be lower than the gross value.')
  await exec(`UPDATE account_asset_asset SET ${Object.keys(vals).map(k => `${k} = :${k}`).join(', ')}, write_uid = :uid, write_date = now() WHERE id = :id`, { ...vals, uid: env.uid, id })
  await computeBoard(id)
  return readAsset(id)
}

const postedCount = async (id: number) => Number((await q<{ n: string }>('SELECT count(*) n FROM account_asset_depreciation_line WHERE asset_id = :id AND move_check', { id }))[0].n)

async function loadAsset(id: number): Promise<Record<string, any>> {
  const [a] = await q<Record<string, any>>('SELECT * FROM account_asset_asset WHERE id = :id', { id })
  if (!a) throw notFound('Asset')
  return a
}

/**
 * Rebuilds the unposted part of the depreciation board (Odoo `compute_depreciation_board`).
 * Posted lines are kept; the remaining value is spread over the periods that are left.
 */
export async function computeBoard(id: number) {
  const a = await loadAsset(id)
  await sequelize.transaction(async t => {
    await exec('DELETE FROM account_asset_depreciation_line WHERE asset_id = :id AND move_check = false', { id }, t)
    const posted = await q<Record<string, any>>('SELECT * FROM account_asset_depreciation_line WHERE asset_id = :id ORDER BY sequence', { id }, t)
    const gross = D(a.value).minus(D(a.salvage_value))
    let depreciated = posted.reduce((s: Decimal, l) => s.plus(l.amount), D(0))
    let remaining = gross.minus(depreciated)
    if (remaining.lte(0)) return
    const periods = totalPeriods(a)
    const left = periods - posted.length
    if (left <= 0) return
    // first depreciation date: the asset date, the manual date, or the end of the first period
    const base = a.date_first_depreciation === 'manual' && a.first_depreciation_manual_date ? dstr(a.first_depreciation_manual_date) : dstr(a.date)
    let seq = posted.length
    let date = posted.length ? addMonths(dstr(posted[posted.length - 1].depreciation_date), a.method_period) : (a.prorata ? base : endOfMonth(addMonths(base, a.method_period - 1)))
    if (!a.prorata && !posted.length) date = endOfMonth(addMonths(base, a.method_period - 1))
    for (let i = 0; i < left; i++) {
      seq++
      let amount = periodAmount(a, gross, remaining, periods, seq, left, i, base)
      if (i === left - 1 || amount.gte(remaining)) amount = remaining       // the last line absorbs the rounding
      amount = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      if (i === left - 1) amount = remaining.toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      remaining = remaining.minus(amount)
      depreciated = depreciated.plus(amount)
      await exec(
        `INSERT INTO account_asset_depreciation_line (name, sequence, asset_id, amount, remaining_value, depreciated_value, depreciation_date)
         VALUES (:name, :seq, :asset, :amt, :rem, :dep, :date)`,
        { name: `${a.code ?? a.name}/${seq}`, seq, asset: id, amt: amount.toString(), rem: remaining.toString(), dep: depreciated.toString(), date }, t)
      date = a.prorata && i === 0 && !posted.length ? endOfMonth(addMonths(base, a.method_period - 1)) : addMonths(date, a.method_period)
      if (remaining.lte(0)) break
    }
  })
}

function totalPeriods(a: Record<string, any>): number {
  if (a.method_time === 'end') {
    const start = new Date(dstr(a.date) + 'T00:00:00Z'), end = new Date(dstr(a.method_end) + 'T00:00:00Z')
    if (end <= start) throw new AppError('method_end must be after the asset date.')
    const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1
    return Math.max(1, Math.ceil(months / a.method_period))
  }
  // Odoo: with prorata temporis (a partial first period) the board has one more line than the number of entries
  return a.prorata ? a.method_number + 1 : a.method_number
}

/** Share of the first period that is left after the purchase date, by calendar days (Odoo 12 `_compute_board_amount`). */
function firstPeriodShare(a: Record<string, any>, base: string): Decimal {
  const d = new Date(base + 'T00:00:00Z'), y = d.getUTCFullYear(), m = d.getUTCMonth()
  if (a.method_period % 12 !== 0) {              // monthly, quarterly, half-yearly: the part of the purchase month that is left
    const monthDays = lastDay(y, m)
    return D(monthDays - d.getUTCDate() + 1).div(monthDays)
  }
  // yearly: the days left until the end of the financial year (the company's year end is not stored here, so 31 Dec)
  const end = new Date(Date.UTC(y, 11, 31))
  const days = Math.round((end.getTime() - d.getTime()) / 86400000) + 1
  return D(days).div(y % 4 ? 365 : 366)
}

/** One period's depreciation: linear spreads evenly; degressive takes a factor of the remaining value. */
function periodAmount(a: Record<string, any>, gross: Decimal, remaining: Decimal, periods: number, seq: number, left: number, i: number, base: string): Decimal {
  if (a.method === 'degressive') {
    const yearly = remaining.mul(D(a.method_progress_factor))
    const amount = yearly.mul(a.method_period).div(12)
    const linear = gross.div(periods)
    return Decimal.max(amount, linear.gt(remaining) ? remaining : linear)   // Odoo switches to linear once it is larger
  }
  // an even share per entry; the extra prorata line makes `periods` one more than the entries, so divide by the entries
  const amount = gross.div(a.method_time === 'number' ? a.method_number : periods)
  // prorata: the first period only counts the days left after the asset date; the last line takes what remains
  if (a.prorata && i === 0 && seq === 1) return amount.mul(firstPeriodShare(a, base))
  return amount
}

export async function confirmAsset(id: number, env: RequestEnv) {
  const a = await loadAsset(id)
  if (a.state !== 'draft') throw new AppError('Only a draft asset can be confirmed.')
  const [cat] = await q<Record<string, any>>('SELECT * FROM account_asset_category WHERE id = :id', { id: a.category_id })
  for (const f of ['journal_id', 'account_asset_id', 'account_depreciation_id', 'account_depreciation_expense_id'])
    if (!cat[f]) throw new AppError(`The asset type has no ${f}.`)
  const [n] = await q<{ n: string }>('SELECT count(*) n FROM account_asset_depreciation_line WHERE asset_id = :id', { id })
  if (Number(n.n) === 0) throw new AppError('The asset has no depreciation board. Check its settings.')
  await exec("UPDATE account_asset_asset SET state = 'open', write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id })
  return readAsset(id)
}

export async function setAssetToDraft(id: number, env: RequestEnv) {
  const a = await loadAsset(id)
  if (a.state === 'draft') throw new AppError('The asset is already in draft.')
  if (await postedCount(id)) throw new AppError('You cannot set an asset with posted depreciation entries back to draft.')
  await exec("UPDATE account_asset_asset SET state = 'draft', write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id })
  return readAsset(id)
}

/** Sell or dispose: the board stops here. Remaining unposted lines are dropped. */
export async function closeAsset(id: number, env: RequestEnv) {
  const a = await loadAsset(id)
  if (a.state === 'close') throw new AppError('The asset is already closed.')
  if (a.state !== 'open') throw new AppError('Only a running asset can be closed.')
  await exec('DELETE FROM account_asset_depreciation_line WHERE asset_id = :id AND move_check = false', { id })
  await exec("UPDATE account_asset_asset SET state = 'close', write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id })
  return readAsset(id)
}

export async function deleteAsset(id: number) {
  const a = await loadAsset(id)
  if (a.state !== 'draft') throw new AppError('Only a draft asset can be deleted.')
  if (await postedCount(id)) throw new AppError('This asset has posted depreciation entries.')
  await exec('DELETE FROM account_asset_asset WHERE id = :id', { id })
}

/**
 * Accounting > Generate Assets Entries: posts every due depreciation line of every
 * running asset (or of one asset). Returns what it posted.
 */
export async function generateAssetEntries(opts: { asset_id?: number; date?: string; company_ids?: number[] }, env: RequestEnv) {
  const upto = opts.date ?? new Date().toISOString().slice(0, 10)
  const where = ["l.move_check = false", "a.state = 'open'", 'l.depreciation_date <= :upto']
  const rp: Record<string, unknown> = { upto }
  if (opts.asset_id) { where.push('a.id = :asset'); rp.asset = opts.asset_id }
  if (opts.company_ids?.length) { where.push('a.company_id IN (:cids)'); rp.cids = opts.company_ids }
  const due = await q<Record<string, any>>(
    `SELECT l.*, a.name asset_name, a.code asset_code, a.category_id, a.company_id, a.partner_id, a.account_analytic_id, a.currency_id
       FROM account_asset_depreciation_line l JOIN account_asset_asset a ON a.id = l.asset_id
      WHERE ${where.join(' AND ')} ORDER BY a.id, l.sequence`, rp)
  const posted: { asset_id: number; line_id: number; move_id: number; name: string; amount: string }[] = []
  for (const l of due) {
    const [cat] = await q<Record<string, any>>('SELECT * FROM account_asset_category WHERE id = :id', { id: l.category_id })
    const sale = cat.type === 'sale'
    const label = `${l.asset_name} (${l.name})`
    // purchase: expense is debited, accumulated depreciation credited. sale (deferred revenue): the other way round.
    const moveId = await createMove({
      date: dstr(l.depreciation_date), journal_id: cat.journal_id, partner_id: l.partner_id, ref: label,
      lines: [
        { account_id: sale ? cat.account_depreciation_id : cat.account_depreciation_expense_id, name: label, debit: l.amount, credit: 0, analytic_account_id: l.account_analytic_id },
        { account_id: sale ? cat.account_depreciation_expense_id : cat.account_depreciation_id, name: label, debit: 0, credit: l.amount },
      ],
    } as never, env)
    const name = await postMove(moveId, env)
    await exec('UPDATE account_move_line SET asset_id = :a WHERE move_id = :m', { a: l.asset_id, m: moveId })
    await exec('UPDATE account_asset_depreciation_line SET move_id = :m, move_check = true, move_posted_check = true, write_uid = :u, write_date = now() WHERE id = :id', { m: moveId, u: env.uid, id: l.id })
    posted.push({ asset_id: l.asset_id, line_id: l.id, move_id: moveId, name, amount: String(l.amount) })
    // the asset closes once nothing is left to depreciate
    const [rest] = await q<{ n: string }>('SELECT count(*) n FROM account_asset_depreciation_line WHERE asset_id = :id AND move_check = false', { id: l.asset_id })
    if (Number(rest.n) === 0) await exec("UPDATE account_asset_asset SET state = 'close' WHERE id = :id", { id: l.asset_id })
  }
  return { posted_count: posted.length, up_to: upto, entries: posted }
}

export async function readAsset(id: number): Promise<Record<string, any>> {
  const [a] = await q<Record<string, any>>(
    `SELECT a.*, c.name category_name, p.name partner_name, an.name analytic_name
       FROM account_asset_asset a JOIN account_asset_category c ON c.id = a.category_id
       LEFT JOIN res_partner p ON p.id = a.partner_id LEFT JOIN account_analytic_account an ON an.id = a.account_analytic_id WHERE a.id = :id`, { id })
  if (!a) throw notFound('Asset')
  const lines = await q<Record<string, any>>(
    `SELECT l.id, l.name, l.sequence, l.amount, l.remaining_value, l.depreciated_value, l.depreciation_date, l.move_check, l.move_id, m.name move_name
       FROM account_asset_depreciation_line l LEFT JOIN account_move m ON m.id = l.move_id WHERE l.asset_id = :id ORDER BY l.sequence`, { id })
  const depreciated = lines.filter(l => l.move_check).reduce((s: Decimal, l) => s.plus(l.amount), D(0))
  const { category_name, partner_name, analytic_name, ...rest } = a
  return {
    ...rest,
    category_id: { id: a.category_id, name: category_name },
    partner_id: a.partner_id ? { id: a.partner_id, name: partner_name } : null,
    account_analytic_id: a.account_analytic_id ? { id: a.account_analytic_id, name: analytic_name } : null,
    depreciated_value: depreciated.toString(),
    book_value: D(a.value).minus(depreciated).toString(),
    depreciation_lines: lines.map(({ move_name, ...l }) => ({ ...l, move_id: l.move_id ? { id: l.move_id, name: move_name } : null })),
  }
}
