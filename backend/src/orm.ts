import 'reflect-metadata'
import { Sequelize } from 'sequelize-typescript'
import { config, type PgConfig } from './config'

import { Currency } from './core/currency/currency.model'
import { Country } from './core/country/country.model'
import { CountryState } from './core/country/state.model'
import { Company } from './core/company/company.model'
import { User } from './core/user/user.model'
import { ExternalId } from './core/external-id/external-id.model'
import { PartnerTitle } from './contacts/title/title.model'
import { PartnerIndustry } from './contacts/industry/industry.model'
import { PartnerCategory, PartnerCategoryRel } from './contacts/category/category.model'
import { Bank } from './contacts/bank/bank.model'
import { PartnerBank } from './contacts/partner-bank/partner-bank.model'
import { Partner } from './contacts/partner/partner.model'
import { Uom, UomCategory } from './inventory/uom/uom.model'
import { ProductCategory } from './inventory/category/product-category.model'
import { ProductProduct, ProductTemplate } from './inventory/product/product.model'
import { Location, PickingType, Warehouse } from './inventory/warehouse/stock.model'

/**
 * Every model class in the application. Adding a module means adding its models
 * here; this is the registry the handover document calls for.
 */
export const MODELS = [
  Currency, Country, CountryState, Company, User, ExternalId,
  PartnerTitle, PartnerIndustry, PartnerCategory, PartnerCategoryRel,
  Bank, PartnerBank, Partner,
  UomCategory, Uom, ProductCategory, ProductTemplate, ProductProduct,
  Location, Warehouse, PickingType,
]

export function makeSequelize(db: PgConfig = config.db): Sequelize {
  return new Sequelize({
    dialect: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.database,
    models: MODELS,
    logging: false,
    // The schema is owned by migrations/. sync() is never called.
    pool: { max: config.poolMax, min: 2, acquire: 30000, idle: 10000 },
    define: { freezeTableName: true, underscored: false },
    dialectOptions: { application_name: 'alyamama-erp' },
  })
}

/** The process-wide connection. Tests build their own against the unit database. */
export const sequelize = makeSequelize()
