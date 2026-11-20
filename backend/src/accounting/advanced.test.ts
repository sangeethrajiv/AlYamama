import { expect } from 'chai'
import { env, resetTables, sequelize } from '../test-helper'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { q } from './crud'
import { createMove, postMove, previewTotals, readMove, reconcileLines, unreconcileLines } from './move.service'
import { createPayment, postPayment } from './payment.service'
import * as rep from './reports.service'
import * as extras from './extras.service'
import { importStatement, parseAmount, parseCsv, parseDate, parseOfx } from './bank-import.service'
import { readStatement } from './bank.service'

const rejects = async (fn: () => Promise<unknown>, text?: string) => {
  try { await fn() } catch (e) { if (text) expect((e as Error).message).to.contain(text); return }
  expect.fail('expected the call to be rejected')
}
const ins = async (sql: string, r: Record<string, unknown> = {}) => (await q<{ id: number }>(sql + ' RETURNING id', r))[0].id
const num = (v: unknown) => Number(v)

describe('accounting: exchange differences, cash-basis tax, statement import, notes, dashboard', () => {
  let co: number, customer: number, usd: number
  let bank: number, recv: number, income: number, gain: number, loss: number, vatOut: number, vatTransit: number
  let jMisc: number, jSale: number, jBank: number, jExchange: number, jCash: number
  let cashTax: number
  const e = () => env({ uid: null, companyId: co, allowedCompanyIds: [co] })

  beforeEach(async () => {
    await resetTables()
    const sar = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    usd = await ins("INSERT INTO res_currency (name, symbol) VALUES ('USD', '$')")
    const cp = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    co = (await Company.create({ name: 'Co', partner_id: cp.id, currency_id: sar } as never)).id
    customer = (await Partner.create({ name: 'Customer', type: 'contact' } as never)).id
    const ty = (type: string, g: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + g, t: type, g })
    const [tR, tB, tI, tL] = [await ty('receivable', 'asset'), await ty('liquidity', 'asset'), await ty('other', 'income'), await ty('other', 'liability')]
    const acc = (code: string, t: number, rec = false) => ins('INSERT INTO account_account (code, name, user_type_id, company_id, reconcile) VALUES (:c, :c, :t, :co, :r)', { c: code, t, co, r: rec })
    bank = await acc('1010', tB); recv = await acc('1100', tR, true); income = await acc('4000', tI)
    gain = await acc('4900', tI); loss = await acc('5900', tI); vatOut = await acc('2200', tL); vatTransit = await acc('2210', tL)
    await sequelize.query('UPDATE res_company SET account_receivable_id = :r WHERE id = :c', { replacements: { r: recv, c: co } })
    await sequelize.query('UPDATE res_partner SET property_account_receivable_id = :r WHERE id = :p', { replacements: { r: recv, p: customer } })
    const jr = (c: string, t: string, dr?: number, cr?: number) => ins('INSERT INTO account_journal (name, code, type, company_id, default_debit_account_id, default_credit_account_id, update_posted) VALUES (:c, :c, :t, :co, :dr, :cr, true)', { c, t, co, dr: dr ?? null, cr: cr ?? null })
    jMisc = await jr('MISC', 'general'); jSale = await jr('INV', 'sale'); jBank = await jr('BNK1', 'bank', bank, bank); jCash = await jr('CABA', 'general')
    jExchange = await jr('EXCH', 'general', loss, gain)
    await sequelize.query('UPDATE res_company SET currency_exchange_journal_id = :x, tax_cash_basis_journal_id = :c WHERE id = :id', { replacements: { x: jExchange, c: jCash, id: co } })
    cashTax = await ins(`INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id, account_id, refund_account_id, tax_exigibility, cash_basis_account_id)
      VALUES ('VAT cash', 'sale', 'percent', 15, :co, :a, :a, 'on_payment', :t)`, { co, a: vatOut, t: vatTransit })
  })

  // an entry that debits/credits the receivable in USD
  const fx = async (side: 'debit' | 'credit', sar: number, usdAmt: number, date: string) => {
    const id = await createMove({ date, journal_id: jMisc, lines: [
      { account_id: recv, partner_id: customer, [side]: sar, currency_id: usd, amount_currency: side === 'debit' ? usdAmt : -usdAmt },
      { account_id: side === 'debit' ? income : bank, [side === 'debit' ? 'credit' : 'debit']: sar },
    ] } as never, e())
    await postMove(id, e())
    return (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a', { m: id, a: recv }))[0].id
  }

  describe('foreign-currency exchange difference', () => {
    it('a gain: customer paid USD 100 worth more SAR than it was booked at', async () => {
      const inv = await fx('debit', 375, 100, '2026-03-01')       // 100 USD booked at 3.75
      const pay = await fx('credit', 380, 100, '2026-03-20')      // 100 USD received worth 380
      const r = await reconcileLines([inv, pay], e())
      expect(r.full).to.equal(true)
      const lines = await q<Record<string, any>>('SELECT id, amount_residual, amount_residual_currency, reconciled, full_reconcile_id FROM account_move_line WHERE id IN (:a, :b)', { a: inv, b: pay })
      lines.forEach(l => { expect(num(l.amount_residual)).to.equal(0); expect(num(l.amount_residual_currency)).to.equal(0); expect(l.reconciled).to.equal(true) })
      const [fr] = await q<{ exchange_move_id: number }>('SELECT exchange_move_id FROM account_full_reconcile WHERE id = :id', { id: lines[0].full_reconcile_id })
      const ex = await readMove(fr.exchange_move_id)
      expect(ex.state).to.equal('posted'); expect(ex.journal_id.name).to.equal('EXCH')
      expect(num(ex.lines.find((l: any) => l.account_id.name.startsWith('4900')).credit)).to.equal(5)   // gain to the journal's credit account
    })
    it('a loss goes to the journal debit account', async () => {
      const inv = await fx('debit', 375, 100, '2026-03-01'); const pay = await fx('credit', 370, 100, '2026-03-20')
      const r = await reconcileLines([inv, pay], e())
      expect(r.full).to.equal(true)
      const [fr] = await q<{ exchange_move_id: number }>('SELECT exchange_move_id FROM account_full_reconcile ORDER BY id DESC LIMIT 1')
      const ex = await readMove(fr.exchange_move_id)
      expect(num(ex.lines.find((l: any) => l.account_id.name.startsWith('5900')).debit)).to.equal(5)
    })
    it('unreconciling removes the exchange entry and restores the residuals', async () => {
      const inv = await fx('debit', 375, 100, '2026-03-01'); const pay = await fx('credit', 380, 100, '2026-03-20')
      await reconcileLines([inv, pay], e())
      await unreconcileLines([inv])
      const lines = await q<Record<string, any>>('SELECT id, amount_residual, amount_residual_currency FROM account_move_line WHERE id IN (:a, :b) ORDER BY id', { a: inv, b: pay })
      expect(num(lines[0].amount_residual)).to.equal(375); expect(num(lines[1].amount_residual)).to.equal(-380)
      expect(num(lines[0].amount_residual_currency)).to.equal(100); expect(num(lines[1].amount_residual_currency)).to.equal(-100)
      const [n] = await q<{ n: string }>("SELECT count(*) n FROM account_move WHERE journal_id = :j", { j: jExchange })
      expect(num(n.n)).to.equal(0)
    })
    it('a partial USD payment leaves the rest open in both currencies', async () => {
      const inv = await fx('debit', 375, 100, '2026-03-01'); const pay = await fx('credit', 190, 50, '2026-03-20')
      const r = await reconcileLines([inv, pay], e())
      expect(r.full).to.equal(false)
      const [l] = await q<Record<string, any>>('SELECT amount_residual, amount_residual_currency FROM account_move_line WHERE id = :id', { id: inv })
      expect(num(l.amount_residual_currency)).to.equal(50); expect(num(l.amount_residual)).to.equal(187.5)
    })
    it('refuses two different foreign currencies, and a missing exchange journal', async () => {
      const eur = await ins("INSERT INTO res_currency (name, symbol) VALUES ('EUR', 'E')")
      const a = await fx('debit', 100, 25, '2026-03-01')
      const idB = await createMove({ date: '2026-03-02', journal_id: jMisc, lines: [{ account_id: recv, partner_id: customer, credit: 100, currency_id: eur, amount_currency: -20 }, { account_id: bank, debit: 100 }] } as never, e())
      await postMove(idB, e())
      const b = (await q<{ id: number }>('SELECT id FROM account_move_line WHERE move_id = :m AND account_id = :a', { m: idB, a: recv }))[0].id
      await rejects(() => reconcileLines([a, b], e()), 'two different foreign currencies')
      const x = await fx('debit', 375, 100, '2026-04-01'); const y = await fx('credit', 380, 100, '2026-04-02')
      await sequelize.query('UPDATE res_company SET currency_exchange_journal_id = NULL WHERE id = :c', { replacements: { c: co } })
      await rejects(() => reconcileLines([x, y], e()), 'exchange difference journal')
    })
  })

  describe('cash-basis tax', () => {
    const invoice = () => createMove({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jSale, partner_id: customer, lines: [{ account_id: income, name: 'x', quantity: 1, price_unit: 1000, tax_ids: [cashTax] }] } as never, e())
    const taxReport = () => rep.taxReport({ companyIds: [co], date_from: '2026-01-01', date_to: '2026-12-31' })

    it('the tax waits on the transition account and is not reported until paid', async () => {
      const id = await invoice(); await postMove(id, e())
      const m = await readMove(id)
      const taxLine = m.lines.find((l: any) => l.tax_line_id)
      expect(taxLine.account_id.name.startsWith('2210')).to.equal(true)
      expect((await taxReport()).output_tax).to.equal('0')
    })
    it('each payment moves its share to the tax account; unreconciling takes it back', async () => {
      const id = await invoice(); await postMove(id, e())
      const jb = jBank
      const p1 = await createPayment({ invoice_ids: [id], amount: 575, journal_id: jb, payment_date: '2026-03-10' }, e())   // half of 1150
      await postPayment(p1, e())
      let t = await taxReport()
      expect(t.output_tax).to.equal('75'); expect(t.sales[0].base).to.equal('500')
      const cb = await q<Record<string, any>>("SELECT id, state, tax_cash_basis_rec_id FROM account_move WHERE journal_id = :j", { j: jCash })
      expect(cb).to.have.length(1); expect(cb[0].state).to.equal('posted'); expect(cb[0].tax_cash_basis_rec_id).to.be.a('number')
      const p2 = await createPayment({ invoice_ids: [id], journal_id: jb, payment_date: '2026-03-20' }, e())               // the rest
      await postPayment(p2, e())
      t = await taxReport(); expect(t.output_tax).to.equal('150'); expect(t.sales[0].base).to.equal('1000')
      const ar = (await q<{ id: number }>('SELECT l.id FROM account_move_line l WHERE l.move_id = :m AND l.account_id = :a', { m: id, a: recv }))[0].id
      await unreconcileLines([ar])
      expect((await taxReport()).output_tax).to.equal('0')
      expect(num((await q<{ n: string }>('SELECT count(*) n FROM account_move WHERE journal_id = :j', { j: jCash }))[0].n)).to.equal(0)
      // the transition account is balanced again by the reversal
    })
    it('a cash-basis tax needs a transition account and the company a journal', async () => {
      await sequelize.query('UPDATE account_tax SET cash_basis_account_id = NULL WHERE id = :t', { replacements: { t: cashTax } })
      await rejects(() => invoice(), 'transition account')
      await sequelize.query('UPDATE account_tax SET cash_basis_account_id = :a WHERE id = :t', { replacements: { a: vatTransit, t: cashTax } })
      await sequelize.query('UPDATE res_company SET tax_cash_basis_journal_id = NULL WHERE id = :c', { replacements: { c: co } })
      const id = await invoice(); await postMove(id, e())
      const p = await createPayment({ invoice_ids: [id], journal_id: jBank, payment_date: '2026-03-10' }, e())
      await rejects(() => postPayment(p, e()), 'cash basis journal')
    })
  })

  describe('bank statement import', () => {
    const csv = ['Date,Description,Amount,Balance', '2026-03-01,Salary March,5000.00,15000.00', '02/03/2026,"Rent, office",-1200.50,13799.50', '2026-03-03,Customer payment,300,14099.50'].join('\n')
    it('reads dates, amounts and balances in the usual formats', () => {
      expect(parseDate('01/03/2026')).to.equal('2026-03-01'); expect(parseDate('20260301120000')).to.equal('2026-03-01')
      expect(parseAmount('(1,234.50)')).to.equal('-1234.5'); expect(parseAmount('1.234,50')).to.equal('1234.5'); expect(parseAmount('-12')).to.equal('-12')
      const p = parseCsv(csv)
      expect(p.lines.map(l => l.amount)).to.deep.equal(['5000', '-1200.5', '300']); expect(p.endBalance).to.equal('14099.5')
      expect(p.lines[1].name).to.equal('Rent, office')
    })
    it('accepts debit and credit columns and a semicolon delimiter', () => {
      const p = parseCsv('date;memo;debit;credit\n2026-03-01;Fee;10,50;\n2026-03-02;Deposit;;200,00')
      expect(p.lines.map(l => l.amount)).to.deep.equal(['-10.5', '200'])
    })
    it('imports a statement with the right opening and closing balance, and refuses to import it twice', async () => {
      const r = await importStatement({ journal_id: jBank, filename: 'march.csv', content: csv }, e())
      expect(r.imported).to.equal(3); expect(r.skipped).to.equal(0)
      const s = await readStatement(r.statement_id)
      expect(s.name).to.equal('march'); expect(num(s.balance_start)).to.equal(10000); expect(num(s.balance_end_real)).to.equal(14099.5); expect(num(s.difference)).to.equal(0)
      await rejects(() => importStatement({ journal_id: jBank, filename: 'march.csv', content: csv }, e()), 'already imported')
      const more = csv + '\n2026-03-04,New line,50,14149.50'
      const r2 = await importStatement({ journal_id: jBank, filename: 'march2.csv', content: more }, e())
      expect(r2.imported).to.equal(1); expect(r2.skipped).to.equal(3)
    })
    it('imports OFX using the bank id, and matches a partner by name', async () => {
      const ofx = `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260305120000<TRNAMT>800.00<FITID>A1<NAME>Customer<MEMO>Invoice payment</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260306<TRNAMT>-25.00<FITID>A2<NAME>Bank<MEMO>Charges</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>1775.00<DTASOF>20260306</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
      expect(parseOfx(ofx).lines).to.have.length(2)
      const r = await importStatement({ journal_id: jBank, filename: 'x.ofx', content: ofx }, e())
      const s = await readStatement(r.statement_id)
      expect(num(s.balance_start)).to.equal(1000); expect(num(s.balance_end_real)).to.equal(1775)
      expect(s.lines.find((l: any) => l.name === 'Invoice payment').partner_id.name).to.equal('Customer')
      expect((await q<{ k: string }>('SELECT unique_import_id k FROM account_bank_statement_line ORDER BY id'))[0].k).to.equal('id:A1')
    })
    it('explains a bad file', async () => {
      await rejects(() => importStatement({ journal_id: jBank, content: 'foo,bar\n1,2' }, e()), 'date')
      await rejects(() => importStatement({ journal_id: jBank, content: 'date,amount\nsoon,5' }, e()), 'Row 2')
      await rejects(() => importStatement({ journal_id: jBank, content: '' }, e()), 'empty')
      await rejects(() => importStatement({ content: csv }, e()), 'journal_id')
    })
  })

  describe('document totals preview', () => {
    it('matches what posting computes, without saving anything', async () => {
      const t = await ins("INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id, account_id) VALUES ('VAT 15', 'sale', 'percent', 15, :co, :a)", { co, a: vatOut })
      const p = await previewTotals({ lines: [{ quantity: 2, price_unit: 100, tax_ids: [t] }, { quantity: 1, price_unit: 50, discount: 10, tax_ids: [t] }] }, e())
      expect(p.amount_untaxed).to.equal('245'); expect(p.amount_tax).to.equal('36.75'); expect(p.amount_total).to.equal('281.75'); expect(p.taxes).to.have.length(1)
      expect(num((await q<{ n: string }>('SELECT count(*) n FROM account_move'))[0].n)).to.equal(0)
    })
  })

  describe('notes and attachments', () => {
    it('keeps notes and files on a record, and only on known record types', async () => {
      const id = await createMove({ date: '2026-03-01', journal_id: jMisc, lines: [{ account_id: bank, debit: 5 }, { account_id: income, credit: 5 }] } as never, e())
      const nid = await extras.addNote('account.move', id, '  Checked with the bank  ', e())
      expect((await extras.listNotes('account.move', id))[0]).to.include({ body: 'Checked with the bank', kind: 'note' })
      await rejects(() => extras.addNote('account.move', id, '   ', e()), 'empty')
      await rejects(() => extras.addNote('res.partner', id, 'x', e()), 'Unknown record')
      await rejects(() => extras.addNote('account.move', 99999, 'x', e()), 'not found')
      const fid = await extras.addAttachment('account.move', id, { name: 'scan.txt', mimetype: 'text/plain', content_base64: Buffer.from('hello').toString('base64') }, e())
      expect((await extras.listAttachments('account.move', id))[0]).to.include({ name: 'scan.txt', file_size: 5 })
      expect((await extras.readAttachment(fid)).data.toString()).to.equal('hello')
      await rejects(() => extras.addAttachment('account.move', id, { name: 'big', content_base64: Buffer.alloc(9 * 1024 * 1024).toString('base64') }, e()), '8 MB')
      await extras.deleteAttachment(fid); await extras.deleteNote(nid)
      expect(await extras.listNotes('account.move', id)).to.have.length(0)
    })
  })

  describe('dashboard', () => {
    it('counts what is draft, unpaid and late per journal, and the bank balance', async () => {
      const mk = (date: string, due: string) => createMove({ move_type: 'out_invoice', date, invoice_date: date, invoice_date_due: due, journal_id: jSale, partner_id: customer, lines: [{ account_id: income, quantity: 1, price_unit: 100 }] } as never, e())
      const late = await mk('2026-01-01', '2026-01-10'); await postMove(late, e())
      await mk('2026-01-02', '2026-01-12')                      // a draft
      const p = await createPayment({ invoice_ids: [late], amount: 40, journal_id: jBank, payment_date: '2026-02-01' }, e()); await postPayment(p, e())
      const cards = await extras.dashboard([co])
      const sale = cards.find(c => c['code'] === 'INV')!
      expect(sale['draft']).to.equal(1); expect(sale['unpaid']).to.equal(1); expect(num(sale['unpaid_amount'])).to.equal(60); expect(sale['late']).to.equal(1)
      expect(num(cards.find(c => c['code'] === 'BNK1')!['gl_balance'])).to.equal(40)
    })
  })
})
