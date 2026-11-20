import { expect } from 'chai'
import { env, resetTables, sequelize } from '../test-helper'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { q } from './crud'
import {
  cancelMove, computeTaxes, createMove, deleteMove, postMove, readMove, reconcileLines, resetToDraft, reverseMove, unreconcileLines, updateMove,
} from './move.service'

const rejects = async (fn: () => Promise<unknown>, text?: string) => {
  try { await fn() } catch (e) { if (text) expect((e as Error).message).to.contain(text); return e as Error }
  expect.fail('expected the call to be rejected')
}
const one = async <T>(sql: string, r: Record<string, unknown> = {}) => (await q<T>(sql, r))[0]
const ins = async (sql: string, r: Record<string, unknown>) => (await one<{ id: number }>(sql + ' RETURNING id', r)).id

describe('accounting core', () => {
  let co: number, partner: number
  let bank: number, recv: number, pay: number, income: number, expense: number, vatOut: number, vatIn: number
  let jGeneral: number, jSale: number, jPurchase: number
  let vat15: number

  beforeEach(async () => {
    await resetTables()
    const cur = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')", {})
    const p = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    co = (await Company.create({ name: 'Co', partner_id: p.id, currency_id: cur } as never)).id
    partner = (await Partner.create({ name: 'Customer', type: 'contact' } as never)).id
    const ty = (type: string, group: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + group, t: type, g: group })
    const tRecv = await ty('receivable', 'asset'), tPay = await ty('payable', 'liability'), tBank = await ty('liquidity', 'asset'), tInc = await ty('other', 'income'), tExp = await ty('other', 'expense'), tTax = await ty('other', 'liability')
    const acc = (code: string, type: number, rec = false) => ins('INSERT INTO account_account (code, name, user_type_id, company_id, reconcile, internal_type) VALUES (:c, :c, :t, :co, :r, (SELECT type FROM account_account_type WHERE id = :t))', { c: code, t: type, co, r: rec })
    bank = await acc('1010', tBank); recv = await acc('1100', tRecv, true); pay = await acc('2100', tPay, true)
    income = await acc('4000', tInc); expense = await acc('5000', tExp); vatOut = await acc('2200', tTax); vatIn = await acc('1200', tTax)
    await sequelize.query('UPDATE res_company SET account_receivable_id = :r, account_payable_id = :p WHERE id = :c', { replacements: { r: recv, p: pay, c: co } })
    const jr = (code: string, type: string) => ins('INSERT INTO account_journal (name, code, type, company_id) VALUES (:c, :c, :t, :co)', { c: code, t: type, co })
    jGeneral = await jr('MISC', 'general'); jSale = await jr('INV', 'sale'); jPurchase = await jr('BILL', 'purchase')
    vat15 = await ins("INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id, account_id, refund_account_id) VALUES ('VAT 15%', 'sale', 'percent', 15, :co, :a, :a)", { co, a: vatOut })
    await sequelize.query('UPDATE res_partner SET property_account_receivable_id = :r, property_account_payable_id = :p WHERE id = :id', { replacements: { r: recv, p: pay, id: partner } })
  })

  const entry = (date: string, debit: number, credit: number, over: Record<string, unknown> = {}) =>
    createMove({ date, journal_id: jGeneral, lines: [{ account_id: bank, debit, name: 'a' }, { account_id: income, credit, name: 'b' }], ...over } as never, env({ companyId: co }))

  describe('tax computation', () => {
    const cur = { id: 1, rounding: '0.01', decimal_places: 2 }
    const t = (o: object) => ({ id: 1, name: 't', amount_type: 'percent', amount: '15', price_include: false, include_base_amount: false, account_id: null, refund_account_id: null, sequence: 1, tax_exigibility: 'on_invoice', ...o }) as never
    it('percent excluded', () => {
      const r = computeTaxes([t({})], '100', '2', cur)
      expect(r.total_excluded.toString()).to.equal('200'); expect(r.total_included.toString()).to.equal('230')
    })
    it('percent included extracts the tax from the price', () => {
      const r = computeTaxes([t({ price_include: true })], '115', '1', cur)
      expect(r.total_excluded.toString()).to.equal('100'); expect(r.taxes[0].amount.toString()).to.equal('15')
    })
    it('fixed tax is per unit and include_base_amount feeds the next tax', () => {
      const r = computeTaxes([t({ amount_type: 'fixed', amount: '2', include_base_amount: true }), t({ id: 2 })], '100', '2', cur)
      expect(r.taxes[0].amount.toString()).to.equal('4'); expect(r.taxes[1].amount.toString()).to.equal('30.6')
    })
  })

  describe('entries', () => {
    it('creates a draft, posts it with a journal sequence', async () => {
      const id = await entry('2026-03-01', 100, 100)
      expect((await readMove(id)).state).to.equal('draft')
      expect(await postMove(id, env())).to.equal('MISC/2026/0001')
      const id2 = await entry('2026-03-02', 5, 5)
      expect(await postMove(id2, env())).to.equal('MISC/2026/0002')
      expect((await readMove(id)).amount).to.equal('100.0000')
    })
    it('refuses an unbalanced entry', async () => {
      const id = await entry('2026-03-01', 100, 90)
      await rejects(() => postMove(id, env()), 'unbalanced')
    })
    it('refuses a line with both debit and credit, and an empty entry', async () => {
      const id = await createMove({ date: '2026-03-01', journal_id: jGeneral, lines: [{ account_id: bank, debit: 5, credit: 5 }, { account_id: income, credit: 0, debit: 0 }] } as never, env({ companyId: co }))
      await rejects(() => postMove(id, env()), 'both')
      const e = await createMove({ date: '2026-03-01', journal_id: jGeneral, lines: [] } as never, env({ companyId: co }))
      await rejects(() => postMove(e, env()), 'add a line')
    })
    it('refuses a deprecated account', async () => {
      const id = await entry('2026-03-01', 10, 10)
      await sequelize.query('UPDATE account_account SET deprecated = true WHERE id = :a', { replacements: { a: bank } })
      await rejects(() => postMove(id, env()), 'deprecated')
    })
    it('posted entries cannot be edited or deleted', async () => {
      const id = await entry('2026-03-01', 10, 10); await postMove(id, env())
      await rejects(() => updateMove(id, { ref: 'x' }, env()), 'posted')
      await rejects(() => deleteMove(id), 'posted')
    })
    it('draft can be edited (lines replaced) and deleted', async () => {
      const id = await entry('2026-03-01', 10, 10)
      await updateMove(id, { lines: [{ account_id: bank, debit: 7 }, { account_id: income, credit: 7 }] }, env())
      expect((await readMove(id)).lines).to.have.length(2)
      await deleteMove(id)
      await rejects(() => readMove(id), 'not found')
    })
    it('lock dates block posting on or before the date', async () => {
      await sequelize.query("UPDATE res_company SET period_lock_date = '2026-03-31' WHERE id = :c", { replacements: { c: co } })
      const id = await entry('2026-03-31', 10, 10)
      await rejects(() => postMove(id, env()), 'lock date')
      const ok = await entry('2026-04-01', 10, 10)
      await postMove(ok, env())
    })
    it('journal account control restricts accounts', async () => {
      await sequelize.query('INSERT INTO account_account_type_rel (journal_id, account_id) VALUES (:j, :a)', { replacements: { j: jGeneral, a: bank } })
      const id = await entry('2026-03-01', 10, 10)
      await rejects(() => postMove(id, env()), 'not in the allowed')
    })
    it('cancel and reset need the journal to allow it, and are blocked when reconciled', async () => {
      const id = await entry('2026-03-01', 10, 10); await postMove(id, env())
      await rejects(() => cancelMove(id, env()), 'allow cancelling')
      await sequelize.query('UPDATE account_journal SET update_posted = true WHERE id = :j', { replacements: { j: jGeneral } })
      await cancelMove(id, env())
      expect((await readMove(id)).state).to.equal('cancel')
      await resetToDraft(id, env())
      expect((await readMove(id)).state).to.equal('draft')
    })
    it('reverse swaps debit and credit and links the entries', async () => {
      const id = await entry('2026-03-01', 40, 40); await postMove(id, env())
      const rid = await reverseMove(id, { date: '2026-03-05', post: true }, env())
      const r = await readMove(rid)
      expect(r.state).to.equal('posted'); expect(r.reversed_entry_id).to.equal(id)
      expect(r.lines.find((l: any) => l.account_id.id === bank).credit).to.equal('40.0000')
      await rejects(() => reverseMove(id, {}, env()), 'already been reversed')
    })
  })

  describe('invoices', () => {
    const invoice = (over: Record<string, unknown> = {}) => createMove({
      move_type: 'out_invoice', date: '2026-03-10', journal_id: jSale, partner_id: partner,
      lines: [{ account_id: income, name: 'Item', quantity: 2, price_unit: 100, tax_ids: [vat15] }], ...over,
    } as never, env({ companyId: co }))

    it('builds product, tax and receivable lines and totals', async () => {
      const id = await invoice()
      const m = await readMove(id)
      expect(m.amount_untaxed).to.equal('200.0000'); expect(m.amount_tax).to.equal('30.0000'); expect(m.amount_total).to.equal('230.0000'); expect(m.amount_residual).to.equal('230.0000')
      const ar = m.lines.find((l: any) => l.account_id.id === recv)
      expect(ar.debit).to.equal('230.0000')
      expect(m.lines.find((l: any) => l.tax_line_id).credit).to.equal('30.0000')
      expect(await postMove(id, env())).to.equal('INV/2026/0001')
    })
    it('a vendor bill debits expense and credits payable', async () => {
      const id = await invoice({ move_type: 'in_invoice', journal_id: jPurchase, lines: [{ account_id: expense, quantity: 1, price_unit: 50 }] })
      const m = await readMove(id)
      expect(m.lines.find((l: any) => l.account_id.id === expense).debit).to.equal('50.0000')
      expect(m.lines.find((l: any) => l.account_id.id === pay).credit).to.equal('50.0000')
    })
    it('requires the right journal type and a partner', async () => {
      await rejects(() => invoice({ journal_id: jPurchase }), 'sale journal')
      await rejects(() => invoice({ partner_id: null }), 'partner_id')
    })
    it('payment term splits the receivable', async () => {
      const term = await ins("INSERT INTO account_payment_term (name) VALUES ('50/50')", {})
      await sequelize.query("INSERT INTO account_payment_term_line (payment_id, value, value_amount, days, sequence) VALUES (:t,'percent',50,15,1), (:t,'balance',0,45,2)", { replacements: { t: term } })
      const m = await readMove(await invoice({ invoice_payment_term_id: term }))
      const ar = m.lines.filter((l: any) => l.account_id.id === recv)
      expect(ar).to.have.length(2); expect(ar[0].debit).to.equal('115.0000'); expect(ar[1].debit).to.equal('115.0000')
    })
    it('a refund flips the sides and uses the refund sequence when enabled', async () => {
      await sequelize.query('UPDATE account_journal SET refund_sequence = true WHERE id = :j', { replacements: { j: jSale } })
      const id = await invoice({ move_type: 'out_refund' })
      const m = await readMove(id)
      expect(m.lines.find((l: any) => l.account_id.id === recv).credit).to.equal('230.0000')
      expect(await postMove(id, env())).to.equal('RINV/2026/0001')
    })
  })

  describe('reconciliation', () => {
    it('partial then full reconcile updates residuals and payment state', async () => {
      const inv = await createMove({ move_type: 'out_invoice', date: '2026-03-10', journal_id: jSale, partner_id: partner, lines: [{ account_id: income, quantity: 1, price_unit: 100 }] } as never, env({ companyId: co }))
      await postMove(inv, env())
      const mk = async (amt: number) => { const id = await createMove({ date: '2026-03-12', journal_id: jGeneral, lines: [{ account_id: bank, debit: amt }, { account_id: recv, credit: amt, partner_id: partner }] } as never, env({ companyId: co })); await postMove(id, env()); return id }
      const line = async (move: number) => (await one<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a', { m: move, a: recv })).id
      const p1 = await mk(40), p2 = await mk(60)
      const invLine = await line(inv)
      const r1 = await reconcileLines([invLine, await line(p1)], env())
      expect(r1.full).to.equal(false)
      let m = await readMove(inv); expect(m.payment_state).to.equal('partial'); expect(m.amount_residual).to.equal('60.0000')
      const r2 = await reconcileLines([invLine, await line(p2)], env())
      expect(r2.full).to.equal(true)
      m = await readMove(inv); expect(m.payment_state).to.equal('paid'); expect(m.amount_residual).to.equal('0.0000')
      await rejects(() => cancelMoveAfter(inv), 'reconciled')
      await unreconcileLines([invLine])
      m = await readMove(inv); expect(m.payment_state).to.equal('not_paid'); expect(m.amount_residual).to.equal('100.0000')
    })
    async function cancelMoveAfter(id: number) {
      await sequelize.query('UPDATE account_journal SET update_posted = true')
      return cancelMove(id, env())
    }
    it('refuses different accounts or partners and non-reconcilable accounts', async () => {
      const a = await createMove({ date: '2026-03-12', journal_id: jGeneral, lines: [{ account_id: bank, debit: 5 }, { account_id: income, credit: 5 }] } as never, env({ companyId: co }))
      await postMove(a, env())
      const ids = (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m', { m: a })).map(r => r.id)
      await rejects(() => reconcileLines(ids, env()), 'allow reconciliation')
      await rejects(() => reconcileLines([ids[0]], env()), 'at least two')
    })
  })
})
