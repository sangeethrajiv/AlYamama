import { Column, DataType, Model, Table } from 'sequelize-typescript'

/**
 * res.bank - Odoo 12 base. The bank institution itself.
 * Note the Odoo column names: `state` and `country`, not state_id / country_id.
 */
@Table({ tableName: 'res_bank', timestamps: false })
export class Bank extends Model<Bank> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.STRING)
  street: string | null

  @Column(DataType.STRING)
  street2: string | null

  @Column(DataType.STRING)
  zip: string | null

  @Column(DataType.STRING)
  city: string | null

  /** res.country.state (Odoo column name is `state`). */
  @Column(DataType.INTEGER)
  state: number | null

  /** res.country (Odoo column name is `country`). */
  @Column(DataType.INTEGER)
  country: number | null

  @Column(DataType.STRING)
  email: string | null

  @Column(DataType.STRING)
  phone: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  /** SWIFT / BIC code. */
  @Column(DataType.STRING)
  bic: string | null
}
