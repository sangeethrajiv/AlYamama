import Decimal from 'decimal.js'
import type { Transaction } from 'sequelize'
import { sequelize } from '../orm'
import { AppError, notFound } from '../common.helper'
import type { RequestEnv } from '../middleware'
import { exec, q } from './crud'

/**
 * Journal entries and invoices (Odoo 12 account.move / account.move.line, with
 * the Odoo 13+ move_type so invoices live in the same table).
 * Everything money-related uses decimal.js, never floats.
 *
 * NOT done yet (marked so it is not forgotten):
 *   - exchange-rate difference entries when reconciling foreign-currency lines
 *   - cash-basis tax (tax_exigibility = on_payment) journal entries
 *   - payments (account_payment) and bank statements: later phases
 */
Decimal.set({ precision: 40 })
const D = (v: unknown) => new Decimal(v == null || v === '' ? 0 : (v as Decimal.Value))

export const MOVE_TYPES = ['entry', 'out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt'] as const
export type MoveType = (typeof MOVE_TYPES)[number]
const isInvoice = (t: string) => t !== 'entry'
const isSale = (t: string) => t.startsWith('out_')
const isRefund = (t: string) => t.endsWith('_refund')

export interface LineInput {
  account_id?: number; name?: string; partner_id?: number | null
  debit?: string | number; credit?: string | number
  amount_currency?: string | number; currency_id?: number | null
  date_maturity?: string | null; ref?: string | null
  quantity?: string | number; price_unit?: string | number; discount?: string | number
  product_id?: number | null; product_uom_id?: number | null
  tax_ids?: number[]; display_type?: string | null
  analytic_account_id?: number | null
}
export interface MoveInput {
  move_type?: MoveType; date?: string; journal_id?: number; partner_id?: number | null; ref?: string | null
  narration?: string | null; currency_id?: number | null
  invoice_date?: string | null; invoice_date_due?: string | null; invoice_origin?: string | null
  invoice_payment_term_id?: number | null; fiscal_position_id?: number | null
  auto_reverse?: boolean; reverse_date?: string | null
  lines?: LineInput[]
  /** Invoicing extras (007): categories, progressive billing, approval, plus EXTERNAL passthrough. */
  [extra: string]: unknown
}

/**
 * Columns a caller may set directly on account_move beside the ones handled above.
 * They carry no logic here: the invoicing service owns the category/approval rules.
 * ext_* belong to other apps and are stored only so an import never loses them.
 */
export const MOVE_EXTRA_COLS = [
  'invoice_category', 'is_progressive', 'contract_amount', 'previously_billed', 'progress_percentage',
  'retainage_amount', 'progressive_parent_id', 'proforma_of_id', 'incoterm_id', 'partner_bank_id',
  'partner_shipping_id', 'contact_id', 'client_order_ref', 'payment_notes', 'show_discount',
  'company_seal_required', 'pr_number', 'po_number', 'vendor_project', 'group_task', 'prepared_by',
  'ext_is_subscription', 'ext_subscription_id', 'ext_subscription_type', 'ext_start_date', 'ext_end_date',
  'ext_frequency', 'ext_vehicle_details', 'ext_picking_id', 'ext_landed_cost_id', 'ext_asset_rental_id',
  'ext_approval_level_id', 'ext_team_id',
] as const

/** The subset of MOVE_EXTRA_COLS present in `input`, ready for an UPDATE/INSERT. */
function extraCols(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of MOVE_EXTRA_COLS) if (input[c] !== undefined) out[c] = input[c] === '' ? null : input[c]
  return out
}

// ------------------------------------------------------------------ helpers ---
interface Cur { id: number; rounding: string; decimal_places: number }
const currencyOf = async (id: number | null, t: Transaction): Promise<Cur> => {
  if (!id) return { id: 0, rounding: '0.01', decimal_places: 2 }
  const [c] = await q<Cur>('SELECT id, rounding, decimal_places FROM res_currency WHERE id = :id', { id }, t)
  if (!c) throw new AppError('currency_id: currency not found')
  return c
}
const round = (v: Decimal.Value, c: Cur) => D(v).toDecimalPlaces(c.decimal_places, Decimal.ROUND_HALF_UP)

/** Units of `currency` per 1 unit of company currency on `date` (latest rate <= date; 1 when none). */
async function rateOn(currencyId: number, companyId: number, date: string, t: Transaction): Promise<Decimal> {
  const [r] = await q<{ rate: string }>(
    `SELECT rate FROM res_currency_rate WHERE currency_id = :c AND (company_id = :co OR company_id IS NULL) AND name <= :d
     ORDER BY name DESC, company_id NULLS LAST LIMIT 1`, { c: currencyId, co: companyId, d: date }, t)
  return r ? D(r.rate) : D(1)
}

// -------------------------------------------------------------------- taxes ---
interface TaxRow {
  id: number; name: string; amount_type: string; amount: string; price_include: boolean; include_base_amount: boolean
  account_id: number | null; refund_account_id: number | null; sequence: number; tax_exigibility: string; cash_basis_account_id: number | null
}
async function loadTaxes(taxIds: number[], t: Transaction): Promise<TaxRow[]> {
  if (!taxIds.length) return []
  const all: TaxRow[] = []
  const seen = new Set<number>()
  const expand = async (list: number[]) => {
    const rows = await q<TaxRow>('SELECT id, name, amount_type, amount, price_include, include_base_amount, account_id, refund_account_id, sequence, tax_exigibility, cash_basis_account_id FROM account_tax WHERE id IN (:ids) AND active ORDER BY sequence, id', { ids: list }, t)
    if (rows.length !== new Set(list).size) throw new AppError('A tax on the line is missing or archived.')
    for (const r of rows) {
      if (r.amount_type === 'group') {
        const kids = (await q<{ child_tax: number }>('SELECT child_tax FROM account_tax_filiation_rel WHERE parent_tax = :id', { id: r.id }, t)).map(k => k.child_tax)
        if (kids.length) await expand(kids)
      } else if (!seen.has(r.id)) { seen.add(r.id); all.push(r) }
    }
  }
  await expand([...new Set(taxIds)])
  return all
}

export interface TaxResult { total_excluded: Decimal; total_included: Decimal; taxes: { tax: TaxRow; amount: Decimal; base: Decimal }[] }

/** Odoo `account.tax.compute_all` for percent, fixed and division taxes, price-included or not. */
export function computeTaxes(taxes: TaxRow[], priceUnit: Decimal.Value, qty: Decimal.Value, cur: Cur): TaxResult {
  let base = D(priceUnit).mul(D(qty))
  const incl = taxes.filter(x => x.price_include)
  if (incl.length) {
    const fixed = incl.filter(x => x.amount_type === 'fixed').reduce((s, x) => s.plus(D(x.amount).mul(D(qty))), D(0))
    const pct = incl.filter(x => x.amount_type === 'percent').reduce((s, x) => s.plus(D(x.amount)), D(0))
    const div = incl.filter(x => x.amount_type === 'division').reduce((s, x) => s.plus(D(x.amount)), D(0))
    base = base.minus(fixed).div(D(1).plus(pct.div(100))).mul(D(1).minus(div.div(100)))
  }
  const excluded = round(base, cur)
  const out: TaxResult['taxes'] = []
  let running = excluded
  let extra = D(0)
  for (const tx of taxes) {
    const b = running.plus(extra)
    let amt: Decimal
    if (tx.amount_type === 'fixed') amt = D(tx.amount).mul(D(qty))
    else if (tx.amount_type === 'division') amt = b.div(D(1).minus(D(tx.amount).div(100))).minus(b)
    else amt = b.mul(D(tx.amount)).div(100)
    amt = round(amt, cur)
    out.push({ tax: tx, amount: amt, base: round(b, cur) })
    if (tx.include_base_amount) extra = extra.plus(amt)
  }
  const sum = out.reduce((s, x) => s.plus(x.amount), D(0))
  return { total_excluded: excluded, total_included: excluded.plus(sum), taxes: out }
}

// ----------------------------------------------------------- payment terms ---
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const dstr = (v: unknown) => (v instanceof Date ? iso(v) : String(v ?? '').slice(0, 10))
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d) }

