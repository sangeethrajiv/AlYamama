import { Op, type Transaction } from 'sequelize'
import { sequelize } from '../../orm'
import { AppError, notFound } from '../../common.helper'
import type { RequestEnv } from '../../middleware'
import { Partner, ADDRESS_FIELDS, COMMERCIAL_FIELDS, PARTNER_TYPE_LABELS } from './partner.model'
import { PartnerCategory, PartnerCategoryRel } from '../category/category.model'

/**
 * The Odoo 12 behaviour of res.partner, ported field for field from
 * odoo/addons/base/models/res_partner.py:
 *
 *   _get_name / _compute_display_name        -> displayNameOf
 *   _compute_commercial_partner             -> commercialPartnerOf
 *   _compute_commercial_company_name        -> recomputeStored
 *   _check_parent_id (recursion)            -> assertNoRecursion
 *   _fields_sync (commercial + address)     -> fieldsSync
 *   _commercial_sync_to_children            -> commercialSyncToChildren
 *   update_address                          -> addressSyncToChildren
 *
 * Everything runs inside one transaction per request, and every write stamps the
 * audit columns from the request env.
 */

const MAX_DEPTH = 100

export type PartnerValues = Partial<Record<string, unknown>>

// ---------------------------------------------------------------- helpers ---

/** Visibility filter: shared records (company_id IS NULL) plus the user's allowed companies. */
export function companyScope(env: RequestEnv) {
  if (!env.allowedCompanyIds.length) return {}
  return { [Op.or]: [{ company_id: null }, { company_id: { [Op.in]: env.allowedCompanyIds } }] }
}

const load = async (id: number, trx?: Transaction) =>
  Partner.findByPk(id, { transaction: trx, lock: trx ? trx.LOCK.UPDATE : undefined })

/**
 * Odoo `_get_name`, without the context options (show_address, show_email, ...).
 * A person or address under a parent is shown as "Company, Name"; an unnamed
 * address falls back to its type label.
 */
export function displayNameOf(p: {
  name?: string | null
  type?: string | null
  is_company?: boolean | null
  company_name?: string | null
  commercial_company_name?: string | null
  parent_id?: number | null
}, parentName?: string | null): string {
  let name = p.name || ''
  if (p.company_name || p.parent_id) {
    if (!name && p.type && ['invoice', 'delivery', 'other'].includes(p.type)) {
      name = PARTNER_TYPE_LABELS[p.type] || ''
    }
    if (!p.is_company) {
      const company = p.commercial_company_name || parentName || ''
      if (company) name = `${company}, ${name}`
    }
  }
  return name
}

/** Odoo `_compute_commercial_partner`: the record itself if it is a company or has no parent. */
async function commercialPartnerOf(p: Partner, trx: Transaction): Promise<Partner> {
  let cur = p
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (cur.is_company || cur.parent_id == null) return cur
    const up = await load(cur.parent_id, trx)
    if (!up) return cur
    cur = up
  }
  throw new AppError('You cannot create recursive Partner hierarchies.', 400, 'recursion')
}

/** Odoo `_check_parent_id`: a partner cannot be its own ancestor. */
async function assertNoRecursion(id: number | null, parentId: number | null, trx: Transaction) {
  if (parentId == null) return
  if (id != null && parentId === id) throw new AppError('You cannot create recursive Partner hierarchies.', 400, 'recursion')
  let cur: number | null = parentId
  for (let i = 0; i < MAX_DEPTH && cur != null; i++) {
    if (id != null && cur === id) throw new AppError('You cannot create recursive Partner hierarchies.', 400, 'recursion')
    const row: Partner | null = await Partner.findByPk(cur, { attributes: ['id', 'parent_id'], transaction: trx })
    if (!row) return
    cur = row.parent_id
  }
  if (cur != null) throw new AppError('Partner hierarchy is too deep.', 400, 'recursion')
}

/**
 * Recomputes the three stored computed columns of one record and saves them.
 * Odoo keeps these in the table, so a plain SQL reader sees the same values.
 */
