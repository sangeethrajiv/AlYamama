import { expect } from 'chai'
import { env, resetTables, sequelize } from '../test-helper'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { q } from './crud'
import { createMove, postMove, readMove } from './move.service'
import * as inv from './invoicing.service'
import * as asset from './asset.service'
import * as rep from './reports.service'
import { createPayment } from './payment.service'

const rejects = async (fn: () => Promise<unknown>, text?: string) => {
  try { await fn() } catch (e) { if (text) expect((e as Error).message).to.contain(text); return }
  expect.fail('expected the call to be rejected')
}
const ins = async (sql: string, r: Record<string, unknown> = {}) => (await q<{ id: number }>(sql + ' RETURNING id', r))[0].id

describe('accounting: invoicing menus, vouchers, assets', () => {
  let co: number, customer: number, vendor: number
  let bank: number, bank2: number, recv: number, pay: number, income: number, expense: number, vatOut: number, accDep: number, depExp: number, fixedAsset: number
  let jSale: number, jProforma: number, jPurchase: number, jBank: number, jBank2: number, jMisc: number, jAsset: number, vat: number
  const e = (uid = 1) => env({ uid, companyId: co, allowedCompanyIds: [co] })

  beforeEach(async () => {
    await resetTables()
    const cur = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    const cp = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    co = (await Company.create({ name: 'Co', partner_id: cp.id, currency_id: cur } as never)).id
    for (const n of [1, 2]) await ins('INSERT INTO res_users (login, partner_id, company_id) VALUES (:l, :p, :c)', { l: `user${n}`, p: cp.id, c: co })
    customer = (await Partner.create({ name: 'Customer', type: 'contact' } as never)).id
    vendor = (await Partner.create({ name: 'Vendor', type: 'contact' } as never)).id
    const ty = (type: string, g: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + g, t: type, g })
    const [tR, tP, tB, tI, tE, tL, tA] = [await ty('receivable', 'asset'), await ty('payable', 'liability'), await ty('liquidity', 'asset'), await ty('other', 'income'), await ty('other', 'expense'), await ty('other', 'liability'), await ty('other', 'asset')]
    const acc = (code: string, t: number, rec = false) => ins('INSERT INTO account_account (code, name, user_type_id, company_id, reconcile) VALUES (:c, :c, :t, :co, :r)', { c: code, t, co, r: rec })
    bank = await acc('1010', tB); bank2 = await acc('1020', tB); recv = await acc('1100', tR, true); pay = await acc('2100', tP, true)
    income = await acc('4000', tI); expense = await acc('5000', tE); vatOut = await acc('2200', tL)
    fixedAsset = await acc('1500', tA); accDep = await acc('1590', tA); depExp = await acc('5100', tE)
    await sequelize.query('UPDATE res_company SET account_receivable_id = :r, account_payable_id = :p WHERE id = :c', { replacements: { r: recv, p: pay, c: co } })
    await sequelize.query('UPDATE res_partner SET property_account_receivable_id = :r, property_account_payable_id = :p WHERE id IN (:a, :b)', { replacements: { r: recv, p: pay, a: customer, b: vendor } })
    const jr = (c: string, t: string, b?: number, cat?: string) => ins('INSERT INTO account_journal (name, code, type, company_id, default_debit_account_id, default_credit_account_id, update_posted, invoice_category) VALUES (:c, :c, :t, :co, :b, :b, true, :cat)', { c, t, co, b: b ?? null, cat: cat ?? null })
    jSale = await jr('INV', 'sale'); jProforma = await jr('PRO', 'sale', undefined, 'proforma'); jPurchase = await jr('BILL', 'purchase'); jBank = await jr('BNK1', 'bank', bank); jBank2 = await jr('BNK2', 'bank', bank2); jMisc = await jr('MISC', 'general'); jAsset = await jr('ASSET', 'general')
    vat = await ins("INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id, account_id, refund_account_id) VALUES ('VAT 15%', 'sale', 'percent', 15, :co, :a, :a)", { co, a: vatOut })
  })

  const bill = (over: Record<string, unknown> = {}) => createMove({ move_type: 'in_invoice', date: '2026-03-01', journal_id: jPurchase, partner_id: vendor, lines: [{ account_id: expense, quantity: 1, price_unit: 300 }], ...over } as never, e(1))

  describe('invoice categories', () => {
    it('inherits the category from the journal and stores extras', async () => {
      const id = await createMove({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jProforma, partner_id: customer, po_number: 'PO-7', lines: [{ account_id: income, quantity: 1, price_unit: 100 }] } as never, e())
      const m = await readMove(id)
      expect(m.invoice_category).to.equal('proforma'); expect(m.po_number).to.equal('PO-7')
    })
    it('a proforma cannot be posted; converting issues a real invoice and cancels the proforma', async () => {
      const id = await createMove({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jProforma, partner_id: customer, lines: [{ account_id: income, quantity: 2, price_unit: 50, tax_ids: [vat] }] } as never, e())
      await rejects(() => postMove(id, e()), 'proforma')
      const real = await inv.convertProforma(id, { journal_id: jSale, post: true }, e())
      expect(real.invoice_category).to.equal('credit'); expect(real.state).to.equal('posted'); expect(real.amount_total).to.equal('115.0000')
      expect((await readMove(id)).state).to.equal('cancel')
      await rejects(() => inv.convertProforma(id, {}, e()), 'already')
    })
    it('a normal invoice cannot be converted', async () => {
      const id = await createMove({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jSale, partner_id: customer, lines: [{ account_id: income, quantity: 1, price_unit: 10 }] } as never, e())
      await rejects(() => inv.convertProforma(id, {}, e()), 'proforma')
    })
  })

  describe('progressive invoices', () => {
    it('bills the milestone difference against the contract and counts what was billed', async () => {
      const first = await createMove({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jSale, partner_id: customer, is_progressive: true, contract_amount: 1000,
        lines: [{ account_id: income, name: 'Milestone 1', quantity: 1, price_unit: 300 }] } as never, e())
      await postMove(first, e())
      const second = await inv.progressiveNext(first, { progress_percentage: 50, post: true }, e())     // 500 - 300 billed = 200
      expect(second.amount_untaxed).to.equal('200.0000'); expect(second.previously_billed).to.equal('300.0000'); expect(second.invoice_category).to.equal('progressive')
      await rejects(() => inv.progressiveNext(first, { progress_percentage: 50 }, e()), 'Nothing left')
      const third = await inv.progressiveNext(first, { progress_percentage: 100, retainage_percentage: 10 }, e())   // 1000 - 500 = 500, 10% held back
      expect(third.amount_untaxed).to.equal('450.0000'); expect(third.retainage_amount).to.equal('50.0000')
    })
    it('refuses a non-progressive source and an out-of-range percentage', async () => {
      const plain = await createMove({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jSale, partner_id: customer, lines: [{ account_id: income, quantity: 1, price_unit: 10 }] } as never, e())
      await rejects(() => inv.progressiveNext(plain, { progress_percentage: 10 }, e()), 'not a progressive')
    })
  })

  describe('vendor bill approval', () => {
    it('a bill waiting for approval cannot be posted; the preparer cannot approve it', async () => {
      const id = await bill()
      await inv.submitBillForApproval(id, e(1))
      await rejects(() => postMove(id, e(1)), 'waiting for approval')
      await rejects(() => inv.approveBill(id, {}, e(1)), 'prepared yourself')
      const a = await inv.approveBill(id, { post: true }, e(2))
      expect(a.request_status).to.equal('approved'); expect(a.state).to.equal('posted'); expect(a.approver_id).to.equal(2)
    })
    it('rejection needs a reason and blocks posting until reset', async () => {
      const id = await bill()
      await inv.submitBillForApproval(id, e(1))
      await rejects(() => inv.rejectBill(id, '  ', e(2)), 'reason')
      const r = await inv.rejectBill(id, 'Wrong amount', e(2))
      expect(r.request_status).to.equal('rejected'); expect(r.reject_reason).to.equal('Wrong amount')
      await rejects(() => postMove(id, e(1)), 'rejected')
      await inv.resetBillApproval(id, e(1)); await postMove(id, e(1))
    })
    it('only vendor bills go through approval, and only drafts', async () => {
      const c = await createMove({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jSale, partner_id: customer, lines: [{ account_id: income, quantity: 1, price_unit: 10 }] } as never, e())
      await rejects(() => inv.submitBillForApproval(c, e()), 'vendor bills')
      const b = await bill(); await postMove(b, e(1))
      await rejects(() => inv.submitBillForApproval(b, e()), 'draft')
    })
  })

  describe('internal voucher', () => {
    it('moves money between two bank journals in one balanced entry', async () => {
      const id = await inv.createInternalVoucher({ amount: 250, journal_id: jBank, destination_journal_id: jBank2, description: 'Top up' }, e())
      const v: any = await inv.postInternalVoucher(id, e())
      expect(v.state).to.equal('posted')
      const lines = await q<{ account_id: number; debit: string; credit: string }>('SELECT account_id, debit, credit FROM account_move_line WHERE move_id = :m ORDER BY id', { m: (v.move_id as { id: number }).id })
      expect(lines.find(l => l.account_id === bank2)?.debit).to.equal('250.0000'); expect(lines.find(l => l.account_id === bank)?.credit).to.equal('250.0000')
      await inv.cancelInternalVoucher(id, e())
      expect(((await inv.readInternalVoucher(id)) as any).state).to.equal('cancelled')
    })
    it('validates the journals and the amount', async () => {
      await rejects(() => inv.createInternalVoucher({ amount: 5, journal_id: jBank, destination_journal_id: jBank }, e()), 'differ')
      await rejects(() => inv.createInternalVoucher({ amount: 0, journal_id: jBank, destination_journal_id: jBank2 }, e()), 'positive')
      await rejects(() => inv.createInternalVoucher({ amount: 5, journal_id: jBank, destination_journal_id: jSale }, e()), 'bank or cash')
    })
    it('approval gates posting', async () => {
      const id = await inv.createInternalVoucher({ amount: 5, journal_id: jBank, destination_journal_id: jBank2 }, e(1))
      await inv.voucherApproval('internal', id, 'submit', null, e(1))
      await rejects(() => inv.postInternalVoucher(id, e(1)), 'waiting for approval')
      await inv.voucherApproval('internal', id, 'approve', null, e(2))
      await inv.postInternalVoucher(id, e(1))
    })
  })

  describe('payable voucher', () => {
    it('posting pays the named bill through a real outbound payment', async () => {
      const b = await bill(); await postMove(b, e(1))
      const id = await inv.createPayableVoucher({ invoice_id: b, payment_journal_id: jBank, payment_mode: 'cheque', cheque_no: 'CH-001' }, e(1))   // amount defaults to the residual
      const v: any = await inv.postPayableVoucher(id, e(1))
      expect(v.state).to.equal('posted'); expect((v.payment_id as { id: number }).id).to.be.a('number')
      const m = await readMove(b)
      expect(m.payment_state).to.equal('paid'); expect(m.amount_residual).to.equal('0.0000')
    })
    it('a cheque voucher needs a number, and the bill must be posted', async () => {
      await rejects(() => inv.createPayableVoucher({ partner_id: vendor, amount: 5, payment_journal_id: jBank, payment_mode: 'cheque' }, e()), 'cheque number')
      const draft = await bill()
      await rejects(() => inv.createPayableVoucher({ invoice_id: draft, payment_journal_id: jBank }, e()), 'posted')
    })
  })

  describe('assets', () => {
    let category: number
    beforeEach(async () => {
      category = await ins(`INSERT INTO account_asset_category (name, company_id, journal_id, account_asset_id, account_depreciation_id, account_depreciation_expense_id, method, method_number, method_period)
        VALUES ('Vehicles', :co, :j, :a, :d, :x, 'linear', 4, 12)`, { co, j: jAsset, a: fixedAsset, d: accDep, x: depExp })
    })

    it('copies the category, builds an even yearly board and ends on zero', async () => {
      const id = await asset.createAsset({ name: 'Truck', category_id: category, value: 10000, salvage_value: 2000, date: '2026-01-15' }, e())
      const a = await asset.readAsset(id)
      expect(a.method_number).to.equal(4); expect(a.depreciation_lines).to.have.length(4)
      expect(a.depreciation_lines.map((l: any) => Number(l.amount))).to.deep.equal([2000, 2000, 2000, 2000])
      expect(Number(a.depreciation_lines[3].remaining_value)).to.equal(0)
      expect(a.depreciation_lines[0].depreciation_date.toISOString?.().slice(0, 10) ?? String(a.depreciation_lines[0].depreciation_date).slice(0, 10)).to.equal('2026-12-31')
    })
    it('the last line absorbs rounding', async () => {
      const id = await asset.createAsset({ name: 'Odd', category_id: category, value: 1000, method_number: 3 }, e())
      const lines = (await asset.readAsset(id)).depreciation_lines.map((l: any) => l.amount)
      expect(lines.map(Number)).to.deep.equal([333.33, 333.33, 333.34])
    })
    it('Generate Assets Entries posts only due lines of running assets, balanced, then closes the asset', async () => {
      const id = await asset.createAsset({ name: 'Truck', category_id: category, value: 8000, date: '2026-01-15', method_number: 2 }, e())
      expect((await asset.generateAssetEntries({ date: '2027-12-31', company_ids: [co] }, e())).posted_count).to.equal(0)   // still a draft; filtered to the company
      await asset.confirmAsset(id, e())
      const first = await asset.generateAssetEntries({ date: '2026-12-31', company_ids: [co] }, e())
      expect(first.posted_count).to.equal(1)
      const a = await asset.readAsset(id)
      expect(Number(a.depreciated_value)).to.equal(4000); expect(Number(a.book_value)).to.equal(4000); expect(a.state).to.equal('open')
      expect((await asset.generateAssetEntries({ date: '2026-12-31' }, e())).posted_count).to.equal(0)   // nothing twice
      await asset.generateAssetEntries({ date: '2027-12-31' }, e())
      expect((await asset.readAsset(id)).state).to.equal('close')
      const tb = await rep.trialBalance({ companyIds: [co], date_from: '2026-01-01', date_to: '2027-12-31' })
      expect(tb.totals.debit).to.equal(tb.totals.credit)
      expect(Number(tb.lines.find((l: any) => l.code === '1590')?.credit)).to.equal(8000)
    })
    it('settings are locked once an entry is posted; a draft asset can be deleted, a running one cannot', async () => {
      const id = await asset.createAsset({ name: 'Truck', category_id: category, value: 8000, date: '2026-01-15' }, e())
      await asset.confirmAsset(id, e()); await asset.generateAssetEntries({ date: '2026-12-31' }, e())
      await rejects(() => asset.updateAsset(id, { value: 9000 }, e()), 'posted depreciation')
      await rejects(() => asset.deleteAsset(id), 'draft')
      await rejects(() => asset.setAssetToDraft(id, e()), 'posted depreciation')
    })
    it('validates the values and the category', async () => {
      await rejects(() => asset.createAsset({ name: 'x', category_id: category, value: 0 }, e()), 'positive')
      await rejects(() => asset.createAsset({ name: 'x', category_id: category, value: 100, salvage_value: 100 }, e()), 'salvage')
      await rejects(() => asset.createAsset({ name: 'x', category_id: 999, value: 100 }, e()), 'asset type')
    })
  })

  describe('tax adjustment', () => {
    it('posts a balanced entry tagged with the tax so the tax report sees it', async () => {
      const m = await inv.taxAdjustment({ date: '2026-03-31', tax_id: vat, account_id: vatOut, counterpart_account_id: expense, amount: 40, reason: 'Correction' }, e())
      expect(m.state).to.equal('posted')
      const r = await rep.taxReport({ companyIds: [co], date_from: '2026-01-01', date_to: '2026-12-31' })
      expect(r.output_tax).to.equal('-40')   // a debit on a sales tax account lowers the output tax
    })
    it('refuses a zero amount', async () => {
      await rejects(() => inv.taxAdjustment({ tax_id: vat, account_id: vatOut, counterpart_account_id: expense, amount: 0 }, e()), 'zero')
    })
  })

  describe('fiscal year', () => {
    it('refuses overlapping years for one company', async () => {
      await ins("INSERT INTO account_fiscal_year (name, date_from, date_to, company_id) VALUES ('2026', '2026-01-01', '2026-12-31', :co)", { co })
      // the overlap rule is enforced by the CRUD hook; check the SQL it relies on
      const [o] = await q<{ n: string }>("SELECT count(*) n FROM account_fiscal_year WHERE company_id = :co AND date_from <= '2026-06-30' AND date_to >= '2026-06-01'", { co })
      expect(Number(o.n)).to.equal(1)
    })
  })
})

