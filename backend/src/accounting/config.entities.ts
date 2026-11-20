import type { Transaction } from 'sequelize'
import { AppError } from '../common.helper'
import { exec, q, type Entity } from './crud'

/**
 * Accounting configuration screens: account types, groups, accounts, taxes,
 * payment terms, fiscal positions, journals, currencies and rates.
 * The rules below are the Odoo 12 constraints from addons/account/models.
 */

const num = (v: unknown, d = 0) => (v === undefined || v === null || v === '' ? d : Number(v))
const ids = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter(Number.isInteger) : [])

const replaceRel = async (table: string, a: string, b: string, id: number, list: number[], t: Transaction) => {
  await exec(`DELETE FROM ${table} WHERE ${a} = :id`, { id }, t)
  for (const x of new Set(list)) await exec(`INSERT INTO ${table} (${a}, ${b}) VALUES (:id, :x)`, { id, x }, t)
}

// --------------------------------------------------------------- account type ---
export const accountType: Entity = {
  table: 'account_account_type', label: 'Account type',
  cols: { name: 's', type: 's', include_initial_balance: 'b', internal_group: 's', note: 't' },
  required: ['name', 'type'], search: ['name'], order: 'id',
}

// -------------------------------------------------------------- account group ---
export const accountGroup: Entity = {
  table: 'account_group', label: 'Account group', company: true,
  cols: { name: 's', code_prefix: 's', parent_id: 'i', company_id: 'i' },
  required: ['name'], search: ['name', 'code_prefix'], order: 'code_prefix, id',
  m2o: { parent_id: ['account_group', 'name'] },
}

// -------------------------------------------------------------------- account ---
export const account: Entity = {
  table: 'account_account', label: 'Account', company: true,
  cols: { code: 's', name: 's', user_type_id: 'i', currency_id: 'i', reconcile: 'b', deprecated: 'b', note: 't', group_id: 'i', company_id: 'i' },
  required: ['code', 'name', 'user_type_id'], search: ['code', 'name'], order: 'code',
  m2o: { user_type_id: ['account_account_type', 'name'], currency_id: ['res_currency', 'name'], group_id: ['account_group', 'name'] },
  async before(b, _env, id, t) {
    if (b.user_type_id != null) {
      const [ty] = await q<{ type: string; internal_group: string | null }>('SELECT type, internal_group FROM account_account_type WHERE id = :i', { i: b.user_type_id }, t)
      if (!ty) throw new AppError('user_type_id: account type not found')
      b.internal_type = ty.type; b.internal_group = ty.internal_group
      // receivable and payable accounts are always reconcilable; so is liquidity on request only
      if (ty.type === 'receivable' || ty.type === 'payable') b.reconcile = true
    }
    if (id) {
      // Odoo: "You cannot change the type / company of an account that has entries" (and currency)
      const [used] = await q<{ n: string }>('SELECT count(*) n FROM account_move_line WHERE account_id = :id', { id }, t)
      if (Number(used.n) > 0) {
        const [cur] = await q<Record<string, unknown>>('SELECT user_type_id, internal_type, company_id, currency_id, reconcile FROM account_account WHERE id = :id', { id }, t)
        for (const f of ['company_id', 'currency_id'] as const) if (f in b && b[f] !== cur[f]) throw new AppError(`You cannot change the ${f.replace('_id', '')} of an account that already has journal items.`)
        if ('user_type_id' in b && b.user_type_id !== cur.user_type_id && ['receivable', 'payable'].includes(String(b.internal_type)) !== ['receivable', 'payable'].includes(String(cur.internal_type)))
          throw new AppError('You cannot change the type of an account to or from receivable/payable when it has journal items.')
        if (b.reconcile === false && cur.reconcile) {
          const [open] = await q<{ n: string }>('SELECT count(*) n FROM account_move_line WHERE account_id = :id AND reconciled = false AND amount_residual <> 0', { id }, t)
          if (Number(open.n) > 0) throw new AppError('You cannot switch an account to prevent the reconciliation because some partners have gotten entries that are not reconciled yet.')
        }
      }
    }
  },
}

