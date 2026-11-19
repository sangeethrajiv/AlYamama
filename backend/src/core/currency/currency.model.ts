import { Column, DataType, Model, Table } from 'sequelize-typescript'

/** res.currency - stub for Phase 1; only what partners and banks refer to. */
@Table({ tableName: 'res_currency', timestamps: false })
export class Currency extends Model<Currency> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.STRING)
  symbol: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean
}
