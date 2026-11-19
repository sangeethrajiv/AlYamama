import { Column, DataType, Model, Table } from 'sequelize-typescript'

/**
 * res.partner.category - Odoo 12 base. Contact tags, stored as a tree.
 * `parent_path` is Odoo's materialised path ("1/4/9/"), used for child_of searches.
 */
@Table({ tableName: 'res_partner_category', timestamps: false })
export class PartnerCategory extends Model<PartnerCategory> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.INTEGER)
  color: number | null

  @Column(DataType.INTEGER)
  parent_id: number | null

  @Column(DataType.STRING)
  parent_path: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean
}

/** The m2m link table between partners and tags (Odoo's default name). */
@Table({ tableName: 'res_partner_res_partner_category_rel', timestamps: false })
export class PartnerCategoryRel extends Model<PartnerCategoryRel> {
  @Column({ type: DataType.INTEGER, primaryKey: true })
  partner_id: number

  @Column({ type: DataType.INTEGER, primaryKey: true })
  category_id: number
}
