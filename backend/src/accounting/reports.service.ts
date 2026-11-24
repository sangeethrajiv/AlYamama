import Decimal from 'decimal.js'
import { q } from './crud'

/**
 * The default accounting reports, all read-only SQL over posted journal items
 * (target_move=all also includes drafts). Amounts are strings (numeric), never floats.
 *
 *   trial balance, general ledger, partner ledger, aged receivable / payable,
 *   profit and loss, balance sheet, tax report, journal summary.
 *
 * Aged reports use today's residual per open item (not a past "as of" replay).
 */
export interface Filter { detail?: boolean; companyIds: number[]; date_from?: string; date_to?: string; target_move?: string; account_id?: number; partner_id?: number; journal_id?: number }
const D = (v: unknown) => new Decimal((v ?? 0) as Decimal.Value)

function base(f: Filter, alias = 'l') {
  const w: string[] = []; const r: Record<string, unknown> = {}
  if (f.companyIds.length) { w.push(`${alias}.company_id IN (:cids)`); r.cids = f.companyIds }
  if (f.target_move !== 'all') w.push("m.state = 'posted'"); else w.push("m.state <> 'cancel'")
  if (f.journal_id) { w.push(`${alias}.journal_id = :jid`); r.jid = f.journal_id }
  if (f.partner_id) { w.push(`${alias}.partner_id = :pid`); r.pid = f.partner_id }
  if (f.account_id) { w.push(`${alias}.account_id = :aid`); r.aid = f.account_id }
  return { w, r }
}
const FROM = 'FROM account_move_line l JOIN account_move m ON m.id = l.move_id JOIN account_account a ON a.id = l.account_id JOIN account_account_type t ON t.id = a.user_type_id'
const fiscalStart = (to: string, day = 31, month = 12) => {
  // first day of the fiscal year containing `to`, for a year ending on day/month
  const y = Number(to.slice(0, 4)); const endThis = new Date(Date.UTC(y, month - 1, day)); const d = new Date(to + 'T00:00:00Z')
  const startYear = d <= endThis ? y - 1 : y
  const s = new Date(Date.UTC(startYear, month - 1, day)); s.setUTCDate(s.getUTCDate() + 1)
  return s.toISOString().slice(0, 10)
}
async function fyStart(companyIds: number[], to: string) {
  const [c] = await q<{ d: number; m: number }>('SELECT fiscalyear_last_day d, fiscalyear_last_month m FROM res_company WHERE id = :id', { id: companyIds[0] ?? 0 })
  return fiscalStart(to, c?.d ?? 31, c?.m ?? 12)
}
const today = () => new Date().toISOString().slice(0, 10)

async function trialBalanceRaw(f: Filter) {
  const to = f.date_to ?? today(); const from = f.date_from ?? await fyStart(f.companyIds, to)
  const { w, r } = base(f)
  // opening: balance-sheet accounts carry everything before `from`; P&L accounts only the part of this fiscal year before `from`
  const fy = await fyStart(f.companyIds, from)
  const rows = await q<Record<string, string>>(
    `SELECT a.id, a.code, a.name, t.internal_group AS grp,
       COALESCE(sum(l.balance) FILTER (WHERE l.date < :from AND (t.include_initial_balance OR t.internal_group IN ('asset','liability','equity') OR l.date >= :fy)), 0) AS initial,
       COALESCE(sum(l.debit)  FILTER (WHERE l.date >= :from AND l.date <= :to), 0) AS debit,
       COALESCE(sum(l.credit) FILTER (WHERE l.date >= :from AND l.date <= :to), 0) AS credit
     ${FROM} WHERE ${w.join(' AND ')} AND l.date <= :to GROUP BY a.id, a.code, a.name, t.internal_group HAVING
       sum(l.balance) FILTER (WHERE l.date < :from) <> 0 OR sum(l.debit) FILTER (WHERE l.date >= :from) <> 0 OR sum(l.credit) FILTER (WHERE l.date >= :from) <> 0 ORDER BY a.code`, { ...r, from, to, fy })
  let ti = D(0), td = D(0), tc = D(0)
  const lines = rows.map(x => { const end = D(x.initial).plus(x.debit).minus(x.credit); ti = ti.plus(x.initial); td = td.plus(x.debit); tc = tc.plus(x.credit); return { account_id: Number(x.id), code: x.code, name: x.name, initial: x.initial, debit: x.debit, credit: x.credit, ending: end.toString() } })
  return { date_from: from, date_to: to, lines, totals: { initial: ti.toString(), debit: td.toString(), credit: tc.toString(), ending: ti.plus(td).minus(tc).toString() } }
}

