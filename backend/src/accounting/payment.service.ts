import Decimal from 'decimal.js'
import { sequelize } from '../orm'
import { AppError, notFound } from '../common.helper'
import type { RequestEnv } from '../middleware'
import { exec, q } from './crud'
import { cancelMove, createMove, postMove, reconcileLines, resetToDraft, unreconcileLines } from './move.service'

/**
 * Customer and vendor payments (Odoo 12 account.payment).
 *   inbound  + customer : debit bank, credit receivable
 *   outbound + supplier : credit bank, debit payable
 * Posting builds and posts the payment's journal entry. When invoice_ids were
 * given, the payment's counterpart line is reconciled with the open lines of
 * those invoices (partially if the amount is smaller).
 * Foreign-currency payments and internal transfers are not built yet.
 */
export interface PaymentInput {
  payment_type?: 'inbound' | 'outbound'; partner_type?: 'customer' | 'supplier'; partner_id?: number
  amount?: string | number; payment_date?: string; communication?: string | null; journal_id?: number
  payment_method_code?: string; destination_account_id?: number | null; invoice_ids?: number[]
}
const D = (v: unknown) => new Decimal(v as Decimal.Value)

export async function createPayment(i: PaymentInput, env: RequestEnv): Promise<number> {
  return sequelize.transaction(async t => {
    if (!i.journal_id) throw new AppError('journal_id: is required')
    const [j] = await q<{ type: string; company_id: number }>('SELECT type, company_id FROM account_journal WHERE id = :id AND active', { id: i.journal_id }, t)
    if (!j) throw new AppError('journal_id: journal not found')
    if (!['bank', 'cash'].includes(j.type)) throw new AppError('A payment needs a bank or cash journal.')
    let type = i.payment_type, ptype = i.partner_type, partner = i.partner_id ?? null
    const invs = [...new Set(i.invoice_ids ?? [])]
    let amount = i.amount != null ? D(i.amount) : null
    if (invs.length) {
      const rows = await q<Record<string, any>>("SELECT id, move_type, state, partner_id, amount_residual, payment_state FROM account_move WHERE id IN (:ids)", { ids: invs }, t)
      if (rows.length !== invs.length) throw new AppError('invoice_ids: invoice not found')
      for (const r of rows) {
        if (r.move_type === 'entry') throw new AppError('Only invoices, bills and credit notes can be paid.')
        if (r.state !== 'posted') throw new AppError('You can only register a payment for a posted invoice.')
        if (D(r.amount_residual).isZero()) throw new AppError('The invoice is already paid.')
      }
      if (new Set(rows.map(r => r.partner_id)).size > 1) throw new AppError('You can only register payments for invoices of the same partner.')
      const inbound = rows.every(r => ['out_invoice', 'in_refund'].includes(r.move_type)), outbound = rows.every(r => ['in_invoice', 'out_refund'].includes(r.move_type))
      if (!inbound && !outbound) throw new AppError('You cannot mix customer invoices and vendor bills in one payment.')
      type = type ?? (inbound ? 'inbound' : 'outbound'); partner = partner ?? rows[0].partner_id
      ptype = ptype ?? (rows[0].move_type.startsWith('out_') ? 'customer' : 'supplier')
      amount = amount ?? rows.reduce((s: Decimal, r) => s.plus(r.amount_residual), D(0))
    }
    if (!type) throw new AppError('payment_type: is required (inbound or outbound)')
    ptype = ptype ?? (type === 'inbound' ? 'customer' : 'supplier')
    if (!partner) throw new AppError('partner_id: is required')
    if (!amount || amount.lte(0)) throw new AppError('The payment amount must be strictly positive.')
    const [p] = await q<{ ar: number | null; ap: number | null }>('SELECT property_account_receivable_id ar, property_account_payable_id ap FROM res_partner WHERE id = :id', { id: partner }, t)
    if (!p) throw new AppError('partner_id: partner not found')
    const [co] = await q<{ ar: number | null; ap: number | null }>('SELECT account_receivable_id ar, account_payable_id ap FROM res_company WHERE id = :id', { id: j.company_id }, t)
    const dest = i.destination_account_id ?? (ptype === 'customer' ? (p.ar ?? co?.ar) : (p.ap ?? co?.ap))
    if (!dest) throw new AppError('No receivable/payable account found for the partner or the company.')
    const [row] = await q<{ id: number }>(
      `INSERT INTO account_payment (state, payment_type, partner_type, partner_id, amount, payment_date, communication, journal_id, payment_method_code, destination_account_id, company_id, create_uid, write_uid)
       VALUES ('draft', :type, :pt, :partner, :amt, :date, :comm, :j, :pm, :dest, :co, :uid, :uid) RETURNING id`,
      { type, pt: ptype, partner, amt: amount.toString(), date: (i.payment_date ?? new Date().toISOString()).slice(0, 10), comm: i.communication ?? null, j: i.journal_id, pm: i.payment_method_code ?? 'manual', dest, co: j.company_id, uid: env.uid }, t)
    for (const inv of invs) await exec('INSERT INTO account_invoice_payment_rel (payment_id, invoice_id) VALUES (:p, :i)', { p: row.id, i: inv }, t)
    return row.id
  })
}