async function recomputeStored(p: Partner, trx: Transaction) {
  const commercial = await commercialPartnerOf(p, trx)
  const commercial_company_name = commercial.is_company ? commercial.name : p.company_name
  const parent = p.parent_id != null ? await Partner.findByPk(p.parent_id, { attributes: ['id', 'name'], transaction: trx }) : null
  const display_name = displayNameOf({ ...p.get(), commercial_company_name }, parent?.name)
  await p.update({ commercial_partner_id: commercial.id, commercial_company_name, display_name }, { transaction: trx, hooks: false, silent: true })
}

/** Recomputes a record and everything under it (used when a parent's name or company changes). */
async function recomputeSubtree(p: Partner, trx: Transaction, depth = 0) {
  if (depth > MAX_DEPTH) return
  await recomputeStored(p, trx)
  const children = await Partner.findAll({ where: { parent_id: p.id }, transaction: trx })
  for (const c of children) await recomputeSubtree(c, trx, depth + 1)
}

/** Odoo `_commercial_sync_to_children`: push vat / credit_limit down to non-company children. */
async function commercialSyncToChildren(p: Partner, trx: Transaction, depth = 0) {
  if (depth > MAX_DEPTH) return
  const commercial = await commercialPartnerOf(p, trx)
  const vals = Object.fromEntries(COMMERCIAL_FIELDS.map(f => [f, (commercial as unknown as Record<string, unknown>)[f]]))
  const children = await Partner.findAll({ where: { parent_id: p.id, is_company: { [Op.not]: true } }, transaction: trx })
  for (const child of children) {
    await child.update(vals, { transaction: trx, hooks: false, silent: true })
    await commercialSyncToChildren(child, trx, depth + 1)
  }
}

/** Odoo `update_address` on children of type 'contact'. */
async function addressSyncToChildren(p: Partner, values: PartnerValues, trx: Transaction) {
  const addr = Object.fromEntries(ADDRESS_FIELDS.filter(f => f in values).map(f => [f, values[f]]))
  if (!Object.keys(addr).length) return
  const children = await Partner.findAll({ where: { parent_id: p.id, type: 'contact' }, transaction: trx })
  for (const child of children) {
    await child.update(addr, { transaction: trx, hooks: false, silent: true })
  }
}

/**
 * Odoo `_fields_sync`: upstream from the parent, then downstream to children.
 * Called after every create and update.
 */
async function fieldsSync(p: Partner, values: PartnerValues, trx: Transaction) {
  // 1. From the parent down to this record.
  if (values.parent_id || values.type === 'contact') {
    if (values.parent_id) {
      const commercial = await commercialPartnerOf(p, trx)
      if (commercial.id !== p.id) {
        const vals = Object.fromEntries(COMMERCIAL_FIELDS.map(f => [f, (commercial as unknown as Record<string, unknown>)[f]]))
        await p.update(vals, { transaction: trx, hooks: false, silent: true })
      }
    }
    if (p.parent_id != null && p.type === 'contact') {
      const parent = await load(p.parent_id, trx)
      if (parent) {
        const addr = Object.fromEntries(ADDRESS_FIELDS.map(f => [f, (parent as unknown as Record<string, unknown>)[f]]))
        await p.update(addr, { transaction: trx, hooks: false, silent: true })
      }
    }
  }

  // 2. From this record down to its children.
  const childCount = await Partner.count({ where: { parent_id: p.id }, transaction: trx })
  if (childCount) {
    if (COMMERCIAL_FIELDS.some(f => f in values)) await commercialSyncToChildren(p, trx)
    await addressSyncToChildren(p, values, trx)
  }
}

/** Resolves tag input (ids or names) to category ids, creating the names that do not exist. */
async function resolveTags(tags: Array<number | string> | undefined, env: RequestEnv, trx: Transaction): Promise<number[] | undefined> {
  if (tags === undefined) return undefined
  const out: number[] = []
  for (const t of tags) {
    if (typeof t === 'number') { out.push(t); continue }
    const name = t.trim()
    if (!name) continue
    const found = await PartnerCategory.findOne({ where: { name }, transaction: trx })
    if (found) { out.push(found.id); continue }
    const made = await PartnerCategory.create(
      { name, active: true, create_uid: env.uid, write_uid: env.uid } as never,
      { transaction: trx },
    )
    out.push(made.id)
  }
  return [...new Set(out)]
}