async function generalLedgerRaw(f: Filter, page = 1, limit = 200) {
  const to = f.date_to ?? today(); const from = f.date_from ?? await fyStart(f.companyIds, to)
  const { w, r } = base(f)
  const accounts = await q<Record<string, string>>(
    `SELECT a.id, a.code, a.name, COALESCE(sum(l.balance) FILTER (WHERE l.date < :from AND (t.internal_group IN ('asset','liability','equity') OR l.date >= :fy)), 0) AS initial,
       COALESCE(sum(l.debit) FILTER (WHERE l.date >= :from AND l.date <= :to), 0) debit, COALESCE(sum(l.credit) FILTER (WHERE l.date >= :from AND l.date <= :to), 0) credit
     ${FROM} WHERE ${w.join(' AND ')} AND l.date <= :to GROUP BY a.id, a.code, a.name HAVING count(*) FILTER (WHERE l.date >= :from) > 0 OR sum(l.balance) FILTER (WHERE l.date < :from) <> 0 ORDER BY a.code`,
    { ...r, from, to, fy: await fyStart(f.companyIds, from) })
  const out = []
  for (const a of accounts) {
    const items = await q<Record<string, any>>(
      `SELECT l.id, l.date, m.name move, l.name label, l.ref, p.name partner, l.debit, l.credit, j.code journal
         FROM account_move_line l JOIN account_move m ON m.id = l.move_id JOIN account_journal j ON j.id = l.journal_id LEFT JOIN res_partner p ON p.id = l.partner_id
        WHERE l.account_id = :a AND l.date >= :from AND l.date <= :to AND ${w.filter(x => !x.includes('aid')).join(' AND ')} ORDER BY l.date, l.id LIMIT :lim OFFSET :off`,
      { ...r, a: a.id, from, to, lim: limit, off: (page - 1) * limit })
    let run = D(a.initial)
    out.push({ account_id: Number(a.id), code: a.code, name: a.name, initial: a.initial, debit: a.debit, credit: a.credit, ending: D(a.initial).plus(a.debit).minus(a.credit).toString(),
      lines: items.map(i => { run = run.plus(i.debit).minus(i.credit); return { ...i, balance: run.toString() } }) })
  }
  return { date_from: from, date_to: to, accounts: out }
}

