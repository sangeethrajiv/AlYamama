import Decimal from 'decimal.js'
import { sequelize } from '../orm'
import { AppError, notFound } from '../common.helper'
import type { RequestEnv } from '../middleware'
import { assertCompany, exec, q } from './crud'
import { createMove, postMove, reconcileLines, unreconcileLines } from './move.service'
import { refreshPaymentState } from './payment.service'

/**
 * Bank statements (Odoo 12 account.bank.statement and its lines).
 * A line is "booked" by building a journal entry: bank (journal default account) against a
 * counterpart. The counterpart is either the open invoice/payment lines it settles
 * (reconcile) or a plain account (direct booking). Importing statements from a file
 * (account_bank_statement_import) is not built; lines are entered through the API.
 * Matching a line to an existing payment's bank line is not built yet.
 */
const D = (v: unknown) => new Decimal(v as Decimal.Value)
const dstr = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10)

export interface StatementLineInput { date: string; name: string; amount: string | number; partner_id?: number | null; ref?: string | null; note?: string | null; unique_import_id?: string | null }
export interface StatementInput { name?: string; reference?: string | null; date?: string; journal_id?: number; balance_start?: string | number; balance_end_real?: string | number; lines?: StatementLineInput[] }

export async function createStatement(i: StatementInput, env: RequestEnv): Promise<number> {
  return sequelize.transaction(async t => {
    if (!i.journal_id) throw new AppError('journal_id: is required')
    const [j] = await q<{ code: string; type: string; company_id: number }>('SELECT code, type, company_id FROM account_journal WHERE id = :id AND active', { id: i.journal_id }, t)
    if (!j) throw new AppError('journal_id: journal not found')
    assertCompany(env, j.company_id, 'journal_id: journal')
    if (!['bank', 'cash'].includes(j.type)) throw new AppError('A statement needs a bank or cash journal.')
    const date = (i.date ?? new Date().toISOString()).slice(0, 10)
    const [s] = await q<{ id: number }>(
      `INSERT INTO account_bank_statement (name, reference, date, journal_id, company_id, balance_start, balance_end_real, state, create_uid, write_uid)
       VALUES (:name, :ref, :date, :j, :co, :bs, :be, 'open', :u, :u) RETURNING id`,
      { name: i.name ?? `${j.code} ${date}`, ref: i.reference ?? null, date, j: i.journal_id, co: j.company_id, bs: String(i.balance_start ?? 0), be: String(i.balance_end_real ?? 0), u: env.uid }, t)
    for (const l of i.lines ?? []) await addLine(s.id, l, env, t)
    return s.id
  })
}

async function addLine(statementId: number, l: StatementLineInput, env: RequestEnv, t?: import('sequelize').Transaction) {
  const [s] = await q<{ state: string; journal_id: number; company_id: number }>('SELECT state, journal_id, company_id FROM account_bank_statement WHERE id = :id', { id: statementId }, t)
  if (!s) throw notFound('Bank statement')
  if (s.state !== 'open') throw new AppError('You cannot add lines to a confirmed statement.')
  if (!l.name || !l.date) throw new AppError('A statement line needs a date and a label.')
  if (D(l.amount ?? 0).isZero()) throw new AppError('A statement line cannot have a zero amount.')
  const [row] = await q<{ id: number }>(
    `INSERT INTO account_bank_statement_line (statement_id, date, name, ref, partner_id, amount, journal_id, company_id, note, unique_import_id, create_uid, write_uid)
     VALUES (:s, :d, :n, :r, :p, :a, :j, :c, :note, :uid_import, :u, :u) RETURNING id`,
    { s: statementId, d: l.date.slice(0, 10), n: l.name, r: l.ref ?? null, p: l.partner_id ?? null, a: String(l.amount), j: s.journal_id, c: s.company_id, note: l.note ?? null, uid_import: l.unique_import_id ?? null, u: env.uid }, t)
  return row.id
}
export const addStatementLine = (statementId: number, l: StatementLineInput, env: RequestEnv) => addLine(statementId, l, env)

export async function removeStatementLine(id: number) {
  const [l] = await q<{ move_id: number | null }>('SELECT move_id FROM account_bank_statement_line WHERE id = :id', { id })
  if (!l) throw notFound('Statement line')
  if (l.move_id) throw new AppError('You cannot delete a reconciled statement line. Unreconcile it first.')
  await exec('DELETE FROM account_bank_statement_line WHERE id = :id', { id })
}

