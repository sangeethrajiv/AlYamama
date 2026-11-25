import { QueryTypes } from 'sequelize'
import { sequelize } from '../../orm'
import { AppError, notFound } from '../../common.helper'
import type { RequestEnv } from '../../middleware'
import { createPartner, updatePartner } from '../../contacts/partner/partner.service'
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from './password'

/**
 * res.users with its partner record (name, email, phone ... live on res_partner, as in Odoo).
 * `password_hash` is never selected into a result; only login() and setPassword() touch it.
 */

const SELECT = `SELECT u.id, u.login, u.active, u.share, u.company_id, u.partner_id, u.notification_type,
    u.create_date, u.write_date, u.create_uid, u.write_uid, u.login_date,
    p.name, p.email, p.phone, p.mobile, p.function, p.title, p.lang, p.tz, p.country_id, p.state_id,
    p.city, p.street, p.street2, p.zip, p.website, p.comment, p.vat, p.ref,
    COALESCE((SELECT array_agg(r.cid ORDER BY r.cid) FROM res_company_users_rel r WHERE r.user_id = u.id), '{}') AS company_ids,
    COALESCE((SELECT array_agg(d.dept_id ORDER BY d.dept_id) FROM department_user_rel d WHERE d.user_id = u.id), '{}') AS user_department_ids
  FROM res_users u JOIN res_partner p ON p.id = u.partner_id`

type Row = Record<string, unknown>
const q = <T extends object = Row>(sql: string, replacements: Record<string, unknown> = {}) =>
  sequelize.query<T>(sql, { replacements, type: QueryTypes.SELECT })

export async function listUsers(active: 'all' | boolean = 'all'): Promise<Row[]> {
  return q(`${SELECT} ${active === 'all' ? '' : `WHERE u.active = ${active}`} ORDER BY lower(p.name), u.id`)
}

export async function getUser(id: number): Promise<Row> {
  const [row] = await q(`${SELECT} WHERE u.id = :id`, { id })
  if (!row) throw notFound('User')
  return row
}

/** Fields stored on the user's partner record. */
const PARTNER_FIELDS = ['name', 'email', 'phone', 'mobile', 'function', 'title', 'lang', 'tz', 'country_id', 'state_id',
  'city', 'street', 'street2', 'zip', 'website', 'comment', 'vat', 'ref'] as const

const partnerValues = (body: Row): Row => {
  const out: Row = {}
  for (const k of PARTNER_FIELDS) if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k]
  return out
}

function checkPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  return password
}

async function assertLoginFree(login: string, exceptId: number | null) {
  const [dup] = await q<{ id: number }>('SELECT id FROM res_users WHERE lower(login) = lower(:login) AND id <> :id', { login, id: exceptId ?? 0 })
  if (dup) throw new AppError(`A user with login "${login}" already exists.`, 409, 'duplicate_login')
}

async function assertCompany(id: unknown) {
  const [c] = await q('SELECT id FROM res_company WHERE id = :id', { id })
  if (!c) throw new AppError('Company not found.', 400, 'validation_error')
}

export async function createUser(body: Row, env: RequestEnv): Promise<Row> {
  const name = String(body.name ?? '').trim()
  const login = String(body.login ?? '').trim()
  if (!name) throw new AppError('Name is required.')
  if (!login) throw new AppError('Login is required.')
  const password = checkPassword(body.password)
  const companyId = Number(body.company_id)
  if (!Number.isInteger(companyId)) throw new AppError('Company is required.')
  await assertCompany(companyId)
  await assertLoginFree(login, null)
  if (body.user_department_ids !== undefined) await assertDepartments(body.user_department_ids)

  const partner = await createPartner({ ...partnerValues({ ...body, name }), type: 'contact', is_company: false, active: true, company_id: null }, env)
  try {
    const hash = await hashPassword(password)
    const [row] = await q<{ id: number }>(
      `INSERT INTO res_users (login, partner_id, company_id, active, share, password_hash, create_uid, write_uid)
       VALUES (:login, :partner, :company, true, :share, :hash, :uid, :uid) RETURNING id`,
      { login, partner: partner.id, company: companyId, share: body.share === true, hash, uid: env.uid },
    )
    await setCompanies(row.id, [companyId, ...(Array.isArray(body.company_ids) ? body.company_ids.map(Number) : [])], companyId)
    if (body.user_department_ids !== undefined) await setDepartments(row.id, body.user_department_ids)
    return getUser(row.id)
  } catch (e) {
    // The partner was created first; do not leave an orphan behind when the user could not be.
    await sequelize.query('DELETE FROM res_partner WHERE id = :id', { replacements: { id: partner.id } })
    throw e
  }
}

