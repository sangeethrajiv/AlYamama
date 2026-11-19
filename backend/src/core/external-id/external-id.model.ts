import { Column, DataType, Model, Table } from 'sequelize-typescript'

/**
 * ir.model.data - external ids. Every record imported from Odoo 12 keeps its
 * Odoo id here (module 'odoo12', name '<model>_<odoo id>'), so a re-run of the
 * importer updates the same row instead of creating a duplicate.
 */
@Table({ tableName: 'ir_model_data', timestamps: false })
export class ExternalId extends Model<ExternalId> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  module: string

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column({ type: DataType.STRING, allowNull: false })
  model: string

  @Column(DataType.INTEGER)
  res_id: number | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  noupdate: boolean
}