/** Splits `total` over a payment term's lines: [{date, amount}], as `account.payment.term.compute`. */
async function termSplit(termId: number, total: Decimal, invoiceDate: string, cur: Cur, t: Transaction) {
  const lines = await q<{ value: string; value_amount: string; days: number; day_of_the_month: number | null; option: string }>(
    'SELECT value, value_amount, days, day_of_the_month, option FROM account_payment_term_line WHERE payment_id = :id ORDER BY sequence, id', { id: termId }, t)
  let left = total
  const out: { date: string; amount: Decimal }[] = []
  for (const l of lines) {
    let amt: Decimal
    if (l.value === 'fixed') amt = round(D(l.value_amount).mul(total.isNegative() ? -1 : 1), cur)
    else if (l.value === 'percent') amt = round(total.mul(D(l.value_amount)).div(100), cur)
    else amt = left
    let date = invoiceDate
    const base = new Date(invoiceDate + 'T00:00:00Z')
    if (l.option === 'after_invoice_month') { date = iso(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0))); date = addDays(date, l.days) }
    else if (l.option === 'day_following_month') { const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1; date = iso(new Date(Date.UTC(y, m, Math.min(l.day_of_the_month || 1, lastDayOfMonth(y, m))))) }
    else if (l.option === 'day_current_month') { const y = base.getUTCFullYear(), m = base.getUTCMonth(); date = iso(new Date(Date.UTC(y, m, Math.min(l.day_of_the_month || 1, lastDayOfMonth(y, m))))) }
    else date = addDays(invoiceDate, l.days)
    out.push({ date, amount: amt }); left = left.minus(amt)
  }
  return out
}

// ----------------------------------------------------------------- sequence ---
async function nextName(journalId: number, refund: boolean, date: string, t: Transaction): Promise<string> {
  const year = Number(date.slice(0, 4))
  const [j] = await q<{ code: string; refund_sequence: boolean }>('SELECT code, refund_sequence FROM account_journal WHERE id = :id', { id: journalId }, t)
  const isRef = refund && j.refund_sequence
  const [s] = await q<{ next_number: number }>(
    `INSERT INTO account_sequence (journal_id, is_refund, year, next_number) VALUES (:j, :r, :y, 2)
     ON CONFLICT (journal_id, is_refund, year) DO UPDATE SET next_number = account_sequence.next_number + 1
     RETURNING next_number - 1 AS next_number`, { j: journalId, r: isRef, y: year }, t)
  return `${isRef ? 'R' : ''}${j.code}/${year}/${String(s.next_number).padStart(4, '0')}`
}

// -------------------------------------------------------------- build lines ---
interface Built { account_id: number; name: string | null; partner_id: number | null; debit: Decimal; credit: Decimal
  amount_currency: Decimal; currency_id: number | null; date_maturity: string | null; quantity: string | null
  price_unit: string | null; discount: string | null; product_id: number | null; product_uom_id: number | null
  tax_line_id: number | null; tax_base_amount: Decimal; display_type: string | null; exclude_from_invoice_tab: boolean
  analytic_account_id: number | null; ref: string | null; tax_ids: number[]
  /** false on the tax line of a cash-basis tax until it is paid. */
  tax_exigible?: boolean }

const sideOf = (amount: Decimal, debitSide: boolean) => ({
  debit: debitSide === !amount.isNegative() ? amount.abs() : D(0),
  credit: debitSide === !amount.isNegative() ? D(0) : amount.abs(),
})

async function buildInvoiceLines(m: Required<Pick<MoveInput, 'move_type' | 'date'>> & MoveInput, companyId: number, cur: Cur, companyCur: Cur, t: Transaction): Promise<Built[]> {
  const type = m.move_type!
  const sale = isSale(type), refund = isRefund(type)
  // sign: sale invoices credit income; purchases debit expense; refunds flip it
  const productDebit = !sale !== refund
  const partnerId = m.partner_id ?? null
  if (!partnerId) throw new AppError('partner_id: is required on an invoice.')
  const [p] = await q<{ ar: number | null; ap: number | null; pt: number | null; spt: number | null; fp: number | null }>(
    'SELECT property_account_receivable_id ar, property_account_payable_id ap, property_payment_term_id pt, property_supplier_payment_term_id spt, property_account_position_id fp FROM res_partner WHERE id = :id', { id: partnerId }, t)
  if (!p) throw new AppError('partner_id: partner not found')
  const [co] = await q<{ ar: number | null; ap: number | null }>('SELECT account_receivable_id ar, account_payable_id ap FROM res_company WHERE id = :id', { id: companyId }, t)
  const counterAccount = sale ? (p.ar ?? co?.ar) : (p.ap ?? co?.ap)
  if (!counterAccount) throw new AppError(`No ${sale ? 'receivable' : 'payable'} account on the partner or the company.`)

  const rate = m.currency_id && m.currency_id !== companyCur.id ? await rateOn(m.currency_id, companyId, m.date, t) : D(1)
  const toCompany = (v: Decimal) => round(v.div(rate), companyCur)
  const built: Built[] = []
  const taxBuckets = new Map<string, Built>()
  let totalCompany = D(0), totalForeign = D(0)

  for (const l of m.lines ?? []) {
    if (l.display_type) { built.push({ account_id: l.account_id ?? 0, name: l.name ?? null, partner_id: null, debit: D(0), credit: D(0), amount_currency: D(0), currency_id: null, date_maturity: null, quantity: null, price_unit: null, discount: null, product_id: null, product_uom_id: null, tax_line_id: null, tax_base_amount: D(0), display_type: l.display_type, exclude_from_invoice_tab: false, analytic_account_id: null, ref: null, tax_ids: [] }); continue }
    if (!l.account_id) throw new AppError('Every invoice line needs an account_id.')
    const qty = D(l.quantity ?? 1), price = D(l.price_unit ?? 0).mul(D(1).minus(D(l.discount ?? 0).div(100)))
    const taxes = await loadTaxes(l.tax_ids ?? [], t)
    const r = computeTaxes(taxes, price, qty, cur)
    const lineForeign = r.total_excluded
    const lineCompany = toCompany(lineForeign)
    const s = sideOf(lineCompany, productDebit)
    built.push({ account_id: l.account_id, name: l.name ?? null, partner_id: partnerId, ...s, amount_currency: m.currency_id && m.currency_id !== companyCur.id ? (productDebit ? lineForeign : lineForeign.neg()) : D(0), currency_id: m.currency_id && m.currency_id !== companyCur.id ? m.currency_id : null, date_maturity: null, quantity: String(qty), price_unit: String(D(l.price_unit ?? 0)), discount: String(D(l.discount ?? 0)), product_id: l.product_id ?? null, product_uom_id: l.product_uom_id ?? null, tax_line_id: null, tax_base_amount: D(0), display_type: null, exclude_from_invoice_tab: false, analytic_account_id: l.analytic_account_id ?? null, ref: null, tax_ids: taxes.map(x => x.id) })
    totalCompany = totalCompany.plus(lineCompany); totalForeign = totalForeign.plus(lineForeign)
    for (const tx of r.taxes) {
      const cashBasis = tx.tax.tax_exigibility === 'on_payment'
      if (cashBasis && !tx.tax.cash_basis_account_id) throw new AppError(`The cash basis tax ${tx.tax.name} needs a transition account (cash_basis_account_id).`)
      const acc = cashBasis ? tx.tax.cash_basis_account_id! : ((refund ? tx.tax.refund_account_id : tx.tax.account_id) ?? tx.tax.account_id ?? l.account_id)
      const key = `${tx.tax.id}:${acc}`
      const amtC = toCompany(tx.amount)
      let b = taxBuckets.get(key)
      if (!b) { b = { account_id: acc, name: tx.tax.name, partner_id: partnerId, debit: D(0), credit: D(0), amount_currency: D(0), currency_id: m.currency_id && m.currency_id !== companyCur.id ? m.currency_id : null, date_maturity: null, quantity: null, price_unit: null, discount: null, product_id: null, product_uom_id: null, tax_line_id: tx.tax.id, tax_base_amount: D(0), display_type: null, exclude_from_invoice_tab: true, analytic_account_id: null, ref: null, tax_ids: [], tax_exigible: !cashBasis }; taxBuckets.set(key, b) }
      const sd = sideOf(amtC, productDebit)
      b.debit = b.debit.plus(sd.debit); b.credit = b.credit.plus(sd.credit)
      b.tax_base_amount = b.tax_base_amount.plus(toCompany(tx.base))
      b.amount_currency = b.amount_currency.plus(productDebit ? tx.amount : tx.amount.neg())
      totalCompany = totalCompany.plus(amtC); totalForeign = totalForeign.plus(tx.amount)
    }
  }
  built.push(...taxBuckets.values())

  // counterpart line(s): receivable / payable, split by the payment term
  const invDate = m.invoice_date ?? m.date
  // the partner's default payment term applies only when no due date was typed; a term chosen on the document always applies
  const termId = m.invoice_payment_term_id ?? (m.invoice_date_due ? null : (sale ? p.pt : p.spt))
  const parts = termId && !isRefund(type) ? await termSplit(termId, totalForeign, invDate, cur, t) : [{ date: m.invoice_date_due ?? invDate, amount: totalForeign }]
  let allocated = D(0)
  parts.forEach((part, i) => {
    const last = i === parts.length - 1
    const inCompany = last ? totalCompany.minus(allocated) : toCompany(part.amount)
    allocated = allocated.plus(inCompany)
    const sd = sideOf(inCompany, !productDebit)
    built.push({ account_id: counterAccount, name: null, partner_id: partnerId, ...sd, amount_currency: m.currency_id && m.currency_id !== companyCur.id ? (productDebit ? part.amount.neg() : part.amount) : D(0), currency_id: m.currency_id && m.currency_id !== companyCur.id ? m.currency_id : null, date_maturity: part.date, quantity: null, price_unit: null, discount: null, product_id: null, product_uom_id: null, tax_line_id: null, tax_base_amount: D(0), display_type: null, exclude_from_invoice_tab: true, analytic_account_id: null, ref: null, tax_ids: [] })
  })
  return built
}