export async function readStatement(id: number): Promise<Record<string, any>> {
  const [s] = await q<Record<string, any>>(
    `SELECT s.*, j.name journal_name, COALESCE((SELECT sum(amount) FROM account_bank_statement_line WHERE statement_id = s.id), 0) AS total_entry_encoding
       FROM account_bank_statement s JOIN account_journal j ON j.id = s.journal_id WHERE s.id = :id`, { id })
  if (!s) throw notFound('Bank statement')
  const lines = await q<Record<string, any>>(
    `SELECT l.id, l.date, l.name, l.ref, l.partner_id, p.name partner_name, l.amount, l.move_id, l.note, l.sequence
       FROM account_bank_statement_line l LEFT JOIN res_partner p ON p.id = l.partner_id WHERE l.statement_id = :id ORDER BY l.date, l.id`, { id })
  const end = D(s.balance_start).plus(s.total_entry_encoding)
  const { journal_name, ...rest } = s
  return {
    ...rest, journal_id: { id: s.journal_id, name: journal_name },
    balance_end: end.toString(), difference: D(s.balance_end_real).minus(end).toString(),
    lines: lines.map(({ partner_name, ...l }) => ({ ...l, partner_id: l.partner_id ? { id: l.partner_id, name: partner_name } : null, reconciled: !!l.move_id })),
  }
}

export interface BookInput { move_line_ids?: number[]; account_id?: number; writeoff?: { account_id: number; name?: string } }

/** Books a statement line and (optionally) reconciles it with open items. */
export async function bookStatementLine(id: number, b: BookInput, env: RequestEnv): Promise<number> {
  const [l] = await q<Record<string, any>>(
    `SELECT l.*, s.state sstate, j.default_debit_account_id dr, j.default_credit_account_id cr, s.id sid
       FROM account_bank_statement_line l JOIN account_bank_statement s ON s.id = l.statement_id JOIN account_journal j ON j.id = l.journal_id WHERE l.id = :id`, { id })
  if (!l) throw notFound('Statement line')
  if (l.move_id) throw new AppError('This statement line is already reconciled.')
  if (l.sstate !== 'open') throw new AppError('The statement is confirmed.')
  const amount = D(l.amount), inbound = amount.gt(0), abs = amount.abs()
  const liquidity = inbound ? l.dr : l.cr
  if (!liquidity) throw new AppError('The bank journal has no default debit/credit account.')
  const matchIds = [...new Set(b.move_line_ids ?? [])]
  let counterAccount = b.account_id ?? null
  // a line without a partner takes the one of the items it settles (Odoo does the same), so the entry reconciles
  let partnerId: number | null = l.partner_id ?? null
  let counterAmount = abs   // absolute amount of the counterpart line
  let counterOnCredit = inbound
  let writeoff: { account_id: number; debit: Decimal; credit: Decimal } | null = null
  if (matchIds.length) {
    const items = await q<Record<string, any>>('SELECT l.id, l.account_id, l.partner_id, l.amount_residual, m.state FROM account_move_line l JOIN account_move m ON m.id = l.move_id WHERE l.id IN (:ids)', { ids: matchIds })
    if (items.length !== matchIds.length) throw new AppError('move_line_ids: journal item not found')
    if (items.some(x => x.state !== 'posted' || D(x.amount_residual).isZero())) throw new AppError('Only open journal items of posted entries can be matched.')
    if (new Set(items.map(x => x.account_id)).size > 1) throw new AppError('The matched items must be on the same account.')
    counterAccount = items[0].account_id
    if (!partnerId) { const ps = new Set(items.map(x => x.partner_id ?? 0)); if (ps.size === 1 && items[0].partner_id) partnerId = items[0].partner_id }
    const S = items.reduce((s, x) => s.plus(x.amount_residual), D(0))   // signed: debit positive
    // inbound money settles receivables (S > 0) or vendor refunds; outbound settles payables (S < 0)
    if (inbound !== S.gt(0)) throw new AppError(inbound ? 'Money received can only settle debit items (customer invoices, vendor refunds).' : 'Money paid can only settle credit items (vendor bills, customer refunds).')
    if (b.writeoff) {
      counterAmount = S.abs()
      const diff = S.abs().minus(abs)       // >0: bank got less than the items -> loss (discount); <0: got more -> gain
      if (!diff.isZero()) {
        // inbound: counterpart credit = S, writeoff debit = S - a; outbound mirrored
        writeoff = { account_id: b.writeoff.account_id, debit: inbound === diff.gt(0) ? diff.abs() : D(0), credit: inbound === diff.gt(0) ? D(0) : diff.abs() }
      }
    } else if (abs.gt(S.abs())) throw new AppError('The statement line is larger than the selected items. Select more items or choose a write-off account.')
  } else if (!counterAccount) throw new AppError('Provide move_line_ids to reconcile, or account_id to book the line directly.')

  const lines: Record<string, unknown>[] = [
    { account_id: liquidity, name: l.name, partner_id: partnerId, debit: inbound ? abs.toString() : 0, credit: inbound ? 0 : abs.toString() },
    { account_id: counterAccount, name: l.name, partner_id: partnerId ?? undefined, debit: counterOnCredit ? 0 : counterAmount.toString(), credit: counterOnCredit ? counterAmount.toString() : 0 },
  ]
  if (writeoff) lines.push({ account_id: writeoff.account_id, name: b.writeoff?.name ?? 'Write-Off', partner_id: partnerId, debit: writeoff.debit.toString(), credit: writeoff.credit.toString() })
  const moveId = await createMove({ date: dstr(l.date), journal_id: l.journal_id, partner_id: partnerId, ref: l.ref ?? l.name, lines } as never, env)
  await postMove(moveId, env)
  await exec('UPDATE account_move_line SET statement_line_id = :l, statement_id = :s WHERE move_id = :m', { l: id, s: l.sid, m: moveId })
  await exec('UPDATE account_bank_statement_line SET move_id = :m, partner_id = COALESCE(partner_id, :p), write_uid = :u, write_date = now() WHERE id = :id', { m: moveId, p: partnerId, u: env.uid, id })
  if (matchIds.length) {
    const [mine] = await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a AND partner_id IS NOT DISTINCT FROM :p ORDER BY id DESC LIMIT 1', { m: moveId, a: counterAccount, p: partnerId })
    await reconcileLines([mine.id, ...matchIds], env)
    const pays = await q<{ payment_id: number }>('SELECT DISTINCT payment_id FROM account_move_line WHERE id IN (:ids) AND payment_id IS NOT NULL', { ids: matchIds })
    for (const p of pays) await refreshPaymentState(p.payment_id)
  }
  return moveId
}