// ------------------------------------------------------------------------ tax ---
export const tax: Entity = {
  table: 'account_tax', label: 'Tax', company: true, active: true,
  cols: {
    name: 's', type_tax_use: 's', amount_type: 's', amount: 'n', description: 's', sequence: 'i', active: 'b',
    price_include: 'b', include_base_amount: 'b', analytic: 'b', tax_exigibility: 's',
    account_id: 'i', refund_account_id: 'i', cash_basis_account_id: 'i', cash_basis_base_account_id: 'i',
    tax_group_id: 'i', company_id: 'i', l10n_sa_is_retention: 'b', l10n_sa_exemption_reason_code: 's',
  },
  required: ['name', 'type_tax_use'], search: ['name', 'description'], order: 'sequence, id',
  m2o: { account_id: ['account_account', 'code'], refund_account_id: ['account_account', 'code'], tax_group_id: ['account_tax_group', 'name'] },
  async before(b) {
    if (b.amount_type === 'percent' || b.amount_type === 'division') {
      if (b.amount !== undefined && (Number(b.amount) < 0 || Number(b.amount) > 100) && b.amount_type === 'division' && Number(b.amount) >= 100)
        throw new AppError('A division tax cannot be 100% or more.')
    }
    if (b.price_include && b.amount_type === 'group') throw new AppError('A group of taxes cannot be included in the price.')
  },
  async after(id, body, _env, t) {
    if (Array.isArray(body.children_tax_ids)) {
      const kids = ids(body.children_tax_ids)
      if (kids.includes(id)) throw new AppError('A tax cannot be its own child.')
      await replaceRel('account_tax_filiation_rel', 'parent_tax', 'child_tax', id, kids, t)
    }
    const [row] = await q<{ amount_type: string }>('SELECT amount_type FROM account_tax WHERE id = :id', { id }, t)
    if (row.amount_type === 'group') {
      const [n] = await q<{ n: string }>('SELECT count(*) n FROM account_tax_filiation_rel WHERE parent_tax = :id', { id }, t)
      if (Number(n.n) === 0) throw new AppError('A tax of type group needs child taxes (children_tax_ids).')
    }
  },
  async detail(id) {
    return { children_tax_ids: (await q<{ child_tax: number }>('SELECT child_tax FROM account_tax_filiation_rel WHERE parent_tax = :id', { id })).map(r => r.child_tax) }
  },
}

export const taxGroup: Entity = {
  table: 'account_tax_group', label: 'Tax group', cols: { name: 's', sequence: 'i' }, required: ['name'], search: ['name'], order: 'sequence, id',
}

// --------------------------------------------------------------- payment term ---
export const paymentTerm: Entity = {
  table: 'account_payment_term', label: 'Payment term', company: true, active: true,
  cols: { name: 's', active: 'b', note: 't', sequence: 'i', company_id: 'i' },
  required: ['name'], search: ['name'], order: 'sequence, id',
  async after(id, body, _env, t) {
    if (!Array.isArray(body.line_ids)) return
    const lines = body.line_ids as Record<string, unknown>[]
    // Odoo `_check_lines`: "A Payment Term should have only one line of type Balance."
    if (lines.filter(l => (l.value ?? 'balance') === 'balance').length !== 1) throw new AppError('A Payment Term should have only one line of type Balance.')
    await exec('DELETE FROM account_payment_term_line WHERE payment_id = :id', { id }, t)
    let seq = 10
    for (const l of lines) {
      const value = String(l.value ?? 'balance')
      if (value === 'percent' && (num(l.value_amount) < 0 || num(l.value_amount) > 100)) throw new AppError('Percentages on the Payment Terms lines must be between 0 and 100.')
      await exec(`INSERT INTO account_payment_term_line (payment_id, value, value_amount, days, day_of_the_month, option, sequence)
        VALUES (:id, :value, :va, :days, :dom, :opt, :seq)`,
        { id, value, va: num(l.value_amount), days: num(l.days), dom: l.day_of_the_month ?? null, opt: l.option ?? 'day_after_invoice_date', seq: num(l.sequence, seq) }, t)
      seq += 10
    }
    const [last] = await q<{ value: string }>('SELECT value FROM account_payment_term_line WHERE payment_id = :id ORDER BY sequence DESC, id DESC LIMIT 1', { id }, t)
    if (last && last.value !== 'balance') throw new AppError('The last line of a Payment Term should be of type Balance.')
  },
  async detail(id) {
    return { line_ids: await q('SELECT id, value, value_amount, days, day_of_the_month, option, sequence FROM account_payment_term_line WHERE payment_id = :id ORDER BY sequence, id', { id }) }
  },
}

