import { expect } from 'chai'
import { env, resetTables, sequelize } from '../../test-helper'
import { createCompany, getCompany, listCompanies, updateCompany, visibleCompanyIds } from './company.service'

type Id = { id: number }
const one = async (sql: string, replacements: Record<string, unknown> = {}) => ((await sequelize.query(sql, { replacements }))[0] as Id[])[0].id

async function company(name: string, over: { parent?: number | null; currency?: number | null; partner?: Record<string, unknown> } = {}) {
  const p = over.partner ?? {}
  const partner = await one(
    `INSERT INTO res_partner (name, display_name, type, street, city, zip, website, vat, state_id, country_id, l10n_sa_additional_identification_scheme, l10n_sa_additional_identification_number, image)
     VALUES (:n, :n, 'contact', :street, :city, :zip, :web, :vat, :state, :country, :scheme, :num, :image) RETURNING id`,
    { n: name, street: p.street ?? null, city: p.city ?? null, zip: p.zip ?? null, web: p.website ?? null, vat: p.vat ?? null, state: p.state ?? null, country: p.country ?? null, scheme: p.scheme ?? null, num: p.num ?? null, image: p.image ?? null },
  )
  return one(
    `INSERT INTO res_company (name, partner_id, parent_id, currency_id, sequence, division, credit_invoice, social_twitter, l10n_sa_registered_name)
     VALUES (:n, :p, :parent, :cur, 10, 'HYD', true, '@yamama', 'ZATCA Name') RETURNING id`,
    { n: name, p: partner, parent: over.parent ?? null, cur: over.currency ?? null },
  )
}

