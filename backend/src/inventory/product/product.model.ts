import { BelongsTo, Column, DataType, HasMany, Model, Table } from 'sequelize-typescript'
import { ProductCategory } from '../category/product-category.model'
import { Uom } from '../uom/uom.model'

/** Odoo 12 `type`: consu (consumable), service, product (storable, added by the stock addon). */
export const PRODUCT_TYPES = ['consu', 'service', 'product'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]
export const TRACKING_MODES = ['none', 'lot', 'serial'] as const

/**
 * product.template - the product as the user sees it. Odoo 12 `product` and
 * `stock` addons plus the Yamama custom fields.
 *
 * The live data has exactly one variant per template (no attributes), so
 * `default_code` is stored here and kept in step with the variant, and
 * `barcode` lives on product_product only.
 */
@Table({
  tableName: 'product_template',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class ProductTemplate extends Model<ProductTemplate> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.INTEGER)
  sequence: number | null

  @Column(DataType.TEXT)
  description: string | null

  @Column(DataType.TEXT)
  description_purchase: string | null

  @Column(DataType.TEXT)
  description_sale: string | null

  @Column(DataType.TEXT)
  description_picking: string | null

  @Column(DataType.TEXT)
  description_pickingout: string | null

  @Column(DataType.TEXT)
  description_pickingin: string | null

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'consu' })
  type: ProductType

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'none' })
  tracking: string

  @Column(DataType.BOOLEAN)
  rental: boolean | null

  @Column({ type: DataType.INTEGER, allowNull: false })
  categ_id: number

  /** Sales price. numeric in this schema, returned as a string. */
  @Column(DataType.DECIMAL(16, 4))
  list_price: string | null

  @Column(DataType.DECIMAL(16, 4))
  volume: string | null

  @Column(DataType.DECIMAL(16, 4))
  weight: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  sale_ok: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  purchase_ok: boolean | null

  /** Unit of measure (stock/sales). */
  @Column({ type: DataType.INTEGER, allowNull: false })
  uom_id: number

  /** Purchase unit of measure; must be in the same category as uom_id. */
  @Column({ type: DataType.INTEGER, allowNull: false })
  uom_po_id: number

  @Column(DataType.INTEGER)
  company_id: number | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  @Column(DataType.INTEGER)
  color: number | null

  /** Internal reference. */
  @Column(DataType.STRING)
  default_code: string | null

  /** res.users. */
  @Column(DataType.INTEGER)
  responsible_id: number | null

  @Column(DataType.DECIMAL(8, 2))
  sale_delay: string | null

  // Yamama custom fields
  @Column(DataType.STRING)
  arabic_name: string | null

  @Column(DataType.STRING)
  internal_short_code: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  no_discount: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_teltonika_product: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_vehicle_subscription: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  purchase_request: boolean | null

  /** att.product.type: out of scope, plain integer. */
  @Column(DataType.INTEGER)
  product_type_id: number | null

  /** Odoo keeps this company-dependent (ir_property); one value per product here. */
  @Column({ type: DataType.DECIMAL(16, 4), defaultValue: '0' })
  standard_price: string | null

  @Column({ type: DataType.DECIMAL(16, 4), defaultValue: '0' })
  margin_perc: string | null

  /** material | labour | overhead. */
  @Column(DataType.STRING)
  internal_type: string | null

  /** The product picture (bytes). The list leaves it out; the detail returns it as a data URL. */
  @Column(DataType.BLOB)
  image: Buffer | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null

  @BelongsTo(() => ProductCategory, { foreignKey: 'categ_id', as: 'category', constraints: false })
  category?: ProductCategory

  @BelongsTo(() => Uom, { foreignKey: 'uom_id', as: 'uom', constraints: false })
  uom?: Uom

  @BelongsTo(() => Uom, { foreignKey: 'uom_po_id', as: 'uomPo', constraints: false })
  uomPo?: Uom

  @HasMany(() => ProductProduct, { foreignKey: 'product_tmpl_id', as: 'variants', constraints: false })
  variants?: ProductProduct[]
}

/**
 * product.product - the variant. Always exactly one per template here.
 * Unique `barcode`: "A barcode can only be assigned to one product !"
 */
@Table({
  tableName: 'product_product',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class ProductProduct extends Model<ProductProduct> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.INTEGER, allowNull: false })
  product_tmpl_id: number

  @Column(DataType.STRING)
  default_code: string | null

  @Column(DataType.STRING)
  barcode: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  @Column(DataType.DECIMAL(16, 4))
  volume: string | null

  @Column(DataType.DECIMAL(16, 4))
  weight: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  no_discount: boolean | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null
}
