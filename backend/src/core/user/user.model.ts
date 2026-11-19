import { Column, DataType, Model, Table } from 'sequelize-typescript'

/**
 * res.users - minimal stub for Phase 1. Needed because a partner has a
 * salesperson (`user_id`) and audit columns (`create_uid` / `write_uid`).
 *
 * There is NO password column: credentials and login are out of scope here and
 * the Odoo hashes are never copied (docs/migration_analysis/02_*).
 */
@Table({ tableName: 'res_users', timestamps: false })
export class User extends Model<User> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  login: string

  /** The partner record holding this user's name, email and phone. */
  @Column({ type: DataType.INTEGER, allowNull: false })
  partner_id: number

  @Column({ type: DataType.INTEGER, allowNull: false })
  company_id: number

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  /** Portal / public user rather than an internal one. */
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  share: boolean

  @Column(DataType.STRING)
  notification_type: string | null
}
