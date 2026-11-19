import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript'
import { CountryState } from './state.model'

/** res.country - Odoo 12 base. Unique name, unique code. */
@Table({ tableName: 'res_country', timestamps: false })
export class Country extends Model<Country> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.STRING(2))
  code: string | null

  @Column(DataType.TEXT)
  address_format: string | null

  @Column(DataType.INTEGER)
  currency_id: number | null

  @Column(DataType.INTEGER)
  phone_code: number | null

  @Column(DataType.STRING)
  name_position: string | null

  @Column(DataType.STRING)
  vat_label: string | null

  /** sale_custom: Arabic/local country name. */
  @Column(DataType.STRING)
  local_name: string | null

  @HasMany(() => CountryState, 'country_id')
  states: CountryState[]
}