async function partnerLedgerRaw(f: Filter, kind: 'receivable' | 'payable' | 'both' = 'both') {
  const to = f.date_to ?? today(); const from = f.date_from ?? '1900-01-01'
  const { w, r } = base(f)
  const types = kind === 'both' ? ['receivable', 'payable'] : [kind]
  const rows = await q<Record<string, string>>(
    `SELECT p.id, p.name, COALESCE(sum(l.balance) FILTER (WHERE l.date < :from), 0) initial,
       COALESCE(sum(l.debit) FILTER (WHERE l.date >= :from), 0) debit, COALESCE(sum(l.credit) FILTER (WHERE l.date >= :from), 0) credit, COALESCE(sum(l.balance), 0) ending
     ${FROM} JOIN res_partner p ON p.id = l.partner_id WHERE ${w.join(' AND ')} AND t.type IN (:types) AND l.date <= :to GROUP BY p.id, p.name HAVING sum(l.balance) <> 0 OR sum(l.debit) FILTER (WHERE l.date >= :from) <> 0 ORDER BY p.name`,
    { ...r, from, to, types })
  // one partner (or `detail`): every line with a running balance, so the ledger can be read like Odoo's partner ledger
  const partners: Record<string, unknown>[] = []
  for (const x of rows) {
    const out: Record<string, unknown> = { partner_id: Number(x.id), name: x.name, initial: x.initial, debit: x.debit, credit: x.credit, ending: x.ending }
    if (f.detail) {
      const items = await q<Record<string, any>>(
        `SELECT l.date, m.name move, j.code journal, a.code account, l.name label, l.ref, l.date_maturity due, l.debit, l.credit, l.amount_residual residual, l.full_reconcile_id
           FROM account_move_line l JOIN account_move m ON m.id = l.move_id JOIN account_journal j ON j.id = l.journal_id
           JOIN account_account a ON a.id = l.account_id JOIN account_account_type t ON t.id = a.user_type_id
          WHERE l.partner_id = :pid AND t.type IN (:types) AND l.date >= :from AND l.date <= :to AND ${w.filter(c => !c.includes('pid')).join(' AND ')}
          ORDER BY l.date, l.id`, { ...r, pid: x.id, from, to, types })
      let run = D(x.initial)
      out['lines'] = items.map(i => { run = run.plus(i.debit).minus(i.credit); return { ...i, date: String(i.date).slice(0, 10), due: i.due ? String(i.due).slice(0, 10) : null, matching: i.full_reconcile_id ? `A${i.full_reconcile_id}` : '', balance: run.toString() } })
    }
    partners.push(out)
  }
  return { date_from: from === '1900-01-01' ? null : from, date_to: to, partners }
}

async function agedBalanceRaw(f: Filter, kind: 'receivable' | 'payable') {
  const at = f.date_to ?? today()
  const { w, r } = base(f)
  const rows = await q<Record<string, string>>(
    `SELECT p.id, p.name,
       COALESCE(sum(l.amount_residual) FILTER (WHERE COALESCE(l.date_maturity, l.date) >= :at), 0) not_due,
       COALESCE(sum(l.amount_residual) FILTER (WHERE :at - COALESCE(l.date_maturity, l.date) BETWEEN 1 AND 30), 0) d30,
       COALESCE(sum(l.amount_residual) FILTER (WHERE :at - COALESCE(l.date_maturity, l.date) BETWEEN 31 AND 60), 0) d60,
       COALESCE(sum(l.amount_residual) FILTER (WHERE :at - COALESCE(l.date_maturity, l.date) BETWEEN 61 AND 90), 0) d90,
       COALESCE(sum(l.amount_residual) FILTER (WHERE :at - COALESCE(l.date_maturity, l.date) BETWEEN 91 AND 120), 0) d120,
       COALESCE(sum(l.amount_residual) FILTER (WHERE :at - COALESCE(l.date_maturity, l.date) > 120), 0) older,
       COALESCE(sum(l.amount_residual), 0) total
     ${FROM} LEFT JOIN res_partner p ON p.id = l.partner_id WHERE ${w.join(' AND ')} AND t.type = :kind AND l.reconciled = false AND l.amount_residual <> 0 AND l.date <= :at
     GROUP BY p.id, p.name ORDER BY p.name NULLS LAST`, { ...r, at, kind })
  const tot = { not_due: D(0), d30: D(0), d60: D(0), d90: D(0), d120: D(0), older: D(0), total: D(0) } as Record<string, Decimal>
  rows.forEach(x => Object.keys(tot).forEach(k => { tot[k] = tot[k].plus(x[k]) }))
  return { as_of: at, buckets: ['not_due', '1-30', '31-60', '61-90', '91-120', 'older'], partners: rows.map(x => ({ partner_id: x.id ? Number(x.id) : null, name: x.name, not_due: x.not_due, '1-30': x.d30, '31-60': x.d60, '61-90': x.d90, '91-120': x.d120, older: x.older, total: x.total })),
    totals: { not_due: tot.not_due.toString(), '1-30': tot.d30.toString(), '31-60': tot.d60.toString(), '61-90': tot.d90.toString(), '91-120': tot.d120.toString(), older: tot.older.toString(), total: tot.total.toString() } }
}

