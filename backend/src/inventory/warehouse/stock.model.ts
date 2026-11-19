import { Column, DataType, Model, Table } from 'sequelize-typescript'

export const LOCATION_USAGES = ['supplier', 'view', 'internal', 'customer', 'inventory', 'procurement', 'production', 'transit'] as const
export type LocationUsage = (typeof LOCATION_USAGES)[number]

/** Labels as Odoo 12 shows them for `usage`. */
export const LOCATION_USAGE_LABELS: Record<LocationUsage, string> = {
  supplier: 'Vendor Location',
  view: 'View',
  internal: 'Internal Location',
  customer: 'Customer Location',
  inventory: 'Inventory Loss',
  procurement: 'Procurement',
  production: 'Production',
  transit: 'Transit Location',
}

/**
 * stock.location - Odoo 12 `stock` addon (a tree).
 * `complete_name` ("Parent/Child") and `parent_path` are stored computed values.
 * Removal/putaway strategies and valuation accounts are out of scope.
 */
@Table({
  tableName: 'stock_location',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class Location extends Model<Location> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.STRING)
  complete_name: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'internal' })
  usage: LocationUsage

  /** Parent location. */
  @Column(DataType.INTEGER)
  location_id: number | null

  @Column(DataType.STRING)
  parent_path: string | null

  /** Owner (res.partner). */
  @Column(DataType.INTEGER)
  partner_id: number | null

  @Column(DataType.TEXT)
  comment: string | null

  @Column(DataType.INTEGER)
  posx: number | null

  @Column(DataType.INTEGER)
  posy: number | null

  @Column(DataType.INTEGER)
  posz: number | null

  @Column(DataType.INTEGER)
  company_id: number | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  scrap_location: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  return_location: boolean | null

  @Column(DataType.STRING)
  barcode: string | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null
}

export const RECEPTION_STEPS = ['one_step', 'two_steps', 'three_steps'] as const
export const DELIVERY_STEPS = ['ship_only', 'pick_ship', 'pick_pack_ship'] as const

/**
 * stock.warehouse - Odoo 12 `stock` addon.
 * Unique (name, company_id) and (code, company_id). Routes and pull rules are
 * out of scope, so those columns are not mapped.
 */
@Table({
  tableName: 'stock_warehouse',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class Warehouse extends Model<Warehouse> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  @Column({ type: DataType.INTEGER, allowNull: false })
  company_id: number

  @Column(DataType.INTEGER)
  partner_id: number | null

  @Column({ type: DataType.INTEGER, allowNull: false })
  view_location_id: number

  @Column({ type: DataType.INTEGER, allowNull: false })
  lot_stock_id: number

  @Column({ type: DataType.STRING(5), allowNull: false })
  code: string

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'one_step' })
  reception_steps: string

  @Column({ type: DataType.STRING, allowNull: false, defaultValue: 'ship_only' })
  delivery_steps: string

  @Column(DataType.INTEGER)
  wh_input_stock_loc_id: number | null

  @Column(DataType.INTEGER)
  wh_qc_stock_loc_id: number | null

  @Column(DataType.INTEGER)
  wh_output_stock_loc_id: number | null

  @Column(DataType.INTEGER)
  wh_pack_stock_loc_id: number | null

  @Column(DataType.INTEGER)
  in_type_id: number | null

  @Column(DataType.INTEGER)
  out_type_id: number | null

  @Column(DataType.INTEGER)
  int_type_id: number | null

  @Column(DataType.INTEGER)
  pick_type_id: number | null

  @Column(DataType.INTEGER)
  pack_type_id: number | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  buy_to_resupply: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  manufacture_to_resupply: boolean | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null
}

export const PICKING_CODES = ['incoming', 'outgoing', 'internal', 'mrp_operation'] as const
export const PICKING_CODE_LABELS: Record<string, string> = {
  incoming: 'Receipt',
  outgoing: 'Delivery',
  internal: 'Internal Transfer',
  mrp_operation: 'Manufacturing',
}

/**
 * stock.picking.type - the operation types (Receipts, Delivery Orders,
 * Internal Transfers, Manufacturing). Read-mostly here: the pickings that use
 * them are a later phase.
 */
@Table({
  tableName: 'stock_picking_type',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class PickingType extends Model<PickingType> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  name: string

  @Column(DataType.INTEGER)
  color: number | null

  @Column(DataType.INTEGER)
  sequence: number | null

  /** ir.sequence: out of scope, plain integer. */
  @Column(DataType.INTEGER)
  sequence_id: number | null

  @Column(DataType.INTEGER)
  default_location_src_id: number | null

  @Column(DataType.INTEGER)
  default_location_dest_id: number | null

  @Column({ type: DataType.STRING, allowNull: false })
  code: string

  @Column(DataType.INTEGER)
  return_picking_type_id: number | null

  @Column(DataType.BOOLEAN)
  show_entire_packs: boolean | null

  @Column(DataType.INTEGER)
  warehouse_id: number | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  use_create_lots: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  use_existing_lots: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  show_operations: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  show_reserved: boolean | null

  @Column(DataType.STRING)
  barcode: string | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null
}
