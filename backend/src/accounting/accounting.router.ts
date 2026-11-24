import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { AppError, handle, likeEscape, notFound, ok, paging } from '../common.helper'
import { crudRouter, q } from './crud'
import * as cfg from './config.entities'
import * as pay from './payment.service'
import * as bank from './bank.service'
import * as rep from './reports.service'
import * as inv from './invoicing.service'
import * as asset from './asset.service'
import * as extras from './extras.service'
import { importStatement } from './bank-import.service'
import { MOVE_TYPES, previewTotals, cancelMove, createMove, deleteMove, postMove, readMove, reconcileLines, resetToDraft, reverseMove, unreconcileLines, updateMove } from './move.service'

/** /v2 accounting routes. Reporting is a later phase and is not mounted. */
const lineSchema = z.object({
  account_id: z.coerce.number().int().optional(), name: z.string().nullish(), partner_id: z.coerce.number().int().nullish(),
  debit: z.union([z.string(), z.number()]).optional(), credit: z.union([z.string(), z.number()]).optional(),
  amount_currency: z.union([z.string(), z.number()]).optional(), currency_id: z.coerce.number().int().nullish(),
  date_maturity: z.string().nullish(), ref: z.string().nullish(),
  quantity: z.union([z.string(), z.number()]).optional(), price_unit: z.union([z.string(), z.number()]).optional(), discount: z.union([z.string(), z.number()]).optional(),
  product_id: z.coerce.number().int().nullish(), product_uom_id: z.coerce.number().int().nullish(),
  tax_ids: z.array(z.coerce.number().int()).optional(), display_type: z.enum(['line_section', 'line_note']).nullish(),
  analytic_account_id: z.coerce.number().int().nullish(),
}).strip()
const moveSchema = z.object({
  move_type: z.enum(MOVE_TYPES).optional(), date: z.string().optional(), journal_id: z.coerce.number().int().optional(),
  partner_id: z.coerce.number().int().nullish(), ref: z.string().nullish(), narration: z.string().nullish(), currency_id: z.coerce.number().int().nullish(),
  invoice_date: z.string().nullish(), invoice_date_due: z.string().nullish(), invoice_origin: z.string().nullish(),
  invoice_payment_term_id: z.coerce.number().int().nullish(), fiscal_position_id: z.coerce.number().int().nullish(),
  auto_reverse: z.boolean().optional(), reverse_date: z.string().nullish(), lines: z.array(lineSchema).optional(),
  // the extra columns (invoice_category, contract_amount, po_number, ...) pass through; createMove only reads its own whitelist (MOVE_EXTRA_COLS)
}).passthrough()
const idsSchema = z.object({ line_ids: z.array(z.coerce.number().int()).min(1) })
const reverseSchema = z.object({ date: z.string().optional(), ref: z.string().optional(), post: z.boolean().optional(), journal_id: z.coerce.number().int().optional() })

const moves = Router()
moves.param('id', (_r, _s, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound('Journal entry')))