async function profitAndLossRaw(f: Filter) {
  const to = f.date_to ?? today(); const from = f.date_from ?? await fyStart(f.companyIds, to)
  const { w, r } = base(f)
  const rows = await q<Record<string, string>>(
    `SELECT a.id, a.code, a.name, t.internal_group grp, COALESCE(sum(l.credit - l.debit), 0) amount
     ${FROM} WHERE ${w.join(' AND ')} AND t.internal_group IN ('income','expense') AND l.date >= :from AND l.date <= :to GROUP BY a.id, a.code, a.name, t.internal_group HAVING sum(l.credit - l.debit) <> 0 ORDER BY a.code`, { ...r, from, to })
  const income = rows.filter(x => x.grp === 'income').map(x => ({ account_id: Number(x.id), code: x.code, name: x.name, amount: x.amount }))
  const expense = rows.filter(x => x.grp === 'expense').map(x => ({ account_id: Number(x.id), code: x.code, name: x.name, amount: D(x.amount).neg().toString() }))
  const ti = income.reduce((s, x) => s.plus(x.amount), D(0)), te = expense.reduce((s, x) => s.plus(x.amount), D(0))
  return { date_from: from, date_to: to, income, expense, total_income: ti.toString(), total_expense: te.toString(), net_profit: ti.minus(te).toString() }
}

async function balanceSheetRaw(f: Filter) {
  const to = f.date_to ?? today()
  const { w, r } = base(f)
  const rows = await q<Record<string, string>>(
    `SELECT a.id, a.code, a.name, t.internal_group grp, COALESCE(sum(l.balance), 0) balance
     ${FROM} WHERE ${w.join(' AND ')} AND t.internal_group IN ('asset','liability','equity') AND l.date <= :to GROUP BY a.id, a.code, a.name, t.internal_group HAVING sum(l.balance) <> 0 ORDER BY a.code`, { ...r, to })
  // unallocated earnings: all income and expense up to the date
  const [pl] = await q<{ v: string }>(`SELECT COALESCE(sum(l.credit - l.debit), 0) v ${FROM} WHERE ${w.join(' AND ')} AND t.internal_group IN ('income','expense') AND l.date <= :to`, { ...r, to })
  const sect = (g: string, sign: 1 | -1) => rows.filter(x => x.grp === g).map(x => ({ account_id: Number(x.id), code: x.code, name: x.name, amount: D(x.balance).mul(sign).toString() }))
  const assets = sect('asset', 1), liabilities = sect('liability', -1), equity = sect('equity', -1)
  const sum = (l: { amount: string }[]) => l.reduce((s, x) => s.plus(x.amount), D(0))
  const earnings = D(pl.v)
  const tl = sum(liabilities), te = sum(equity).plus(earnings)
  return { as_of: to, assets, liabilities, equity, unallocated_earnings: earnings.toString(), total_assets: sum(assets).toString(), total_liabilities: tl.toString(), total_equity: te.toString(), total_liabilities_and_equity: tl.plus(te).toString() }
}

async function taxReportRaw(f: Filter) {
  const to = f.date_to ?? today(); const from = f.date_from ?? await fyStart(f.companyIds, to)
  const { w, r } = base(f)
  const rows = await q<Record<string, string>>(
    `SELECT x.id, x.name, x.type_tax_use, x.amount,
       COALESCE(sum(l.tax_base_amount * sg.sign), 0) base,
       COALESCE(sum(CASE WHEN x.type_tax_use = 'sale' THEN l.credit - l.debit ELSE l.debit - l.credit END), 0) tax
     FROM account_move_line l JOIN account_move m ON m.id = l.move_id JOIN account_tax x ON x.id = l.tax_line_id
     CROSS JOIN LATERAL (SELECT CASE WHEN (CASE WHEN x.type_tax_use = 'sale' THEN l.credit - l.debit ELSE l.debit - l.credit END) < 0 THEN -1 ELSE 1 END AS sign) sg
     WHERE ${w.join(' AND ')} AND l.tax_exigible AND l.date >= :from AND l.date <= :to GROUP BY x.id, x.name, x.type_tax_use, x.amount ORDER BY x.type_tax_use, x.name`, { ...r, from, to })
  const side = (u: string) => rows.filter(x => x.type_tax_use === u).map(x => ({ tax_id: Number(x.id), name: x.name, rate: D(x.amount).toString(), base: D(x.base).toString(), tax: D(x.tax).toString() }))
  const sale = side('sale'), purchase = side('purchase')
  const sum = (l: { tax: string }[]) => l.reduce((s, x) => s.plus(x.tax), D(0))
  return { date_from: from, date_to: to, sales: sale, purchases: purchase, output_tax: sum(sale).toString(), input_tax: sum(purchase).toString(), net_tax_payable: sum(sale).minus(sum(purchase)).toString() }
}

