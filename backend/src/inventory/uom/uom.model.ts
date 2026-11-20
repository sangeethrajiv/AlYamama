import { Column, DataType, HasMany, Model, Table } from 'sequelize-typescript'

export const MEASURE_TYPES = ['unit', 'weight', 'time', 'length', 'volume'] as const
export const UOM_TYPES = ['bigger', 'reference', 'smaller'] as const
export type UomType = (typeof UOM_TYPES)[number]

/**
 * uom.category - Odoo 12 `uom` addon. One category groups units that can be
 * converted into each other (Unit, Weight, Volume, ...). `measure_type` is
 * unique, so at most one category exists per measurement type.
 */
@Table({
  tableName: 'uom_category',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class UomCategory extends Model<UomCategory> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.STRING)
  measure_type: string | null

  /** Not an Odoo column: the UI's archive flag. */
  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null

  @HasMany(() => Uom, { foreignKey: 'category_id', as: 'uoms', constraints: false })
  uoms?: Uom[]
}

/**
 * uom.uom - Odoo 12 `uom` addon.
 *
 * `factor` is the ratio against the category's reference unit
 * (1 reference = factor x this unit); `factor_inv` is its inverse and is not
 * stored. Bigger units therefore store factor = 1 / factor_inv.
 */
@Table({
  tableName: 'uom_uom',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class Uom extends Model<Uom> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column({ type: DataType.INTEGER, allowNull: false })
  category_id: number

  /** numeric in this schema; read as a string to avoid float rounding. */
  @Column({ type: DataType.DECIMAL, allowNull: false, defaultValue: '1.0' })
  factor: string

  @Column({ type: DataType.DECIMAL, allowNull: false, defaultValue: '0.01' })
  rounding: string

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'reference' })
  uom_type: UomType

  /** Stored copy of category_id.measure_type, kept in step by the service. */
  @Column(DataType.STRING)
  measure_type: string | null

  /** purchase_custom */
  @Column(DataType.STRING)
  view_name: string | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null
}
