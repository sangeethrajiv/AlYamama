import { Column, DataType, Model, Table } from 'sequelize-typescript'

/** res.partner.title - Odoo 12 base (Mister, Doctor, Engineer, ...). */
@Table({ tableName: 'res_partner_title', timestamps: false })
export class PartnerTitle extends Model<PartnerTitle> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.STRING)
  shortcut: string | null
}
