import { BelongsTo, BelongsToMany, Column, DataType, HasMany, Model, Table } from 'sequelize-typescript'
import { Country } from '../../core/country/country.model'
import { CountryState } from '../../core/country/state.model'
import { Company } from '../../core/company/company.model'
import { User } from '../../core/user/user.model'
import { PartnerTitle } from '../title/title.model'
import { PartnerIndustry } from '../industry/industry.model'
import { PartnerCategory, PartnerCategoryRel } from '../category/category.model'
import { PartnerBank } from '../partner-bank/partner-bank.model'

/** Odoo 12 `type` selection, including the two values added by the custom addons. */
export const PARTNER_TYPES = ['contact', 'invoice', 'delivery', 'other', 'private', 'child_company', 'manager'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]

/** Labels used when an address child has no name of its own (Odoo `_get_name`). */
export const PARTNER_TYPE_LABELS: Record<string, string> = {
  contact: 'Contact',
  invoice: 'Invoice address',
  delivery: 'Shipping address',
  other: 'Other address',
  private: 'Private Address',
  child_company: 'Child Company',
  manager: 'Manager',
}

/** ZATCA buyer identification schemes (l10n_sa_edi). */
export const ID_SCHEMES = ['TIN', 'CRN', 'MOM', 'MLS', '700', 'SAG', 'NAT', 'GCC', 'IQA', 'PAS', 'OTH'] as const

/** Synced from the commercial entity down to its non-company children (Odoo `_commercial_fields`). */
export const COMMERCIAL_FIELDS = ['vat', 'credit_limit'] as const

/** Synced from a parent to its `type='contact'` children (Odoo `ADDRESS_FIELDS`). */
export const ADDRESS_FIELDS = ['street', 'street2', 'zip', 'city', 'state_id', 'country_id'] as const

/**
 * res.partner - the Contacts master. One table holds companies, people and
 * addresses; `is_company` and `type` tell them apart and `parent_id` builds the
 * hierarchy, exactly as in Odoo 12.
 *
 * Column names are the Odoo 12 ones, including the Yamama custom fields and the
 * misspelled `vandor_number`. `display_name`, `commercial_partner_id` and
 * `commercial_company_name` are stored computed values maintained by
 * partner.service.ts, not by the database.
 */
