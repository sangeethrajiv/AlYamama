import { expect } from 'chai'
import { env, resetTables, sequelize } from '../test-helper'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { q } from './crud'
import { createMove, postMove, readMove, reconcileLines, reverseMove } from './move.service'
import { createPayment, postPayment, cancelPayment } from './payment.service'
import * as rep from './reports.service'

const ins = async (sql: string, r: Record<string, unknown> = {}) => (await q<{ id: number }>(sql + ' RETURNING id', r))[0].id
const rejects = async (fn: () => Promise<unknown>, text: string) => { try { await fn() } catch (e) { expect((e as Error).message).to.contain(text); return } expect.fail('expected the call to be rejected') }
const n = (v: unknown) => Number(v)

/**
 * The flow for one company, as in Odoo 12: several invoices and bills, a payment on one invoice, a partial payment,
 * one payment (batch) for several documents, an overpayment and a payment on account matched later,
 * a credit note, and then the journal entries and ledgers.
 */
describe('accounting flow for one company: invoices, bills, payments, batch, reconciliation, ledgers', () => {
  let co: number, custA: number, custB: number, vendX: number, vendY: number
  let recv: number, pay: number, income: number, expense: number, bank: number, vatOut: number, vatIn: number
  let jInv: number, jBill: number, jBank: number, vat15: number, vat5: number, vatBuy: number
  const e = () => env({ uid: null, companyId: co, allowedCompanyIds: [co] })

  before(async () => {
    await resetTables()
    const sar = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    const cp = await Partner.create({ name: 'Team', is_company: true, type: 'contact' } as never)
    co = (await Company.create({ name: 'Team', partner_id: cp.id, currency_id: sar } as never)).id
    const mk = async (name: string) => (await Partner.create({ name, type: 'contact' } as never)).id
    custA = await mk('Customer A'); custB = await mk('Customer B'); vendX = await mk('Vendor X'); vendY = await mk('Vendor Y')
    const ty = (type: string, g: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + g, t: type, g })
    const [tR, tP, tB, tI, tE, tL, tA] = [await ty('receivable', 'asset'), await ty('payable', 'liability'), await ty('liquidity', 'asset'), await ty('other', 'income'), await ty('other', 'expense'), await ty('other', 'liability'), await ty('other', 'asset')]
    const acc = (code: string, t: number, rec = false) => ins('INSERT INTO account_account (code, name, user_type_id, company_id, reconcile) VALUES (:c, :c, :t, :co, :r)', { c: code, t, co, r: rec })
    recv = await acc('1100', tR, true); pay = await acc('2100', tP, true); bank = await acc('1010', tB); income = await acc('4000', tI); expense = await acc('5000', tE); vatOut = await acc('2200', tL); vatIn = await acc('1200', tA)
    await sequelize.query('UPDATE res_company SET account_receivable_id = :r, account_payable_id = :p WHERE id = :c', { replacements: { r: recv, p: pay, c: co } })
    const jr = (c: string, t: string, b?: number) => ins('INSERT INTO account_journal (name, code, type, company_id, default_debit_account_id, default_credit_account_id, update_posted) VALUES (:c, :c, :t, :co, :b, :b, true)', { c, t, co, b: b ?? null })
    jInv = await jr('INV', 'sale'); jBill = await jr('BILL', 'purchase'); jBank = await jr('BNK1', 'bank', bank)
    const tax = (name: string, use: string, amt: number, a: number) => ins("INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id, account_id, refund_account_id) VALUES (:n, :u, 'percent', :a, :co, :ac, :ac)", { n: name, u: use, a: amt, co, ac: a })
    vat15 = await tax('VAT 15%', 'sale', 15, vatOut); vat5 = await tax('VAT 5%', 'sale', 5, vatOut); vatBuy = await tax('15%', 'purchase', 15, vatIn)
  })

  const invoice = async (partner: number, date: string, price: number, tax = vat15, due?: string) => {
    const id = await createMove({ move_type: 'out_invoice', date, invoice_date: date, invoice_date_due: due ?? date, journal_id: jInv, partner_id: partner, lines: [{ account_id: income, name: 'Service', quantity: 1, price_unit: price, tax_ids: [tax] }] } as never, e())
    await postMove(id, e()); return id
  }
  const bill = async (partner: number, date: string, price: number) => {
    const id = await createMove({ move_type: 'in_invoice', date, invoice_date: date, invoice_date_due: date, journal_id: jBill, partner_id: partner, lines: [{ account_id: expense, name: 'Goods', quantity: 1, price_unit: price, tax_ids: [vatBuy] }] } as never, e())
    await postMove(id, e()); return id
  }
  const pay_ = async (opts: Record<string, unknown>) => { const id = await createPayment({ journal_id: jBank, payment_date: '2026-04-01', ...opts } as never, e()); await postPayment(id, e()); return id }
  const state = async (id: number) => { const m = await readMove(id); return { state: m.payment_state as string, residual: n(m.amount_residual), total: n(m.amount_total) } }
  const payState = async (id: number) => (await q<{ state: string }>('SELECT state FROM account_payment WHERE id = :id', { id }))[0].state
  const arLine = async (move: number) => (await q<{ id: number }>("SELECT l.id FROM account_move_line l JOIN account_account a ON a.id = l.account_id WHERE l.move_id = :m AND a.reconcile", { m: move }))[0].id

  let a1: number, a2: number, a3: number, a4: number, b1: number
  it('customer A: four invoices with different taxes and amounts', async () => {
    a1 = await invoice(custA, '2026-03-01', 1000, vat15, '2026-03-31')      // 1150
    a2 = await invoice(custA, '2026-03-05', 2000, vat15, '2026-04-05')      // 2300
    a3 = await invoice(custA, '2026-03-10', 500, vat5, '2026-04-10')        // 525
    a4 = await invoice(custA, '2026-03-15', 1000, vat15, '2026-04-15')      // 1150
    expect([a1, a2, a3, a4].map(async i => (await state(i)).total)).to.have.length(4)
    expect((await state(a1)).total).to.equal(1150); expect((await state(a3)).total).to.equal(525)
    b1 = await invoice(custB, '2026-03-20', 800)                              // 920
  })

  it('a payment made for one invoice only settles it and is itself reconciled', async () => {
    const p = await pay_({ invoice_ids: [a1] })                                // amount defaults to the invoice residual
    expect(await state(a1)).to.deep.equal({ state: 'paid', residual: 0, total: 1150 })
    expect(await payState(p)).to.equal('reconciled')
    const m = await readMove((await q<{ move_id: number }>('SELECT move_id FROM account_payment WHERE id = :p', { p }))[0].move_id)
    expect(m.reconciled_items).to.have.length(1)                              // the payment's entry lists what it settled
  })

  it('a partial payment leaves the invoice partly paid', async () => {
    const p = await pay_({ invoice_ids: [a2], amount: 1000 })
    expect(await state(a2)).to.deep.equal({ state: 'partial', residual: 1300, total: 2300 })
    expect(await payState(p)).to.equal('reconciled')
  })

  it('one batch payment settles the rest of invoice 2 and invoices 3 and 4', async () => {
    const p = await pay_({ invoice_ids: [a2, a3, a4], payment_date: '2026-04-20' })  // 1300 + 525 + 1150 = 2975
    for (const id of [a2, a3, a4]) expect((await state(id)).state).to.equal('paid')
    expect(await payState(p)).to.equal('reconciled')
    const row = (await q<{ amount: string; move_id: number }>('SELECT amount, move_id FROM account_payment WHERE id = :p', { p }))[0]
    expect(n(row.amount)).to.equal(2975)
    const m = await readMove(row.move_id)
    expect(m.reconciled_items).to.have.length(3)
    // the three invoices and the payment were settled together: one full reconcile marker for the lot
    const frs = await q<{ f: number | null }>('SELECT DISTINCT full_reconcile_id f FROM account_move_line WHERE id IN (:ids)', { ids: [await arLine(a2), await arLine(a3), await arLine(a4)] })
    expect(frs).to.have.length(1); expect(frs[0].f).to.be.a('number')
  })

  it('a batch payment smaller than the total pays the oldest due first', async () => {
    const x1 = await invoice(custB, '2026-04-01', 100, vat15, '2026-05-01')   // 115, due last
    const x2 = await invoice(custB, '2026-04-02', 200, vat15, '2026-04-10')   // 230, due first
    const x3 = await invoice(custB, '2026-04-03', 300, vat15, '2026-04-20')   // 345
    await pay_({ invoice_ids: [x1, x2, x3], amount: 300 })
    expect(await state(x2)).to.deep.equal({ state: 'paid', residual: 0, total: 230 })        // oldest due paid in full
    expect((await state(x3)).residual).to.equal(275)                                          // then 70 of the next
    expect((await state(x1)).residual).to.equal(115)                                          // the last untouched
    await pay_({ invoice_ids: [x1, x3] })                                                     // settle the remainder
    expect((await state(x1)).state).to.equal('paid'); expect((await state(x3)).state).to.equal('paid')
  })

  it('an overpayment leaves a credit that is matched to a later invoice (outstanding credits)', async () => {
    const over = await pay_({ invoice_ids: [b1], amount: 1500, payment_date: '2026-05-01' })  // invoice is 920
    expect((await state(b1)).state).to.equal('paid')
    expect(await payState(over)).to.equal('posted')                                           // 580 still open on the payment
    const credit = (await q<{ id: number }>('SELECT l.id FROM account_move_line l JOIN account_payment p ON p.id = l.payment_id WHERE p.id = :p AND l.account_id = :a', { p: over, a: recv }))[0].id
    expect(n((await q<{ r: string }>('SELECT amount_residual r FROM account_move_line WHERE id = :id', { id: credit }))[0].r)).to.equal(-580)
    const later = await invoice(custB, '2026-05-02', 400)                                     // 460
    await reconcileLines([await arLine(later), credit], e())
    expect(await state(later)).to.deep.equal({ state: 'paid', residual: 0, total: 460 })
    expect(n((await q<{ r: string }>('SELECT amount_residual r FROM account_move_line WHERE id = :id', { id: credit }))[0].r)).to.equal(-120)   // 580 - 460 still open
  })

  it('a payment on account (no invoice) is matched later and closes both', async () => {
    const onAccount = await pay_({ partner_id: custA, partner_type: 'customer', payment_type: 'inbound', amount: 345, payment_date: '2026-05-05' })
    expect(await payState(onAccount)).to.equal('posted')
    const inv = await invoice(custA, '2026-05-06', 300)                                       // 345
    const credit = (await q<{ id: number }>('SELECT l.id FROM account_move_line l WHERE l.payment_id = :p AND l.account_id = :a', { p: onAccount, a: recv }))[0].id
    const r = await reconcileLines([await arLine(inv), credit], e())
    expect(r.full).to.equal(true); expect((await state(inv)).state).to.equal('paid')
  })

  it('a credit note settles an invoice by reconciling the two', async () => {
    const inv = await invoice(custA, '2026-05-10', 1000)                                      // 1150
    const note = await reverseMove(inv, { date: '2026-05-11', post: true }, e())
    expect((await readMove(note)).move_type).to.equal('out_refund')
    const r = await reconcileLines([await arLine(inv), await arLine(note)], e())
    expect(r.full).to.equal(true)
    expect((await state(inv)).state).to.equal('paid'); expect((await state(note)).state).to.equal('paid')
  })

  it('vendor bills: a payment for one, a partial one, and a batch payment for several', async () => {
    const v1 = await bill(vendX, '2026-03-02', 400)    // 460
    const v2 = await bill(vendX, '2026-03-04', 600)    // 690
    const v3 = await bill(vendX, '2026-03-06', 200)    // 230
    const w1 = await bill(vendY, '2026-03-08', 1000)   // 1150
    await pay_({ invoice_ids: [v1] }); expect((await state(v1)).state).to.equal('paid')
    const p = await pay_({ invoice_ids: [v2], amount: 300, payment_date: '2026-04-02' })
    expect(await state(v2)).to.deep.equal({ state: 'partial', residual: 390, total: 690 }); expect(await payState(p)).to.equal('reconciled')
    const batch = await pay_({ invoice_ids: [v2, v3], payment_date: '2026-04-10' })           // 390 + 230
    expect((await state(v2)).state).to.equal('paid'); expect((await state(v3)).state).to.equal('paid'); expect(await payState(batch)).to.equal('reconciled')
    expect(n((await q<{ a: string }>('SELECT amount a FROM account_payment WHERE id = :p', { p: batch }))[0].a)).to.equal(620)
    await rejects(() => createPayment({ invoice_ids: [v3, w1], journal_id: jBank } as never, e()), 'already paid')   // v3 is already paid
    const openInvoice = await invoice(custB, '2026-06-05', 50)                                                       // 57.50, left open on purpose
    await rejects(() => createPayment({ invoice_ids: [w1, openInvoice], journal_id: jBank } as never, e()), 'same partner')   // a vendor's bill and a customer's invoice never go in one payment
    await rejects(() => createPayment({ invoice_ids: [w1, v1], journal_id: jBank } as never, e()), 'already paid')
    await pay_({ invoice_ids: [w1] }); expect((await state(w1)).state).to.equal('paid')
  })

  it('cancelling a payment reopens what it settled', async () => {
    const inv = await invoice(custA, '2026-06-01', 100)                                       // 115
    const p = await pay_({ invoice_ids: [inv] })
    expect((await state(inv)).state).to.equal('paid')
    await cancelPayment(p, e())
    expect(await state(inv)).to.deep.equal({ state: 'not_paid', residual: 115, total: 115 })
  })

  describe('journal entries and ledgers after all of that', () => {
    const filter = () => ({ companyIds: [co], date_from: '2026-01-01', date_to: '2026-12-31' })

    it('every posted entry is balanced', async () => {
      const bad = await q<{ id: number }>("SELECT m.id FROM account_move m JOIN account_move_line l ON l.move_id = m.id WHERE m.state = 'posted' GROUP BY m.id HAVING sum(l.debit) <> sum(l.credit)")
      expect(bad).to.have.length(0)
    })
    it('the trial balance balances and the receivable account equals what is open', async () => {
      const tb = await rep.trialBalance(filter())
      expect(tb.totals.debit).to.equal(tb.totals.credit); expect(tb.totals.ending).to.equal('0')
      const open = n((await q<{ s: string }>("SELECT sum(l.amount_residual) s FROM account_move_line l JOIN account_move m ON m.id = l.move_id WHERE l.account_id = :a AND m.state = 'posted'", { a: recv }))[0].s)
      expect(n(tb.lines.find(l => l.code === '1100')!.ending)).to.equal(open)
    })
    it('the partner ledger of customer A lists every line with a matching number and a running balance', async () => {
      const r = await rep.partnerLedger({ ...filter(), partner_id: custA, detail: true }, 'receivable')
      const a = (r.partners as any[])[0]
      expect(a.name).to.equal('Customer A'); expect(a.lines.length).to.be.greaterThan(8)
      expect(a.lines[a.lines.length - 1].balance).to.equal(a.ending)
      expect(a.lines.some((l: any) => /^A\d+$/.test(l.matching))).to.equal(true)
      // only the cancelled-payment invoice (115) is still open for this customer
      expect(n(a.ending)).to.equal(115)
    })
    it('aged receivable equals the sum of the open invoices less open credits', async () => {
      let aged: any; try { aged = await rep.agedBalance({ ...filter(), date_to: '2026-12-31' }, 'receivable') } catch (e) { throw new Error(String((e as any).parent?.message ?? e)) }
      const open = n((await q<{ s: string }>("SELECT sum(l.amount_residual) s FROM account_move_line l JOIN account_move m ON m.id = l.move_id WHERE l.account_id = :a AND NOT l.reconciled AND m.state = 'posted'", { a: recv }))[0].s)
      expect(n(aged.totals.total), JSON.stringify(aged.totals)).to.equal(open)
    })
    it('the general ledger of the bank account ends with money received less money paid', async () => {
      const gl = await rep.generalLedger({ ...filter(), account_id: bank })
      const acc = (gl.accounts as any[])[0]
      const [x] = await q<{ d: string; c: string }>("SELECT sum(l.debit) d, sum(l.credit) c FROM account_move_line l JOIN account_move m ON m.id = l.move_id WHERE l.account_id = :a AND m.state = 'posted'", { a: bank })
      expect(n(acc.ending)).to.equal(n(x.d) - n(x.c))
      expect(n(acc.ending)).to.be.greaterThan(0)
    })
    it('the tax report matches the invoices and bills', async () => {
      const t = await rep.taxReport(filter())
      const [s] = await q<{ v: string }>("SELECT sum(l.credit - l.debit) v FROM account_move_line l JOIN account_move m ON m.id = l.move_id WHERE l.account_id = :a AND m.state = 'posted'", { a: vatOut })
      expect(n(t.output_tax)).to.equal(n(s.v))
    })
  })
})