function buildEntryLines(m: MoveInput, rateFor: (cid: number) => Decimal, companyCur: Cur): Built[] {
  return (m.lines ?? []).map(l => {
    const debit = round(l.debit ?? 0, companyCur), credit = round(l.credit ?? 0, companyCur)
    if (debit.isNegative() || credit.isNegative()) throw new AppError('Debit and credit cannot be negative.')
    if (!l.account_id) throw new AppError('Every journal item needs an account_id.')
    return { account_id: l.account_id, name: l.name ?? null, partner_id: l.partner_id ?? null, debit, credit, amount_currency: D(l.amount_currency ?? 0), currency_id: l.currency_id ?? null, date_maturity: l.date_maturity ?? null, quantity: l.quantity != null ? String(l.quantity) : null, price_unit: null, discount: null, product_id: l.product_id ?? null, product_uom_id: l.product_uom_id ?? null, tax_line_id: null, tax_base_amount: D(0), display_type: l.display_type ?? null, exclude_from_invoice_tab: false, analytic_account_id: l.analytic_account_id ?? null, ref: l.ref ?? null, tax_ids: l.tax_ids ?? [] }
  })
}

// ------------------------------------------------------------------ writing ---
async function writeLines(moveId: number, journalId: number, companyId: number, date: string, companyCurId: number | null, lines: Built[], uid: number | null, t: Transaction) {
  await exec('DELETE FROM account_move_line WHERE move_id = :id', { id: moveId }, t)
  let seqNo = 0
  for (const b of lines) {
    const [acc] = b.account_id ? await q<{ user_type_id: number; reconcile: boolean; company_id: number; deprecated: boolean }>('SELECT user_type_id, reconcile, company_id, deprecated FROM account_account WHERE id = :id', { id: b.account_id }, t) : []
    if (b.account_id && !acc) throw new AppError(`account_id ${b.account_id}: account not found`)
    if (acc && acc.company_id !== companyId) throw new AppError('The account of a journal item must belong to the same company as the entry.')
    const balance = b.debit.minus(b.credit)
    const [row] = await q<{ id: number }>(
      `INSERT INTO account_move_line (move_id, name, ref, account_id, partner_id, journal_id, company_id, company_currency_id, currency_id, user_type_id, date, date_maturity,
         debit, credit, balance, amount_currency, amount_residual, amount_residual_currency, quantity, price_unit, discount, product_id, product_uom_id, display_type,
         tax_line_id, tax_base_amount, tax_exigible, exclude_from_invoice_tab, analytic_account_id, sequence, create_uid, write_uid)
       VALUES (:move, :name, :ref, :acc, :partner, :journal, :company, :ccur, :cur, :ut, :date, :mat, :debit, :credit, :bal, :ac, :res, :resc, :qty, :pu, :disc, :prod, :uom, :dt,
         :tl, :tb, :exg, :ex, :an, :seq, :uid, :uid) RETURNING id`,
      { move: moveId, name: b.name, ref: b.ref, acc: b.account_id || null, partner: b.partner_id, journal: journalId, company: companyId, ccur: companyCurId, cur: b.currency_id, ut: acc?.user_type_id ?? null,
        date, mat: b.date_maturity, debit: b.debit.toString(), credit: b.credit.toString(), bal: balance.toString(), ac: b.amount_currency.toString(),
        res: acc?.reconcile ? balance.toString() : '0', resc: acc?.reconcile ? b.amount_currency.toString() : '0',
        qty: b.quantity, pu: b.price_unit, disc: b.discount, prod: b.product_id, uom: b.product_uom_id, dt: b.display_type, tl: b.tax_line_id, tb: b.tax_base_amount.toString(), exg: b.tax_exigible ?? true, ex: b.exclude_from_invoice_tab, an: b.analytic_account_id, seq: seqNo += 10, uid }, t)
    for (const tid of new Set(b.tax_ids)) await exec('INSERT INTO account_move_line_account_tax_rel (account_move_line_id, account_tax_id) VALUES (:l, :t)', { l: row.id, t: tid }, t)
  }
}

async function refreshTotals(moveId: number, t: Transaction) {
  const [mv] = await q<{ move_type: string }>('SELECT move_type FROM account_move WHERE id = :id', { id: moveId }, t)
  const [s] = await q<{ debit: string; untaxed: string; tax: string; residual: string }>(
    `SELECT COALESCE(sum(l.debit),0) debit,
            COALESCE(sum(abs(l.balance)) FILTER (WHERE l.display_type IS NULL AND l.tax_line_id IS NULL AND at.type NOT IN ('receivable','payable')),0) untaxed,
            COALESCE(sum(abs(l.balance)) FILTER (WHERE l.tax_line_id IS NOT NULL),0) tax,
            COALESCE(abs(sum(l.amount_residual) FILTER (WHERE at.type IN ('receivable','payable'))),0) residual
       FROM account_move_line l LEFT JOIN account_account_type at ON at.id = l.user_type_id WHERE l.move_id = :id`, { id: moveId }, t)
  if (!isInvoice(mv.move_type)) { await exec('UPDATE account_move SET amount = :d WHERE id = :id', { d: s.debit, id: moveId }, t); return }
  const total = D(s.untaxed).plus(D(s.tax))
  const resid = D(s.residual)
  const state = total.isZero() ? 'not_paid' : resid.isZero() ? 'paid' : resid.lt(total) ? 'partial' : 'not_paid'
  await exec('UPDATE account_move SET amount = :d, amount_untaxed = :u, amount_tax = :tx, amount_total = :tt, amount_residual = :r, payment_state = :ps WHERE id = :id',
    { d: s.debit, u: s.untaxed, tx: s.tax, tt: total.toString(), r: resid.toString(), ps: state, id: moveId }, t)
}

async function loadHeader(id: number, t: Transaction, lock = false) {
  const [m] = await q<Record<string, any>>(`SELECT * FROM account_move WHERE id = :id ${lock ? 'FOR UPDATE' : ''}`, { id }, t)
  if (!m) throw notFound('Journal entry')
  return m
}

/**
 * Totals of an unsaved document, so the form can show tax and total while the user types. Same rules as posting
 * (percent, fixed, division, price-included, group taxes), nothing is written.
 */
export async function previewTotals(input: { currency_id?: number | null; lines?: LineInput[] }, env: RequestEnv) {
  const [co] = await q<{ currency_id: number | null }>('SELECT currency_id FROM res_company WHERE id = :id', { id: env.companyId ?? 0 })
  const cur = await currencyOf(input.currency_id ?? co?.currency_id ?? null, undefined as never)
  let untaxed = D(0)
  const byTax = new Map<number, { name: string; amount: Decimal }>()
  for (const l of input.lines ?? []) {
    if (l.display_type) continue
    const taxes = await loadTaxes(l.tax_ids ?? [], undefined as never)
    const r = computeTaxes(taxes, D(l.price_unit ?? 0).mul(D(1).minus(D(l.discount ?? 0).div(100))), D(l.quantity ?? 1), cur)
    untaxed = untaxed.plus(r.total_excluded)
    for (const x of r.taxes) byTax.set(x.tax.id, { name: x.tax.name, amount: (byTax.get(x.tax.id)?.amount ?? D(0)).plus(x.amount) })
  }
  const tax = [...byTax.values()].reduce((a, x) => a.plus(x.amount), D(0))
  return { amount_untaxed: untaxed.toString(), amount_tax: tax.toString(), amount_total: untaxed.plus(tax).toString(), taxes: [...byTax.values()].map(x => ({ name: x.name, amount: x.amount.toString() })) }
}