// ------------------------------------------------------------ fiscal position ---
export const fiscalPosition: Entity = {
  table: 'account_fiscal_position', label: 'Fiscal position', company: true, active: true,
  cols: { name: 's', active: 'b', note: 't', auto_apply: 'b', vat_required: 'b', country_id: 'i', sequence: 'i', company_id: 'i' },
  required: ['name'], search: ['name'], order: 'sequence, id',
  m2o: { country_id: ['res_country', 'name'] },
  async after(id, body, _env, t) {
    if (Array.isArray(body.tax_ids)) {
      await exec('DELETE FROM account_fiscal_position_tax WHERE position_id = :id', { id }, t)
      for (const m of body.tax_ids as { tax_src_id: number; tax_dest_id?: number | null }[])
        await exec('INSERT INTO account_fiscal_position_tax (position_id, tax_src_id, tax_dest_id) VALUES (:id, :s, :d)', { id, s: m.tax_src_id, d: m.tax_dest_id ?? null }, t)
    }
    if (Array.isArray(body.account_ids)) {
      await exec('DELETE FROM account_fiscal_position_account WHERE position_id = :id', { id }, t)
      for (const m of body.account_ids as { account_src_id: number; account_dest_id: number }[])
        await exec('INSERT INTO account_fiscal_position_account (position_id, account_src_id, account_dest_id) VALUES (:id, :s, :d)', { id, s: m.account_src_id, d: m.account_dest_id }, t)
    }
  },
  async detail(id) {
    return {
      tax_ids: await q('SELECT id, tax_src_id, tax_dest_id FROM account_fiscal_position_tax WHERE position_id = :id', { id }),
      account_ids: await q('SELECT id, account_src_id, account_dest_id FROM account_fiscal_position_account WHERE position_id = :id', { id }),
    }
  },
}

// -------------------------------------------------------------------- journal ---
export const journal: Entity = {
  table: 'account_journal', label: 'Journal', company: true, active: true,
  cols: {
    name: 's', code: 's', type: 's', active: 'b', sequence: 'i', color: 'i', currency_id: 'i', company_id: 'i',
    default_debit_account_id: 'i', default_credit_account_id: 'i', profit_account_id: 'i', loss_account_id: 'i',
    bank_account_id: 'i', update_posted: 'b', group_invoice_lines: 'b', refund_sequence: 'b', show_on_dashboard: 'b',
    at_least_one_inbound: 'b', at_least_one_outbound: 'b', post_at_bank_rec: 'b', bank_statements_source: 's',
    cash_customer: 'b', credit_note_name: 's', country_code: 's', invoice_category: 's',
  },
  required: ['name', 'code', 'type'], search: ['name', 'code'], order: 'sequence, id',
  m2o: { default_debit_account_id: ['account_account', 'code'], default_credit_account_id: ['account_account', 'code'], currency_id: ['res_currency', 'name'] },
  async before(b, _env, id, t) {
    if (id && 'type' in b) {
      const [cur] = await q<{ type: string }>('SELECT type FROM account_journal WHERE id = :id', { id }, t)
      const [used] = await q<{ n: string }>('SELECT count(*) n FROM account_move WHERE journal_id = :id', { id }, t)
      if (cur.type !== b.type && Number(used.n) > 0) throw new AppError('You cannot change the type of a journal that already has entries.')
    }
  },
  async after(id, body, _env, t) {
    if (Array.isArray(body.type_control_ids)) await replaceRel('account_journal_type_control_rel', 'journal_id', 'type_id', id, ids(body.type_control_ids), t)
    if (Array.isArray(body.account_control_ids)) await replaceRel('account_account_type_rel', 'journal_id', 'account_id', id, ids(body.account_control_ids), t)
    const [j] = await q<{ type: string; default_debit_account_id: number | null; default_credit_account_id: number | null }>('SELECT type, default_debit_account_id, default_credit_account_id FROM account_journal WHERE id = :id', { id }, t)
    if (['bank', 'cash'].includes(j.type) && (!j.default_debit_account_id || !j.default_credit_account_id))
      throw new AppError('Bank and cash journals need default debit and credit accounts.')
  },
  async detail(id) {
    return {
      type_control_ids: (await q<{ type_id: number }>('SELECT type_id FROM account_journal_type_control_rel WHERE journal_id = :id', { id })).map(r => r.type_id),
      account_control_ids: (await q<{ account_id: number }>('SELECT account_id FROM account_account_type_rel WHERE journal_id = :id', { id })).map(r => r.account_id),
    }
  },
}

// ------------------------------------------------------------ currency, rate ---
export const currency: Entity = {
  table: 'res_currency', label: 'Currency', active: true,
  cols: { name: 's', symbol: 's', active: 'b', rounding: 'n', decimal_places: 'i', position: 's' },
  required: ['name'], search: ['name', 'symbol'], order: 'name',
}
export const currencyRate: Entity = {
  table: 'res_currency_rate', label: 'Currency rate', company: true,
  cols: { name: 'd', rate: 'n', currency_id: 'i', company_id: 'i' },
  required: ['name', 'rate', 'currency_id'], order: 'name DESC, id DESC',
  m2o: { currency_id: ['res_currency', 'name'] },
}

