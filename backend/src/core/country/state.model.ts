import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript'
import { Country } from './country.model'

/** res.country.state - Odoo 12 base. Unique (country_id, code). */
@Table({ tableName: 'res_country_state', timestamps: false })
export class CountryState extends Model<CountryState> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @ForeignKey(() => Country)
  @Column({ type: DataType.INTEGER, allowNull: false })
  country_id: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column({ type: DataType.STRING, allowNull: false })
  code: string

  @BelongsTo(() => Country, 'country_id')
  country: Country
}
