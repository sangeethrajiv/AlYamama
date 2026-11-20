import Decimal from 'decimal.js'
import { sequelize } from '../orm'
import { AppError, notFound } from '../common.helper'
import type { RequestEnv } from '../middleware'
import { exec, q } from './crud'
import { createMove, postMove, readMove } from './move.service'
import { createPayment, postPayment } from './payment.service'

/**
 * The Invoicing menus that are not plain CRUD (Odoo 12 custom addons in yamama_LIVE_sep_26):
 *
 *   Customers > Cash / Credit / Proforma / Progressive Invoices   -> invoice_category
 *   Customers > Internal Voucher                                  -> att_internal_voucher
 *   Vendors   > To Approve Bill / Approved Bill / Refund          -> request_status
 *   Vendors   > Payable Voucher                                   -> att_account_voucher
 *
 * EXTERNAL and therefore not implemented: the approval-level routing app (who approves what),
 * ZATCA submission, subscription renewal. The columns exist; the rules do not.
 */
const D = (v: unknown) => new Decimal((v ?? 0) as Decimal.Value)
const dstr = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? '')).slice(0, 10)

// ------------------------------------------------------------ bill approval ---
/** Vendors > Bills: send a draft bill for approval. */
export async function submitBillForApproval(id: number, env: RequestEnv) {
  const m = await loadInvoice(id)
  if (!m.move_type.startsWith('in_')) throw new AppError('Only vendor bills go through approval.')
  if (m.state !== 'draft') throw new AppError('Only a draft bill can be sent for approval.')
  if (m.request_status === 'to_approve') throw new AppError('This bill is already waiting for approval.')
  if (m.request_status === 'approved') throw new AppError('This bill is already approved.')
  await exec("UPDATE account_move SET request_status = 'to_approve', prepared_by = COALESCE(prepared_by, :uid), reject_reason = NULL, write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id })
  return readMove(id)
}

/** Vendors > To Approve Bill: approve, optionally posting it straight away. */
export async function approveBill(id: number, opts: { post?: boolean }, env: RequestEnv) {
  const m = await loadInvoice(id)
  if (m.request_status !== 'to_approve') throw new AppError('Only a bill waiting for approval can be approved.')
  if (m.prepared_by && env.uid && m.prepared_by === env.uid) throw new AppError('You cannot approve a bill you prepared yourself.')
  await exec("UPDATE account_move SET request_status = 'approved', approver_id = :uid, approved_on = now(), reject_reason = NULL, write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id })
  if (opts.post) await postMove(id, env)
  return readMove(id)
}

export async function rejectBill(id: number, reason: string, env: RequestEnv) {
  const m = await loadInvoice(id)
  if (m.request_status !== 'to_approve') throw new AppError('Only a bill waiting for approval can be rejected.')
  if (!reason?.trim()) throw new AppError('A rejection reason is required.')
  await exec("UPDATE account_move SET request_status = 'rejected', approver_id = :uid, reject_reason = :r, write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, r: reason.trim(), id })
  return readMove(id)
}

/** Back to draft for a correction after a rejection. */
export async function resetBillApproval(id: number, env: RequestEnv) {
  const m = await loadInvoice(id)
  if (m.state === 'posted') throw new AppError('The bill is posted; reset the entry to draft first.')
  await exec("UPDATE account_move SET request_status = 'not_required', approver_id = NULL, approved_on = NULL, reject_reason = NULL, write_uid = :uid WHERE id = :id", { uid: env.uid, id })
  return readMove(id)
}

async function loadInvoice(id: number): Promise<Record<string, any>> {
  const [m] = await q<Record<string, any>>('SELECT * FROM account_move WHERE id = :id', { id })
  if (!m) throw notFound('Invoice')
  if (m.move_type === 'entry') throw new AppError('This is a journal entry, not an invoice.')
  return m
}

// ---------------------------------------------------------------- proforma ---
/**
 * Customers > Proforma Invoices: a proforma carries no accounting. Converting it
 * copies the lines into a real customer invoice and links the two; the proforma is
 * then cancelled so it cannot be converted twice.
 */
export async function convertProforma(id: number, opts: { journal_id?: number; date?: string; post?: boolean }, env: RequestEnv) {
  const m = await loadInvoice(id)
  if (m.invoice_category !== 'proforma') throw new AppError('Only a proforma invoice can be converted.')
  if (m.state === 'cancel') throw new AppError('This proforma was already converted or cancelled.')
  const [dup] = await q<{ id: number }>("SELECT id FROM account_move WHERE proforma_of_id = :id AND state <> 'cancel' LIMIT 1", { id })
  if (dup) throw new AppError('This proforma has already been converted.')
  const lines = await q<Record<string, any>>('SELECT * FROM account_move_line WHERE move_id = :id AND tax_line_id IS NULL AND NOT exclude_from_invoice_tab ORDER BY sequence, id', { id })
  if (!lines.length) throw new AppError('The proforma has no lines to convert.')
  const date = opts.date ?? dstr(m.invoice_date ?? m.date)
  const journal = opts.journal_id ?? (await defaultJournal(m.company_id, 'sale', { excludeCategory: 'proforma' }))
  const newId = await createMove({
    move_type: 'out_invoice', date, journal_id: journal, partner_id: m.partner_id, ref: m.ref,
    invoice_date: date, invoice_origin: m.name !== '/' ? m.name : `Proforma #${id}`, invoice_payment_term_id: m.invoice_payment_term_id,
    fiscal_position_id: m.fiscal_position_id, currency_id: m.currency_id, narration: m.narration,
    invoice_category: 'credit', proforma_of_id: id, po_number: m.po_number, pr_number: m.pr_number, client_order_ref: m.client_order_ref,
    lines: await linesForCopy(lines),
  } as never, env)
  await exec("UPDATE account_move SET state = 'cancel', write_uid = :uid, write_date = now() WHERE id = :id", { uid: env.uid, id })
  if (opts.post) await postMove(newId, env)
  return readMove(newId)
}

async function linesForCopy(lines: Record<string, any>[]) {
  const out = []
  for (const l of lines) {
    const taxes = (await q<{ account_tax_id: number }>('SELECT account_tax_id FROM account_move_line_account_tax_rel WHERE account_move_line_id = :id', { id: l.id })).map(x => x.account_tax_id)
    out.push({ account_id: l.account_id, name: l.name, quantity: l.quantity ?? 1, price_unit: l.price_unit ?? 0, discount: l.discount ?? 0,
      product_id: l.product_id, product_uom_id: l.product_uom_id, analytic_account_id: l.analytic_account_id, display_type: l.display_type, tax_ids: taxes })
  }
  return out
}

async function defaultJournal(companyId: number, type: string, opts: { excludeCategory?: string } = {}) {
  const [j] = await q<{ id: number }>(
    `SELECT id FROM account_journal WHERE company_id = :c AND type = :t AND active
       AND (:ex::varchar IS NULL OR invoice_category IS DISTINCT FROM :ex) ORDER BY sequence, id LIMIT 1`,
    { c: companyId, t: type, ex: opts.excludeCategory ?? null })
  if (!j) throw new AppError(`No ${type} journal found for this company.`)
  return j.id
}

// ------------------------------------------------------------- progressive ---
/**
 * Customers > Progressive Invoices: milestone billing against a contract amount.
 * The next invoice bills `progress_percentage` of the contract minus what was billed
 * before, and may hold back a retainage.
 */
export async function progressiveNext(parentId: number, opts: { progress_percentage: number | string; date?: string; retainage_percentage?: number | string; post?: boolean }, env: RequestEnv) {
  const m = await loadInvoice(parentId)
  const root = m.progressive_parent_id ?? parentId
  const [r] = await q<Record<string, any>>('SELECT * FROM account_move WHERE id = :id', { id: root })
  if (!r.is_progressive) throw new AppError('The source invoice is not a progressive invoice.')
  const contract = D(r.contract_amount)
  if (contract.lte(0)) throw new AppError('The progressive invoice has no contract_amount.')
  const pct = D(opts.progress_percentage)
  if (pct.lte(0) || pct.gt(100)) throw new AppError('progress_percentage must be between 0 and 100.')
  const [billed] = await q<{ v: string }>(
    `SELECT COALESCE(sum(amount_untaxed), 0) v FROM account_move WHERE (id = :root OR progressive_parent_id = :root) AND state = 'posted' AND move_type = 'out_invoice'`, { root })
  const target = contract.mul(pct).div(100)
  const amount = target.minus(D(billed.v))
  if (amount.lte(0)) throw new AppError(`Nothing left to bill at ${pct}%: ${billed.v} of ${contract} is already invoiced.`)
  const retainage = opts.retainage_percentage ? amount.mul(D(opts.retainage_percentage)).div(100) : D(0)
  const lines = await q<Record<string, any>>('SELECT * FROM account_move_line WHERE move_id = :id AND tax_line_id IS NULL AND NOT exclude_from_invoice_tab ORDER BY sequence, id LIMIT 1', { id: root })
  if (!lines.length) throw new AppError('The progressive invoice has no line to base the milestone on.')
  const base = lines[0]
  const taxes = (await q<{ account_tax_id: number }>('SELECT account_tax_id FROM account_move_line_account_tax_rel WHERE account_move_line_id = :id', { id: base.id })).map(x => x.account_tax_id)
  const date = opts.date ?? new Date().toISOString().slice(0, 10)
  const newId = await createMove({
    move_type: 'out_invoice', date, journal_id: r.journal_id, partner_id: r.partner_id, invoice_date: date,
    invoice_origin: r.name !== '/' ? r.name : `Progressive #${root}`, invoice_payment_term_id: r.invoice_payment_term_id,
    fiscal_position_id: r.fiscal_position_id, currency_id: r.currency_id,
    invoice_category: 'progressive', is_progressive: true, progressive_parent_id: root,
    contract_amount: contract.toString(), previously_billed: billed.v, progress_percentage: pct.toString(), retainage_amount: retainage.toString(),
    lines: [{ account_id: base.account_id, name: `${base.name ?? 'Progress'} - ${pct}%`, quantity: 1, price_unit: amount.minus(retainage).toString(),
      product_id: base.product_id, analytic_account_id: base.analytic_account_id, tax_ids: taxes }],
  } as never, env)
  if (opts.post) await postMove(newId, env)
  return readMove(newId)
}

// ------------------------------------------------------- internal voucher ---
/**
 * Customers > Internal Voucher (att_internal_voucher): money moved between two of
 * the company's own journals. Posting writes one entry: credit the source journal's
 * account, debit the destination's.
 */
export interface InternalVoucherInput {
  amount?: string | number; payment_date?: string; journal_id?: number; destination_journal_id?: number
  description?: string | null; currency_id?: number | null
}
export async function createInternalVoucher(i: InternalVoucherInput, env: RequestEnv): Promise<number> {
  if (!i.journal_id || !i.destination_journal_id) throw new AppError('journal_id and destination_journal_id are required.')
  if (i.journal_id === i.destination_journal_id) throw new AppError('The source and destination journals must differ.')
  const amount = D(i.amount)
  if (amount.lte(0)) throw new AppError('The amount must be strictly positive.')
  const js = await q<{ id: number; type: string; company_id: number; dr: number | null; cr: number | null }>(
    'SELECT id, type, company_id, default_debit_account_id dr, default_credit_account_id cr FROM account_journal WHERE id IN (:a, :b) AND active', { a: i.journal_id, b: i.destination_journal_id })
  if (js.length !== 2) throw new AppError('journal_id: journal not found or archived')
  for (const j of js) {
    if (!['bank', 'cash'].includes(j.type)) throw new AppError('An internal voucher moves money between bank or cash journals only.')
    if (!j.dr || !j.cr) throw new AppError(`The journal ${j.id} has no default debit/credit account.`)
  }
  if (new Set(js.map(j => j.company_id)).size > 1) throw new AppError('Both journals must belong to the same company.')
  const [row] = await q<{ id: number }>(
    `INSERT INTO account_internal_voucher (amount, currency_id, payment_date, journal_id, destination_journal_id, description, company_id, prepared_by, create_uid, write_uid)
     VALUES (:amt, :cur, :date, :j, :d, :desc, :co, :uid, :uid, :uid) RETURNING id`,
    { amt: amount.toString(), cur: i.currency_id ?? null, date: (i.payment_date ?? new Date().toISOString()).slice(0, 10), j: i.journal_id, d: i.destination_journal_id,
      desc: i.description ?? null, co: js[0].company_id, uid: env.uid })
  return row.id
}

export async function postInternalVoucher(id: number, env: RequestEnv) {
  const [v] = await q<Record<string, any>>('SELECT * FROM account_internal_voucher WHERE id = :id', { id })
  if (!v) throw notFound('Internal voucher')
  if (v.state !== 'draft') throw new AppError('Only a draft internal voucher can be posted.')
  if (v.request_status === 'to_approve') throw new AppError('This voucher is waiting for approval.')
  if (v.request_status === 'rejected') throw new AppError('This voucher was rejected.')
  const [from] = await q<{ cr: number }>('SELECT default_credit_account_id cr FROM account_journal WHERE id = :id', { id: v.journal_id })
  const [to] = await q<{ dr: number }>('SELECT default_debit_account_id dr FROM account_journal WHERE id = :id', { id: v.destination_journal_id })
  const label = v.description ?? 'Internal transfer'
  const moveId = await createMove({
    date: dstr(v.payment_date), journal_id: v.journal_id, ref: label,
    lines: [{ account_id: to.dr, name: label, debit: v.amount, credit: 0 }, { account_id: from.cr, name: label, debit: 0, credit: v.amount }],
  } as never, env)
  const name = await postMove(moveId, env)
  await exec("UPDATE account_internal_voucher SET state = 'posted', name = :n, move_id = :m, write_uid = :u, write_date = now() WHERE id = :id", { n: name, m: moveId, u: env.uid, id })
  return readInternalVoucher(id)
}

export async function cancelInternalVoucher(id: number, env: RequestEnv) {
  const [v] = await q<Record<string, any>>('SELECT * FROM account_internal_voucher WHERE id = :id', { id })
  if (!v) throw notFound('Internal voucher')
  if (v.state === 'cancelled') throw new AppError('The voucher is already cancelled.')
  if (v.state === 'posted') {
    const [j] = await q<{ update_posted: boolean }>('SELECT update_posted FROM account_journal WHERE id = :id', { id: v.journal_id })
    if (!j.update_posted) throw new AppError('You cannot cancel a posted voucher of this journal. First set the journal to allow cancelling entries.')
    await exec('DELETE FROM account_move WHERE id = :m', { m: v.move_id })
  }
  await exec("UPDATE account_internal_voucher SET state = 'cancelled', move_id = NULL, write_uid = :u, write_date = now() WHERE id = :id", { u: env.uid, id })
  return readInternalVoucher(id)
}

export async function readInternalVoucher(id: number) {
  const [v] = await q<Record<string, any>>(
    `SELECT v.*, j.name journal_name, d.name destination_journal_name, m.name move_name
       FROM account_internal_voucher v JOIN account_journal j ON j.id = v.journal_id
       JOIN account_journal d ON d.id = v.destination_journal_id LEFT JOIN account_move m ON m.id = v.move_id WHERE v.id = :id`, { id })
  if (!v) throw notFound('Internal voucher')
  const { journal_name, destination_journal_name, move_name, ...rest } = v
  return { ...rest, journal_id: { id: v.journal_id, name: journal_name }, destination_journal_id: { id: v.destination_journal_id, name: destination_journal_name },
    move_id: v.move_id ? { id: v.move_id, name: move_name } : null }
}

// -------------------------------------------------------- payable voucher ---
/**
 * Vendors > Payable Voucher (att_account_voucher): a vendor payment request, by
 * transfer or cheque. Posting creates and posts a real outbound payment, so the bill
 * it names is reconciled by the normal payment flow.
 */
export interface PayableVoucherInput {
  partner_id?: number; amount?: string | number; date?: string; payment_journal_id?: number
  payment_mode?: 'transfer' | 'cheque'; invoice_id?: number | null; account_id?: number | null
  po_number?: string | null; reference?: string | null; description?: string | null
  cheque_no?: string | null; cheque_prepared_date?: string | null; currency_id?: number | null
}
export async function createPayableVoucher(i: PayableVoucherInput, env: RequestEnv): Promise<number> {
  if (!i.payment_journal_id) throw new AppError('payment_journal_id: is required')
  const [j] = await q<{ type: string; company_id: number }>('SELECT type, company_id FROM account_journal WHERE id = :id AND active', { id: i.payment_journal_id })
  if (!j) throw new AppError('payment_journal_id: journal not found')
  if (!['bank', 'cash'].includes(j.type)) throw new AppError('A payable voucher needs a bank or cash journal.')
  let partner = i.partner_id ?? null, amount = i.amount != null ? D(i.amount) : null
  if (i.invoice_id) {
    const [inv] = await q<Record<string, any>>('SELECT id, move_type, state, partner_id, amount_residual FROM account_move WHERE id = :id', { id: i.invoice_id })
    if (!inv) throw new AppError('invoice_id: bill not found')
    if (inv.move_type !== 'in_invoice') throw new AppError('A payable voucher pays a vendor bill.')
    if (inv.state !== 'posted') throw new AppError('The bill must be posted.')
    partner = partner ?? inv.partner_id
    amount = amount ?? D(inv.amount_residual)
  }
  if (!partner) throw new AppError('partner_id: is required')
  if (!amount || amount.lte(0)) throw new AppError('The amount must be strictly positive.')
  if (i.payment_mode === 'cheque' && !i.cheque_no?.trim()) throw new AppError('A cheque voucher needs a cheque number.')
  const [p] = await q<{ ap: number | null }>('SELECT property_account_payable_id ap FROM res_partner WHERE id = :id', { id: partner })
  const [co] = await q<{ ap: number | null }>('SELECT account_payable_id ap FROM res_company WHERE id = :id', { id: j.company_id })
  const [row] = await q<{ id: number }>(
    `INSERT INTO account_payable_voucher (date, partner_id, amount, currency_id, payment_journal_id, account_id, payment_mode, invoice_id,
       po_number, reference, description, cheque_no, cheque_prepared_date, company_id, prepared_by, create_uid, write_uid)
     VALUES (:date, :partner, :amt, :cur, :j, :acc, :mode, :inv, :po, :ref, :desc, :chq, :chqd, :co, :uid, :uid, :uid) RETURNING id`,
    { date: (i.date ?? new Date().toISOString()).slice(0, 10), partner, amt: amount.toString(), cur: i.currency_id ?? null, j: i.payment_journal_id,
      acc: i.account_id ?? p?.ap ?? co?.ap ?? null, mode: i.payment_mode ?? 'transfer', inv: i.invoice_id ?? null, po: i.po_number ?? null,
      ref: i.reference ?? null, desc: i.description ?? null, chq: i.cheque_no ?? null, chqd: i.cheque_prepared_date ?? null, co: j.company_id, uid: env.uid })
  return row.id
}

export async function postPayableVoucher(id: number, env: RequestEnv) {
  const [v] = await q<Record<string, any>>('SELECT * FROM account_payable_voucher WHERE id = :id', { id })
  if (!v) throw notFound('Payable voucher')
  if (v.state !== 'draft') throw new AppError('Only a draft payable voucher can be posted.')
  if (v.request_status === 'to_approve') throw new AppError('This voucher is waiting for approval.')
  if (v.request_status === 'rejected') throw new AppError('This voucher was rejected.')
  const paymentId = await createPayment({
    payment_type: 'outbound', partner_type: 'supplier', partner_id: v.partner_id, amount: v.amount,
    payment_date: dstr(v.date), journal_id: v.payment_journal_id, destination_account_id: v.account_id,
    payment_method_code: v.payment_mode === 'cheque' ? 'check' : 'manual',
    communication: v.cheque_no ? `Cheque ${v.cheque_no}` : (v.reference ?? v.description ?? undefined),
    invoice_ids: v.invoice_id ? [v.invoice_id] : [],
  }, env)
  const name = await postPayment(paymentId, env)
  await exec("UPDATE account_payable_voucher SET state = 'posted', name = :n, payment_id = :p, write_uid = :u, write_date = now() WHERE id = :id", { n: name, p: paymentId, u: env.uid, id })
  return readPayableVoucher(id)
}

export async function readPayableVoucher(id: number) {
  const [v] = await q<Record<string, any>>(
    `SELECT v.*, p.name partner_name, j.name journal_name, m.name invoice_name, pay.name payment_name
       FROM account_payable_voucher v JOIN res_partner p ON p.id = v.partner_id JOIN account_journal j ON j.id = v.payment_journal_id
       LEFT JOIN account_move m ON m.id = v.invoice_id LEFT JOIN account_payment pay ON pay.id = v.payment_id WHERE v.id = :id`, { id })
  if (!v) throw notFound('Payable voucher')
  const { partner_name, journal_name, invoice_name, payment_name, ...rest } = v
  return { ...rest, partner_id: { id: v.partner_id, name: partner_name }, payment_journal_id: { id: v.payment_journal_id, name: journal_name },
    invoice_id: v.invoice_id ? { id: v.invoice_id, name: invoice_name } : null, payment_id: v.payment_id ? { id: v.payment_id, name: payment_name } : null }
}

// --------------------------------------------- approval shared by vouchers ---
const VOUCHER_TABLES: Record<string, string> = { internal: 'account_internal_voucher', payable: 'account_payable_voucher' }
export async function voucherApproval(kind: 'internal' | 'payable', id: number, action: 'submit' | 'approve' | 'reject' | 'reset', reason: string | null, env: RequestEnv) {
  const table = VOUCHER_TABLES[kind]
  if (!table) throw new AppError('Unknown voucher kind.')
  const [v] = await q<Record<string, any>>(`SELECT * FROM ${table} WHERE id = :id`, { id })
  if (!v) throw notFound('Voucher')
  if (v.state !== 'draft') throw new AppError('Approval only applies to a draft voucher.')
  if (action === 'submit') {
    if (v.request_status === 'to_approve') throw new AppError('This voucher is already waiting for approval.')
    await exec(`UPDATE ${table} SET request_status = 'to_approve', prepared_by = COALESCE(prepared_by, :uid), reject_reason = NULL, write_uid = :uid WHERE id = :id`, { uid: env.uid, id })
  } else if (action === 'approve') {
    if (v.request_status !== 'to_approve') throw new AppError('Only a voucher waiting for approval can be approved.')
    if (v.prepared_by && env.uid && v.prepared_by === env.uid) throw new AppError('You cannot approve a voucher you prepared yourself.')
    await exec(`UPDATE ${table} SET request_status = 'approved', approved_by = :uid, reject_reason = NULL, write_uid = :uid WHERE id = :id`, { uid: env.uid, id })
  } else if (action === 'reject') {
    if (v.request_status !== 'to_approve') throw new AppError('Only a voucher waiting for approval can be rejected.')
    if (!reason?.trim()) throw new AppError('A rejection reason is required.')
    await exec(`UPDATE ${table} SET request_status = 'rejected', approved_by = :uid, reject_reason = :r, write_uid = :uid WHERE id = :id`, { uid: env.uid, r: reason.trim(), id })
  } else {
    await exec(`UPDATE ${table} SET request_status = 'not_required', approved_by = NULL, reject_reason = NULL, write_uid = :uid WHERE id = :id`, { uid: env.uid, id })
  }
  return kind === 'internal' ? readInternalVoucher(id) : readPayableVoucher(id)
}

// ------------------------------------------------------- tax adjustments ---
/**
 * Accounting > Tax Adjustments: a miscellaneous entry that moves an amount onto a tax
 * account and tags it with the tax, so it shows in the tax report.
 */
export async function taxAdjustment(i: { date?: string; journal_id?: number; tax_id?: number; account_id?: number; counterpart_account_id?: number; amount?: string | number; reason?: string }, env: RequestEnv) {
  if (!i.tax_id || !i.account_id || !i.counterpart_account_id) throw new AppError('tax_id, account_id and counterpart_account_id are required.')
  const amount = D(i.amount)
  if (amount.isZero()) throw new AppError('The adjustment amount cannot be zero.')
  const [tax] = await q<{ company_id: number; name: string }>('SELECT company_id, name FROM account_tax WHERE id = :id', { id: i.tax_id })
  if (!tax) throw new AppError('tax_id: tax not found')
  const journal = i.journal_id ?? (await defaultJournal(tax.company_id, 'general'))
  const date = i.date ?? new Date().toISOString().slice(0, 10)
  const label = i.reason?.trim() || `Tax adjustment - ${tax.name}`
  const debitFirst = amount.gt(0)
  const abs = amount.abs().toString()
  const moveId = await createMove({
    date, journal_id: journal, ref: label,
    lines: [
      { account_id: i.account_id, name: label, debit: debitFirst ? abs : 0, credit: debitFirst ? 0 : abs },
      { account_id: i.counterpart_account_id, name: label, debit: debitFirst ? 0 : abs, credit: debitFirst ? abs : 0 },
    ],
  } as never, env)
  // tag the tax line so the tax report picks it up
  const [line] = await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a ORDER BY id LIMIT 1', { m: moveId, a: i.account_id })
  await exec('UPDATE account_move_line SET tax_line_id = :t, tax_base_amount = 0 WHERE id = :id', { t: i.tax_id, id: line.id })
  await postMove(moveId, env)
  return readMove(moveId)
}