/** With no due date typed, the document's due date is the last maturity the payment term gave its receivable / payable lines. */
async function syncDueDate(moveId: number, typed: string | null | undefined, built: Built[], t: Transaction) {
  if (typed) return
  const last = built.map(b => b.date_maturity).filter((d): d is string => !!d).sort().pop()
  if (last) await exec('UPDATE account_move SET invoice_date_due = :d WHERE id = :id', { d: last, id: moveId }, t)
}

// ---------------------------------------------------------------- operations ---
export async function createMove(input: MoveInput, env: RequestEnv): Promise<number> {
  return sequelize.transaction(async t => {
    const m = await normalize(input, env, t)
    const [row] = await q<{ id: number }>(
      `INSERT INTO account_move (name, ref, date, journal_id, currency_id, state, partner_id, narration, company_id, move_type, invoice_date, invoice_date_due, invoice_origin,
         invoice_payment_term_id, fiscal_position_id, commercial_partner_id, auto_reverse, reverse_date, create_uid, write_uid)
       VALUES ('/', :ref, :date, :journal, :cur, 'draft', :partner, :narr, :company, :type, :idate, :ddate, :origin, :pt, :fp, :partner, :ar, :rd, :uid, :uid) RETURNING id`,
      { ref: m.ref ?? null, date: m.date, journal: m.journal_id, cur: m.currency_id ?? null, partner: m.partner_id ?? null, narr: m.narration ?? null, company: m.company_id, type: m.move_type,
        idate: m.invoice_date ?? null, ddate: m.invoice_date_due ?? null, origin: m.invoice_origin ?? null, pt: m.invoice_payment_term_id ?? null, fp: m.fiscal_position_id ?? null,
        ar: !!m.auto_reverse, rd: m.reverse_date ?? null, uid: env.uid }, t)
    const extra = extraCols(input as Record<string, unknown>)
    // an invoice on a journal with a default category inherits it unless the caller chose one
    if (isInvoice(m.move_type) && extra.invoice_category === undefined) {
      const [j] = await q<{ invoice_category: string | null }>('SELECT invoice_category FROM account_journal WHERE id = :id', { id: m.journal_id }, t)
      if (j?.invoice_category) extra.invoice_category = j.invoice_category
    }
    if (extra.is_progressive) extra.invoice_category = 'progressive'
    if (Object.keys(extra).length) await exec(`UPDATE account_move SET ${Object.keys(extra).map(k => `${k} = :${k}`).join(', ')} WHERE id = :id`, { ...extra, id: row.id }, t)
    await writeLines(row.id, m.journal_id, m.company_id, m.date, m.companyCurId, m.built, env.uid, t)
    await syncDueDate(row.id, input.invoice_date_due, m.built, t)
    await refreshTotals(row.id, t)
    return row.id
  })
}

