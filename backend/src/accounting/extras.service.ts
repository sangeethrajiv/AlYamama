import { AppError, notFound } from '../common.helper'
import type { RequestEnv } from '../middleware'
import { assertCompany, exec, q } from './crud'

/**
 * Notes and attachments on accounting records (Odoo chatter and ir.attachment), and the accounting overview.
 * Both are keyed by `res_model` + `res_id`; only the models below are accepted.
 */
const TABLES: Record<string, string> = {
  'account.move': 'account_move', 'account.payment': 'account_payment', 'account.asset.asset': 'account_asset_asset',
  'account.bank.statement': 'account_bank_statement', 'account.internal.voucher': 'account_internal_voucher', 'account.payable.voucher': 'account_payable_voucher',
}
const MAX_FILE = 8 * 1024 * 1024

async function checkRecord(model: string, id: number, env?: RequestEnv) {
  const table = TABLES[model]
  if (!table) throw new AppError(`Unknown record type "${model}".`)
  const [r] = await q<{ company_id: number | null }>(`SELECT company_id FROM ${table} WHERE id = :id`, { id })
  if (!r) throw notFound('Record')
  if (env) assertCompany(env, r.company_id, 'Record')
}

export async function listNotes(model: string, id: number, env?: RequestEnv) {
  await checkRecord(model, id, env)
  return q(`SELECT n.id, n.kind, n.body, n.create_date, n.author_id, u.login author FROM account_note n LEFT JOIN res_users u ON u.id = n.author_id WHERE n.res_model = :m AND n.res_id = :id ORDER BY n.id DESC`, { m: model, id })
}
export async function addNote(model: string, id: number, body: string, env: RequestEnv, kind: 'note' | 'log' = 'note') {
  await checkRecord(model, id, env)
  if (!body?.trim()) throw new AppError('The note is empty.')
  const [row] = await q<{ id: number }>('INSERT INTO account_note (res_model, res_id, kind, body, author_id) VALUES (:m, :id, :k, :b, :u) RETURNING id', { m: model, id, k: kind, b: body.trim(), u: env.uid })
  return row.id
}
export async function deleteNote(id: number, env?: RequestEnv) {
  await checkOwner('account_note', id, env)
  const rows = await q<{ id: number }>("DELETE FROM account_note WHERE id = :id AND kind = 'note' RETURNING id", { id })
  if (!rows.length) throw new AppError('Only a note you typed can be deleted.')
}

export async function listAttachments(model: string, id: number, env?: RequestEnv) {
  await checkRecord(model, id, env)
  return q('SELECT id, name, mimetype, file_size, create_date FROM account_attachment WHERE res_model = :m AND res_id = :id ORDER BY id DESC', { m: model, id })
}
export async function addAttachment(model: string, id: number, f: { name?: string; mimetype?: string; content_base64?: string }, env: RequestEnv) {
  await checkRecord(model, id, env)
  if (!f.name?.trim() || !f.content_base64) throw new AppError('A file name and content are required.')
  const data = Buffer.from(f.content_base64, 'base64')
  if (!data.length) throw new AppError('The file is empty.')
  if (data.length > MAX_FILE) throw new AppError('The file is larger than 8 MB.')
  const [row] = await q<{ id: number }>('INSERT INTO account_attachment (res_model, res_id, name, mimetype, file_size, data, create_uid) VALUES (:m, :id, :n, :t, :s, :d, :u) RETURNING id',
    { m: model, id, n: f.name.trim().slice(0, 255), t: f.mimetype ?? 'application/octet-stream', s: data.length, d: data, u: env.uid })
  return row.id
}
/** An attachment or note is visible only with the record it belongs to. */
async function checkOwner(table: 'account_attachment' | 'account_note', id: number, env?: RequestEnv) {
  const [o] = await q<{ res_model: string; res_id: number }>(`SELECT res_model, res_id FROM ${table} WHERE id = :id`, { id })
  if (!o) throw notFound(table === 'account_note' ? 'Note' : 'Attachment')
  await checkRecord(o.res_model, o.res_id, env)
}
export async function readAttachment(id: number, env?: RequestEnv) {
  await checkOwner('account_attachment', id, env)
  const [a] = await q<{ name: string; mimetype: string; data: Buffer }>('SELECT name, mimetype, data FROM account_attachment WHERE id = :id', { id })
  return a
}
export async function deleteAttachment(id: number, env?: RequestEnv) {
  await checkOwner('account_attachment', id, env)
  await exec('DELETE FROM account_attachment WHERE id = :id', { id })
}

/** Accounting > Overview: one card per journal, like the Odoo dashboard. */
export async function dashboard(companyIds: number[]) {
  if (!companyIds.length) throw new AppError('Send X-Company-Id.')
  const journals = await q<Record<string, any>>(
    `SELECT id, name, code, type, invoice_category, default_debit_account_id, company_id FROM account_journal WHERE active AND show_on_dashboard AND company_id IN (:c) ORDER BY sequence, id`, { c: companyIds })
  const cards = []
  for (const j of journals) {
    const card: Record<string, unknown> = { journal_id: j.id, name: j.name, code: j.code, type: j.type, invoice_category: j.invoice_category }
    if (j.type === 'sale' || j.type === 'purchase') {
      const [s] = await q<Record<string, any>>(
        `SELECT count(*) FILTER (WHERE state = 'draft') draft,
                count(*) FILTER (WHERE request_status = 'to_approve') to_approve,
                count(*) FILTER (WHERE state = 'posted' AND payment_state IN ('not_paid', 'partial')) unpaid,
                COALESCE(sum(amount_residual) FILTER (WHERE state = 'posted' AND payment_state IN ('not_paid', 'partial')), 0) unpaid_amount,
                count(*) FILTER (WHERE state = 'posted' AND payment_state IN ('not_paid', 'partial') AND invoice_date_due < current_date) late,
                COALESCE(sum(amount_residual) FILTER (WHERE state = 'posted' AND payment_state IN ('not_paid', 'partial') AND invoice_date_due < current_date), 0) late_amount
           FROM account_move WHERE journal_id = :j AND move_type <> 'entry'`, { j: j.id })
      Object.assign(card, { draft: Number(s.draft), to_approve: Number(s.to_approve), unpaid: Number(s.unpaid), unpaid_amount: s.unpaid_amount, late: Number(s.late), late_amount: s.late_amount })
    } else if (j.type === 'bank' || j.type === 'cash') {
      const [gl] = j.default_debit_account_id
        ? await q<{ v: string }>("SELECT COALESCE(sum(l.balance), 0) v FROM account_move_line l JOIN account_move m ON m.id = l.move_id WHERE l.account_id = :a AND m.state = 'posted'", { a: j.default_debit_account_id })
        : [{ v: '0' }]
      const [last] = await q<{ b: string }>('SELECT balance_end_real b FROM account_bank_statement WHERE journal_id = :j ORDER BY date DESC, id DESC LIMIT 1', { j: j.id })
      const [todo] = await q<{ n: string }>('SELECT count(*) n FROM account_bank_statement_line WHERE journal_id = :j AND move_id IS NULL', { j: j.id })
      Object.assign(card, { gl_balance: gl.v, last_statement: last?.b ?? null, to_reconcile: Number(todo.n) })
    } else {
      const [d] = await q<{ n: string }>("SELECT count(*) n FROM account_move WHERE journal_id = :j AND state = 'draft'", { j: j.id })
      Object.assign(card, { draft: Number(d.n) })
    }
    cards.push(card)
  }
  return cards
}