// ------------------------------------------------------------------- analytic ---
export const analyticGroup: Entity = {
  table: 'account_analytic_group', label: 'Analytic group', company: true,
  cols: { name: 's', parent_id: 'i', description: 't', company_id: 'i' }, required: ['name'], search: ['name'], order: 'name',
  m2o: { parent_id: ['account_analytic_group', 'name'] },
}
export const analyticTag: Entity = {
  table: 'account_analytic_tag', label: 'Analytic tag', company: true, active: true,
  cols: { name: 's', active: 'b', company_id: 'i' }, required: ['name'], search: ['name'], order: 'name',
}
export const analyticAccount: Entity = {
  table: 'account_analytic_account', label: 'Analytic account', company: true, active: true,
  cols: { name: 's', code: 's', active: 'b', group_id: 'i', partner_id: 'i', currency_id: 'i', company_id: 'i' },
  required: ['name'], search: ['name', 'code'], order: 'code NULLS LAST, name',
  m2o: { group_id: ['account_analytic_group', 'name'], partner_id: ['res_partner', 'name'], currency_id: ['res_currency', 'name'] },
}

// --------------------------------------------------------------- assets, misc ---
export const assetCategory: Entity = {
  table: 'account_asset_category', label: 'Asset type', company: true, active: true,
  cols: {
    name: 's', active: 'b', type: 's', journal_id: 'i', company_id: 'i', account_asset_id: 'i', account_depreciation_id: 'i',
    account_depreciation_expense_id: 'i', account_analytic_id: 'i', method: 's', method_number: 'i', method_period: 'i',
    method_progress_factor: 'n', method_time: 's', method_end: 'd', prorata: 'b', open_asset: 'b', group_entries: 'b',
  },
  required: ['name', 'journal_id', 'account_asset_id', 'account_depreciation_id', 'account_depreciation_expense_id'], search: ['name'], order: 'name',
  m2o: { journal_id: ['account_journal', 'name'], account_asset_id: ['account_account', 'code'], account_depreciation_id: ['account_account', 'code'],
    account_depreciation_expense_id: ['account_account', 'code'], account_analytic_id: ['account_analytic_account', 'name'] },
}

export const incoterm: Entity = {
  table: 'account_incoterms', label: 'Incoterm', active: true,
  cols: { name: 's', code: 's', active: 'b' }, required: ['name', 'code'], search: ['name', 'code'], order: 'code',
}

export const reconcileModel: Entity = {
  table: 'account_reconcile_model', label: 'Reconciliation model', company: true,
  cols: {
    name: 's', sequence: 'i', company_id: 'i', rule_type: 's', auto_reconcile: 'b', match_nature: 's', match_label: 's', match_label_param: 's',
    match_amount_min: 'n', match_amount_max: 'n', match_partner: 'b', journal_id: 'i', account_id: 'i', label: 's', amount_type: 's', amount: 'n',
    tax_id: 'i', force_tax_included: 'b', analytic_account_id: 'i',
  },
  required: ['name'], search: ['name'], order: 'sequence, id',
  m2o: { journal_id: ['account_journal', 'name'], account_id: ['account_account', 'code'], tax_id: ['account_tax', 'name'], analytic_account_id: ['account_analytic_account', 'name'] },
}

export const fiscalYear: Entity = {
  table: 'account_fiscal_year', label: 'Fiscal year', company: true,
  cols: { name: 's', date_from: 'd', date_to: 'd', company_id: 'i' }, required: ['name', 'date_from', 'date_to'], search: ['name'], order: 'date_from DESC',
  async before(b, _env, id, t) {
    // Odoo: "You can not have an overlap between two fiscal years, please correct the start and/or end dates of your fiscal years."
    const [cur] = id ? await q<{ date_from: string; date_to: string; company_id: number }>('SELECT date_from, date_to, company_id FROM account_fiscal_year WHERE id = :id', { id }, t) : []
    const from = String(b.date_from ?? cur?.date_from).slice(0, 10), to = String(b.date_to ?? cur?.date_to).slice(0, 10), co = (b.company_id ?? cur?.company_id) as number
    const [o] = await q<{ n: string }>('SELECT count(*) n FROM account_fiscal_year WHERE company_id = :co AND id <> :id AND date_from <= :to AND date_to >= :from', { co, id: id ?? 0, from, to }, t)
    if (Number(o.n) > 0) throw new AppError('You can not have an overlap between two fiscal years, please correct the start and/or end dates of your fiscal years.')
  },
}
