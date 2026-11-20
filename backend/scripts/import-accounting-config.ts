/**
 * Copies the accounting CONFIGURATION from the Odoo 12 database into this one.
 * No transactions: no invoices, entries, payments, statements or assets.
 *
 *   npm run import:accounting                 load into PGDATABASE
 *   npm run import:accounting -- --unit       load into the test database
 *   npm run import:accounting -- --truncate   empty the config tables first
 *
 * What it loads, in dependency order:
 *   currency rounding and rates, account types and groups, chart of accounts, tax groups and
 *   taxes, payment terms, journals (with their account/type controls), analytic groups, accounts
 *   and tags, asset types, incoterms, reconciliation models, fiscal years,
 *   plus the company defaults and the partner defaults that Odoo keeps in ir_property:
 *     receivable / payable / income / expense accounts, payment terms, lock dates.
 *
 * Needs `npm run migrate` (005 to 007) and `npm run import:odoo` first: companies, partners and
 * products must already be here. Like the other importers it is read-only on Odoo (BEGIN READ ONLY),
 * idempotent (ON CONFLICT (id) DO UPDATE), keeps the Odoo ids and records them in ir_model_data.
 *
 * Odoo keeps some values per company in ir_property. This schema holds one value per partner, so
 * when a partner has several, the lowest company id wins (the same rule the product cost uses).
 * Rows that belong to a company that was not imported are skipped and counted in the report.
 */
import { config } from '../src/config'
import { makeClient, withOdooReadOnly } from '../src/db'
import { argvFlag, recordExternalIds, resetSequences, upsert, type Row } from './lib/import-helpers'

const TARGET_DB = argvFlag('unit') ? config.unitDatabase : config.db.database
const log = (...a: unknown[]) => console.log(...a)

/** 'account.account,42' -> 42 */
const refId = (v: unknown): number | null => {
  const m = /,(\d+)$/.exec(String(v ?? ''))
  return m ? Number(m[1]) : null
}

