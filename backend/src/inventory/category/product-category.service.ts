import { sequelize } from '../../orm'
import { AppError, notFound } from '../../common.helper'
import { assertNoTreeRecursion, recomputeTree, type TreeSpec } from '../../common.tree'
import type { RequestEnv } from '../../middleware'
import { ProductCategory } from './product-category.model'
import { ProductTemplate } from '../product/product.model'

/** Odoo 12 product.category: a tree with a stored complete_name ("Parent / Child") and parent_path. */
const TREE: TreeSpec = {
  model: ProductCategory as never,
  parentCol: 'parent_id',
  separator: ' / ',
  recursionMessage: 'You cannot create recursive categories.',
}

export type CategoryValues = Partial<{
  name: string
  parent_id: number | null
  sequence_code: string | null
}>

export async function createCategory(values: CategoryValues, env: RequestEnv): Promise<ProductCategory> {
  if (!values.name?.trim()) throw new AppError('Name is required.', 400)
  return sequelize.transaction(async trx => {
    if (values.parent_id != null && !(await ProductCategory.findByPk(values.parent_id, { transaction: trx }))) {
      throw notFound('Parent category')
    }
    const row = await ProductCategory.create(
      { ...values, name: values.name!.trim(), create_uid: env.uid, write_uid: env.uid } as never,
      { transaction: trx },
    )
    await recomputeTree(TREE, row.id, trx)
    return row.reload({ transaction: trx })
  })
}

export async function updateCategory(id: number, values: CategoryValues, env: RequestEnv): Promise<ProductCategory> {
  return sequelize.transaction(async trx => {
    const row = await ProductCategory.findByPk(id, { transaction: trx, lock: trx.LOCK.UPDATE })
    if (!row) throw notFound('Category')
    if ('parent_id' in values) {
      await assertNoTreeRecursion(TREE, id, values.parent_id ?? null, trx)
      if (values.parent_id != null && !(await ProductCategory.findByPk(values.parent_id, { transaction: trx }))) {
        throw notFound('Parent category')
      }
    }
    const patch: Record<string, unknown> = { ...values, write_uid: env.uid }
    if (values.name !== undefined) patch.name = values.name.trim()
    await row.update(patch as never, { transaction: trx })
    if ('name' in values || 'parent_id' in values) await recomputeTree(TREE, id, trx)
    return row.reload({ transaction: trx })
  })
}

export async function deleteCategory(id: number): Promise<void> {
  await sequelize.transaction(async trx => {
    const row = await ProductCategory.findByPk(id, { transaction: trx })
    if (!row) throw notFound('Category')
    const children = await ProductCategory.count({ where: { parent_id: id }, transaction: trx })
    if (children) throw new AppError(`This category has ${children} sub-categor${children === 1 ? 'y' : 'ies'}.`, 400, 'has_children')
    const products = await ProductTemplate.count({ where: { categ_id: id }, transaction: trx })
    if (products) throw new AppError(`This category is used by ${products} product(s).`, 400, 'in_use')
    await row.destroy({ transaction: trx })
  })
}

/** Ids of a category and all of its descendants (Odoo's `child_of`), via parent_path. */
export async function categoryAndDescendantIds(id: number): Promise<number[]> {
  const row = await ProductCategory.findByPk(id, { attributes: ['id', 'parent_path'] })
  if (!row?.parent_path) return [id]
  const [rows] = await sequelize.query(
    `SELECT id FROM product_category WHERE parent_path LIKE :prefix`,
    { replacements: { prefix: `${row.parent_path}%` } },
  )
  return (rows as Array<{ id: number }>).map(r => r.id)
}