async function setTags(partnerId: number, ids: number[], trx: Transaction) {
  await PartnerCategoryRel.destroy({ where: { partner_id: partnerId }, transaction: trx })
  if (ids.length) {
    await PartnerCategoryRel.bulkCreate(ids.map(category_id => ({ partner_id: partnerId, category_id })) as never[], { transaction: trx })
  }
}

// -------------------------------------------------------------- write API ---

/** Fields a client may never set directly; they are computed or audit columns. */
const READ_ONLY = new Set([
  'id', 'display_name', 'commercial_partner_id', 'commercial_company_name',
  'create_uid', 'create_date', 'write_uid', 'write_date', 'partner_share',
])

function sanitizeValues(values: PartnerValues): PartnerValues {
  const out: PartnerValues = {}
  for (const [k, v] of Object.entries(values)) if (!READ_ONLY.has(k)) out[k] = v
  return out
}

export async function createPartner(values: PartnerValues & { tags?: Array<number | string> }, env: RequestEnv): Promise<Partner> {
  return sequelize.transaction(async trx => {
    const { tags, ...rest } = values
    const vals = sanitizeValues(rest)

    // Defaults, as in Odoo: a new record belongs to the current company.
    if (vals.company_id === undefined && env.companyId != null) vals.company_id = env.companyId
    if (vals.type === undefined) vals.type = 'contact'
    if (vals.active === undefined) vals.active = true

    await assertNoRecursion(null, (vals.parent_id as number) ?? null, trx)
    const tagIds = await resolveTags(tags, env, trx)

    const p = await Partner.create({ ...vals, create_uid: env.uid, write_uid: env.uid } as never, { transaction: trx })
    if (tagIds) await setTags(p.id, tagIds, trx)
    await fieldsSync(p, vals, trx)
    await recomputeStored(p, trx)
    await p.reload({ transaction: trx })
    return p
  })
}

export async function updatePartner(
  id: number,
  values: PartnerValues & { tags?: Array<number | string> },
  env: RequestEnv,
): Promise<Partner> {
  return sequelize.transaction(async trx => {
    const p = await load(id, trx)
    if (!p) throw notFound('Contact')
    const { tags, ...rest } = values
    const vals = sanitizeValues(rest)

    if ('parent_id' in vals) await assertNoRecursion(id, (vals.parent_id as number) ?? null, trx)
    const tagIds = await resolveTags(tags, env, trx)

    const nameOrCompanyChanged = ['name', 'is_company', 'company_name', 'parent_id', 'type'].some(f => f in vals)

    await p.update({ ...vals, write_uid: env.uid } as never, { transaction: trx })
    if (tagIds) await setTags(p.id, tagIds, trx)
    await fieldsSync(p, vals, trx)

    // A changed name or hierarchy changes the children's display_name too.
    if (nameOrCompanyChanged) await recomputeSubtree(p, trx)
    else await recomputeStored(p, trx)

    await p.reload({ transaction: trx })
    return p
  })
}

export async function archivePartner(id: number, active: boolean, env: RequestEnv): Promise<Partner> {
  return sequelize.transaction(async trx => {
    const p = await load(id, trx)
    if (!p) throw notFound('Contact')
    await p.update({ active, write_uid: env.uid } as never, { transaction: trx })
    return p
  })
}

export async function deletePartner(id: number, _env: RequestEnv): Promise<void> {
  await sequelize.transaction(async trx => {
    const p = await load(id, trx)
    if (!p) throw notFound('Contact')
    const children = await Partner.count({ where: { parent_id: id }, transaction: trx })
    if (children) {
      throw new AppError(
        `This contact has ${children} child contact(s). Archive it instead, or move the children first.`,
        400,
        'has_children',
      )
    }
    await PartnerCategoryRel.destroy({ where: { partner_id: id }, transaction: trx })
    await p.destroy({ transaction: trx })
  })
}
