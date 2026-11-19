import type { Request, Response } from 'express'
import { Op, type Model, type ModelStatic } from 'sequelize'
import { likeEscape, notFound, ok, paging } from '../common.helper'
import { lookupWriteSchema } from '../requestValidator'
import { PartnerTitle } from './title/title.model'
import { PartnerIndustry } from './industry/industry.model'
import { PartnerCategory } from './category/category.model'
import { Bank } from './bank/bank.model'
import { Country } from '../core/country/country.model'
import { CountryState } from '../core/country/state.model'
import { Company } from '../core/company/company.model'
import { User } from '../core/user/user.model'
import { Partner } from './partner/partner.model'
import { Currency } from '../core/currency/currency.model'

/**
 * Read endpoints for the lookup models behind the Contacts form dropdowns,
 * plus create/update for the three the user maintains from the form
 * (tags, titles, industries).
 */

type Ctor = ModelStatic<Model> & { prototype: { id: number } }

const listOf = (model: Ctor, searchCols: string[], order: string = 'name') =>
  async (req: Request, res: Response) => {
    const { limit, offset, page } = paging(req.query as Record<string, unknown>, 200)
    const q = String(req.query.q || '').trim()
    const where: Record<string, unknown> = {}
    const attrs = Object.keys(model.getAttributes())
    if (attrs.includes('active') && req.query.active !== 'all') where.active = req.query.active === 'false' ? false : true
    if (q) {
      const pattern = `%${likeEscape(q)}%`
      Object.assign(where, { [Op.or]: searchCols.map(col => ({ [col]: { [Op.iLike]: pattern } })) })
    }
    const { rows, count } = await model.findAndCountAll({ where, order: [[order, 'ASC']], limit, offset })
    return ok(res, { records: rows, total: count, page, limit })
  }

export const titles = listOf(PartnerTitle as unknown as Ctor, ['name', 'shortcut'])
export const industries = listOf(PartnerIndustry as unknown as Ctor, ['name', 'full_name'])
export const categories = listOf(PartnerCategory as unknown as Ctor, ['name'])
export const banks = listOf(Bank as unknown as Ctor, ['name', 'bic', 'city'])
export const countries = listOf(Country as unknown as Ctor, ['name', 'code', 'local_name'])
export const currencies = listOf(Currency as unknown as Ctor, ['name'])

/** GET /countries/:id/states */
export async function states(req: Request, res: Response) {
  const rows = await CountryState.findAll({
    where: { country_id: Number(req.params.id) },
    order: [['name', 'ASC']],
  })
  return ok(res, { records: rows, total: rows.length })
}

/** GET /companies - the company switcher and the form's Company field. */
export async function companies(req: Request, res: Response) {
  const allowed = req.env.allowedCompanyIds
  const rows = await Company.findAll({
    where: allowed.length ? { id: { [Op.in]: allowed } } : {},
    attributes: ['id', 'name', 'parent_id', 'partner_id', 'currency_id', 'sequence'],
    order: [['sequence', 'ASC'], ['name', 'ASC']],
  })
  return ok(res, { records: rows, total: rows.length, current: req.env.companyId })
}

/** GET /users - the Salesperson field. Names come from each user's partner record. */
export async function users(req: Request, res: Response) {
  const q = String(req.query.q || '').trim()
  const rows = await User.findAll({
    where: req.query.active === 'all' ? {} : { active: true },
    attributes: ['id', 'login', 'partner_id', 'company_id', 'active', 'share'],
    order: [['login', 'ASC']],
    limit: 500,
  })
  const partners = await Partner.findAll({
    where: { id: { [Op.in]: rows.map(r => r.partner_id) } },
    attributes: ['id', 'display_name', 'email'],
  })
  const byId = new Map(partners.map(p => [p.id, p]))
  let out = rows.map(r => {
    const p = byId.get(r.partner_id)
    return { id: r.id, login: r.login, name: p?.display_name || r.login, email: p?.email ?? null, company_id: r.company_id, active: r.active }
  })
  if (q) {
    const needle = q.toLowerCase()
    out = out.filter(u => u.name.toLowerCase().includes(needle) || u.login.toLowerCase().includes(needle))
  }
  return ok(res, { records: out, total: out.length })
}

/** Create/update for the lookups the Contacts form can add to. */
const writable: Record<string, Ctor> = {
  titles: PartnerTitle as unknown as Ctor,
  industries: PartnerIndustry as unknown as Ctor,
  categories: PartnerCategory as unknown as Ctor,
}

export const createLookup = (kind: keyof typeof writable) => async (req: Request, res: Response) => {
  const values = lookupWriteSchema.parse(req.body)
  const model = writable[kind]
  const attrs = Object.keys(model.getAttributes())
  const data = Object.fromEntries(Object.entries(values).filter(([k, v]) => attrs.includes(k) && v !== undefined))
  const row = await model.create({ ...data, create_uid: req.env.uid, write_uid: req.env.uid } as never)
  return ok(res, row, 'Created', 201)
}

export const updateLookup = (kind: keyof typeof writable) => async (req: Request, res: Response) => {
  const values = lookupWriteSchema.partial().parse(req.body)
  const model = writable[kind]
  const row = await model.findByPk(Number(req.params.id))
  if (!row) throw notFound('Record')
  const attrs = Object.keys(model.getAttributes())
  const data = Object.fromEntries(Object.entries(values).filter(([k, v]) => attrs.includes(k) && v !== undefined))
  await row.update({ ...data, write_uid: req.env.uid } as never)
  return ok(res, row, 'Updated')
}
