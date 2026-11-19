import { Column, DataType, Model, Table } from 'sequelize-typescript'

/**
 * res.company - minimal stub for Phase 1 (Contacts).
 * Accounting, stock and HR columns are deliberately out of scope; see
 * docs/CLAUDE_main.md section 4. `parent_id` carries the Yamama company tree
 * (parent: Flames of Al Yamama Trading Co. + 5 operating companies).
 */
@Table({ tableName: 'res_company', timestamps: false })
export class Company extends Model<Company> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.INTEGER)
  parent_id: number | null

  /** The partner record that represents this company. */
  @Column({ type: DataType.INTEGER, allowNull: false })
  partner_id: number

  @Column(DataType.INTEGER)
  currency_id: number | null

  @Column(DataType.INTEGER)
  sequence: number | null

  @Column(DataType.STRING)
  email: string | null

  @Column(DataType.STRING)
  phone: string | null

  @Column(DataType.STRING)
  company_registry: string | null

  /** create_user_wizard: default timezone for users of this company. */
  @Column(DataType.STRING)
  default_user_tz: string | null

  @Column(DataType.STRING)
  l10n_sa_registered_name: string | null
}