describe('core / res.company', () => {
  beforeEach(resetTables)

  it('lists each company with the name of its partner', async () => {
    const a = await company('Alpha'); const b = await company('Beta')
    const rows = await listCompanies([])
    expect(rows.map(r => [r.id, r.name, r.partner_name])).to.deep.equal([[a, 'Alpha', 'Alpha'], [b, 'Beta', 'Beta']])
  })

  it('lists only the allowed companies when the caller has a list', async () => {
    await company('Alpha'); const b = await company('Beta')
    expect((await listCompanies([b])).map(r => r.id)).to.deep.equal([b])
  })

  it('returns the form: partner address and ids, currency, parent, the stored company flags', async () => {
    const [cur] = (await sequelize.query(`INSERT INTO res_currency (name) VALUES ('SAR') RETURNING id`))[0] as Id[]
    const [country] = (await sequelize.query(`INSERT INTO res_country (name, code) VALUES ('Saudi Arabia', 'SA') RETURNING id`))[0] as Id[]
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const parent = await company('Parent')
    const id = await company('Child', { parent, currency: cur.id, partner: { street: 'Abu Bakr Al Razi', city: 'Dammam', zip: '32442', website: 'http://www.fay.sa', vat: '3104', country: country.id, scheme: 'CRN', num: '2050118528', image: png } })
    const c = await getCompany(id, [])
    expect(c).to.include({ name: 'Child', partner_name: 'Child', parent_name: 'Parent', currency_name: 'SAR', street: 'Abu Bakr Al Razi', city: 'Dammam', zip: '32442',
      website: 'http://www.fay.sa', vat: '3104', country_name: 'Saudi Arabia', country_code: 'SA', l10n_sa_additional_identification_scheme: 'CRN',
      l10n_sa_additional_identification_number: '2050118528', division: 'HYD', credit_invoice: true, social_twitter: '@yamama', l10n_sa_registered_name: 'ZATCA Name' })
    expect(c.logo).to.equal(`data:image/png;base64,${png.toString('base64')}`)
  })

  it('has no logo when the partner has no image, and 404s a missing or not allowed company', async () => {
    const a = await company('Alpha'); const b = await company('Beta')
    expect((await getCompany(a, [])).logo).to.equal(null)
    for (const [id, allowed] of [[999, []], [a, [b]]] as [number, number[]][]) {
      try { await getCompany(id, allowed); expect.fail() } catch (e) { expect((e as Error).message).to.equal('Company not found') }
    }
  })

  it('creates a company with its partner, copies the address onto the partner and adds the creator to its users', async () => {
    const [cur] = (await sequelize.query(`INSERT INTO res_currency (name) VALUES ('SAR') RETURNING id`))[0] as Id[]
    const [country] = (await sequelize.query(`INSERT INTO res_country (name, code) VALUES ('Saudi Arabia', 'SA') RETURNING id`))[0] as Id[]
    const parent = await company('Parent')
    const [pp] = (await sequelize.query(`INSERT INTO res_partner (name, display_name, type) VALUES ('Ali', 'Ali', 'contact') RETURNING id`))[0] as Id[]
    const [u] = (await sequelize.query(`INSERT INTO res_users (login, partner_id, company_id) VALUES ('ali', :p, :c) RETURNING id`, { replacements: { p: pp.id, c: parent } }))[0] as Id[]
    const c = await createCompany({ name: '  New Co ', street: 'Main St', city: 'Dammam', country_id: country.id, currency_id: cur.id, parent_id: parent,
      vat: '3104', website: 'http://x.sa', l10n_sa_additional_identification_scheme: 'CRN', l10n_sa_additional_identification_number: '205', company_registry: '205',
      division: 'NEW', credit_invoice: true, social_twitter: '@new' }, env({ uid: u.id }))
    expect(c).to.include({ name: 'New Co', partner_name: 'New Co', parent_name: 'Parent', currency_name: 'SAR', street: 'Main St', city: 'Dammam', vat: '3104',
      website: 'http://x.sa', country_name: 'Saudi Arabia', division: 'NEW', credit_invoice: true, cash_invoice: false, social_twitter: '@new', company_registry: '205' })
    const rel = (await sequelize.query('SELECT user_id FROM res_company_users_rel WHERE cid = :c', { replacements: { c: c.id } }))[0] as { user_id: number }[]
    expect(rel.map(r => r.user_id)).to.deep.equal([u.id])
    expect((await listCompanies([])).map(r => r.name)).to.include('New Co')
  })

  it('refuses a missing name, a duplicate name or an unknown reference, creating nothing', async () => {
    await company('Alpha')
    const before = (await listCompanies([])).length
    const bad = (b: Record<string, unknown>) => createCompany(b, env()).then(() => 'created', e => (e as Error).message)
    expect(await bad({ name: ' ' })).to.match(/Name is required/)
    expect(await bad({ name: 'alpha' })).to.match(/already exists/)
    expect(await bad({ name: 'B', parent_id: 9999 })).to.match(/Parent company not found/)
    expect(await bad({ name: 'B', currency_id: 9999 })).to.match(/Currency not found/)
    expect(await bad({ name: 'B', country_id: 'x' })).to.match(/Country is not valid/)
    expect((await listCompanies([])).length).to.equal(before)
    expect(((await sequelize.query(`SELECT count(*)::int AS n FROM res_partner WHERE name = 'B'`))[0] as { n: number }[])[0].n).to.equal(0)
  })

  it('stores the seal, header and footer images and returns them as data URLs', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9, 9])
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 1, 2])
    const c = await createCompany({ name: 'Img Co', company_seal: `data:image/png;base64,${png.toString('base64')}`, company_header_boxed: `data:image/jpeg;base64,${jpg.toString('base64')}` }, env())
    expect(c.company_seal).to.equal(`data:image/png;base64,${png.toString('base64')}`)
    expect(c.company_header_boxed).to.equal(`data:image/jpeg;base64,${jpg.toString('base64')}`)
    expect(c.company_footer_boxed).to.equal(null)
  })

  it('refuses an image that is not a data URL of a picture, creating nothing', async () => {
    const bad = (v: unknown) => createCompany({ name: 'Bad Img', company_seal: v }, env()).then(() => 'created', e => (e as Error).message)
    expect(await bad('not-an-image')).to.match(/Company Seal must be a PNG/)
    expect(await bad('data:text/html;base64,AAAA')).to.match(/Company Seal must be a PNG/)
    expect(await bad(`data:image/png;base64,${Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64')}`)).to.match(/larger than 5 MB/)
    expect((await listCompanies([])).length).to.equal(0)
  })

  it('returns the intercompany accounts and journal with their display names, as Odoo prints them', async () => {
    const [cur] = (await sequelize.query(`INSERT INTO res_currency (name) VALUES ('SAR') RETURNING id`))[0] as Id[]
    const id = await company('Interco', { currency: cur.id })
    const [type] = (await sequelize.query(`INSERT INTO account_account_type (name) VALUES ('Current Liabilities') RETURNING id`))[0] as Id[]
    const acc = async (code: string, name: string) => ((await sequelize.query(`INSERT INTO account_account (name, code, user_type_id, company_id) VALUES (:name, :code, :t, :c) RETURNING id`, { replacements: { name, code, t: type.id, c: id } }))[0] as Id[])[0].id
    const from = await acc('301760', 'Inter Division Account (Clearing Account)')
    const to = await acc('301750', "Related Parties (Partner's Current Account)")
    const [jr] = (await sequelize.query(`INSERT INTO account_journal (name, code, type, company_id) VALUES ('Inter Company Transfer', 'ICT', 'general', :c) RETURNING id`, { replacements: { c: id } }))[0] as Id[]
    await sequelize.query('UPDATE res_company SET due_from_account_id = :f, due_to_account_id = :t, due_fromto_payment_journal_id = :j, currency_id = :cur WHERE id = :id', { replacements: { f: from, t: to, j: jr.id, cur: cur.id, id } })
    const c = await getCompany(id, [])
    expect(c).to.include({ due_from_account_id: from, due_from_account_name: '301760 Inter Division Account (Clearing Account)',
      due_to_account_id: to, due_to_account_name: "301750 Related Parties (Partner's Current Account)",
      due_fromto_payment_journal_id: jr.id, due_fromto_payment_journal_name: 'Inter Company Transfer (SAR)' })
  })

  it('has no intercompany values for a new company, and keeps the id when the account is not loaded yet', async () => {
    const id = await company('Plain')
    expect(await getCompany(id, [])).to.include({ due_from_account_id: null, due_from_account_name: null, due_fromto_payment_journal_name: null })
    await sequelize.query('UPDATE res_company SET due_from_account_id = 999 WHERE id = :id', { replacements: { id } })
    expect(await getCompany(id, [])).to.include({ due_from_account_id: 999, due_from_account_name: null })
  })

  it('keeps a company the user just created visible even when the request lists only older companies', async () => {
    const old = await company('Old')
    const [pp] = (await sequelize.query(`INSERT INTO res_partner (name, display_name, type) VALUES ('Ali', 'Ali', 'contact') RETURNING id`))[0] as Id[]
    const [u] = (await sequelize.query(`INSERT INTO res_users (login, partner_id, company_id) VALUES ('ali', :p, :c) RETURNING id`, { replacements: { p: pp.id, c: old } }))[0] as Id[]
    const request = env({ uid: u.id, allowedCompanyIds: [old] })
    const created = await createCompany({ name: 'Just Created' }, request)
    const allowed = await visibleCompanyIds(request)
    expect(allowed).to.have.members([old, created.id as number])
    expect((await listCompanies(allowed)).map(r => r.name)).to.have.members(['Old', 'Just Created'])
    expect((await getCompany(created.id as number, allowed)).name).to.equal('Just Created')
  })

  it('adds nothing for a request with no company filter, and does not widen a request that names companies for an unknown user', async () => {
    const a = await company('A'); const b = await company('B')
    expect(await visibleCompanyIds(env({ allowedCompanyIds: [] }))).to.deep.equal([])
    expect(await visibleCompanyIds(env({ uid: null, allowedCompanyIds: [a] }))).to.deep.equal([a])
    expect(await visibleCompanyIds(env({ uid: 999, allowedCompanyIds: [a] }))).to.deep.equal([a])
    expect((await listCompanies(await visibleCompanyIds(env({ uid: 999, allowedCompanyIds: [a] })))).map(r => r.id)).to.deep.equal([a])
    expect(b).to.be.a('number')
  })


  it('edits company and partner fields, keeps what the request leaves out, and renames the partner too', async () => {
    const [cur] = (await sequelize.query(`INSERT INTO res_currency (name) VALUES ('SAR') RETURNING id`))[0] as Id[]
    const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 5]).toString('base64')}`
    const parent = await company('Parent')
    const c = await createCompany({ name: 'Edit Me', street: 'Old St', city: 'Dammam', vat: '111', division: 'OLD', credit_invoice: true, cash_invoice: true, company_seal: png, currency_id: cur.id }, env())
    const out = await updateCompany(c.id as number, { name: 'Edited', street: 'New St', division: 'NEW', cash_invoice: false, parent_id: parent, website: 'http://e.sa' }, env(), [])
    expect(out).to.include({ name: 'Edited', partner_name: 'Edited', street: 'New St', city: 'Dammam', vat: '111', division: 'NEW', cash_invoice: false, credit_invoice: true,
      parent_name: 'Parent', currency_name: 'SAR', website: 'http://e.sa' })
    expect(out.company_seal).to.equal(png)
  })

  it('clears a field or an image sent as empty, and replaces an image with a new one', async () => {
    const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 5]).toString('base64')}`
    const jpg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 7]).toString('base64')}`
    const c = await createCompany({ name: 'Img Edit', division: 'X', company_seal: png, company_header_boxed: png }, env())
    const out = await updateCompany(c.id as number, { division: '', company_seal: '', company_header_boxed: jpg }, env(), [])
    expect(out.division).to.equal(null)
    expect(out.company_seal).to.equal(null)
    expect(out.company_header_boxed).to.equal(jpg)
  })

  it('refuses a blank or duplicate name, a company as its own ancestor, bad references and a missing company, changing nothing', async () => {
    const a = await company('Alpha'); const b = await company('Beta')
    const child = await createCompany({ name: 'Child', parent_id: a }, env())
    const bad = (id: number, body: Record<string, unknown>) => updateCompany(id, body, env(), []).then(() => 'updated', e => (e as Error).message)
    expect(await bad(b, { name: ' ' })).to.match(/Name is required/)
    expect(await bad(b, { name: 'alpha' })).to.match(/already exists/)
    expect(await bad(a, { parent_id: a })).to.match(/own parent/)
    expect(await bad(a, { parent_id: child.id })).to.match(/own parent/)
    expect(await bad(b, { currency_id: 9999 })).to.match(/Currency not found/)
    expect(await bad(b, { company_seal: 'nope' })).to.match(/Company Seal must be/)
    expect(await bad(999, { name: 'X' })).to.match(/Company not found/)
    expect((await getCompany(b, [])).name).to.equal('Beta')
    expect((await updateCompany(b, { name: 'Beta' }, env(), [])).name).to.equal('Beta')
  })

  it('does not edit a company the caller may not see', async () => {
    const a = await company('Alpha'); const b = await company('Beta')
    try { await updateCompany(b, { name: 'Hacked' }, env(), [a]); expect.fail() } catch (e) { expect((e as Error).message).to.equal('Company not found') }
    expect((await getCompany(b, [])).name).to.equal('Beta')
  })
})