moves.get('/', handle(async (req: Request, res: Response) => {
  const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
  const where: string[] = []; const rep: Record<string, unknown> = {}
  const f = req.query as Record<string, string>
  if (f.q) { where.push('(m.name ILIKE :q OR m.ref ILIKE :q OR p.name ILIKE :q)'); rep.q = `%${likeEscape(f.q)}%` }
  if (f.state) { where.push('m.state = :state'); rep.state = f.state }
  if (f.journal_id) { where.push('m.journal_id = :j'); rep.j = f.journal_id }
  if (f.partner_id) { where.push('m.partner_id = :pa'); rep.pa = f.partner_id }
  if (f.move_type) { where.push('m.move_type = :mt'); rep.mt = f.move_type }
  if (f.kind === 'invoices') where.push("m.move_type <> 'entry'")
  if (f.payment_state) { where.push('m.payment_state = :ps'); rep.ps = f.payment_state }
  if (f.unpaid === '1') where.push("m.state = 'posted' AND m.payment_state IN ('not_paid', 'partial') AND m.amount_residual > 0")
  if (f.invoice_category) { where.push('m.invoice_category = :ic'); rep.ic = f.invoice_category }
  if (f.request_status) { where.push('m.request_status = :rs'); rep.rs = f.request_status }
  if (f.date_from) { where.push('m.date >= :df'); rep.df = f.date_from }
  if (f.date_to) { where.push('m.date <= :dt'); rep.dt = f.date_to }
  const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
  if (cids.length) { where.push('m.company_id IN (:cids)'); rep.cids = cids }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const from = `FROM account_move m JOIN account_journal j ON j.id = m.journal_id LEFT JOIN res_partner p ON p.id = m.partner_id ${w}`
  const rows = await q<Record<string, any>>(`SELECT m.id, m.name, m.ref, m.date, m.state, m.move_type, m.amount, m.amount_total, m.amount_residual, m.payment_state, m.invoice_date, m.invoice_date_due, m.invoice_category, m.request_status, m.po_number,
      m.journal_id, j.name journal_name, m.partner_id, p.name partner_name ${from} ORDER BY m.date DESC, m.id DESC LIMIT :limit OFFSET :offset`, { ...rep, limit, offset })
  const [{ n }] = await q<{ n: string }>(`SELECT count(*) n ${from}`, rep)
  return ok(res, { records: rows.map(({ journal_name, partner_name, ...r }) => ({ ...r, journal_id: { id: r.journal_id, name: journal_name }, partner_id: r.partner_id ? { id: r.partner_id, name: partner_name } : null })), total: Number(n), page, limit })
}))
moves.get('/:id', handle(async (req: Request, res: Response) => ok(res, await readMove(Number(req.params.id)))))
moves.post('/', handle(async (req: Request, res: Response) => {
  const id = await createMove(moveSchema.parse(req.body) as never, req.env)
  return ok(res, await readMove(id), 'Journal entry created', 201)
}))
moves.put('/:id', handle(async (req: Request, res: Response) => {
  await updateMove(Number(req.params.id), moveSchema.parse(req.body) as never, req.env)
  return ok(res, await readMove(Number(req.params.id)), 'Journal entry updated')
}))
moves.post('/:id/post', handle(async (req: Request, res: Response) => {
  const name = await postMove(Number(req.params.id), req.env)
  return ok(res, { id: Number(req.params.id), name, state: 'posted' }, 'Entry posted')
}))
moves.post('/:id/cancel', handle(async (req: Request, res: Response) => { await cancelMove(Number(req.params.id), req.env); return ok(res, { id: Number(req.params.id), state: 'cancel' }, 'Entry cancelled') }))
moves.post('/:id/draft', handle(async (req: Request, res: Response) => { await resetToDraft(Number(req.params.id), req.env); return ok(res, { id: Number(req.params.id), state: 'draft' }, 'Entry set to draft') }))
moves.post('/:id/reverse', handle(async (req: Request, res: Response) => {
  const id = await reverseMove(Number(req.params.id), reverseSchema.parse(req.body ?? {}), req.env)
  return ok(res, await readMove(id), 'Entry reversed', 201)
}))
moves.delete('/:id', handle(async (req: Request, res: Response) => { await deleteMove(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Journal entry deleted') }))

// ---------------------------------------------------------- journal items ---
const items = Router()
items.get('/', handle(async (req: Request, res: Response) => {
  const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
  const f = req.query as Record<string, string>
  const where = ["m.state = 'posted'"]; const rep: Record<string, unknown> = {}
  if (f.account_id) { where.push('l.account_id = :a'); rep.a = f.account_id }
  if (f.partner_id) { where.push('l.partner_id = :p'); rep.p = f.partner_id }
  if (f.journal_id) { where.push('l.journal_id = :j'); rep.j = f.journal_id }
  if (f.reconciled !== undefined) { where.push('l.reconciled = :r'); rep.r = f.reconciled === 'true' }
  if (f.unreconciled_only === '1') where.push('l.reconciled = false AND l.amount_residual <> 0 AND a.reconcile')
  if (f.account_type) { where.push('a.internal_type = :at'); rep.at = f.account_type }
  if (f.exclude_move) { where.push('l.move_id <> :xm'); rep.xm = f.exclude_move }
  if (f.date_from) { where.push('l.date >= :df'); rep.df = f.date_from }
  if (f.date_to) { where.push('l.date <= :dt'); rep.dt = f.date_to }
  const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
  if (cids.length) { where.push('l.company_id IN (:cids)'); rep.cids = cids }
  const from = `FROM account_move_line l JOIN account_move m ON m.id = l.move_id JOIN account_account a ON a.id = l.account_id LEFT JOIN res_partner p ON p.id = l.partner_id WHERE ${where.join(' AND ')}`
  const rows = await q<Record<string, any>>(`SELECT l.id, l.move_id, m.name move_name, l.date, l.name, l.ref, l.account_id, a.code account_code, l.partner_id, p.name partner_name, l.debit, l.credit, l.balance,
      l.amount_residual, l.reconciled, l.full_reconcile_id, l.date_maturity ${from} ORDER BY l.date DESC, l.id DESC LIMIT :limit OFFSET :offset`, { ...rep, limit, offset })
  const [{ n }] = await q<{ n: string }>(`SELECT count(*) n ${from}`, rep)
  return ok(res, { records: rows, total: Number(n), page, limit })
}))
items.post('/reconcile', handle(async (req: Request, res: Response) => ok(res, await reconcileLines(idsSchema.parse(req.body).line_ids, req.env), 'Reconciled')))
items.post('/unreconcile', handle(async (req: Request, res: Response) => { await unreconcileLines(idsSchema.parse(req.body).line_ids); return ok(res, {}, 'Unreconciled') }))

// ------------------------------------------------------------ router mount ---
const lockSchema = z.object({ fiscalyear_lock_date: z.string().nullable().optional(), period_lock_date: z.string().nullable().optional(), tax_lock_date: z.string().nullable().optional() })
const settings = Router()
settings.get('/', handle(async (req: Request, res: Response) => {
  if (!req.env.companyId) throw new AppError('Send X-Company-Id.')
  const [row] = await q('SELECT id, currency_exchange_journal_id, tax_cash_basis_journal_id, fiscalyear_lock_date, period_lock_date, tax_lock_date, fiscalyear_last_day, fiscalyear_last_month, account_receivable_id, account_payable_id, income_account_id, expense_account_id, (SELECT t.id FROM account_tax t WHERE t.id = res_company.default_sale_tax_id AND t.active) AS default_sale_tax_id, (SELECT t.id FROM account_tax t WHERE t.id = res_company.default_purchase_tax_id AND t.active) AS default_purchase_tax_id FROM res_company WHERE id = :id', { id: req.env.companyId })
  if (!row) throw notFound('Company')
  return ok(res, row)
}))
settings.put('/', handle(async (req: Request, res: Response) => {
  if (!req.env.companyId) throw new AppError('Send X-Company-Id.')
  const b = { ...lockSchema.parse(req.body), ...Object.fromEntries(['account_receivable_id', 'account_payable_id', 'income_account_id', 'expense_account_id', 'default_sale_tax_id', 'default_purchase_tax_id', 'fiscalyear_last_day', 'fiscalyear_last_month', 'currency_exchange_journal_id', 'tax_cash_basis_journal_id'].filter(k => k in (req.body ?? {})).map(k => [k, req.body[k]])) }
  const keys = Object.keys(b)
  if (!keys.length) throw new AppError('Nothing to update.')
  await q(`UPDATE res_company SET ${keys.map(k => `${k} = :${k}`).join(', ')} WHERE id = :id RETURNING id`, { ...b, id: req.env.companyId })
  return ok(res, b, 'Accounting settings updated')
}))


// ---------------------------------------------------------------- payments ---
const paymentSchema = z.object({
  payment_type: z.enum(['inbound', 'outbound']).optional(), partner_type: z.enum(['customer', 'supplier']).optional(), partner_id: z.coerce.number().int().optional(),
  amount: z.union([z.string(), z.number()]).nullish(), payment_date: z.string().nullish(), communication: z.string().nullish(), journal_id: z.coerce.number().int().optional(),
  payment_method_code: z.string().optional(), destination_account_id: z.coerce.number().int().nullish(), invoice_ids: z.array(z.coerce.number().int()).optional(),
}).strip()
const readPayment = async (id: number) => {
  const [p] = await q<Record<string, any>>(`SELECT p.*, pa.name partner_name, j.name journal_name FROM account_payment p JOIN account_journal j ON j.id = p.journal_id LEFT JOIN res_partner pa ON pa.id = p.partner_id WHERE p.id = :id`, { id })
  if (!p) throw notFound('Payment')
  const invs = await q<{ id: number; name: string; amount_residual: string; payment_state: string }>('SELECT m.id, m.name, m.amount_residual, m.payment_state FROM account_invoice_payment_rel r JOIN account_move m ON m.id = r.invoice_id WHERE r.payment_id = :id', { id })
  const { partner_name, journal_name, ...rest } = p
  // the payment's own journal entry and every document it ended up reconciled with (also matches made later, in Journal Items)
  const entry = p.move_id ? await readMove(p.move_id) : null
  return {
    ...rest, partner_id: p.partner_id ? { id: p.partner_id, name: partner_name } : null, journal_id: { id: p.journal_id, name: journal_name }, invoice_ids: invs,
    move_id: entry ? { id: entry.id, name: entry.name } : null,
    entry_lines: entry?.lines ?? [], reconciled_items: entry?.reconciled_items ?? [],
  }
}
const payments = Router()
payments.param('id', (_r, _s, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound('Payment')))
payments.get('/', handle(async (req: Request, res: Response) => {
  const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
  const f = req.query as Record<string, string>; const where: string[] = []; const rep2: Record<string, unknown> = {}
  if (f.state) { where.push('p.state = :st'); rep2.st = f.state }
  if (f.payment_type) { where.push('p.payment_type = :pt'); rep2.pt = f.payment_type }
  if (f.partner_id) { where.push('p.partner_id = :pa'); rep2.pa = f.partner_id }
  if (f.q) { where.push('(p.name ILIKE :q OR p.communication ILIKE :q OR pa.name ILIKE :q)'); rep2.q = `%${likeEscape(f.q)}%` }
  const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
  if (cids.length) { where.push('p.company_id IN (:cids)'); rep2.cids = cids }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const from = `FROM account_payment p LEFT JOIN res_partner pa ON pa.id = p.partner_id ${w}`
  const rows = await q<Record<string, any>>(`SELECT p.id, p.name, p.state, p.payment_type, p.partner_type, p.partner_id, pa.name partner_name, p.amount, p.payment_date, p.communication, p.journal_id ${from} ORDER BY p.payment_date DESC, p.id DESC LIMIT :limit OFFSET :offset`, { ...rep2, limit, offset })
  const [{ n }] = await q<{ n: string }>(`SELECT count(*) n ${from}`, rep2)
  return ok(res, { records: rows.map(({ partner_name, ...r }) => ({ ...r, partner_id: r.partner_id ? { id: r.partner_id, name: partner_name } : null })), total: Number(n), page, limit })
}))
payments.get('/:id', handle(async (req: Request, res: Response) => ok(res, await readPayment(Number(req.params.id)))))
payments.post('/', handle(async (req: Request, res: Response) => {
  const body = paymentSchema.parse(req.body)
  const id = await pay.createPayment(body as never, req.env)
  if (req.query.post === '1') await pay.postPayment(id, req.env)
  return ok(res, await readPayment(id), 'Payment created', 201)
}))
payments.post('/:id/post', handle(async (req: Request, res: Response) => { const name = await pay.postPayment(Number(req.params.id), req.env); return ok(res, await readPayment(Number(req.params.id)), `Payment ${name} posted`) }))
payments.post('/:id/cancel', handle(async (req: Request, res: Response) => { await pay.cancelPayment(Number(req.params.id), req.env); return ok(res, await readPayment(Number(req.params.id)), 'Payment cancelled') }))
payments.post('/:id/draft', handle(async (req: Request, res: Response) => { await pay.resetPaymentToDraft(Number(req.params.id), req.env); return ok(res, await readPayment(Number(req.params.id)), 'Payment set to draft') }))
payments.delete('/:id', handle(async (req: Request, res: Response) => { await pay.deletePayment(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Payment deleted') }))

// ---------------------------------------------------------- bank statements ---
const stmtLine = z.object({ date: z.string(), name: z.string().min(1), amount: z.union([z.string(), z.number()]), partner_id: z.coerce.number().int().nullish(), ref: z.string().nullish(), note: z.string().nullish() })
const stmtSchema = z.object({ name: z.string().optional(), reference: z.string().nullish(), date: z.string().optional(), journal_id: z.coerce.number().int().optional(), balance_start: z.union([z.string(), z.number()]).optional(), balance_end_real: z.union([z.string(), z.number()]).optional(), lines: z.array(stmtLine).optional() })
const bookSchema = z.object({ move_line_ids: z.array(z.coerce.number().int()).optional(), account_id: z.coerce.number().int().optional(), writeoff: z.object({ account_id: z.coerce.number().int(), name: z.string().optional() }).optional() })
const statements = Router()
statements.param('id', (_r, _s, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound('Bank statement')))
statements.get('/', handle(async (req: Request, res: Response) => {
  const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
  const f = req.query as Record<string, string>; const where: string[] = []; const r2: Record<string, unknown> = {}
  if (f.state) { where.push('s.state = :st'); r2.st = f.state }
  if (f.journal_id) { where.push('s.journal_id = :j'); r2.j = f.journal_id }
  const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
  if (cids.length) { where.push('s.company_id IN (:cids)'); r2.cids = cids }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const rows = await q<Record<string, any>>(`SELECT s.id, s.name, s.date, s.state, s.journal_id, j.name journal_name, s.balance_start, s.balance_end_real,
      s.balance_start + COALESCE((SELECT sum(amount) FROM account_bank_statement_line WHERE statement_id = s.id), 0) balance_end,
      (SELECT count(*) FROM account_bank_statement_line WHERE statement_id = s.id) line_count, (SELECT count(*) FROM account_bank_statement_line WHERE statement_id = s.id AND move_id IS NULL) unreconciled
      FROM account_bank_statement s JOIN account_journal j ON j.id = s.journal_id ${w} ORDER BY s.date DESC, s.id DESC LIMIT :limit OFFSET :offset`, { ...r2, limit, offset })
  const [{ n }] = await q<{ n: string }>(`SELECT count(*) n FROM account_bank_statement s ${w}`, r2)
  return ok(res, { records: rows.map(({ journal_name, ...r }) => ({ ...r, journal_id: { id: r.journal_id, name: journal_name } })), total: Number(n), page, limit })
}))
statements.get('/:id', handle(async (req: Request, res: Response) => ok(res, await bank.readStatement(Number(req.params.id)))))
statements.post('/', handle(async (req: Request, res: Response) => ok(res, await bank.readStatement(await bank.createStatement(stmtSchema.parse(req.body) as never, req.env)), 'Bank statement created', 201)))
statements.post('/:id/lines', handle(async (req: Request, res: Response) => { await bank.addStatementLine(Number(req.params.id), stmtLine.parse(req.body) as never, req.env); return ok(res, await bank.readStatement(Number(req.params.id)), 'Line added', 201) }))
statements.post('/:id/confirm', handle(async (req: Request, res: Response) => { await bank.confirmStatement(Number(req.params.id), req.env); return ok(res, await bank.readStatement(Number(req.params.id)), 'Statement confirmed') }))
statements.post('/:id/reopen', handle(async (req: Request, res: Response) => { await bank.reopenStatement(Number(req.params.id), req.env); return ok(res, await bank.readStatement(Number(req.params.id)), 'Statement reopened') }))
statements.delete('/:id', handle(async (req: Request, res: Response) => { await bank.deleteStatement(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Bank statement deleted') }))

const stmtLines = Router()
stmtLines.param('id', (_r, _s, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound('Statement line')))
stmtLines.post('/:id/reconcile', handle(async (req: Request, res: Response) => ok(res, { move_id: await bank.bookStatementLine(Number(req.params.id), bookSchema.parse(req.body ?? {}), req.env) }, 'Statement line reconciled')))
stmtLines.post('/:id/unreconcile', handle(async (req: Request, res: Response) => { await bank.unbookStatementLine(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Statement line unreconciled') }))
stmtLines.delete('/:id', handle(async (req: Request, res: Response) => { await bank.removeStatementLine(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Statement line deleted') }))

// ----------------------------------------------------------------- reports ---
const reports = Router()
const filt = (req: Request): rep.Filter => {
  const f = req.query as Record<string, string>
  const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
  const d = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  return { companyIds: cids, date_from: d(f.date_from), date_to: d(f.date_to), target_move: f.target_move === 'all' ? 'all' : 'posted',
    account_id: f.account_id ? Number(f.account_id) : undefined, partner_id: f.partner_id ? Number(f.partner_id) : undefined, journal_id: f.journal_id ? Number(f.journal_id) : undefined }
}
reports.get('/', handle(async (_req: Request, res: Response) => ok(res, rep.REPORT_CATALOG)))
reports.get('/trial-balance', handle(async (req: Request, res: Response) => ok(res, await rep.trialBalance(filt(req)))))
reports.get('/general-ledger', handle(async (req: Request, res: Response) => ok(res, await rep.generalLedger(filt(req), Number(req.query.page) || 1, Math.min(Number(req.query.limit) || 200, 1000)))))
reports.get('/partner-ledger', handle(async (req: Request, res: Response) => ok(res, await rep.partnerLedger({ ...filt(req), detail: req.query.detail === '1' || !!req.query.partner_id }, (['receivable', 'payable'].includes(String(req.query.kind)) ? req.query.kind : 'both') as never))))
reports.get('/aged-receivable', handle(async (req: Request, res: Response) => ok(res, await rep.agedBalance(filt(req), 'receivable'))))
reports.get('/aged-payable', handle(async (req: Request, res: Response) => ok(res, await rep.agedBalance(filt(req), 'payable'))))
reports.get('/profit-loss', handle(async (req: Request, res: Response) => ok(res, await rep.profitAndLoss(filt(req)))))
reports.get('/balance-sheet', handle(async (req: Request, res: Response) => ok(res, await rep.balanceSheet(filt(req)))))
reports.get('/tax-report', handle(async (req: Request, res: Response) => ok(res, await rep.taxReport(filt(req)))))
reports.get('/journal-summary', handle(async (req: Request, res: Response) => ok(res, await rep.journalSummary(filt(req)))))

// ------------------------------------------------------- invoicing flows ---
// Approval, proforma, progressive, tax adjustment live under /moves because they act on a move.
moves.post('/:id/submit-approval', handle(async (req: Request, res: Response) => ok(res, await inv.submitBillForApproval(Number(req.params.id), req.env), 'Bill sent for approval')))
moves.post('/:id/approve', handle(async (req: Request, res: Response) => ok(res, await inv.approveBill(Number(req.params.id), { post: !!req.body?.post }, req.env), 'Bill approved')))
moves.post('/:id/reject', handle(async (req: Request, res: Response) => ok(res, await inv.rejectBill(Number(req.params.id), String(req.body?.reason ?? ''), req.env), 'Bill rejected')))
moves.post('/:id/reset-approval', handle(async (req: Request, res: Response) => ok(res, await inv.resetBillApproval(Number(req.params.id), req.env), 'Approval reset')))
moves.post('/:id/convert-proforma', handle(async (req: Request, res: Response) => ok(res, await inv.convertProforma(Number(req.params.id), z.object({ journal_id: z.coerce.number().int().optional(), date: z.string().optional(), post: z.boolean().optional() }).parse(req.body ?? {}), req.env), 'Proforma converted to a tax invoice', 201)))
moves.post('/:id/progressive-next', handle(async (req: Request, res: Response) => ok(res, await inv.progressiveNext(Number(req.params.id), z.object({ progress_percentage: z.union([z.string(), z.number()]), date: z.string().optional(), retainage_percentage: z.union([z.string(), z.number()]).optional(), post: z.boolean().optional() }).parse(req.body ?? {}) as never, req.env), 'Progressive invoice created', 201)))
moves.post('/tax-adjustment', handle(async (req: Request, res: Response) => ok(res, await inv.taxAdjustment(z.object({ date: z.string().optional(), journal_id: z.coerce.number().int().optional(), tax_id: z.coerce.number().int(), account_id: z.coerce.number().int(), counterpart_account_id: z.coerce.number().int(), amount: z.union([z.string(), z.number()]), reason: z.string().optional() }).parse(req.body ?? {}), req.env), 'Tax adjustment posted', 201)))

const voucherRoutes = (kind: 'internal' | 'payable') => {
  const r = Router()
  const table = kind === 'internal' ? 'account_internal_voucher' : 'account_payable_voucher'
  const label = kind === 'internal' ? 'Internal voucher' : 'Payable voucher'
  const read = (id: number) => (kind === 'internal' ? inv.readInternalVoucher(id) : inv.readPayableVoucher(id))
  r.param('id', (_rq, _rs, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound(label)))
  r.get('/', handle(async (req: Request, res: Response) => {
    const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
    const f = req.query as Record<string, string>; const where: string[] = []; const rp: Record<string, unknown> = {}
    if (f.state) { where.push('v.state = :st'); rp.st = f.state }
    if (f.request_status) { where.push('v.request_status = :rs'); rp.rs = f.request_status }
    if (f.q) { where.push('v.name ILIKE :q'); rp.q = `%${likeEscape(f.q)}%` }
    const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
    if (cids.length) { where.push('v.company_id IN (:cids)'); rp.cids = cids }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const sel = kind === 'internal'
      ? `SELECT v.id, v.name, v.amount, v.payment_date AS date, v.state, v.request_status, j.name journal_name, d.name destination_name FROM account_internal_voucher v JOIN account_journal j ON j.id = v.journal_id JOIN account_journal d ON d.id = v.destination_journal_id`
      : `SELECT v.id, v.name, v.amount, v.date, v.state, v.request_status, v.payment_mode, p.name partner_name, j.name journal_name FROM account_payable_voucher v JOIN res_partner p ON p.id = v.partner_id JOIN account_journal j ON j.id = v.payment_journal_id`
    const rows = await q(`${sel} ${w} ORDER BY date DESC, v.id DESC LIMIT :limit OFFSET :offset`, { ...rp, limit, offset })
    const [{ n }] = await q<{ n: string }>(`SELECT count(*) n FROM ${table} v ${w}`, rp)
    return ok(res, { records: rows, total: Number(n), page, limit })
  }))
  r.get('/:id', handle(async (req: Request, res: Response) => ok(res, await read(Number(req.params.id)))))
  r.post('/', handle(async (req: Request, res: Response) => {
    const id = kind === 'internal' ? await inv.createInternalVoucher(req.body ?? {}, req.env) : await inv.createPayableVoucher(req.body ?? {}, req.env)
    return ok(res, await read(id), `${label} created`, 201)
  }))
  r.post('/:id/post', handle(async (req: Request, res: Response) => ok(res, kind === 'internal' ? await inv.postInternalVoucher(Number(req.params.id), req.env) : await inv.postPayableVoucher(Number(req.params.id), req.env), `${label} posted`)))
  if (kind === 'internal') r.post('/:id/cancel', handle(async (req: Request, res: Response) => ok(res, await inv.cancelInternalVoucher(Number(req.params.id), req.env), `${label} cancelled`)))
  for (const action of ['submit', 'approve', 'reject', 'reset'] as const)
    r.post(`/:id/${action}`, handle(async (req: Request, res: Response) => ok(res, await inv.voucherApproval(kind, Number(req.params.id), action, req.body?.reason ?? null, req.env), `${label}: ${action}`)))
  r.delete('/:id', handle(async (req: Request, res: Response) => {
    const [v] = await q<{ state: string }>(`SELECT state FROM ${table} WHERE id = :id`, { id: req.params.id })
    if (!v) throw notFound(label)
    if (v.state !== 'draft') throw new AppError(`Only a draft ${label.toLowerCase()} can be deleted.`)
    await q(`DELETE FROM ${table} WHERE id = :id RETURNING id`, { id: req.params.id })
    return ok(res, { id: Number(req.params.id) }, `${label} deleted`)
  }))
  return r
}

// ------------------------------------------------------------------ assets ---
const assets = Router()
assets.param('id', (_r, _s, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound('Asset')))
assets.get('/', handle(async (req: Request, res: Response) => {
  const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
  const f = req.query as Record<string, string>; const where: string[] = []; const rp: Record<string, unknown> = {}
  if (f.state) { where.push('a.state = :st'); rp.st = f.state }
  if (f.category_id) { where.push('a.category_id = :c'); rp.c = f.category_id }
  if (f.q) { where.push('(a.name ILIKE :q OR a.code ILIKE :q)'); rp.q = `%${likeEscape(f.q)}%` }
  const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
  if (cids.length) { where.push('a.company_id IN (:cids)'); rp.cids = cids }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const from = `FROM account_asset_asset a JOIN account_asset_category c ON c.id = a.category_id ${w}`
  const rows = await q<Record<string, any>>(`SELECT a.id, a.name, a.code, a.state, a.date, a.value, a.salvage_value, a.category_id, c.name category_name,
      COALESCE((SELECT sum(l.amount) FROM account_asset_depreciation_line l WHERE l.asset_id = a.id AND l.move_check), 0) depreciated_value ${from} ORDER BY a.date DESC, a.id DESC LIMIT :limit OFFSET :offset`, { ...rp, limit, offset })
  const [{ n }] = await q<{ n: string }>(`SELECT count(*) n ${from}`, rp)
  return ok(res, { records: rows.map(({ category_name, ...r }) => ({ ...r, book_value: String(Number(r.value) - Number(r.depreciated_value)), category_id: { id: r.category_id, name: category_name } })), total: Number(n), page, limit })
}))
assets.post('/generate-entries', handle(async (req: Request, res: Response) => ok(res, await asset.generateAssetEntries({ asset_id: req.body?.asset_id, date: req.body?.date, company_ids: req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : undefined }, req.env), 'Asset entries generated')))
assets.get('/:id', handle(async (req: Request, res: Response) => ok(res, await asset.readAsset(Number(req.params.id)))))
assets.post('/', handle(async (req: Request, res: Response) => ok(res, await asset.readAsset(await asset.createAsset(req.body ?? {}, req.env)), 'Asset created', 201)))
assets.put('/:id', handle(async (req: Request, res: Response) => ok(res, await asset.updateAsset(Number(req.params.id), req.body ?? {}, req.env), 'Asset updated')))
assets.post('/:id/confirm', handle(async (req: Request, res: Response) => ok(res, await asset.confirmAsset(Number(req.params.id), req.env), 'Asset confirmed')))
assets.post('/:id/draft', handle(async (req: Request, res: Response) => ok(res, await asset.setAssetToDraft(Number(req.params.id), req.env), 'Asset set to draft')))
assets.post('/:id/close', handle(async (req: Request, res: Response) => ok(res, await asset.closeAsset(Number(req.params.id), req.env), 'Asset closed')))
assets.post('/:id/compute-board', handle(async (req: Request, res: Response) => { await asset.computeBoard(Number(req.params.id)); return ok(res, await asset.readAsset(Number(req.params.id)), 'Depreciation board recomputed') }))
assets.delete('/:id', handle(async (req: Request, res: Response) => { await asset.deleteAsset(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Asset deleted') }))

// ------------------------------------------------------------------ lookups ---
// Pickers for the document forms. Products come back as VARIANT ids (product_product), the id invoice lines store.
const lookups = Router()
lookups.get('/products', handle(async (req: Request, res: Response) => {
  const f = req.query as Record<string, string>
  const lim = Math.min(Number(f.limit) || 20, 100)
  const where: string[] = ['t.active AND p.active']; const rp: Record<string, unknown> = { lim }
  if (f.q) { where.push('(t.name ILIKE :q OR t.default_code ILIKE :q OR p.barcode ILIKE :q)'); rp.q = `%${likeEscape(f.q)}%` }
  if (f.id) { where.push('p.id = :id'); rp.id = f.id }
  if (f.use === 'sale') where.push('t.sale_ok')
  if (f.use === 'purchase') where.push('t.purchase_ok')
  const rows = await q<Record<string, any>>(`SELECT p.id, t.name, t.default_code, t.list_price, t.standard_price, t.uom_id, u.name uom_name, t.type
      FROM product_product p JOIN product_template t ON t.id = p.product_tmpl_id LEFT JOIN uom_uom u ON u.id = t.uom_id
      WHERE ${where.join(' AND ')} ORDER BY t.name LIMIT :lim`, rp)
  return ok(res, rows.map(r => ({ id: r.id, name: r.default_code ? `[${r.default_code}] ${r.name}` : r.name, price_sale: r.list_price, price_cost: r.standard_price, uom_id: r.uom_id, uom_name: r.uom_name, type: r.type })))
}))

// ---------------------------------------------------------- analytic items ---
const analyticLines = Router()
analyticLines.get('/', handle(async (req: Request, res: Response) => {
  const { limit, offset, page } = paging(req.query as Record<string, unknown>, 80, 500)
  const f = req.query as Record<string, string>; const where: string[] = []; const rp: Record<string, unknown> = {}
  if (f.account_id) { where.push('l.account_id = :a'); rp.a = f.account_id }
  if (f.partner_id) { where.push('l.partner_id = :p'); rp.p = f.partner_id }
  if (f.date_from) { where.push('l.date >= :df'); rp.df = f.date_from }
  if (f.date_to) { where.push('l.date <= :dt'); rp.dt = f.date_to }
  if (f.q) { where.push('(l.name ILIKE :q OR l.ref ILIKE :q)'); rp.q = `%${likeEscape(f.q)}%` }
  const cids = req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []
  if (cids.length) { where.push('l.company_id IN (:cids)'); rp.cids = cids }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
  const from = `FROM account_analytic_line l JOIN account_analytic_account a ON a.id = l.account_id LEFT JOIN account_account g ON g.id = l.general_account_id LEFT JOIN res_partner p ON p.id = l.partner_id ${w}`
  const rows = await q<Record<string, any>>(`SELECT l.id, l.date, l.name, l.ref, l.amount, l.unit_amount, l.account_id, a.name analytic_name, g.code general_code, g.name general_name, l.partner_id, p.name partner_name ${from} ORDER BY l.date DESC, l.id DESC LIMIT :limit OFFSET :offset`, { ...rp, limit, offset })
  const [{ n }] = await q<{ n: string }>(`SELECT count(*) n ${from}`, rp)
  return ok(res, { records: rows, total: Number(n), page, limit })
}))

// ------------------------------------------------ preview, import, notes, dashboard ---
moves.post('/preview', handle(async (req: Request, res: Response) => ok(res, await previewTotals(moveSchema.parse(req.body ?? {}) as never, req.env))))
statements.post('/import', handle(async (req: Request, res: Response) => ok(res, await importStatement(req.body ?? {}, req.env), 'Statement imported', 201)))

const records = Router()
records.param('id', (_r, _s, next, v) => next(/^\d+$/.test(String(v)) ? undefined : notFound('Record')))
records.get('/:model/:id/notes', handle(async (req: Request, res: Response) => ok(res, await extras.listNotes(String(req.params.model), Number(req.params.id)))))
records.post('/:model/:id/notes', handle(async (req: Request, res: Response) => ok(res, { id: await extras.addNote(String(req.params.model), Number(req.params.id), String(req.body?.body ?? ''), req.env) }, 'Note added', 201)))
records.get('/:model/:id/attachments', handle(async (req: Request, res: Response) => ok(res, await extras.listAttachments(String(req.params.model), Number(req.params.id)))))
records.post('/:model/:id/attachments', handle(async (req: Request, res: Response) => ok(res, { id: await extras.addAttachment(String(req.params.model), Number(req.params.id), req.body ?? {}, req.env) }, 'File attached', 201)))
const files = Router()
files.get('/:id/download', handle(async (req: Request, res: Response) => {
  const a = await extras.readAttachment(Number(req.params.id))
  res.setHeader('Content-Type', a.mimetype || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${a.name.replace(/[^\w.\- ]/g, '_')}"`)
  res.send(a.data)
}))
files.delete('/:id', handle(async (req: Request, res: Response) => { await extras.deleteAttachment(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Attachment deleted') }))
const noteRouter = Router()
noteRouter.delete('/:id', handle(async (req: Request, res: Response) => { await extras.deleteNote(Number(req.params.id)); return ok(res, { id: Number(req.params.id) }, 'Note deleted') }))

const accounting = Router()
accounting.use('/records', records)
accounting.use('/attachments', files)
accounting.use('/notes', noteRouter)
accounting.get('/dashboard', handle(async (req: Request, res: Response) => ok(res, await extras.dashboard(req.env.allowedCompanyIds.length ? req.env.allowedCompanyIds : req.env.companyId ? [req.env.companyId] : []))))
accounting.use('/analytic-lines', analyticLines)
accounting.use('/lookups', lookups)
accounting.use('/internal-vouchers', voucherRoutes('internal'))
accounting.use('/payable-vouchers', voucherRoutes('payable'))
accounting.use('/assets', assets)
accounting.use('/asset-types', crudRouter(cfg.assetCategory))
accounting.use('/incoterms', crudRouter(cfg.incoterm))
accounting.use('/reconcile-models', crudRouter(cfg.reconcileModel))
accounting.use('/fiscal-years', crudRouter(cfg.fiscalYear))
accounting.use('/payments', payments)
accounting.use('/bank-statements', statements)
accounting.use('/bank-statement-lines', stmtLines)
accounting.use('/reports', reports)
accounting.use('/analytic-accounts', crudRouter(cfg.analyticAccount))
accounting.use('/analytic-groups', crudRouter(cfg.analyticGroup))
accounting.use('/analytic-tags', crudRouter(cfg.analyticTag))
accounting.use('/moves', moves)
accounting.use('/move-lines', items)
accounting.use('/settings', settings)
accounting.use('/account-types', crudRouter(cfg.accountType))
accounting.use('/account-groups', crudRouter(cfg.accountGroup))
accounting.use('/accounts', crudRouter(cfg.account))
accounting.use('/taxes', crudRouter(cfg.tax))
accounting.use('/tax-groups', crudRouter(cfg.taxGroup))
accounting.use('/payment-terms', crudRouter(cfg.paymentTerm))
accounting.use('/fiscal-positions', crudRouter(cfg.fiscalPosition))
accounting.use('/journals', crudRouter(cfg.journal))
accounting.use('/currency-list', crudRouter(cfg.currency))
accounting.use('/currency-rates', crudRouter(cfg.currencyRate))
export default accounting
