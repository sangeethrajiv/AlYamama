import { expect } from 'chai'
import type { Server } from 'http'
import { createApp } from '../app'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { resetTables } from '../test-helper'
import { q } from './crud'

const ins = async (sql: string, r: Record<string, unknown> = {}) => (await q<{ id: number }>(sql + ' RETURNING id', r))[0].id

/** The same flows through the real HTTP layer, so a request-schema that drops a field cannot hide. */
describe('accounting over HTTP', () => {
  let server: Server, base: string, co: number, customer: number, income: number, jSale: number, recv: number, bank: number, jBank: number
  const call = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`${base}/v2/accounting${path}`, { method, headers: { 'content-type': 'application/json', 'x-user-id': '1', 'x-company-id': String(co), 'x-allowed-company-ids': String(co) }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, body: (await r.json()) as { success: boolean; data: any; message?: string } }
  }

  before(async () => {
    await resetTables()
    const sar = await ins("INSERT INTO res_currency (name, symbol) VALUES ('SAR', 'SAR')")
    const cp = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    co = (await Company.create({ name: 'Co', partner_id: cp.id, currency_id: sar } as never)).id
    customer = (await Partner.create({ name: 'Customer', type: 'contact' } as never)).id
    const ty = (type: string, g: string) => ins('INSERT INTO account_account_type (name, type, internal_group) VALUES (:n, :t, :g)', { n: type + g, t: type, g })
    const [tR, tI, tB] = [await ty('receivable', 'asset'), await ty('other', 'income'), await ty('liquidity', 'asset')]
    const acc = (c: string, t: number, rec = false) => ins('INSERT INTO account_account (code, name, user_type_id, company_id, reconcile) VALUES (:c, :c, :t, :co, :r)', { c, t, co, r: rec })
    recv = await acc('1100', tR, true); income = await acc('4000', tI); bank = await acc('1010', tB)
    await q('UPDATE res_company SET account_receivable_id = :r WHERE id = :c', { r: recv, c: co })
    await q('UPDATE res_partner SET property_account_receivable_id = :r WHERE id = :p', { r: recv, p: customer })
    jSale = await ins("INSERT INTO account_journal (name, code, type, company_id) VALUES ('INV', 'INV', 'sale', :co)", { co })
    jBank = await ins("INSERT INTO account_journal (name, code, type, company_id, default_debit_account_id, default_credit_account_id) VALUES ('BNK', 'BNK', 'bank', :co, :b, :b)", { co, b: bank })
    server = createApp().listen(0)
    base = `http://localhost:${(server.address() as { port: number }).port}`
  })
  after(() => new Promise<void>(r => server.close(() => r())))

  const invoice = (extra: Record<string, unknown> = {}) => ({ move_type: 'out_invoice', date: '2026-03-01', journal_id: jSale, partner_id: customer, lines: [{ account_id: income, quantity: 1, price_unit: 100 }], ...extra })

  it('keeps the invoice category and the extra fields sent by the form', async () => {
    const r = await call('POST', '/moves', invoice({ invoice_category: 'proforma', po_number: 'PO-1', pr_number: 'PR-1', client_order_ref: 'REF-9' }))
    expect(r.status).to.equal(201)
    expect(r.body.data).to.include({ invoice_category: 'proforma', po_number: 'PO-1', pr_number: 'PR-1', client_order_ref: 'REF-9' })
    const post = await call('POST', `/moves/${r.body.data.id}/post`)
    expect(post.status).to.equal(400); expect(post.body.message).to.contain('proforma')
  })
  it('stores progressive billing fields', async () => {
    const r = await call('POST', '/moves', invoice({ is_progressive: true, contract_amount: 5000 }))
    expect(r.body.data.invoice_category).to.equal('progressive'); expect(Number(r.body.data.contract_amount)).to.equal(5000)
  })
  it('previews totals without saving', async () => {
    const r = await call('POST', '/moves/preview', { lines: [{ quantity: 2, price_unit: 50 }] })
    expect(r.body.data.amount_total).to.equal('100')
  })
  it('lists journals filtered by several types', async () => {
    const r = await call('GET', '/journals?type=bank,cash')
    expect(r.status).to.equal(200); expect(r.body.data.records.map((j: any) => j.code)).to.deep.equal(['BNK'])
  })
  it('pays an invoice and returns what it was reconciled with', async () => {
    const inv = (await call('POST', '/moves', invoice())).body.data.id
    await call('POST', `/moves/${inv}/post`)
    const pay = await call('POST', '/payments?post=1', { invoice_ids: [inv], journal_id: jBank, amount: 100, payment_date: '2026-03-05' })
    expect(pay.status).to.equal(201)
    const m = (await call('GET', `/moves/${inv}`)).body.data
    expect(m.payment_state).to.equal('paid'); expect(m.reconciled_items).to.have.length(1)
  })
  it('answers 404 for an unknown record and 400 for bad input', async () => {
    expect((await call('GET', '/moves/999999')).status).to.equal(404)
    expect((await call('POST', '/moves', invoice({ journal_id: 'x' }))).status).to.equal(400)
  })
  it('imports a bank statement file and refuses it twice', async () => {
    const content = 'date,amount,description\n2026-03-01,10,A\n2026-03-02,-4,B'
    const ok = await call('POST', '/bank-statements/import', { journal_id: jBank, filename: 'x.csv', content })
    expect(ok.status).to.equal(201); expect(ok.body.data.imported).to.equal(2)
    expect((await call('POST', '/bank-statements/import', { journal_id: jBank, filename: 'x.csv', content })).status).to.equal(400)
  })

  describe('company isolation and bad input', () => {
    let other: number, jOther: number
    const as = async (company: number, method: string, path: string, body?: unknown) => {
      const r = await fetch(`${base}/v2/accounting${path}`, { method, headers: { 'content-type': 'application/json', 'x-user-id': '1', 'x-company-id': String(company), 'x-allowed-company-ids': String(company) }, body: body ? JSON.stringify(body) : undefined })
      return { status: r.status, body: (await r.json()) as { success: boolean; data: any; message?: string } }
    }
    before(async () => {
      const cp = await Partner.create({ name: 'Other Co', is_company: true, type: 'contact' } as never)
      other = (await Company.create({ name: 'Other Co', partner_id: cp.id } as never)).id
      jOther = await ins("INSERT INTO account_journal (name, code, type, company_id) VALUES ('OINV', 'OINV', 'sale', :co)", { co: other })
      await q('INSERT INTO res_users (id, login, partner_id, company_id) VALUES (1, \'tester\', :p, :c)', { p: cp.id, c: other })   // notes record their author
    })
    it('another company cannot read, act on or list a record by its id', async () => {
      const mine = (await call('POST', '/moves', invoice())).body.data.id
      expect((await as(other, 'GET', `/moves/${mine}`)).status).to.equal(404)
      expect((await as(other, 'POST', `/moves/${mine}/cancel`)).status).to.equal(404)
      expect((await as(other, 'GET', `/accounts/${income}`)).status).to.equal(404)
      expect((await as(other, 'GET', '/moves')).body.data.records.every((r: any) => r.id !== mine)).to.equal(true)
      expect((await call('GET', `/moves/${mine}`)).status).to.equal(200)
    })
    it('a journal of another company cannot be used to post, pay or import', async () => {
      const r = await as(other, 'POST', '/moves', invoice())            // journal jSale belongs to the first company
      expect(r.status).to.equal(404); expect(r.body.message).to.contain('journal')
      expect((await as(other, 'POST', '/payments', { payment_type: 'inbound', partner_id: customer, amount: 5, journal_id: jBank })).status).to.equal(404)
      expect((await as(other, 'POST', '/bank-statements/import', { journal_id: jBank, content: 'date,amount\n2026-01-01,5' })).status).to.equal(404)
      void jOther
    })
    it('reconciling items of another company is refused', async () => {
      const a = (await call('POST', '/moves', invoice())).body.data.id; await call('POST', `/moves/${a}/post`)
      const line = (await call('GET', `/moves/${a}`)).body.data.lines.find((l: any) => l.exclude_from_invoice_tab && !l.tax_line_id).id
      expect((await as(other, 'POST', '/move-lines/reconcile', { line_ids: [line, line + 1] })).status).to.equal(404)
      expect((await as(other, 'POST', '/move-lines/unreconcile', { line_ids: [line] })).status).to.equal(404)
    })
    it('notes and attachments follow the record', async () => {
      const mine = (await call('POST', '/moves', invoice())).body.data.id
      await call('POST', `/records/account.move/${mine}/notes`, { body: 'private' })
      expect((await as(other, 'GET', `/records/account.move/${mine}/notes`)).status).to.equal(404)
      expect((await call('GET', `/records/account.move/${mine}/notes`)).body.data).to.have.length(1)
    })
    it('answers invalid JSON with a 400 and an oversized body with a 413, not a 500', async () => {
      const bad = await fetch(`${base}/v2/accounting/moves`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': '1' }, body: '{not json' })
      expect(bad.status).to.equal(400)
      const big = await fetch(`${base}/v2/accounting/records/account.move/1/attachments`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-user-id': '1' }, body: JSON.stringify({ name: 'x', content_base64: 'A'.repeat(13 * 1024 * 1024) }) })
      expect(big.status).to.equal(413)
    })
  })
})