async function assertDepartments(value: unknown) {
  if (!Array.isArray(value) || value.map(Number).some(i => !Number.isInteger(i))) throw new AppError('user_department_ids must be a list of department ids.', 400, 'validation_error')
  const ids = [...new Set(value.map(Number))]
  if (!ids.length) return
  const found = await q<{ id: number }>('SELECT id FROM hr_department WHERE id IN (:ids)', { ids })
  if (found.length !== ids.length) throw new AppError('Department not found.', 400, 'validation_error')
}

/** Replaces a user's departments (res.users.user_department_ids). Every id must exist: none is skipped silently. */
async function setDepartments(userId: number, value: unknown) {
  await assertDepartments(value)
  const ids = [...new Set((value as unknown[]).map(Number))]
  await sequelize.query('DELETE FROM department_user_rel WHERE user_id = :userId', { replacements: { userId } })
  for (const dept of ids) await sequelize.query('INSERT INTO department_user_rel (user_id, dept_id) VALUES (:userId, :dept)', { replacements: { userId, dept } })
}

async function setCompanies(userId: number, ids: number[], defaultCompany: number) {
  const unique = [...new Set([...ids, defaultCompany])].filter(Number.isInteger)
  await sequelize.query('DELETE FROM res_company_users_rel WHERE user_id = :userId', { replacements: { userId } })
  for (const cid of unique) {
    await sequelize.query('INSERT INTO res_company_users_rel (cid, user_id) SELECT id, :userId FROM res_company WHERE id = :cid', { replacements: { cid, userId } })
  }
}

export async function updateUser(id: number, body: Row, env: RequestEnv): Promise<Row> {
  const cur = await getUser(id)
  const sets: string[] = ['write_date = now()', 'write_uid = :uid']
  const rep: Row = { id, uid: env.uid }
  if (body.login !== undefined) {
    const login = String(body.login).trim()
    if (!login) throw new AppError('Login is required.')
    await assertLoginFree(login, id)
    sets.push('login = :login'); rep.login = login
  }
  if (body.name !== undefined && !String(body.name).trim()) throw new AppError('Name is required.')
  if (body.active !== undefined) { sets.push('active = :active'); rep.active = body.active === true }
  if (body.share !== undefined) { sets.push('share = :share'); rep.share = body.share === true }
  let companyId = Number(cur.company_id)
  if (body.company_id !== undefined) {
    companyId = Number(body.company_id)
    await assertCompany(companyId)
    sets.push('company_id = :company'); rep.company = companyId
  }
  await sequelize.query(`UPDATE res_users SET ${sets.join(', ')} WHERE id = :id`, { replacements: rep })
  if (body.company_ids !== undefined || body.company_id !== undefined) {
    const ids = Array.isArray(body.company_ids) ? body.company_ids.map(Number) : (cur.company_ids as number[])
    await setCompanies(id, ids, companyId)
  }
  // Only when the request carries the list: leaving it out keeps the departments the user already has.
  if (body.user_department_ids !== undefined) await setDepartments(id, body.user_department_ids)
  const pv = partnerValues(body)
  if (Object.keys(pv).length) await updatePartner(Number(cur.partner_id), pv, env)
  return getUser(id)
}

export async function setPassword(id: number, password: unknown, env: RequestEnv): Promise<void> {
  await getUser(id)
  const hash = await hashPassword(checkPassword(password))
  await sequelize.query('UPDATE res_users SET password_hash = :hash, write_date = now(), write_uid = :uid WHERE id = :id', { replacements: { hash, uid: env.uid, id } })
}

/** Checks a login and password. One message for "no such user", "wrong password", "no password set" and "archived". */
export async function login(loginName: unknown, password: unknown): Promise<Row> {
  const fail = () => new AppError('Incorrect login or password.', 401, 'unauthorized')
  if (typeof loginName !== 'string' || typeof password !== 'string' || !loginName.trim()) throw fail()
  const [u] = await q<{ id: number; password_hash: string | null; active: boolean }>(
    'SELECT id, password_hash, active FROM res_users WHERE lower(login) = lower(:login)', { login: loginName.trim() })
  // Verify even when the user is unknown so the response time does not reveal which logins exist.
  const good = await verifyPassword(password, u?.password_hash ?? 'scrypt$00$00')
  if (!u || !u.active || !good) throw fail()
  await sequelize.query('UPDATE res_users SET login_date = now() WHERE id = :id', { replacements: { id: u.id } })
  return getUser(u.id)
}