@Table({
  tableName: 'res_partner',
  timestamps: true,
  createdAt: 'create_date',
  updatedAt: 'write_date',
})
export class Partner extends Model<Partner> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number

  // ------------------------------------------------------------- identity ---
  /** Required for `type='contact'` (SQL CHECK res_partner_check_name). */
  @Column(DataType.STRING)
  name: string | null

  /** Stored computed: "Parent, Child" for a person, plain name for a company. */
  @Column(DataType.STRING)
  display_name: string | null

  /** res.partner.title (Odoo column name is `title`, not title_id). */
  @Column(DataType.INTEGER)
  title: number | null

  /** Job position. `function` is a reserved word in some tools but is the Odoo name. */
  @Column({ type: DataType.STRING, field: 'function' })
  function: string | null

  /** Internal reference. */
  @Column(DataType.STRING)
  ref: string | null

  @Column(DataType.STRING)
  barcode: string | null

  @Column(DataType.DATEONLY)
  date: string | null

  /** Internal notes. */
  @Column(DataType.TEXT)
  comment: string | null

  // ------------------------------------------------------- classification ---
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  is_company: boolean

  @Column({ type: DataType.STRING, defaultValue: 'contact' })
  type: PartnerType

  @Column(DataType.INTEGER)
  industry_id: number | null

  // ------------------------------------------------------------ hierarchy ---
  @Column(DataType.INTEGER)
  parent_id: number | null

  /** Stored computed: the top company of the hierarchy, or the record itself. */
  @Column(DataType.INTEGER)
  commercial_partner_id: number | null

  /** Stored computed from the commercial partner's name. */
  @Column(DataType.STRING)
  commercial_company_name: string | null

  /** Free-text company name, used when there is no parent record. */
  @Column(DataType.STRING)
  company_name: string | null

  // --------------------------------------------------------- contact info ---
  @Column(DataType.STRING)
  email: string | null

  @Column(DataType.STRING)
  phone: string | null

  @Column(DataType.STRING)
  mobile: string | null

  @Column(DataType.STRING)
  website: string | null

  // -------------------------------------------------------------- address ---
  @Column(DataType.STRING)
  street: string | null

  @Column(DataType.STRING)
  street2: string | null

  @Column(DataType.STRING)
  zip: string | null

  @Column(DataType.STRING)
  city: string | null

  @Column(DataType.INTEGER)
  state_id: number | null

  @Column(DataType.INTEGER)
  country_id: number | null

  // ---------------------------------------------------------- preferences ---
  @Column(DataType.STRING)
  lang: string | null

  @Column(DataType.STRING)
  tz: string | null

  // ------------------------------------------------------- responsibility ---
  /** Salesperson. */
  @Column(DataType.INTEGER)
  user_id: number | null

  /** Owning company; NULL means the record is shared by all companies. */
  @Column(DataType.INTEGER)
  company_id: number | null

  // ---------------------------------------------------------------- flags ---
  /** Nullable: partner 1 in the live data has NULL in the three flags. */
  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  customer: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  supplier: boolean | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  employee: boolean | null

  @Column(DataType.STRING)
  vat: string | null

  /** numeric in this schema; Odoo 12 used double precision. */
  @Column(DataType.DECIMAL(16, 2))
  credit_limit: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: true })
  active: boolean

  /** Stored computed: true when a linked user is a portal/public user. */
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  partner_share: boolean

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  color: number | null

  // --------------------------------------------------------------- images ---
  /** bytea here; Odoo keeps the bytes in ir_attachment + filestore. */
  @Column(DataType.BLOB)
  image: Buffer | null

  @Column(DataType.BLOB)
  image_sign: Buffer | null

  @Column(DataType.BLOB)
  image_seal: Buffer | null

  // ------------------------------------------------- Yamama custom fields ---
  @Column(DataType.STRING)
  arabic_name: string | null

  @Column(DataType.STRING)
  arabic_street2_name: string | null

  @Column(DataType.STRING)
  arabic_city_name: string | null

  @Column(DataType.STRING)
  vat_arabic: string | null

  @Column(DataType.STRING)
  customer_code: string | null

  /** Vendor number. The misspelling is Odoo's (sale_custom). */
  @Column(DataType.STRING)
  vandor_number: string | null

  /** Commercial registration number. */
  @Column(DataType.STRING)
  cr_number: string | null

  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  cash_customer: boolean | null

  @Column(DataType.STRING)
  fax: string | null

  @Column(DataType.DECIMAL(6, 3))
  discount: string | null

  @Column(DataType.DECIMAL(6, 3))
  customer_discount: string | null

  /** Unique (delivery_order_custom): "Company Code already exists!" */
  @Column(DataType.STRING)
  company_name_code: string | null

  // ---------------------------------------------------- ZATCA (l10n_sa_edi) ---
  @Column(DataType.STRING)
  l10n_sa_edi_building_number: string | null

  @Column(DataType.STRING)
  l10n_sa_edi_plot_identification: string | null

  @Column(DataType.STRING)
  l10n_sa_additional_identification_scheme: string | null

  @Column(DataType.STRING)
  l10n_sa_additional_identification_number: string | null

  @Column(DataType.STRING)
  l10n_sa_registered_name: string | null

  // ---------------------------------------------------------------- audit ---
  @Column(DataType.INTEGER)
  create_uid: number | null

  @Column(DataType.INTEGER)
  write_uid: number | null

  @Column(DataType.DATE)
  create_date: Date

  @Column(DataType.DATE)
  write_date: Date

  // ------------------------------------------------------------ relations ---
  @BelongsTo(() => Partner, { foreignKey: 'parent_id', as: 'parent', constraints: false })
  parent?: Partner

  @HasMany(() => Partner, { foreignKey: 'parent_id', as: 'children', constraints: false })
  children?: Partner[]

  @BelongsTo(() => PartnerTitle, { foreignKey: 'title', as: 'titleRec', constraints: false })
  titleRec?: PartnerTitle

  @BelongsTo(() => PartnerIndustry, { foreignKey: 'industry_id', as: 'industry', constraints: false })
  industry?: PartnerIndustry

  @BelongsTo(() => Country, { foreignKey: 'country_id', as: 'country', constraints: false })
  country?: Country

  @BelongsTo(() => CountryState, { foreignKey: 'state_id', as: 'state', constraints: false })
  state?: CountryState

  @BelongsTo(() => Company, { foreignKey: 'company_id', as: 'company', constraints: false })
  company?: Company

  @BelongsTo(() => User, { foreignKey: 'user_id', as: 'salesperson', constraints: false })
  salesperson?: User

  @BelongsToMany(() => PartnerCategory, () => PartnerCategoryRel, 'partner_id', 'category_id')
  categories?: PartnerCategory[]

  @HasMany(() => PartnerBank, { foreignKey: 'partner_id', as: 'banks', constraints: false })
  banks?: PartnerBank[]
}