describe('payment terms and due dates', () => {
  it('a typed due date wins over the partner default term, and the oldest due is paid first in a batch', async () => {
    await resetTables()
    const sar = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    const cp = await Partner.create({ name: 'Team', is_company: true, type: 'contact' } as never)
    const co = (await Company.create({ name: 'Team', partner_id: cp.id, currency_id: sar } as never)).id
    const cust = (await Partner.create({ name: 'Cust', type: 'contact' } as never)).id
    const ty = (type: string, g: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + g, t: type, g })
    const [tR, tB, tI] = [await ty('receivable', 'asset'), await ty('liquidity', 'asset'), await ty('other', 'income')]
    const acc = (c: string, t: number, rec = false) => ins('INSERT INTO account_account (code, name, user_type_id, company_id, reconcile) VALUES (:c, :c, :t, :co, :r)', { c, t, co, r: rec })
    const recv = await acc('1100', tR, true), bank = await acc('1010', tB), income = await acc('4000', tI)
    await sequelize.query('UPDATE res_company SET account_receivable_id = :r WHERE id = :c', { replacements: { r: recv, c: co } })
    const term = await ins("INSERT INTO account_payment_term (name, company_id) VALUES ('60 days', :co)", { co })
    await sequelize.query("INSERT INTO account_payment_term_line (payment_id, value, days, sequence) VALUES (:t, 'balance', 60, 1)", { replacements: { t: term } })
    await sequelize.query('UPDATE res_partner SET property_account_receivable_id = :r, property_payment_term_id = :t WHERE id = :p', { replacements: { r: recv, t: term, p: cust } })
    const jInv = await ins("INSERT INTO account_journal (name, code, type, company_id) VALUES ('INV', 'INV', 'sale', :co)", { co })
    const jBank = await ins("INSERT INTO account_journal (name, code, type, company_id, default_debit_account_id, default_credit_account_id) VALUES ('BNK', 'BNK', 'bank', :co, :b, :b)", { co, b: bank })
    const e = () => env({ uid: null, companyId: co, allowedCompanyIds: [co] })
    const inv = async (price: number, date: string, due?: string) => {
      const id = await createMove({ move_type: 'out_invoice', date, invoice_date: date, ...(due ? { invoice_date_due: due } : {}), journal_id: jInv, partner_id: cust, lines: [{ account_id: income, quantity: 1, price_unit: price }] } as never, e())
      await postMove(id, e()); return id
    }
    const late = await inv(100, '2026-03-01', '2026-06-30')     // typed due date, later
    const early = await inv(100, '2026-03-02', '2026-04-01')    // typed due date, earlier although created second
    const byTerm = await inv(100, '2026-03-03')                 // none typed: the partner's 60 days
    const due = async (id: number) => String((await readMove(id)).invoice_date_due).slice(0, 10)
    expect(await due(early)).to.equal('2026-04-01'); expect(await due(late)).to.equal('2026-06-30'); expect(await due(byTerm)).to.equal('2026-05-02')
    const lineDue = (await q<{ d: string }>('SELECT date_maturity d FROM account_move_line WHERE move_id = :m AND account_id = :a', { m: early, a: recv }))[0].d
    expect(String(lineDue).slice(0, 10)).to.equal('2026-04-01')
    const pid = await createPayment({ invoice_ids: [late, early, byTerm], amount: 150, journal_id: jBank, payment_date: '2026-04-05' } as never, e()); await postPayment(pid, e())
    const r = async (id: number) => { const m = await readMove(id); return [m.payment_state, Number(m.amount_residual)] }
    expect(await r(early)).to.deep.equal(['paid', 0])           // due first
    expect(await r(byTerm)).to.deep.equal(['partial', 50])      // then 50 of the next (due 2 May)
    expect(await r(late)).to.deep.equal(['not_paid', 100])      // due last, untouched
  })
})
