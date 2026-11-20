import { expect } from 'chai'
import { env, resetTables, sequelize } from '../test-helper'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { createUom, createUomCategory } from '../inventory/uom/uom.service'
import { createCategory } from '../inventory/category/product-category.service'
import { createProduct } from '../inventory/product/product.service'
import { q } from './crud'
import { cancelMove, createMove, postMove, readMove } from './move.service'
import { cancelPayment, createPayment, postPayment } from './payment.service'
import { addStatementLine, bookStatementLine, confirmStatement, createStatement, readStatement, unbookStatementLine } from './bank.service'
import * as rep from './reports.service'

const rejects = async (fn: () => Promise<unknown>, text?: string) => {
  try { await fn() } catch (e) { if (text) expect((e as Error).message).to.contain(text); return }
  expect.fail('expected the call to be rejected')
}
const ins = async (sql: string, r: Record<string, unknown> = {}) => (await q<{ id: number }>(sql + ' RETURNING id', r))[0].id

/** The whole flow once: product -> customer invoice -> payment -> reconcile -> bank statement -> reports. */
describe('accounting flow (customer invoice, vendor bill, payments, bank, reports)', () => {
  let co: number, customer: number, vendor: number, product: number
  let bank: number, recv: number, pay: number, income: number, expense: number, vatOut: number, vatIn: number, discount: number
  let jSale: number, jPurchase: number, jBank: number, jMisc: number, vatSale: number, vatBuy: number, analytic: number
  const e = () => env({ companyId: co, allowedCompanyIds: [co] })

  before(async () => {
    await resetTables()
    const cur = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    const cp = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    co = (await Company.create({ name: 'Co', partner_id: cp.id, currency_id: cur } as never)).id
    customer = (await Partner.create({ name: 'Customer A', type: 'contact' } as never)).id
    vendor = (await Partner.create({ name: 'Vendor B', type: 'contact' } as never)).id
    const cat = await createUomCategory({ name: 'Unit', measure_type: 'unit' }, env())
    const uom = await createUom({ name: 'Unit', category_id: cat.id, uom_type: 'reference' }, env())
    const pc = await createCategory({ name: 'All' }, env())
    const tpl = await createProduct({ name: 'Widget', categ_id: pc.id, uom_id: uom.id } as never, env())
    product = (await q<{ id: number }>('SELECT id FROM product_product WHERE product_tmpl_id = :t', { t: tpl.id }))[0].id
    const ty = (type: string, g: string, ib = false) => ins('INSERT INTO account_account_type (name, type, internal_group, include_initial_balance) VALUES (:n, :t, :g, :ib)', { n: type + g, t: type, g, ib })
    const [tR, tP, tB, tI, tE, tL, tA] = [await ty('receivable', 'asset', true), await ty('payable', 'liability', true), await ty('liquidity', 'asset', true), await ty('other', 'income'), await ty('other', 'expense'), await ty('other', 'liability', true), await ty('other', 'asset', true)]
    const acc = (code: string, t: number, rec = false) => ins('INSERT INTO account_account (code, name, user_type_id, company_id, reconcile) VALUES (:c, :c, :t, :co, :r)', { c: code, t, co, r: rec })
    bank = await acc('1010', tB); recv = await acc('1100', tR, true); pay = await acc('2100', tP, true); income = await acc('4000', tI); expense = await acc('5000', tE)
    vatOut = await acc('2200', tL); vatIn = await acc('1200', tA); discount = await acc('5900', tE)
    await sequelize.query('UPDATE res_company SET account_receivable_id = :r, account_payable_id = :p WHERE id = :c', { replacements: { r: recv, p: pay, c: co } })
    await sequelize.query('UPDATE res_partner SET property_account_receivable_id = :r, property_account_payable_id = :p WHERE id IN (:a, :b)', { replacements: { r: recv, p: pay, a: customer, b: vendor } })
    const jr = (c: string, t: string, extra = '') => ins(`INSERT INTO account_journal (name, code, type, company_id${extra ? ', default_debit_account_id, default_credit_account_id, update_posted' : ''}) VALUES (:c, :c, :t, :co${extra ? ', :b, :b, true' : ''})`, { c, t, co, b: bank })
    jSale = await jr('INV', 'sale'); jPurchase = await jr('BILL', 'purchase'); jBank = await jr('BNK1', 'bank', 'x'); jMisc = await jr('MISC', 'general')
    vatSale = await ins("INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id, account_id, refund_account_id) VALUES ('VAT 15% S', 'sale', 'percent', 15, :co, :a, :a)", { co, a: vatOut })
    vatBuy = await ins("INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id, account_id, refund_account_id) VALUES ('VAT 15% P', 'purchase', 'percent', 15, :co, :a, :a)", { co, a: vatIn })
    analytic = await ins("INSERT INTO account_analytic_account (name, code, company_id) VALUES ('Project X', 'PX', :co)", { co })
  })

  let inv: number, bill: number, pmt: number

  it('1. customer invoice for a product: posted with tax and analytic line', async () => {
    inv = await createMove({ move_type: 'out_invoice', date: '2026-02-01', journal_id: jSale, partner_id: customer,
      lines: [{ account_id: income, product_id: product, name: 'Widget', quantity: 10, price_unit: 100, tax_ids: [vatSale], analytic_account_id: analytic }] } as never, e())
    expect(await postMove(inv, e())).to.equal('INV/2026/0001')
    const m = await readMove(inv)
    expect(m.amount_total).to.equal('1150.0000'); expect(m.payment_state).to.equal('not_paid')
    const al = await q<{ amount: string }>('SELECT amount FROM account_analytic_line WHERE account_id = :a', { a: analytic })
    expect(al).to.have.length(1); expect(al[0].amount).to.equal('1000.0000')
  })

  it('2. vendor bill posted', async () => {
    bill = await createMove({ move_type: 'in_invoice', date: '2026-02-03', journal_id: jPurchase, partner_id: vendor, lines: [{ account_id: expense, name: 'Parts', quantity: 1, price_unit: 400, tax_ids: [vatBuy] }] } as never, e())
    await postMove(bill, e())
    expect((await readMove(bill)).amount_total).to.equal('460.0000')
  })

  it('3. partial customer payment reconciles the invoice partially', async () => {
    pmt = await createPayment({ invoice_ids: [inv], amount: 400, journal_id: jBank, payment_date: '2026-02-10' }, e())
    expect(await postPayment(pmt, e())).to.match(/^BNK1\/2026\//)
    const m = await readMove(inv)
    expect(m.payment_state).to.equal('partial'); expect(m.amount_residual).to.equal('750.0000')
    // the whole 400 was used up by the invoice, so the payment itself is already reconciled
    expect((await q<{ state: string }>('SELECT state FROM account_payment WHERE id = :id', { id: pmt }))[0].state).to.equal('reconciled')
  })

  it('4. second payment settles the rest: invoice paid, payment reconciled', async () => {
    const p2 = await createPayment({ invoice_ids: [inv], journal_id: jBank, payment_date: '2026-02-20' }, e())   // amount defaults to the residual
    await postPayment(p2, e())
    const m = await readMove(inv)
    expect(m.payment_state).to.equal('paid'); expect(m.amount_residual).to.equal('0.0000')
    expect((await q<{ state: string }>('SELECT state FROM account_payment WHERE id = :id', { id: p2 }))[0].state).to.equal('reconciled')
    await rejects(() => createPayment({ invoice_ids: [inv], journal_id: jBank }, e()), 'already paid')
  })

  it('5. a payment cannot mix customer invoices and vendor bills', async () => {
    await rejects(() => createPayment({ invoice_ids: [bill, inv], journal_id: jBank }, e()))
  })

  it('6. vendor bill is paid through the bank statement (reconcile with the bill)', async () => {
    const st = await createStatement({ journal_id: jBank, date: '2026-03-01', balance_start: 1150, balance_end_real: 750,
      lines: [{ date: '2026-03-01', name: 'Payment to Vendor B', amount: -400, partner_id: vendor }] }, e())
    const line = (await readStatement(st)).lines[0]
    const billLine = (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a', { m: bill, a: pay }))[0].id
    await bookStatementLine(line.id, { move_line_ids: [billLine], writeoff: { account_id: discount, name: 'Early payment discount' } }, e())
    const m = await readMove(bill)
    // 460 owed, 400 paid, 60 written off -> settled
    expect(m.payment_state).to.equal('paid'); expect(m.amount_residual).to.equal('0.0000')
    const s = await readStatement(st)
    expect(s.lines[0].reconciled).to.equal(true); expect(s.difference).to.equal('0')
    await confirmStatement(st, e())
    await rejects(() => addStatementLine(st, { date: '2026-03-02', name: 'x', amount: 1 }, e()), 'confirmed')
  })

  it('7. unreconciling a statement line reopens the bill', async () => {
    const st = await createStatement({ journal_id: jBank, date: '2026-03-05', balance_start: 0, balance_end_real: 5, lines: [{ date: '2026-03-05', name: 'Bank interest', amount: 5 }] }, e())
    const lid = (await readStatement(st)).lines[0].id
    await bookStatementLine(lid, { account_id: income }, e())
    expect((await readStatement(st)).lines[0].reconciled).to.equal(true)
    await unbookStatementLine(lid)
    expect((await readStatement(st)).lines[0].reconciled).to.equal(false)
    await bookStatementLine(lid, { account_id: income }, e())
    await confirmStatement(st, e())
  })

  it('8. cancelling a payment re-opens the invoice (journal allows it)', async () => {
    await cancelPayment(pmt, e())
    const m = await readMove(inv)
    expect(m.amount_residual).to.equal('400.0000'); expect(m.payment_state).to.equal('partial')
    await rejects(() => cancelPayment(pmt, e()), 'already cancelled')
  })

  it('9. reports: trial balance balances, P&L, tax report, balance sheet, ledgers, aged', async () => {
    const f = { companyIds: [co], date_from: '2026-01-01', date_to: '2026-12-31' }
    const tb = await rep.trialBalance(f)
    expect(tb.totals.debit).to.equal(tb.totals.credit)
    expect(tb.totals.ending).to.equal('0')

    const pl = await rep.profitAndLoss(f)
    // income 1000 (invoice) + 5 (bank interest); expense 400 (bill) less the 60 discount received
    expect(pl.total_income).to.equal('1005'); expect(pl.total_expense).to.equal('340'); expect(pl.net_profit).to.equal('665')

    const tax = await rep.taxReport(f)
    expect(tax.output_tax).to.equal('150'); expect(tax.input_tax).to.equal('60'); expect(tax.net_tax_payable).to.equal('90')
    expect(tax.sales[0].base).to.equal('1000')

    const bs = await rep.balanceSheet(f)
    expect(bs.total_assets).to.equal(bs.total_liabilities_and_equity)

    const gl = await rep.generalLedger({ ...f, account_id: bank })
    expect(gl.accounts).to.have.length(1)
    const last = gl.accounts[0].lines[gl.accounts[0].lines.length - 1]
    expect(last.balance).to.equal(gl.accounts[0].ending)

    const ar = await rep.agedBalance({ ...f, date_to: '2026-12-31' }, 'receivable')
    expect(ar.totals.total).to.equal('400')              // the invoice re-opened by the cancelled payment
    expect(ar.partners[0].name).to.equal('Customer A')
    const ap = await rep.agedBalance(f, 'payable'); expect(ap.totals.total).to.equal('0')

    const pledger = await rep.partnerLedger(f, 'receivable'); expect(pledger.partners[0].ending).to.equal('400')
    const js = await rep.journalSummary(f); expect(js.journals.map(j => j.code)).to.include.members(['INV', 'BILL', 'BNK1'])
  })

  it('10. the accounting controls hold: unbalanced entry, cancelled invoice stays out of reports', async () => {
    const bad = await createMove({ date: '2026-04-01', journal_id: jMisc, lines: [{ account_id: bank, debit: 10 }, { account_id: income, credit: 9 }] } as never, e())
    await rejects(() => postMove(bad, e()), 'unbalanced')
    const draft = await createMove({ move_type: 'out_invoice', date: '2026-04-02', journal_id: jSale, partner_id: customer, lines: [{ account_id: income, quantity: 1, price_unit: 999 }] } as never, e())
    await postMove(draft, e())
    await sequelize.query('UPDATE account_journal SET update_posted = true WHERE id = :j', { replacements: { j: jSale } })
    await cancelMove(draft, e())
    const ar = await rep.agedBalance({ companyIds: [co], date_to: '2026-12-31' }, 'receivable')
    expect(ar.totals.total).to.equal('400')
  })

  it('11. a statement line without a partner takes the partner of the invoice it settles', async () => {
    const inv2 = await createMove({ move_type: 'out_invoice', date: '2026-03-02', journal_id: jSale, partner_id: customer, lines: [{ account_id: income, quantity: 1, price_unit: 80 }] } as never, e())
    await postMove(inv2, e())
    const st = await createStatement({ journal_id: jBank, date: '2026-03-03', balance_start: 0, balance_end_real: 80, lines: [{ date: '2026-03-03', name: 'Anonymous deposit', amount: 80 }] }, e())
    const lid = (await readStatement(st)).lines[0].id
    const open = (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a', { m: inv2, a: recv }))[0].id
    await bookStatementLine(lid, { move_line_ids: [open] }, e())
    expect((await readMove(inv2)).payment_state).to.equal('paid')
    expect((await readStatement(st)).lines[0].partner_id.name).to.equal('Customer A')
  })
})
