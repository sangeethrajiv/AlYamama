import { BelongsTo, Column, DataType, Model, Table } from 'sequelize-typescript'
import { Bank } from '../bank/bank.model'

/** Odoo's sanitize: keep only letters and digits, upper-cased. Stored, and part of the unique key. */
export const sanitizeAccountNumber = (acc: string | null | undefined): string | null => {
  if (!acc) return null
  const s = acc.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  return s || null
}

/** Odoo 12 `acc_type`: 'iban' when the number looks like an IBAN, else 'bank'. */
export const accountType = (sanitized: string | null): 'iban' | 'bank' | null =>
  !sanitized ? null : /^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(sanitized) ? 'iban' : 'bank'

/**
 * res.partner.bank - Odoo 12 base, plus `iban` and `show_in_report` from the
 * account_customization addon. Unique on (sanitized_acc_number, company_id):
 * "Account Number must be unique".
 */
@Table({
  tableName: 'res_partner_bank',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class PartnerBank extends Model<PartnerBank> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  @Column({ type: DataType.STRING, allowNull: false })
  acc_number: string

  /** Stored computed from acc_number. */
  @Column(DataType.STRING)
  sanitized_acc_number: string | null

  @Column(DataType.STRING)
  acc_holder_name: string | null

  @Column({ type: DataType.INTEGER, allowNull: false })
  partner_id: number

  @Column(DataType.INTEGER)
  bank_id: number | null

  @Column({ type: DataType.INTEGER, defaultValue: 10 })
  sequence: number | null

  @Column(DataType.INTEGER)
  currency_id: number | null

  @Column(DataType.INTEGER)
  company_id: number | null

  /** account_customization: show this account on printed documents. */
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  show_in_report: boolean | null

  @Column(DataType.STRING)
  iban: string | null

  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null

  @BelongsTo(() => Bank, { foreignKey: 'bank_id', as: 'bank', constraints: false })
  bank?: Bank
}
