import type { ModelStatic, Transaction } from 'sequelize'
import type { Model } from 'sequelize-typescript'
import { AppError } from './common.helper'

/**
 * Helpers for Odoo's tree models (product.category, stock.location):
 *   - `complete_name`: "Parent / Child" (category) or "Parent/Child" (location)
 *   - `parent_path`:   "1/4/9/" - the ids from the root down to the record itself
 *
 * Both are stored computed values, so every write that renames or moves a record
 * has to recompute the record and everything below it.
 */

export interface TreeSpec {
  model: ModelStatic<Model>
  /** Column holding the parent id. */
  parentCol: string
  /** Separator used inside complete_name. */
  separator: string
  /** Message raised for a recursive hierarchy. */
  recursionMessage: string
}

type Row = Model & Record<string, unknown>

const MAX_DEPTH = 100

/** Raises when `parentId` is the record itself or one of its descendants. */
export async function assertNoTreeRecursion(spec: TreeSpec, id: number | null, parentId: number | null, trx: Transaction) {
  if (parentId == null) return
  if (id != null && parentId === id) throw new AppError(spec.recursionMessage, 400, 'recursion')
  let cur: number | null = parentId
  for (let i = 0; i < MAX_DEPTH && cur != null; i++) {
    if (id != null && cur === id) throw new AppError(spec.recursionMessage, 400, 'recursion')
    const row = (await spec.model.findByPk(cur, { attributes: ['id', spec.parentCol], transaction: trx })) as Row | null
    if (!row) return
    cur = (row.get(spec.parentCol) as number | null) ?? null
  }
  if (cur != null) throw new AppError('The hierarchy is too deep.', 400, 'recursion')
}

/**
 * Recomputes complete_name and parent_path on one record and on all of its
 * descendants. The record must already be saved.
 */
export async function recomputeTree(spec: TreeSpec, id: number, trx: Transaction) {
  const walk = async (rowId: number, parentName: string | null, parentPath: string, depth: number) => {
    if (depth > MAX_DEPTH) return
    const row = (await spec.model.findByPk(rowId, { transaction: trx })) as Row | null
    if (!row) return
    const name = String(row.get('name') ?? '')
    const complete = parentName ? `${parentName}${spec.separator}${name}` : name
    const path = `${parentPath}${rowId}/`
    await row.update({ complete_name: complete, parent_path: path } as never, { transaction: trx, silent: true, hooks: false })
    const children = (await spec.model.findAll({
      where: { [spec.parentCol]: rowId } as never,
      attributes: ['id'],
      transaction: trx,
    })) as Row[]
    for (const c of children) await walk(Number(c.get('id')), complete, path, depth + 1)
  }

  const self = (await spec.model.findByPk(id, { transaction: trx })) as Row | null
  if (!self) return
  const parentId = (self.get(spec.parentCol) as number | null) ?? null
  let parentName: string | null = null
  let parentPath = ''
  if (parentId != null) {
    const parent = (await spec.model.findByPk(parentId, { transaction: trx })) as Row | null
    if (parent) {
      parentName = (parent.get('complete_name') as string | null) ?? String(parent.get('name') ?? '')
      parentPath = (parent.get('parent_path') as string | null) ?? `${parentId}/`
    }
  }
  await walk(id, parentName, parentPath, 0)
}