export async function unbookStatementLine(id: number) {
  await sequelize.transaction(async t => {
    const [l] = await q<{ move_id: number | null; sstate: string }>('SELECT l.move_id, s.state sstate FROM account_bank_statement_line l JOIN account_bank_statement s ON s.id = l.statement_id WHERE l.id = :id', { id }, t)
    if (!l) throw notFound('Statement line')
    if (!l.move_id) throw new AppError('This statement line is not reconciled.')
    if (l.sstate !== 'open') throw new AppError('The statement is confirmed.')
    const lineIds = (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m', { m: l.move_id }, t)).map(r => r.id)
    const rec = await q<{ n: string }>('SELECT count(*) n FROM account_partial_reconcile WHERE debit_move_id IN (:l) OR credit_move_id IN (:l)', { l: lineIds }, t)
    if (Number(rec[0].n) > 0) await unreconcileLinesIn(lineIds, t)
    await exec('DELETE FROM account_move WHERE id = :m', { m: l.move_id }, t)
  })
}
async function unreconcileLinesIn(lineIds: number[], _t: import('sequelize').Transaction) {
  // unreconcileLines opens its own transaction; run it on the committed state before deleting
  await unreconcileLines(lineIds)
}

export async function confirmStatement(id: number, env: RequestEnv) {
  await sequelize.transaction(async t => {
    const s = await readStatement(id)
    if (s.state === 'confirm') throw new AppError('The statement is already confirmed.')
    if (!s.lines.length) throw new AppError('The statement has no lines.')
    if (!D(s.difference).isZero()) throw new AppError(`The ending balance is incorrect: the real balance is ${s.balance_end_real} but the computed balance is ${s.balance_end}.`)
    if (s.lines.some((l: any) => !l.reconciled)) throw new AppError('All statement lines must be reconciled or booked before confirming.')
    await exec("UPDATE account_bank_statement SET state = 'confirm', write_uid = :u, write_date = now() WHERE id = :id", { u: env.uid, id }, t)
  })
}
export async function reopenStatement(id: number, env: RequestEnv) {
  const [s] = await q<{ state: string }>('SELECT state FROM account_bank_statement WHERE id = :id', { id })
  if (!s) throw notFound('Bank statement')
  if (s.state !== 'confirm') throw new AppError('Only a confirmed statement can be reopened.')
  await exec("UPDATE account_bank_statement SET state = 'open', write_uid = :u, write_date = now() WHERE id = :id", { u: env.uid, id })
}
export async function deleteStatement(id: number) {
  const [s] = await q<{ state: string }>('SELECT state FROM account_bank_statement WHERE id = :id', { id })
  if (!s) throw notFound('Bank statement')
  if (s.state !== 'open') throw new AppError('You cannot delete a confirmed statement.')
  const [n] = await q<{ n: string }>('SELECT count(*) n FROM account_bank_statement_line WHERE statement_id = :id AND move_id IS NOT NULL', { id })
  if (Number(n.n) > 0) throw new AppError('You cannot delete a statement with reconciled lines.')
  await exec('DELETE FROM account_bank_statement WHERE id = :id', { id })
}
