import { Column, DataType, Model, Table } from 'sequelize-typescript'

/** res.partner.industry - Odoo 12 base. */
@Table({ tableName: 'res_partner_industry', timestamps: false })
export class PartnerIndustry extends Model<PartnerIndustry> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column(DataType.STRING)
  name: string | null

  @Column(DataType.STRING)
  full_name: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean
}