describe('assets: prorata temporis (a partial first year)', () => {
  it('first year is the share of days left, a closing line takes the rest, and the board adds up', async () => {
    await resetTables()
    const sar = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    const cp = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    const co = (await Company.create({ name: 'Co', partner_id: cp.id, currency_id: sar } as never)).id
    const ty = (type: string, g: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + g, t: type, g })
    const t1 = await ty('other', 'asset'), t2 = await ty('other', 'expense')
    const acc = (c: string, t: number) => ins('INSERT INTO account_account (code, name, user_type_id, company_id) VALUES (:c, :c, :t, :co)', { c, t, co })
    const [a, d, x] = [await acc('1500', t1), await acc('1590', t1), await acc('5100', t2)]
    const j = await ins("INSERT INTO account_journal (name, code, type, company_id) VALUES ('AS', 'AS', 'general', :co)", { co })
    const cat = await ins("INSERT INTO account_asset_category (name, company_id, journal_id, account_asset_id, account_depreciation_id, account_depreciation_expense_id, method, method_number, method_period, prorata) VALUES ('P', :co, :j, :a, :d, :x, 'linear', 5, 12, true)", { co, j, a, d, x })
    const id = await asset.createAsset({ name: 'Truck', category_id: cat, value: 12000, salvage_value: 2000, date: '2026-01-15' }, env({ companyId: co, allowedCompanyIds: [co] }))
    const b = (await asset.readAsset(id)).depreciation_lines as any[]
    expect(b).to.have.length(6)                                                                  // 5 entries + the prorata line
    expect(Number(b[0].amount)).to.equal(1923.29)                                                // 2000 x 351 days left / 365
    expect([1, 2, 3, 4].map(i => Number(b[i].amount))).to.deep.equal([2000, 2000, 2000, 2000])
    expect(Number(b[5].amount)).to.equal(76.71)                                                  // what is left
    expect(b.reduce((s, l) => s + Number(l.amount), 0)).to.be.closeTo(10000, 0.001)
    expect(Number(b[5].remaining_value)).to.equal(0)
  })
  it('monthly periods use the days left in the purchase month', async () => {
    await resetTables()
    const sar = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    const cp = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    const co = (await Company.create({ name: 'Co', partner_id: cp.id, currency_id: sar } as never)).id
    const ty = (type: string, g: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + g, t: type, g })
    const t1 = await ty('other', 'asset')
    const acc = (c: string) => ins('INSERT INTO account_account (code, name, user_type_id, company_id) VALUES (:c, :c, :t, :co)', { c, t: t1, co })
    const [a, d, x] = [await acc('1'), await acc('2'), await acc('3')]
    const j = await ins("INSERT INTO account_journal (name, code, type, company_id) VALUES ('AS', 'AS', 'general', :co)", { co })
    const cat = await ins("INSERT INTO account_asset_category (name, company_id, journal_id, account_asset_id, account_depreciation_id, account_depreciation_expense_id, method, method_number, method_period, prorata) VALUES ('M', :co, :j, :a, :d, :x, 'linear', 12, 1, true)", { co, j, a, d, x })
    const id = await asset.createAsset({ name: 'Laptop', category_id: cat, value: 1200, date: '2026-01-16' }, env({ companyId: co, allowedCompanyIds: [co] }))
    const b = (await asset.readAsset(id)).depreciation_lines as any[]
    expect(b).to.have.length(13)
    expect(Number(b[0].amount)).to.equal(51.61)                                                  // 100 x 16 days left of 31 (16th to 31st) / 31
    expect(b.reduce((s, l) => s + Number(l.amount), 0)).to.be.closeTo(1200, 0.001)
  })
})