interface Norm extends MoveInput { move_type: MoveType; date: string; journal_id: number; company_id: number; companyCurId: number | null; built: Built[] }
async function normalize(input: MoveInput, env: RequestEnv, t: Transaction, existing?: Record<string, any>): Promise<Norm> {
  const type = (input.move_type ?? existing?.move_type ?? 'entry') as MoveType
  if (!MOVE_TYPES.includes(type)) throw new AppError('move_type: invalid')
  const journalId = input.journal_id ?? existing?.journal_id
  if (!journalId) throw new AppError('journal_id: is required')
  const [j] = await q<{ type: string; company_id: number; currency_id: number | null }>('SELECT type, company_id, currency_id FROM account_journal WHERE id = :id AND active', { id: journalId }, t)
  if (!j) throw new AppError('journal_id: journal not found or archived')
  if (isInvoice(type) && !['sale', 'purchase'].includes(j.type)) throw new AppError('Invoices need a sale or purchase journal.')
  if (isInvoice(type) && (isSale(type) ? 'sale' : 'purchase') !== j.type) throw new AppError(`A ${type} must use a ${isSale(type) ? 'sale' : 'purchase'} journal.`)
  const date = dstr(input.date ?? existing?.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError('date: is required (YYYY-MM-DD)')
  const [co] = await q<{ currency_id: number | null }>('SELECT currency_id FROM res_company WHERE id = :id', { id: j.company_id }, t)
  const companyCur = await currencyOf(co?.currency_id ?? null, t)
  const merged = { ...existing, ...input, move_type: type, date, journal_id: journalId } as MoveInput & { move_type: MoveType; date: string }
  const cur = await currencyOf(merged.currency_id ?? co?.currency_id ?? null, t)
  let built: Built[]
  if (input.lines === undefined && existing) built = await existingLines(existing.id, t)
  else if (isInvoice(type)) built = await buildInvoiceLines(merged, j.company_id, cur, companyCur, t)
  else built = buildEntryLines(merged, () => D(1), companyCur)
  return { ...merged, journal_id: journalId, company_id: j.company_id, companyCurId: co?.currency_id ?? null, built }
}

async function existingLines(moveId: number, t: Transaction): Promise<Built[]> {
  const rows = await q<Record<string, any>>('SELECT * FROM account_move_line WHERE move_id = :id ORDER BY id', { id: moveId }, t)
  const out: Built[] = []
  for (const r of rows) {
    const taxes = (await q<{ account_tax_id: number }>('SELECT account_tax_id FROM account_move_line_account_tax_rel WHERE account_move_line_id = :id', { id: r.id }, t)).map(x => x.account_tax_id)
    out.push({ account_id: r.account_id, name: r.name, partner_id: r.partner_id, debit: D(r.debit), credit: D(r.credit), amount_currency: D(r.amount_currency), currency_id: r.currency_id, date_maturity: r.date_maturity ? dstr(r.date_maturity) : null, quantity: r.quantity, price_unit: r.price_unit, discount: r.discount, product_id: r.product_id, product_uom_id: r.product_uom_id, tax_line_id: r.tax_line_id, tax_base_amount: D(r.tax_base_amount), display_type: r.display_type, exclude_from_invoice_tab: r.exclude_from_invoice_tab, analytic_account_id: r.analytic_account_id, ref: r.ref, tax_ids: taxes, tax_exigible: r.tax_exigible })
  }
  return out
}

export async function updateMove(id: number, input: MoveInput, env: RequestEnv): Promise<void> {
  await sequelize.transaction(async t => {
    const cur = await loadHeader(id, t, true)
    if (cur.state !== 'draft') throw new AppError('You cannot modify a posted journal entry. Set it to draft first.', 400)
    const m = await normalize(input, env, t, cur)
    await exec(`UPDATE account_move SET ref = :ref, date = :date, journal_id = :journal, currency_id = :cur, partner_id = :partner, narration = :narr, company_id = :company,
        move_type = :type, invoice_date = :idate, invoice_date_due = :ddate, invoice_origin = :origin, invoice_payment_term_id = :pt, fiscal_position_id = :fp,
        commercial_partner_id = :partner, auto_reverse = :ar, reverse_date = :rd, write_uid = :uid, write_date = now() WHERE id = :id`,
      { id, ref: m.ref ?? cur.ref, date: m.date, journal: m.journal_id, cur: m.currency_id ?? cur.currency_id, partner: m.partner_id === undefined ? cur.partner_id : m.partner_id, narr: m.narration ?? cur.narration,
        company: m.company_id, type: m.move_type, idate: m.invoice_date ?? cur.invoice_date, ddate: m.invoice_date_due ?? cur.invoice_date_due, origin: m.invoice_origin ?? cur.invoice_origin,
        pt: m.invoice_payment_term_id ?? cur.invoice_payment_term_id, fp: m.fiscal_position_id ?? cur.fiscal_position_id, ar: m.auto_reverse ?? cur.auto_reverse, rd: m.reverse_date ?? cur.reverse_date, uid: env.uid }, t)
    const extra = extraCols(input as Record<string, unknown>)
    if (extra.is_progressive) extra.invoice_category = 'progressive'
    if (Object.keys(extra).length) await exec(`UPDATE account_move SET ${Object.keys(extra).map(k => `${k} = :${k}`).join(', ')} WHERE id = :id`, { ...extra, id }, t)
    await writeLines(id, m.journal_id, m.company_id, m.date, m.companyCurId, m.built, env.uid, t)
    await syncDueDate(id, input.invoice_date_due, m.built, t)
    await refreshTotals(id, t)
  })
}

export async function deleteMove(id: number) {
  await sequelize.transaction(async t => {
    const m = await loadHeader(id, t, true)
    if (m.state !== 'draft') throw new AppError('You cannot delete an entry which has been posted once. Cancel it or reverse it instead.')
    await exec('DELETE FROM account_move WHERE id = :id', { id }, t)
  })
}

/** Odoo `_check_lock_date`: entries dated on or before a lock date cannot be posted, changed or cancelled. */
async function checkLock(date: string, companyId: number, t: Transaction, hasTax = false) {
  const [c] = await q<{ p: string | null; f: string | null; x: string | null }>('SELECT period_lock_date p, fiscalyear_lock_date f, tax_lock_date x FROM res_company WHERE id = :id', { id: companyId }, t)
  const d = date.slice(0, 10)
  const fmt = (v: unknown) => v ? dstr(v) : null
  const f = fmt(c?.f ?? null), p = fmt(c?.p ?? null), x = fmt(c?.x ?? null)
  if (f && d <= f) throw new AppError(`You cannot add/modify entries prior to and inclusive of the lock date ${f}.`)
  if (p && d <= p) throw new AppError(`You cannot add/modify entries prior to and inclusive of the lock date ${p}.`)
  if (hasTax && x && d <= x) throw new AppError(`You cannot add/modify tax entries prior to and inclusive of the tax lock date ${x}.`)
}

export async function postMove(id: number, env: RequestEnv): Promise<string> {
  return sequelize.transaction(async t => {
    const m = await loadHeader(id, t, true)
    if (m.state === 'posted') throw new AppError('The entry is already posted.')
    if (m.state === 'cancel') throw new AppError('A cancelled entry must be set back to draft before posting.')
    const lines = await q<Record<string, any>>('SELECT l.*, a.deprecated, a.code AS account_code FROM account_move_line l JOIN account_account a ON a.id = l.account_id WHERE l.move_id = :id AND l.display_type IS NULL', { id }, t)
    if (!lines.length) throw new AppError('You need to add a line before posting.')
    let d = D(0), c = D(0)
    for (const l of lines) {
      if (D(l.debit).gt(0) && D(l.credit).gt(0)) throw new AppError(`Line on account ${l.account_code}: wrong credit or debit value; a line cannot have both.`)
      if (l.deprecated) throw new AppError(`The account ${l.account_code} is deprecated and cannot be posted to.`)
      d = d.plus(l.debit); c = c.plus(l.credit)
    }
    if (!d.eq(c)) throw new AppError(`Cannot create unbalanced journal entry. Total debit ${d.toFixed(2)} and credit ${c.toFixed(2)} differ.`)
    if (d.isZero()) throw new AppError('The entry has no amount to post.')
    await checkLock(dstr(m.date), m.company_id, t, lines.some((l: any) => l.tax_line_id))
    // journal controls
    const typeCtl = (await q<{ type_id: number }>('SELECT type_id FROM account_journal_type_control_rel WHERE journal_id = :j', { j: m.journal_id }, t)).map(r => r.type_id)
    const accCtl = (await q<{ account_id: number }>('SELECT account_id FROM account_account_type_rel WHERE journal_id = :j', { j: m.journal_id }, t)).map(r => r.account_id)
    for (const l of lines) {
      if (typeCtl.length && !typeCtl.includes(l.user_type_id)) throw new AppError(`You cannot use this account (${l.account_code}) in this journal: its account type is not allowed.`)
      if (accCtl.length && !accCtl.includes(l.account_id)) throw new AppError(`You cannot use this account (${l.account_code}) in this journal: it is not in the allowed accounts.`)
    }
    if (isInvoice(m.move_type)) {
      if (m.invoice_category === 'proforma') throw new AppError('A proforma invoice cannot be posted. Convert it to a tax invoice first.')
      if (m.move_type.startsWith('in_') && m.request_status === 'to_approve') throw new AppError('This bill is waiting for approval.')
      if (m.move_type.startsWith('in_') && m.request_status === 'rejected') throw new AppError('This bill was rejected and cannot be posted.')
      if (!m.partner_id) throw new AppError('The partner is required to post an invoice.')
      if (!m.invoice_date) await exec('UPDATE account_move SET invoice_date = date WHERE id = :id', { id }, t)
    }
    const name = m.name && m.name !== '/' ? m.name : await nextName(m.journal_id, isRefund(m.move_type), dstr(m.date), t)
    await exec("UPDATE account_move SET state = 'posted', name = :name, amount = :amt, write_uid = :uid, write_date = now() WHERE id = :id", { name, amt: d.toString(), uid: env.uid, id }, t)
    await exec('UPDATE account_move_line SET ref = COALESCE(ref, :ref) WHERE move_id = :id', { ref: m.ref, id }, t)
    // one analytic line per journal item that carries an analytic account (amount = credit - debit)
    await exec(`INSERT INTO account_analytic_line (name, date, amount, unit_amount, account_id, partner_id, company_id, move_id, general_account_id, product_id, ref, create_uid, write_uid)
      SELECT COALESCE(l.name, :name), l.date, l.credit - l.debit, COALESCE(l.quantity, 0), l.analytic_account_id, l.partner_id, l.company_id, l.id, l.account_id, l.product_id, :name, :uid, :uid
      FROM account_move_line l WHERE l.move_id = :id AND l.analytic_account_id IS NOT NULL`, { id, name, uid: env.uid }, t)
    await refreshTotals(id, t)
    return name
  })
}

async function assertUnreconciled(id: number, t: Transaction) {
  const [r] = await q<{ n: string }>(`SELECT count(*) n FROM account_move_line l WHERE l.move_id = :id AND (l.full_reconcile_id IS NOT NULL OR EXISTS
    (SELECT 1 FROM account_partial_reconcile p WHERE p.debit_move_id = l.id OR p.credit_move_id = l.id))`, { id }, t)
  if (Number(r.n) > 0) throw new AppError('You cannot do this modification on a reconciled entry. Unreconcile the items first.')
}

export async function cancelMove(id: number, env: RequestEnv) {
  await sequelize.transaction(async t => {
    const m = await loadHeader(id, t, true)
    if (m.state === 'cancel') throw new AppError('The entry is already cancelled.')
    if (m.state === 'posted') {
      const [j] = await q<{ update_posted: boolean }>('SELECT update_posted FROM account_journal WHERE id = :id', { id: m.journal_id }, t)
      if (!j.update_posted) throw new AppError('You cannot modify a posted entry of this journal. First you should set the journal to allow cancelling entries.')
      await checkLock(dstr(m.date), m.company_id, t)
      await assertUnreconciled(id, t)
    }
    await exec('DELETE FROM account_analytic_line WHERE move_id IN (SELECT id FROM account_move_line WHERE move_id = :id)', { id }, t)
    await exec("UPDATE account_move SET state = 'cancel', write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id }, t)
  })
}

export async function resetToDraft(id: number, env: RequestEnv) {
  await sequelize.transaction(async t => {
    const m = await loadHeader(id, t, true)
    if (m.state === 'draft') throw new AppError('The entry is already in draft.')
    if (m.state === 'posted') {
      const [j] = await q<{ update_posted: boolean }>('SELECT update_posted FROM account_journal WHERE id = :id', { id: m.journal_id }, t)
      if (!j.update_posted) throw new AppError('You cannot modify a posted entry of this journal. First you should set the journal to allow cancelling entries.')
      await checkLock(dstr(m.date), m.company_id, t)
      await assertUnreconciled(id, t)
    }
    await exec('DELETE FROM account_analytic_line WHERE move_id IN (SELECT id FROM account_move_line WHERE move_id = :id)', { id }, t)
    await exec("UPDATE account_move SET state = 'draft', write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id }, t)
  })
}

/** Odoo `reverse_moves`: a new entry with debit and credit swapped, linked by reversed_entry_id. Credit notes for invoices. */
export async function reverseMove(id: number, opts: { date?: string; ref?: string; post?: boolean; journal_id?: number }, env: RequestEnv): Promise<number> {
  return sequelize.transaction(async t => {
    const m = await loadHeader(id, t, true)
    if (m.state !== 'posted') throw new AppError('Only posted entries can be reversed.')
    const [dup] = await q<{ id: number }>("SELECT id FROM account_move WHERE reversed_entry_id = :id AND state <> 'cancel' LIMIT 1", { id }, t)
    if (dup) throw new AppError('This entry has already been reversed.')
    const date = dstr(opts.date ?? m.date)
    const flip: Record<string, string> = { out_invoice: 'out_refund', out_refund: 'out_invoice', in_invoice: 'in_refund', in_refund: 'in_invoice', entry: 'entry', out_receipt: 'out_refund', in_receipt: 'in_refund' }
    const journalId = opts.journal_id ?? m.journal_id
    const [row] = await q<{ id: number }>(
      `INSERT INTO account_move (name, ref, date, journal_id, currency_id, state, partner_id, narration, company_id, move_type, invoice_date, invoice_payment_term_id,
         fiscal_position_id, commercial_partner_id, reversed_entry_id, create_uid, write_uid)
       VALUES ('/', :ref, :date, :journal, :cur, 'draft', :partner, :narr, :company, :type, :date, NULL, :fp, :partner, :orig, :uid, :uid) RETURNING id`,
      { ref: opts.ref ?? `Reversal of: ${m.name}`, date, journal: journalId, cur: m.currency_id, partner: m.partner_id, narr: m.narration, company: m.company_id, type: flip[m.move_type] ?? 'entry', fp: m.fiscal_position_id, orig: id, uid: env.uid }, t)
    // copy lines with sides swapped; a refund of a sale invoice keeps the same accounts
    await exec(`INSERT INTO account_move_line (move_id, name, ref, account_id, partner_id, journal_id, company_id, company_currency_id, currency_id, user_type_id, date, date_maturity,
        debit, credit, balance, amount_currency, amount_residual, amount_residual_currency, quantity, price_unit, discount, product_id, product_uom_id, display_type,
        tax_line_id, tax_base_amount, tax_exigible, exclude_from_invoice_tab, analytic_account_id, create_uid, write_uid)
      SELECT :new, l.name, l.ref, l.account_id, l.partner_id, :journal, l.company_id, l.company_currency_id, l.currency_id, l.user_type_id, :date, :date,
        l.credit, l.debit, -l.balance, -l.amount_currency, CASE WHEN a.reconcile THEN -l.balance ELSE 0 END, CASE WHEN a.reconcile THEN -l.amount_currency ELSE 0 END,
        l.quantity, l.price_unit, l.discount, l.product_id, l.product_uom_id, l.display_type, l.tax_line_id, l.tax_base_amount, l.tax_exigible, l.exclude_from_invoice_tab, l.analytic_account_id, :uid, :uid
      FROM account_move_line l JOIN account_account a ON a.id = l.account_id WHERE l.move_id = :old`, { new: row.id, journal: journalId, date, uid: env.uid, old: id }, t)
    await exec(`INSERT INTO account_move_line_account_tax_rel (account_move_line_id, account_tax_id)
      SELECT n.id, r.account_tax_id FROM account_move_line o JOIN account_move_line_account_tax_rel r ON r.account_move_line_id = o.id
      JOIN account_move_line n ON n.move_id = :new AND n.account_id = o.account_id AND n.name IS NOT DISTINCT FROM o.name AND n.price_unit IS NOT DISTINCT FROM o.price_unit
      WHERE o.move_id = :old`, { new: row.id, old: id }, t)
    await refreshTotals(row.id, t)
    return row.id
  }).then(async newId => {
    if (opts.post) await postMove(newId, env)
    return newId
  })
}

// ---------------------------------------------------------------- reconcile ---
/**
 * Recomputes amount_residual (company currency) and amount_residual_currency of lines from their partial reconciles,
 * flags reconciled, refreshes invoice totals.
 */
export async function recomputeResiduals(lineIds: number[], t: Transaction) {
  if (!lineIds.length) return
  const sideSum = (col: string, side: string, onlyCurrency = false) =>
    `COALESCE((SELECT sum(p.${col}) FROM account_partial_reconcile p WHERE p.${side} = l.id${onlyCurrency ? ' AND p.currency_id = l.currency_id' : ''}), 0)`
  const res = `l.balance - ${sideSum('amount', 'debit_move_id')} + ${sideSum('amount', 'credit_move_id')}`
  const resCur = `l.amount_currency - ${sideSum('amount_currency', 'debit_move_id', true)} + ${sideSum('amount_currency', 'credit_move_id', true)}`
  await exec(`UPDATE account_move_line l SET
      amount_residual = ${res},
      amount_residual_currency = CASE WHEN l.currency_id IS NULL THEN 0 ELSE ${resCur} END,
      reconciled = (${res}) = 0 AND (l.currency_id IS NULL OR (${resCur}) = 0)
                    AND EXISTS (SELECT 1 FROM account_account a WHERE a.id = l.account_id AND a.reconcile)
    WHERE l.id IN (:ids)`, { ids: lineIds }, t)
  const moves = await q<{ move_id: number }>('SELECT DISTINCT move_id FROM account_move_line WHERE id IN (:ids)', { ids: lineIds }, t)
  for (const mv of moves) await refreshTotals(mv.move_id, t)
}

interface Side { id: number; left: Decimal; leftCur: Decimal; res: Decimal; resCur: Decimal; currency: number | null }

/** Writes one partial reconcile. `amount` is in company currency; `cur` (when a foreign side is involved) in that currency. */
async function insertPartial(d: number, c: number, amount: Decimal, companyId: number, cur: { id: number; amount: Decimal } | null, uid: number | null, t: Transaction): Promise<number> {
  const [row] = await q<{ id: number }>(
    `INSERT INTO account_partial_reconcile (debit_move_id, credit_move_id, amount, amount_currency, currency_id, company_id, max_date, create_uid, write_uid)
     VALUES (:d, :c, :a, :ac, :cur, :co, (SELECT max(date) FROM account_move_line WHERE id IN (:d, :c)), :uid, :uid) RETURNING id`,
    { d, c, a: amount.toString(), ac: cur ? cur.amount.toString() : null, cur: cur ? cur.id : null, co: companyId, uid }, t)
  return row.id
}

async function markFull(ids: number[], exchangeMoveId: number | null, uid: number | null, t: Transaction) {
  const [fr] = await q<{ id: number }>("INSERT INTO account_full_reconcile (name, exchange_move_id, create_uid, write_uid) VALUES ('tmp', :x, :u, :u) RETURNING id", { x: exchangeMoveId, u: uid }, t)
  await exec("UPDATE account_full_reconcile SET name = 'A' || id WHERE id = :id", { id: fr.id }, t)
  await exec('UPDATE account_move_line SET full_reconcile_id = :f WHERE id IN (:ids)', { f: fr.id, ids }, t)
  await exec('UPDATE account_partial_reconcile SET full_reconcile_id = :f WHERE debit_move_id IN (:ids) OR credit_move_id IN (:ids)', { f: fr.id, ids }, t)
}

export async function reconcileLines(lineIds: number[], env: RequestEnv): Promise<{ partials: number; full: boolean }> {
  const idsU = [...new Set(lineIds)]
  if (idsU.length < 2) throw new AppError('Select at least two journal items to reconcile.')
  const r = await sequelize.transaction(async t => {
    const lines = await q<Record<string, any>>(
      `SELECT l.*, a.reconcile, m.state FROM account_move_line l JOIN account_account a ON a.id = l.account_id JOIN account_move m ON m.id = l.move_id WHERE l.id IN (:ids) FOR UPDATE OF l`, { ids: idsU }, t)
    if (lines.length !== idsU.length) throw new AppError('Some journal items were not found.')
    for (const l of lines) {
      if (l.state !== 'posted') throw new AppError('You can only reconcile posted entries.')
      if (!l.reconcile) throw new AppError('You can only reconcile journal items on accounts that allow reconciliation.')
      if (l.reconciled || D(l.amount_residual).isZero()) throw new AppError('You are trying to reconcile some entries that are already reconciled.')
    }
    if (new Set(lines.map(l => l.account_id)).size > 1) throw new AppError('Entries are not from the same account.')
    if (new Set(lines.map(l => l.company_id)).size > 1) throw new AppError('Entries doesn\'t belong to the same company.')
    const companyId = lines[0].company_id as number
    const [at] = await q<{ type: string }>('SELECT t.type FROM account_account a JOIN account_account_type t ON t.id = a.user_type_id WHERE a.id = :id', { id: lines[0].account_id }, t)
    if (['receivable', 'payable'].includes(at.type) && new Set(lines.map(l => l.partner_id ?? 0)).size > 1) throw new AppError('Entries are not from the same account or the same partner.')
    const [co] = await q<{ currency_id: number | null }>('SELECT currency_id FROM res_company WHERE id = :id', { id: companyId }, t)
    const companyCur = await currencyOf(co?.currency_id ?? null, t)
    // a line "in" the company currency is a line with no foreign currency
    const foreignOf = (l: Record<string, any>) => (l.currency_id && l.currency_id !== co?.currency_id ? (l.currency_id as number) : null)
    const foreignSet = new Set(lines.map(foreignOf).filter((c): c is number => c !== null))
    if (foreignSet.size > 1) throw new AppError('Reconciling items in two different foreign currencies is not supported.')
    const foreignId = [...foreignSet][0] ?? null
    const foreignCur = foreignId ? await currencyOf(foreignId, t) : null

    // Foreign mode: every item is in the same foreign currency with a currency residual of the same sign as its company residual.
    // The amounts are then matched in that currency; what is left in company currency is the exchange difference.
    const foreignMode = foreignId !== null && lines.every(l => foreignOf(l) === foreignId && !D(l.amount_residual_currency).isZero() && D(l.amount_residual_currency).isNegative() === D(l.amount_residual).isNegative())
    const mk = (l: Record<string, any>): Side => ({ id: l.id, res: D(l.amount_residual), resCur: D(l.amount_residual_currency), left: D(l.amount_residual).abs(), leftCur: D(l.amount_residual_currency).abs(), currency: foreignOf(l) })
    // oldest due first, as Odoo matches (a payment smaller than the total pays the earliest invoices first)
    const due = (id: number) => { const l = lines.find(x => x.id === id)!; return `${dstr(l.date_maturity ?? l.date)}#${String(id).padStart(12, '0')}` }
    const byDue = (a: Side, b: Side) => due(a.id).localeCompare(due(b.id))
    const debits = lines.filter(l => D(l.amount_residual).gt(0)).map(mk).sort(byDue)
    const credits = lines.filter(l => D(l.amount_residual).lt(0)).map(mk).sort(byDue)
    if (!debits.length || !credits.length) throw new AppError('Nothing to reconcile: you need both debit and credit items with a residual.')

    const partialIds: number[] = []
    for (const dl of debits) for (const cl of credits) {
      if (foreignMode) {
        if (dl.leftCur.isZero() || cl.leftCur.isZero()) continue
        const amtCur = Decimal.min(dl.leftCur, cl.leftCur)
        const amt = round(dl.res.abs().mul(amtCur).div(dl.resCur.abs()), companyCur)     // the debit side's company amount, as Odoo does
        if (amt.lte(0)) continue
        partialIds.push(await insertPartial(dl.id, cl.id, amt, companyId, { id: foreignId!, amount: round(amtCur, foreignCur!) }, env.uid, t))
        dl.leftCur = dl.leftCur.minus(amtCur); cl.leftCur = cl.leftCur.minus(amtCur)
      } else {
        if (dl.left.isZero() || cl.left.isZero()) continue
        const amt = Decimal.min(dl.left, cl.left)
        // a foreign item matched in company currency keeps its currency residual in step, in proportion
        const foreignSide = dl.currency ? dl : cl.currency ? cl : null
        const cur = foreignSide && foreignCur ? { id: foreignSide.currency!, amount: round(foreignSide.resCur.abs().mul(amt).div(foreignSide.res.abs()), foreignCur) } : null
        partialIds.push(await insertPartial(dl.id, cl.id, amt, companyId, cur, env.uid, t))
        dl.left = dl.left.minus(amt); cl.left = cl.left.minus(amt)
        if (foreignSide) { foreignSide.res = foreignSide.res.isNegative() ? foreignSide.res.plus(amt) : foreignSide.res.minus(amt); if (cur) foreignSide.resCur = foreignSide.resCur.isNegative() ? foreignSide.resCur.plus(cur.amount) : foreignSide.resCur.minus(cur.amount) }
      }
    }
    await recomputeResiduals(idsU, t)

    const open = await q<{ company: string; cur: string }>(
      'SELECT count(*) FILTER (WHERE amount_residual <> 0) company, count(*) FILTER (WHERE currency_id IS NOT NULL AND amount_residual_currency <> 0) cur FROM account_move_line WHERE id IN (:ids)', { ids: idsU }, t)
    const allZero = Number(open[0].company) === 0
    if (allZero) await markFull(idsU, null, env.uid, t)
    // Only the exchange difference is left: every foreign amount is matched but the company-currency amounts differ.
    const needsExchange = foreignMode && !allZero && Number(open[0].cur) === 0
    return { partials: partialIds.length, partialIds, full: allZero, needsExchange, companyId }
  })

  let full = r.full
  if (r.needsExchange) full = await settleExchangeDifference(idsU, r.companyId, env)
  await createCashBasisEntries(r.partialIds, r.companyId, env)
  return { partials: r.partials, full }
}

/**
 * Odoo `_create_exchange_difference_move`: when everything in a foreign currency is matched but the company-currency
 * amounts still differ, post the difference in the exchange journal (loss to its debit account, gain to its credit
 * account), reconcile it with what is left and close the whole set as one full reconcile.
 */
async function settleExchangeDifference(lineIds: number[], companyId: number, env: RequestEnv): Promise<boolean> {
  const left = await q<Record<string, any>>('SELECT id, account_id, partner_id, amount_residual, date FROM account_move_line WHERE id IN (:ids) AND amount_residual <> 0', { ids: lineIds })
  if (!left.length) return true
  const S = left.reduce((s: Decimal, l) => s.plus(l.amount_residual), D(0))
  if (S.isZero()) return true
  const [j] = await q<{ id: number | null; dr: number | null; cr: number | null }>(
    `SELECT c.currency_exchange_journal_id id, j.default_debit_account_id dr, j.default_credit_account_id cr FROM res_company c LEFT JOIN account_journal j ON j.id = c.currency_exchange_journal_id WHERE c.id = :c`, { c: companyId })
  if (!j?.id || !j.dr || !j.cr) throw new AppError('The company has no exchange difference journal with default accounts. Set one in the accounting settings.')
  const date = left.map(l => dstr(l.date)).sort().pop()!
  const first = left[0]
  const label = 'Currency exchange rate difference'
  const loss = S.gt(0)
  const moveId = await createMove({
    date, journal_id: j.id, ref: label,
    lines: [
      { account_id: first.account_id, partner_id: first.partner_id, name: label, debit: loss ? 0 : S.neg().toString(), credit: loss ? S.toString() : 0 },
      { account_id: loss ? j.dr : j.cr, name: label, debit: loss ? S.toString() : 0, credit: loss ? 0 : S.neg().toString() },
    ],
  } as never, env)
  await postMove(moveId, env)
  return sequelize.transaction(async t => {
    const [a] = await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a ORDER BY id LIMIT 1', { m: moveId, a: first.account_id }, t)
    const items = await q<Record<string, any>>('SELECT id, amount_residual FROM account_move_line WHERE id IN (:ids) AND amount_residual <> 0', { ids: [...lineIds, a.id] }, t)
    const debits = items.filter(l => D(l.amount_residual).gt(0)).map(l => ({ id: l.id as number, left: D(l.amount_residual) }))
    const credits = items.filter(l => D(l.amount_residual).lt(0)).map(l => ({ id: l.id as number, left: D(l.amount_residual).neg() }))
    for (const dl of debits) for (const cl of credits) {
      if (dl.left.isZero() || cl.left.isZero()) continue
      const amt = Decimal.min(dl.left, cl.left)
      await insertPartial(dl.id, cl.id, amt, companyId, null, env.uid, t)
      dl.left = dl.left.minus(amt); cl.left = cl.left.minus(amt)
    }
    const all = [...lineIds, a.id]
    await recomputeResiduals(all, t)
    const [open] = await q<{ n: string }>('SELECT count(*) n FROM account_move_line WHERE id IN (:ids) AND amount_residual <> 0', { ids: all }, t)
    if (Number(open.n) > 0) return false
    await markFull(all, moveId, env.uid, t)
    return true
  })
}

/**
 * Cash-basis tax (Odoo `_create_tax_cash_basis_moves`): the tax of an invoice with a cash-basis tax sits on a transition
 * account until it is paid. Each reconcile moves the paid share of it to the real tax account in the cash-basis journal.
 * The entry is tied to the partial reconcile, so unreconciling deletes it.
 */
async function createCashBasisEntries(partialIds: number[], companyId: number, env: RequestEnv) {
  for (const pid of partialIds) {
    const [p] = await q<Record<string, any>>('SELECT id, debit_move_id, credit_move_id, amount, max_date FROM account_partial_reconcile WHERE id = :id', { id: pid })
    if (!p) continue
    const moves = await q<{ move_id: number }>('SELECT DISTINCT move_id FROM account_move_line WHERE id IN (:a, :b)', { a: p.debit_move_id, b: p.credit_move_id })
    for (const { move_id } of moves) {
      const [m] = await q<Record<string, any>>("SELECT id, name, move_type, ref FROM account_move WHERE id = :id AND move_type <> 'entry'", { id: move_id })
      if (!m) continue
      const taxLines = await q<Record<string, any>>('SELECT id, account_id, balance, tax_base_amount, tax_line_id, partner_id FROM account_move_line WHERE move_id = :id AND tax_line_id IS NOT NULL AND tax_exigible = false ORDER BY id', { id: move_id })
      if (!taxLines.length) continue
      const [tot] = await q<{ v: string }>(`SELECT COALESCE(sum(abs(l.balance)), 0) v FROM account_move_line l JOIN account_account_type t ON t.id = l.user_type_id WHERE l.move_id = :id AND t.type IN ('receivable', 'payable')`, { id: move_id })
      if (D(tot.v).isZero()) continue
      const pct = D(p.amount).div(D(tot.v))
      const [j] = await q<{ id: number | null }>('SELECT tax_cash_basis_journal_id id FROM res_company WHERE id = :c', { c: companyId })
      if (!j?.id) throw new AppError('The company has no cash basis journal. Set one in the accounting settings.')
      const [co] = await q<{ currency_id: number | null }>('SELECT currency_id FROM res_company WHERE id = :c', { c: companyId })
      const cur = await currencyOf(co?.currency_id ?? null, undefined as never)
      const lines: LineInput[] = []; const bases: Decimal[] = []; const taxIds: number[] = []
      for (const tl of taxLines) {
        const [tax] = await q<Record<string, any>>('SELECT id, name, account_id, refund_account_id FROM account_tax WHERE id = :id', { id: tl.tax_line_id })
        const real = (m.move_type.endsWith('_refund') ? tax.refund_account_id : tax.account_id) ?? tax.account_id
        if (!real) throw new AppError(`The tax ${tax.name} has no tax account for its cash basis entry.`)
        const amt = round(D(tl.balance).mul(pct), cur)              // signed like the original tax line
        if (amt.isZero()) continue
        // the transition account gets the opposite of the original tax line, the real tax account the same
        lines.push({ account_id: tl.account_id, partner_id: tl.partner_id, name: tax.name, debit: amt.gt(0) ? 0 : amt.neg().toString(), credit: amt.gt(0) ? amt.toString() : 0 })
        lines.push({ account_id: real, partner_id: tl.partner_id, name: tax.name, debit: amt.gt(0) ? amt.toString() : 0, credit: amt.gt(0) ? 0 : amt.neg().toString() })
        bases.push(round(D(tl.tax_base_amount).mul(pct), cur)); taxIds.push(tax.id)
      }
      if (!lines.length) continue
      const id = await createMove({ date: dstr(p.max_date), journal_id: j.id, ref: `${m.name}: cash basis`, lines } as never, env)
      await exec('UPDATE account_move SET tax_cash_basis_rec_id = :p WHERE id = :id', { p: pid, id })
      const created = await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :id ORDER BY id', { id })
      for (let i = 0; i < taxIds.length; i++)    // the second line of each pair is the real tax line the tax report reads
        await exec('UPDATE account_move_line SET tax_line_id = :t, tax_base_amount = :b, tax_exigible = true WHERE id = :l', { t: taxIds[i], b: bases[i].toString(), l: created[i * 2 + 1].id })
      await postMove(id, env)
    }
  }
}

export async function unreconcileLines(lineIds: number[]) {
  const idsU = [...new Set(lineIds)]
  if (!idsU.length) throw new AppError('Select the journal items to unreconcile.')
  await sequelize.transaction(async t => {
    const partials = await q<{ id: number; debit_move_id: number; credit_move_id: number; full_reconcile_id: number | null }>(
      'SELECT id, debit_move_id, credit_move_id, full_reconcile_id FROM account_partial_reconcile WHERE debit_move_id IN (:ids) OR credit_move_id IN (:ids)', { ids: idsU }, t)
    if (!partials.length) throw new AppError('These journal items are not reconciled.')
    // Odoo: only the partials that involve the chosen lines are deleted. A full reconcile they belonged to
    // is dissolved (its marker is removed from every line), the other partials of it stay.
    const fulls = [...new Set(partials.map(p => p.full_reconcile_id).filter((x): x is number => !!x))]
    const touched = new Set<number>()
    partials.forEach(p => { touched.add(p.debit_move_id); touched.add(p.credit_move_id) })
    let exchange: number[] = []
    if (fulls.length) {
      (await q<{ id: number }>('SELECT id FROM account_move_line WHERE full_reconcile_id IN (:f)', { f: fulls }, t)).forEach(r => touched.add(r.id))
      exchange = (await q<{ exchange_move_id: number | null }>('SELECT exchange_move_id FROM account_full_reconcile WHERE id IN (:f)', { f: fulls }, t)).map(r => r.exchange_move_id).filter((x): x is number => !!x)
      await exec('UPDATE account_move_line SET full_reconcile_id = NULL WHERE full_reconcile_id IN (:f)', { f: fulls }, t)
      await exec('UPDATE account_partial_reconcile SET full_reconcile_id = NULL WHERE full_reconcile_id IN (:f)', { f: fulls }, t)
    }
    // cash-basis entries are removed with their partial (foreign key cascade)
    await exec('DELETE FROM account_partial_reconcile WHERE id IN (:ids)', { ids: partials.map(p => p.id) }, t)
    if (fulls.length) await exec('DELETE FROM account_full_reconcile WHERE id IN (:f)', { f: fulls }, t)
    // the exchange difference entry only made sense with the full reconcile it closed
    if (exchange.length) {
      const exLines = (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id IN (:m)', { m: exchange }, t)).map(r => r.id)
      exLines.forEach(id => touched.delete(id))
      await exec('DELETE FROM account_move WHERE id IN (:m)', { m: exchange }, t)
    }
    await recomputeResiduals([...touched], t)
  })
}

// ------------------------------------------------------------------ reading ---
export async function readMove(id: number): Promise<Record<string, any>> {
  const [m] = await q<Record<string, any>>(
    `SELECT m.*, j.name journal_name, p.name partner_name, c.name currency_name FROM account_move m JOIN account_journal j ON j.id = m.journal_id
     LEFT JOIN res_partner p ON p.id = m.partner_id LEFT JOIN res_currency c ON c.id = m.currency_id WHERE m.id = :id`, { id })
  if (!m) throw notFound('Journal entry')
  const lines = await q<Record<string, any>>(
    `SELECT l.id, l.name, l.ref, l.account_id, a.code account_code, a.name account_name, l.partner_id, p.name partner_name, l.debit, l.credit, l.balance, l.amount_currency,
       l.currency_id, l.amount_residual, l.reconciled, l.full_reconcile_id, l.date_maturity, l.quantity, l.price_unit, l.discount, l.product_id, l.product_uom_id,
       l.display_type, l.tax_line_id, l.tax_base_amount, l.exclude_from_invoice_tab, l.analytic_account_id
     FROM account_move_line l LEFT JOIN account_account a ON a.id = l.account_id LEFT JOIN res_partner p ON p.id = l.partner_id WHERE l.move_id = :id ORDER BY l.id`, { id })
  for (const l of lines) l.tax_ids = (await q<{ account_tax_id: number }>('SELECT account_tax_id FROM account_move_line_account_tax_rel WHERE account_move_line_id = :id', { id: l.id })).map(x => x.account_tax_id)
  // what this document was settled with: one row per partial reconcile on its receivable/payable lines
  const settled = await q<Record<string, any>>(
    `SELECT pr.id AS reconcile_id, pr.amount, pr.max_date AS date, other.id AS line_id, om.id AS move_id, om.name AS move_name, op.id AS payment_id, op.name AS payment_name, oj.name AS journal_name
       FROM account_move_line mine JOIN account_account_type t ON t.id = mine.user_type_id AND t.type IN ('receivable', 'payable')
       JOIN account_partial_reconcile pr ON pr.debit_move_id = mine.id OR pr.credit_move_id = mine.id
       JOIN account_move_line other ON other.id = CASE WHEN pr.debit_move_id = mine.id THEN pr.credit_move_id ELSE pr.debit_move_id END
       JOIN account_move om ON om.id = other.move_id JOIN account_journal oj ON oj.id = om.journal_id LEFT JOIN account_payment op ON op.id = other.payment_id
      WHERE mine.move_id = :id ORDER BY pr.id`, { id })
  const { journal_name, partner_name, currency_name, ...rest } = m
  return {
    ...rest,
    reconciled_items: settled,
    journal_id: { id: m.journal_id, name: journal_name },
    partner_id: m.partner_id ? { id: m.partner_id, name: partner_name } : null,
    currency_id: m.currency_id ? { id: m.currency_id, name: currency_name } : null,
    lines: lines.map(l => ({ ...l, account_id: l.account_id ? { id: l.account_id, name: `${l.account_code} ${l.account_name}` } : null, partner_id: l.partner_id ? { id: l.partner_id, name: l.partner_name } : null })),
  }
}
