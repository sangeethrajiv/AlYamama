import { Column, DataType, Model, Table } from 'sequelize-typescript'

/**
 * product.category - Odoo 12 `product` addon (a tree).
 *
 * `complete_name` ("Parent / Child") and `parent_path` ("1/4/9/") are stored
 * computed values maintained by product-category.service.ts.
 * `arabic_name` is kept for parity with Odoo but is not exposed by the API.
 */
@Table({
  tableName: 'product_category',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class ProductCategory extends Model<ProductCategory> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.STRING)
  complete_name: string | null

  @Column(DataType.INTEGER)
  parent_id: number | null

  @Column(DataType.STRING)
  parent_path: string | null

  @Column(DataType.STRING)
  arabic_name: string | null

  /** sale_custom: prefix used when numbering products of this category. */
  @Column(DataType.STRING)
  sequence_code: string | null

  /** ir.sequence: out of scope, plain integers. */
  @Column(DataType.INTEGER)
  sequence_id: number | null

  @Column(DataType.INTEGER)
  lot_sequence_id: number | null

  @Column(DataType.INTEGER)
  removal_strategy_id: number | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null
}