export async function run() {
  const target = makeClient({ ...config.db, database: TARGET_DB })
  await target.connect()
  const report: [string, number, number][] = []
  try {
    await target.query('BEGIN')
    // the unit database is rebuilt by the tests, but a dev database must not lose its work by accident
    if (argvFlag('truncate')) {
      await target.query(`TRUNCATE account_reconcile_model, account_asset_category, account_incoterms, account_fiscal_year,
        account_analytic_account, account_analytic_tag, account_analytic_group, account_journal, account_payment_term,
        account_tax, account_tax_group, account_account, account_group, account_account_type, res_currency_rate CASCADE`)
    }

    const companies = new Set((await target.query<{ id: number }>('SELECT id FROM res_company')).rows.map(r => r.id))
    if (!companies.size) throw new Error('No companies in the target. Run `npm run import:odoo` first.')
    const co = (id: unknown) => (id == null ? true : companies.has(Number(id)))

    await withOdooReadOnly(async odoo => {
      const q = async <T extends Row = Row>(sql: string, p: unknown[] = []) => (await odoo.query<T>(sql, p)).rows
      const load = async (table: string, source: string, rows: Row[], columns: string[], model: string) => {
        const n = await upsert(target, table, columns, rows)
        await recordExternalIds(target, model, rows.map(r => r.id as number))
        report.push([table, rows.length, n])
        log(`  ${table.padEnd(26)} ${String(rows.length).padStart(6)}`)
      }
      const known = async (table: string) => new Set((await target.query<{ id: number }>(`SELECT id FROM ${table}`)).rows.map(r => r.id))

      log('importing accounting configuration from', config.odoo.database, '->', TARGET_DB)

      // ---------------------------------------------------------- currencies
      const cur = await q('SELECT id, name, rounding, decimal_places, position FROM res_currency')
      for (const c of cur)
        await target.query('UPDATE res_currency SET rounding = $2, decimal_places = $3, position = $4 WHERE id = $1', [c.id, c.rounding, c.decimal_places, c.position])
      report.push(['res_currency (rounding)', cur.length, cur.length]); log(`  res_currency (rounding)    ${String(cur.length).padStart(6)}`)
      const curIds = await known('res_currency')
      const rates = (await q('SELECT id, name, rate, currency_id, company_id FROM res_currency_rate')).filter(r => curIds.has(r.currency_id as number) && co(r.company_id))
      await load('res_currency_rate', 'res_currency_rate', rates, ['id', 'name', 'rate', 'currency_id', 'company_id'], 'res.currency.rate')

      // ------------------------------------------------------- account types
      const types = await q('SELECT id, name, include_initial_balance, type, internal_group, note FROM account_account_type ORDER BY id')
      await load('account_account_type', 'account_account_type', types, ['id', 'name', 'include_initial_balance', 'type', 'internal_group', 'note'], 'account.account.type')

      // ------------------------------------------------------------- groups
      // parents first, so a parent exists when its child is written
      const groups = await q('SELECT id, name, code_prefix, parent_id, parent_path FROM account_group ORDER BY level NULLS FIRST, id')
      await load('account_group', 'account_group', groups, ['id', 'name', 'code_prefix', 'parent_id', 'parent_path'], 'account.group')

      // ------------------------------------------------------------ accounts
      const accountsAll = await q(`SELECT a.id, a.name, a.code, a.currency_id, a.deprecated, a.user_type_id, t.type AS internal_type, t.internal_group,
          a.reconcile, a.note, a.company_id, a.group_id, a.centralized, a.list_customer_in_pl_report FROM account_account a JOIN account_account_type t ON t.id = a.user_type_id ORDER BY a.id`)
      const accounts = accountsAll.filter(a => co(a.company_id))
      const groupIds = await known('account_group')
      accounts.forEach(a => { if (a.group_id && !groupIds.has(a.group_id as number)) a.group_id = null; if (a.currency_id && !curIds.has(a.currency_id as number)) a.currency_id = null })
      await load('account_account', 'account_account', accounts, ['id', 'name', 'code', 'currency_id', 'deprecated', 'user_type_id', 'internal_type', 'internal_group', 'reconcile', 'note', 'company_id', 'group_id', 'centralized', 'list_customer_in_pl_report'], 'account.account')
      const accIds = await known('account_account')
      const acc = (v: unknown) => (v != null && accIds.has(Number(v)) ? v : null)

      // ----------------------------------------------------------------- tax
      const taxGroups = await q('SELECT id, name, sequence FROM account_tax_group ORDER BY id')
      await load('account_tax_group', 'account_tax_group', taxGroups, ['id', 'name', 'sequence'], 'account.tax.group')
      const taxes = (await q(`SELECT id, name, type_tax_use, amount_type, active, company_id, sequence, amount, account_id, refund_account_id, description, price_include,
          include_base_amount, analytic, tax_group_id, tax_exigibility, cash_basis_account_id, cash_basis_base_account_id, l10n_sa_is_retention, l10n_sa_exemption_reason_code FROM account_tax ORDER BY id`)).filter(t => co(t.company_id))
      taxes.forEach(t => { for (const f of ['account_id', 'refund_account_id', 'cash_basis_account_id', 'cash_basis_base_account_id']) t[f] = acc(t[f]) })
      await load('account_tax', 'account_tax', taxes, ['id', 'name', 'type_tax_use', 'amount_type', 'active', 'company_id', 'sequence', 'amount', 'account_id', 'refund_account_id', 'description', 'price_include', 'include_base_amount', 'analytic', 'tax_group_id', 'tax_exigibility', 'cash_basis_account_id', 'cash_basis_base_account_id', 'l10n_sa_is_retention', 'l10n_sa_exemption_reason_code'], 'account.tax')
      const taxIds = await known('account_tax')
      const kids = (await q('SELECT parent_tax, child_tax FROM account_tax_filiation_rel')).filter(r => taxIds.has(r.parent_tax as number) && taxIds.has(r.child_tax as number))
      await upsert(target, 'account_tax_filiation_rel', ['parent_tax', 'child_tax'], kids, 500, ['parent_tax', 'child_tax'])

      // ------------------------------------------------------- payment terms
      const terms = (await q('SELECT id, name, active, note, company_id, sequence FROM account_payment_term ORDER BY id')).filter(t => co(t.company_id))
      await load('account_payment_term', 'account_payment_term', terms, ['id', 'name', 'active', 'note', 'company_id', 'sequence'], 'account.payment.term')
      const termIds = await known('account_payment_term')
      const termLines = (await q('SELECT id, payment_id, value, value_amount, days, day_of_the_month, option, sequence FROM account_payment_term_line ORDER BY id')).filter(l => termIds.has(l.payment_id as number))
      await load('account_payment_term_line', 'account_payment_term_line', termLines, ['id', 'payment_id', 'value', 'value_amount', 'days', 'day_of_the_month', 'option', 'sequence'], 'account.payment.term.line')

      // ------------------------------------------------------------- journals
      const journals = (await q(`SELECT id, name, code, active, type, default_credit_account_id, default_debit_account_id, update_posted, group_invoice_lines,
          sequence, currency_id, company_id, refund_sequence, at_least_one_inbound, at_least_one_outbound, profit_account_id, loss_account_id, bank_statements_source,
          post_at_bank_rec, show_on_dashboard, color, cash_customer, credit_note_name, country_code FROM account_journal ORDER BY id`)).filter(j => co(j.company_id))
      journals.forEach(j => {
        for (const f of ['default_credit_account_id', 'default_debit_account_id', 'profit_account_id', 'loss_account_id']) j[f] = acc(j[f])
        if (j.currency_id && !curIds.has(j.currency_id as number)) j.currency_id = null
        // Odoo marks cash-customer journals; they feed Customers > Cash Invoices
        j.invoice_category = j.cash_customer ? 'cash' : null
        delete j.cash_customer
      })
      await load('account_journal', 'account_journal', journals, ['id', 'name', 'code', 'active', 'type', 'default_credit_account_id', 'default_debit_account_id', 'update_posted', 'group_invoice_lines', 'sequence', 'currency_id', 'company_id', 'refund_sequence', 'at_least_one_inbound', 'at_least_one_outbound', 'profit_account_id', 'loss_account_id', 'bank_statements_source', 'post_at_bank_rec', 'show_on_dashboard', 'color', 'credit_note_name', 'country_code', 'invoice_category'], 'account.journal')
      // the cash-customer flag also sets cash_customer for parity
      await target.query("UPDATE account_journal SET cash_customer = (invoice_category = 'cash')")
      const jIds = await known('account_journal')
      const typeCtl = (await q('SELECT journal_id, type_id FROM account_journal_type_rel')).filter(r => jIds.has(r.journal_id as number))
      await upsert(target, 'account_journal_type_control_rel', ['journal_id', 'type_id'], typeCtl, 500, ['journal_id', 'type_id'])
      const accCtl = (await q('SELECT journal_id, account_id FROM account_account_type_rel')).filter(r => jIds.has(r.journal_id as number) && accIds.has(r.account_id as number))
      await upsert(target, 'account_account_type_rel', ['journal_id', 'account_id'], accCtl, 500, ['journal_id', 'account_id'])

      // ------------------------------------------------------------- analytic
      const agroups = (await q('SELECT id, name, description, parent_id, parent_path, company_id FROM account_analytic_group ORDER BY parent_id NULLS FIRST, id')).filter(g => co(g.company_id))
      await load('account_analytic_group', 'account_analytic_group', agroups, ['id', 'name', 'description', 'parent_id', 'parent_path', 'company_id'], 'account.analytic.group')
      const agIds = await known('account_analytic_group')
      const partnerIds = await known('res_partner')
      const analytics = (await q('SELECT id, name, code, active, group_id, partner_id, company_id FROM account_analytic_account ORDER BY id')).filter(a => co(a.company_id))
      analytics.forEach(a => { if (a.group_id && !agIds.has(a.group_id as number)) a.group_id = null; if (a.partner_id && !partnerIds.has(a.partner_id as number)) a.partner_id = null })
      await load('account_analytic_account', 'account_analytic_account', analytics, ['id', 'name', 'code', 'active', 'group_id', 'partner_id', 'company_id'], 'account.analytic.account')
      const tags = (await q('SELECT id, name, active, company_id FROM account_analytic_tag ORDER BY id')).filter(t => co(t.company_id))
      await load('account_analytic_tag', 'account_analytic_tag', tags, ['id', 'name', 'active', 'company_id'], 'account.analytic.tag')
      const anIds = await known('account_analytic_account')

      // --------------------------------------------------------- asset types
      const assetTypes = (await q(`SELECT id, name, active, type, company_id, journal_id, account_asset_id, account_depreciation_id, account_depreciation_expense_id,
          account_analytic_id, method, method_number, method_period, method_progress_factor, method_time, method_end, prorata, open_asset, group_entries
          FROM account_asset_category ORDER BY id`)).filter(c => co(c.company_id) && jIds.has(c.journal_id as number) && accIds.has(c.account_asset_id as number)
            && accIds.has(c.account_depreciation_id as number) && accIds.has(c.account_depreciation_expense_id as number))
      assetTypes.forEach(c => { if (c.account_analytic_id && !anIds.has(c.account_analytic_id as number)) c.account_analytic_id = null })
      await load('account_asset_category', 'account_asset_category', assetTypes, ['id', 'name', 'active', 'type', 'company_id', 'journal_id', 'account_asset_id', 'account_depreciation_id', 'account_depreciation_expense_id', 'account_analytic_id', 'method', 'method_number', 'method_period', 'method_progress_factor', 'method_time', 'method_end', 'prorata', 'open_asset', 'group_entries'], 'account.asset.category')

      // -------------------------------------------------- incoterms and models
      const incoterms = await q('SELECT id, name, code, active FROM account_incoterms ORDER BY id')
      await load('account_incoterms', 'account_incoterms', incoterms, ['id', 'name', 'code', 'active'], 'account.incoterms')
      const models = (await q(`SELECT id, name, sequence, company_id, rule_type, auto_reconcile, match_nature, match_amount_min, match_amount_max, match_partner,
          journal_id, account_id, label, amount_type, amount, tax_id, force_tax_included, analytic_account_id, match_label, match_label_param FROM account_reconcile_model ORDER BY id`)).filter(m => co(m.company_id))
      models.forEach(m => { m.journal_id = jIds.has(m.journal_id as number) ? m.journal_id : null; m.account_id = acc(m.account_id); m.tax_id = taxIds.has(m.tax_id as number) ? m.tax_id : null; if (m.analytic_account_id && !anIds.has(m.analytic_account_id as number)) m.analytic_account_id = null })
      await load('account_reconcile_model', 'account_reconcile_model', models, ['id', 'name', 'sequence', 'company_id', 'rule_type', 'auto_reconcile', 'match_nature', 'match_amount_min', 'match_amount_max', 'match_partner', 'journal_id', 'account_id', 'label', 'amount_type', 'amount', 'tax_id', 'force_tax_included', 'analytic_account_id', 'match_label', 'match_label_param'], 'account.reconcile.model')

      // ---------------------------------------------------------- fiscal years
      const fyears = (await q('SELECT id, name, date_from, date_to, company_id FROM account_fiscal_year ORDER BY id')).filter(y => co(y.company_id))
      await load('account_fiscal_year', 'account_fiscal_year', fyears, ['id', 'name', 'date_from', 'date_to', 'company_id'], 'account.fiscal.year')

      // ------------------------------------------- company defaults, lock dates
      const comp = await q('SELECT id, fiscalyear_lock_date, period_lock_date, fiscalyear_last_day, fiscalyear_last_month, account_sale_tax_id, account_purchase_tax_id FROM res_company')
      for (const c of comp.filter(c => co(c.id)))
        await target.query(`UPDATE res_company SET fiscalyear_lock_date = $2, period_lock_date = $3, fiscalyear_last_day = COALESCE($4, 31), fiscalyear_last_month = COALESCE($5, 12),
            default_sale_tax_id = $6, default_purchase_tax_id = $7 WHERE id = $1`,
          [c.id, c.fiscalyear_lock_date, c.period_lock_date, c.fiscalyear_last_day, c.fiscalyear_last_month,
            taxIds.has(c.account_sale_tax_id as number) ? c.account_sale_tax_id : null, taxIds.has(c.account_purchase_tax_id as number) ? c.account_purchase_tax_id : null])
      // exchange-difference and cash-basis journals (the journals were loaded above)
      const jset = await q('SELECT id, currency_exchange_journal_id, tax_cash_basis_journal_id FROM res_company')
      for (const c of jset.filter(c => co(c.id)))
        await target.query('UPDATE res_company SET currency_exchange_journal_id = $2, tax_cash_basis_journal_id = $3 WHERE id = $1',
          [c.id, jIds.has(c.currency_exchange_journal_id as number) ? c.currency_exchange_journal_id : null, jIds.has(c.tax_cash_basis_journal_id as number) ? c.tax_cash_basis_journal_id : null])
      // account defaults: ir_property rows with no res_id are the company-wide defaults
      const defaults = await q("SELECT name, company_id, value_reference FROM ir_property WHERE res_id IS NULL AND name IN ('property_account_receivable_id', 'property_account_payable_id', 'property_account_income_categ_id', 'property_account_expense_categ_id')")
      const colFor: Record<string, string> = { property_account_receivable_id: 'account_receivable_id', property_account_payable_id: 'account_payable_id', property_account_income_categ_id: 'income_account_id', property_account_expense_categ_id: 'expense_account_id' }
      let defaultsSet = 0
      for (const d of defaults) {
        const a = acc(refId(d.value_reference))
        if (a == null || !co(d.company_id)) continue
        await target.query(`UPDATE res_company SET ${colFor[d.name as string]} = $2 WHERE id = $1`, [d.company_id, a]); defaultsSet++
      }
      report.push(['res_company (defaults)', defaults.length, defaultsSet]); log(`  res_company (defaults)     ${String(defaults.length).padStart(6)}`)

      // ------------------------------------------------- partner defaults
      const props = await q(`SELECT name, res_id, company_id, value_reference FROM ir_property WHERE res_id LIKE 'res.partner,%'
          AND name IN ('property_account_receivable_id', 'property_account_payable_id', 'property_payment_term_id', 'property_supplier_payment_term_id', 'property_account_position_id')
        ORDER BY company_id`)   // lowest company id wins: it is written last-to-first below
      const pcol: Record<string, string> = { property_account_receivable_id: 'property_account_receivable_id', property_account_payable_id: 'property_account_payable_id', property_payment_term_id: 'property_payment_term_id', property_supplier_payment_term_id: 'property_supplier_payment_term_id', property_account_position_id: 'property_account_position_id' }
      let propsSet = 0
      for (const p of props.slice().reverse()) {
        const partner = refId(p.res_id), value = refId(p.value_reference)
        if (!partner || !value || !partnerIds.has(partner) || !co(p.company_id)) continue
        const ok = p.name === 'property_account_position_id' ? false : (String(p.name).includes('account') ? accIds.has(value) : termIds.has(value))
        if (!ok) continue
        await target.query(`UPDATE res_partner SET ${pcol[p.name as string]} = $2 WHERE id = $1`, [partner, value]); propsSet++
      }
      report.push(['res_partner (defaults)', props.length, propsSet]); log(`  res_partner (defaults)     ${String(props.length).padStart(6)}`)
    })

    await resetSequences(target, [
      'res_currency_rate', 'account_account_type', 'account_group', 'account_account', 'account_tax_group', 'account_tax', 'account_payment_term',
      'account_payment_term_line', 'account_journal', 'account_analytic_group', 'account_analytic_account', 'account_analytic_tag',
      'account_asset_category', 'account_incoterms', 'account_reconcile_model', 'account_fiscal_year', 'ir_model_data',
    ])
    await target.query('COMMIT')

    log('\n table                      source   loaded   now in target')
    log(' -----------------------------------------------------------')
    for (const [table, src, loaded] of report) {
      if (/[()]/.test(table)) { log(` ${table.padEnd(26)} ${String(src).padStart(6)} ${String(loaded).padStart(8)}`); continue }
      const { rows } = await target.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`)
      log(` ${table.padEnd(26)} ${String(src).padStart(6)} ${String(loaded).padStart(8)} ${rows[0].n.padStart(14)}`)
    }
  } catch (e) {
    await target.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    await target.end()
  }
}

if (require.main === module) {
  run().catch(e => {
    console.error(`import failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
}