async function journalSummaryRaw(f: Filter) {
  const to = f.date_to ?? today(); const from = f.date_from ?? await fyStart(f.companyIds, to)
  const { w, r } = base(f)
  const rows = await q<Record<string, string>>(
    `SELECT j.id, j.code, j.name, j.type, count(DISTINCT m.id) moves, COALESCE(sum(l.debit),0) debit, COALESCE(sum(l.credit),0) credit
       FROM account_move_line l JOIN account_move m ON m.id = l.move_id JOIN account_journal j ON j.id = l.journal_id
      WHERE ${w.join(' AND ')} AND l.date >= :from AND l.date <= :to GROUP BY j.id, j.code, j.name, j.type ORDER BY j.code`, { ...r, from, to })
  return { date_from: from, date_to: to, journals: rows.map(x => ({ journal_id: Number(x.id), code: x.code, name: x.name, type: x.type, moves: Number(x.moves), debit: x.debit, credit: x.credit })) }
}

export const REPORT_CATALOG = [
  { key: 'trial-balance', name: 'Trial Balance', params: ['date_from', 'date_to', 'target_move'] },
  { key: 'general-ledger', name: 'General Ledger', params: ['date_from', 'date_to', 'account_id', 'journal_id', 'target_move'] },
  { key: 'partner-ledger', name: 'Partner Ledger', params: ['date_from', 'date_to', 'partner_id', 'kind'] },
  { key: 'aged-receivable', name: 'Aged Receivable', params: ['date_to', 'partner_id'] },
  { key: 'aged-payable', name: 'Aged Payable', params: ['date_to', 'partner_id'] },
  { key: 'profit-loss', name: 'Profit and Loss', params: ['date_from', 'date_to'] },
  { key: 'balance-sheet', name: 'Balance Sheet', params: ['date_to'] },
  { key: 'tax-report', name: 'Tax Report', params: ['date_from', 'date_to'] },
  { key: 'journal-summary', name: 'Journals Audit Summary', params: ['date_from', 'date_to', 'journal_id'] },
]

/** Numbers come out of Postgres as '400.0000'; every report returns them without trailing zeros ('400'). */
const norm = <T,>(v: T): T => {
  if (typeof v === 'string') return (/^-?\d+\.\d+$/.test(v) ? new Decimal(v).toString() : v) as unknown as T
  if (Array.isArray(v)) return v.map(norm) as unknown as T
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)])) as T
  return v
}
export const trialBalance = async (...a: Parameters<typeof trialBalanceRaw>) => norm(await trialBalanceRaw(...a))
export const generalLedger = async (...a: Parameters<typeof generalLedgerRaw>) => norm(await generalLedgerRaw(...a))
export const partnerLedger = async (...a: Parameters<typeof partnerLedgerRaw>) => norm(await partnerLedgerRaw(...a))
export const agedBalance = async (...a: Parameters<typeof agedBalanceRaw>) => norm(await agedBalanceRaw(...a))
export const profitAndLoss = async (...a: Parameters<typeof profitAndLossRaw>) => norm(await profitAndLossRaw(...a))
export const balanceSheet = async (...a: Parameters<typeof balanceSheetRaw>) => norm(await balanceSheetRaw(...a))
export const taxReport = async (...a: Parameters<typeof taxReportRaw>) => norm(await taxReportRaw(...a))
export const journalSummary = async (...a: Parameters<typeof journalSummaryRaw>) => norm(await journalSummaryRaw(...a))
