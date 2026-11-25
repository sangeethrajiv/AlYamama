import { expect } from 'chai'
import { env, resetTables, sequelize } from '../../test-helper'
import { createUser, getUser, listUsers, login, setPassword, updateUser } from './user.service'
import { hashPassword, verifyPassword } from './password'

async function company(name = 'Co A') {
  const [p] = (await sequelize.query(`INSERT INTO res_partner (name, display_name, type) VALUES (:n, :n, 'contact') RETURNING id`, { replacements: { n: name } }))[0] as { id: number }[]
  const [c] = (await sequelize.query(`INSERT INTO res_company (name, partner_id) VALUES (:n, :p) RETURNING id`, { replacements: { n: name, p: p.id } }))[0] as { id: number }[]
  return c.id
}

async function department(name: string) {
  const [d] = (await sequelize.query(`INSERT INTO hr_department (name, complete_name) VALUES (:n, :n) RETURNING id`, { replacements: { n: name } }))[0] as { id: number }[]
  return d.id
}

describe('core / res.users', () => {
  beforeEach(resetTables)

  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('Secret#123')
    const b = await hashPassword('Secret#123')
    expect(a).to.not.equal(b)
    expect(await verifyPassword('Secret#123', a)).to.equal(true)
    expect(await verifyPassword('secret#123', a)).to.equal(false)
    expect(await verifyPassword('x', null)).to.equal(false)
  })

  it('creates a user with its partner, allowed company and a stored hash', async () => {
    const co = await company()
    const u = await createUser({ name: 'Ali Test', login: 'ali', email: 'ali@x.com', company_id: co, password: 'Secret#123' }, env())
    expect(u).to.include({ login: 'ali', name: 'Ali Test', email: 'ali@x.com', active: true, company_id: co })
    expect(u.company_ids).to.deep.equal([co])
    expect(u).to.not.have.property('password_hash')
    const [row] = (await sequelize.query('SELECT password_hash FROM res_users WHERE id = :id', { replacements: { id: u.id } }))[0] as { password_hash: string }[]
    expect(row.password_hash).to.match(/^scrypt\$/).and.to.not.contain('Secret#123')
    expect(await listUsers()).to.have.length(1)
  })

  it('refuses a duplicate login (any case), a short password and a missing name, creating nothing', async () => {
    const co = await company()
    await createUser({ name: 'A', login: 'ali', company_id: co, password: 'Secret#123' }, env())
    const bad = (body: Record<string, unknown>) => createUser({ name: 'B', login: 'bob', company_id: co, password: 'Secret#123', ...body }, env()).then(() => 'created', e => (e as Error).message)
    expect(await bad({ login: 'ALI' })).to.match(/already exists/)
    expect(await bad({ password: 'short' })).to.match(/at least 8/)
    expect(await bad({ name: ' ' })).to.match(/Name is required/)
    const [n] = (await sequelize.query('SELECT count(*)::int AS n FROM res_partner WHERE name IN (\'B\')'))[0] as { n: number }[]
    expect(n.n).to.equal(0)
  })

  it('signs in with the right password only, and not when archived', async () => {
    const co = await company()
    const u = await createUser({ name: 'Ali', login: 'Ali', company_id: co, password: 'Secret#123' }, env())
    expect((await login('ali', 'Secret#123')).id).to.equal(u.id)
    expect((await getUser(u.id)).login_date).to.not.equal(null)
    for (const [l, p] of [['ali', 'wrong-password'], ['nobody', 'Secret#123'], ['', ''], [undefined, undefined]]) {
      let msg = ''
      try { await login(l, p) } catch (e) { msg = (e as Error).message }
      expect(msg, `${l}/${p}`).to.equal('Incorrect login or password.')
    }
    await updateUser(u.id, { active: false }, env())
    try { await login('ali', 'Secret#123'); expect.fail('archived user signed in') } catch (e) { expect((e as Error).message).to.equal('Incorrect login or password.') }
  })

  it('changes the password: the new one works, the old one stops', async () => {
    const co = await company()
    const u = await createUser({ name: 'Ali', login: 'ali', company_id: co, password: 'Secret#123' }, env())
    await setPassword(u.id as number, 'Another#456', env())
    expect((await login('ali', 'Another#456')).id).to.equal(u.id)
    try { await login('ali', 'Secret#123'); expect.fail('old password still works') } catch (e) { expect((e as Error).message).to.match(/Incorrect/) }
    try { await setPassword(u.id as number, 'short', env()); expect.fail() } catch (e) { expect((e as Error).message).to.match(/at least 8/) }
  })

  it('updates partner fields, login, active and allowed companies', async () => {
    const a = await company('A'); const b = await company('B')
    const u = await createUser({ name: 'Ali', login: 'ali', company_id: a, password: 'Secret#123' }, env())
    const out = await updateUser(u.id as number, { name: 'Ali Renamed', phone: '555', login: 'ali2', company_id: b, company_ids: [a, b] }, env())
    expect(out).to.include({ name: 'Ali Renamed', phone: '555', login: 'ali2', company_id: b })
    expect(out.company_ids).to.deep.equal([a, b])
    const o = await updateUser(u.id as number, { active: false }, env())
    expect(o.active).to.equal(false)
  })

  it('404s an unknown user', async () => {
    try { await getUser(999); expect.fail() } catch (e) { expect((e as Error).message).to.equal('User not found') }
  })

  it('returns every assigned department and keeps them when an update does not mention them', async () => {
    const co = await company()
    const [d1, d2, d3, d4, d5] = [await department('Sales'), await department('Sales'), await department('Hydraulic'), await department('Logistics'), await department('Corporate')]
    const u = await createUser({ name: 'Ali', login: 'ali', company_id: co, password: 'Secret#123', user_department_ids: [d5, d1, d3, d2, d4] }, env())
    expect(u.user_department_ids).to.deep.equal([d1, d2, d3, d4, d5])
    const renamed = await updateUser(u.id as number, { name: 'Ali R' }, env())
    expect(renamed.user_department_ids).to.deep.equal([d1, d2, d3, d4, d5])
    expect((await listUsers())[0].user_department_ids).to.deep.equal([d1, d2, d3, d4, d5])
  })

  it('replaces the departments only when a list is sent, and an empty list clears them', async () => {
    const co = await company()
    const [d1, d2, d3] = [await department('A'), await department('B'), await department('C')]
    const u = await createUser({ name: 'Ali', login: 'ali', company_id: co, password: 'Secret#123' }, env())
    expect(u.user_department_ids).to.deep.equal([])
    expect((await updateUser(u.id as number, { user_department_ids: [d1, d2] }, env())).user_department_ids).to.deep.equal([d1, d2])
    expect((await updateUser(u.id as number, { user_department_ids: [d3] }, env())).user_department_ids).to.deep.equal([d3])
    expect((await updateUser(u.id as number, { user_department_ids: [] }, env())).user_department_ids).to.deep.equal([])
  })

  it('refuses an unknown department or a bad list and changes nothing', async () => {
    const co = await company()
    const d1 = await department('A')
    const u = await createUser({ name: 'Ali', login: 'ali', company_id: co, password: 'Secret#123', user_department_ids: [d1] }, env())
    const bad = (v: unknown) => updateUser(u.id as number, { user_department_ids: v }, env()).then(() => 'updated', e => (e as Error).message)
    expect(await bad([d1, 9999])).to.match(/Department not found/)
    expect(await bad('3')).to.match(/list of department ids/)
    expect(await bad(['x'])).to.match(/list of department ids/)
    expect((await getUser(u.id as number)).user_department_ids).to.deep.equal([d1])
    const create = createUser({ name: 'Bob', login: 'bob', company_id: co, password: 'Secret#123', user_department_ids: [9999] }, env()).then(() => 'created', e => (e as Error).message)
    expect(await create).to.match(/Department not found/)
    expect(await listUsers()).to.have.length(1)
  })
})
