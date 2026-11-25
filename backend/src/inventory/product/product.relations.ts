import { QueryTypes, type Transaction } from 'sequelize'
import { sequelize } from '../../orm'
import { AppError } from '../../common.helper'

/**
 * The two product relations that live outside product_template (Odoo 12 names):
 *   product_type_id  many2one  att.product.type  "Product Genre"    -> att_product_type
 *   taxes_id         many2many account.tax       "Customer Taxes"   -> product_taxes_rel (prod_id, tax_id)
 */
export type Named = { id: number; name: string }

const sel = <T extends object>(sql: string, replacements: Record<string, unknown> = {}, transaction?: Transaction) =>
  sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements, transaction })

/** Every genre, archived ones included, so a product never shows a bare id. */
export const listGenres = () => sel<Named & { active: boolean }>('SELECT id, name, active FROM att_product_type ORDER BY name, id')

export async function genreNames(ids: Array<number | null>): Promise<Map<number, string>> {
  const wanted = [...new Set(ids.filter((i): i is number => i != null))]
  if (!wanted.length) return new Map()
  const rows = await sel<Named>('SELECT id, name FROM att_product_type WHERE id IN (:ids)', { ids: wanted })
  return new Map(rows.map(r => [r.id, r.name]))
}

/** All assigned customer taxes of a page of templates, in one query. */
export async function taxesFor(templateIds: number[]): Promise<Map<number, Named[]>> {
  const out = new Map<number, Named[]>()
  if (!templateIds.length) return out
  const rows = await sel<{ prod_id: number; id: number; name: string }>(
    `SELECT r.prod_id, t.id, t.name FROM product_taxes_rel r JOIN account_tax t ON t.id = r.tax_id
      WHERE r.prod_id IN (:ids) ORDER BY t.sequence, t.id`,
    { ids: templateIds },
  )
  for (const r of rows) out.set(r.prod_id, [...(out.get(r.prod_id) ?? []), { id: r.id, name: r.name }])
  return out
}

export async function checkGenre(id: number | null | undefined, trx: Transaction): Promise<void> {
  if (id == null) return
  if (!(await sel('SELECT 1 FROM att_product_type WHERE id = :id', { id }, trx)).length) throw new AppError('Product Genre not found.', 404, 'not_found')
}

/** Replaces the product's customer taxes with exactly these. An unknown tax is refused, never dropped. */
export async function setTaxes(templateId: number, taxIds: number[], trx: Transaction): Promise<void> {
  const ids = [...new Set(taxIds)]
  if (ids.length) {
    const found = await sel<{ id: number }>('SELECT id FROM account_tax WHERE id IN (:ids)', { ids }, trx)
    if (found.length !== ids.length) throw new AppError('Customer Taxes: one of the taxes does not exist.', 400)
  }
  await sequelize.query(
    ids.length ? 'DELETE FROM product_taxes_rel WHERE prod_id = :id AND tax_id NOT IN (:ids)' : 'DELETE FROM product_taxes_rel WHERE prod_id = :id',
    { replacements: { id: templateId, ids }, transaction: trx },
  )
  for (const taxId of ids) {
    await sequelize.query('INSERT INTO product_taxes_rel (prod_id, tax_id) VALUES (:id, :tax) ON CONFLICT DO NOTHING', {
      replacements: { id: templateId, tax: taxId }, transaction: trx,
    })
  }
}