export async function postPayment(id: number, env: RequestEnv): Promise<string> {
  const [pay] = await q<Record<string, any>>('SELECT * FROM account_payment WHERE id = :id', { id })
  if (!pay) throw notFound('Payment')
  if (pay.state !== 'draft') throw new AppError('Only a draft payment can be posted.')
  const [j] = await q<{ debit: number | null; credit: number | null }>('SELECT default_debit_account_id debit, default_credit_account_id credit FROM account_journal WHERE id = :id', { id: pay.journal_id })
  const inbound = pay.payment_type === 'inbound'
  const liquidity = inbound ? j.debit : j.credit
  if (!liquidity) throw new AppError('The payment journal has no default debit/credit account.')
  const amt = pay.amount
  const label = pay.communication ?? (inbound ? 'Customer Payment' : 'Vendor Payment')
  const moveId = await createMove({
    date: String(pay.payment_date instanceof Date ? pay.payment_date.toISOString() : pay.payment_date).slice(0, 10), journal_id: pay.journal_id, partner_id: pay.partner_id, ref: pay.communication,
    lines: [
      { account_id: liquidity, name: label, partner_id: pay.partner_id, debit: inbound ? amt : 0, credit: inbound ? 0 : amt },
      { account_id: pay.destination_account_id, name: label, partner_id: pay.partner_id, debit: inbound ? 0 : amt, credit: inbound ? amt : 0 },
    ],
  } as never, env)
  const name = await postMove(moveId, env)
  await exec('UPDATE account_move_line SET payment_id = :p WHERE move_id = :m', { p: id, m: moveId })
  await exec("UPDATE account_payment SET state = 'posted', name = :name, move_id = :m, write_uid = :u, write_date = now() WHERE id = :id", { name, m: moveId, u: env.uid, id })
  // reconcile the counterpart line with the invoices' open receivable/payable lines
  const invs = (await q<{ invoice_id: number }>('SELECT invoice_id FROM account_invoice_payment_rel WHERE payment_id = :id', { id })).map(r => r.invoice_id)
  if (invs.length) {
    const [mine] = await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a', { m: moveId, a: pay.destination_account_id })
    const theirs = await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id IN (:ids) AND account_id = :a AND amount_residual <> 0 AND NOT reconciled ORDER BY date_maturity, id', { ids: invs, a: pay.destination_account_id })
    if (theirs.length) await reconcileLines([mine.id, ...theirs.map(r => r.id)], env)
  }
  await refreshPaymentState(id)
  return name
}

/** reconciled when the payment's counterpart line has no residual left. */
export async function refreshPaymentState(id: number) {
  const [r] = await q<{ n: string; state: string }>(
    `SELECT count(*) FILTER (WHERE l.account_id = p.destination_account_id AND l.amount_residual <> 0) n, p.state
       FROM account_payment p JOIN account_move_line l ON l.payment_id = p.id WHERE p.id = :id GROUP BY p.state`, { id })
  if (!r || !['posted', 'reconciled'].includes(r.state)) return
  await exec('UPDATE account_payment SET state = :s WHERE id = :id', { s: Number(r.n) === 0 ? 'reconciled' : 'posted', id })
}

export async function cancelPayment(id: number, env: RequestEnv) {
  const [pay] = await q<Record<string, any>>('SELECT * FROM account_payment WHERE id = :id', { id })
  if (!pay) throw notFound('Payment')
  if (pay.state === 'draft') { await exec("UPDATE account_payment SET state = 'cancelled' WHERE id = :id", { id }); return }
  if (pay.state === 'cancelled') throw new AppError('The payment is already cancelled.')
  const [jr] = await q<{ update_posted: boolean }>('SELECT update_posted FROM account_journal WHERE id = :j', { j: pay.journal_id })
  if (!jr.update_posted) throw new AppError('You cannot cancel a posted payment of this journal. First you should set the journal to allow cancelling entries.')
  const lines = (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m', { m: pay.move_id })).map(r => r.id)
  // undo the reconciliation first so the invoices become open again
  const rec = await q<{ n: string }>('SELECT count(*) n FROM account_partial_reconcile WHERE debit_move_id IN (:l) OR credit_move_id IN (:l)', { l: lines })
  if (Number(rec[0].n) > 0) await unreconcileLines(lines)
  await cancelMove(pay.move_id, env)
  await exec("UPDATE account_payment SET state = 'cancelled', write_uid = :u, write_date = now() WHERE id = :id", { u: env.uid, id })
}

export async function resetPaymentToDraft(id: number, env: RequestEnv) {
  const [pay] = await q<Record<string, any>>('SELECT * FROM account_payment WHERE id = :id', { id })
  if (!pay) throw notFound('Payment')
  if (pay.state !== 'cancelled') throw new AppError('Only a cancelled payment can be set back to draft.')
  if (pay.move_id) { await resetToDraft(pay.move_id, env) }
  await exec("UPDATE account_payment SET state = 'draft' WHERE id = :id", { id })
}

export async function deletePayment(id: number) {
  const [pay] = await q<Record<string, any>>('SELECT state, move_id FROM account_payment WHERE id = :id', { id })
  if (!pay) throw notFound('Payment')
  if (!['draft', 'cancelled'].includes(pay.state)) throw new AppError('You cannot delete a posted payment. Cancel it first.')
  await exec('DELETE FROM account_payment WHERE id = :id', { id })
}
