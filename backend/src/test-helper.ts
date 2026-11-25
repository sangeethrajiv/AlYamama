import { sequelize } from './orm'
import { config } from './config'
import type { RequestEnv } from './middleware'

/**
 * Shared test setup. The suite runs against PGDATABASE_UNIT, which
 * run_all_tests.ts drops, recreates and migrates before mocha starts, so the
 * development data in accounting_26_test is never touched.
 */

if (!/_unit$/.test(config.db.database)) {
  throw new Error(
    `tests must run against the unit database (got "${config.db.database}"). Use: npm test`,
  )
}

export const env = (over: Partial<RequestEnv> = {}): RequestEnv => ({
  uid: 1,
  companyId: null,
  allowedCompanyIds: [],
  ...over,
})

/** Empties the Contacts tables between tests. */
export async function resetTables() {
  await sequelize.query(`TRUNCATE product_product, product_template, att_product_type, stock_picking_type, stock_warehouse,
    stock_location, product_category, uom_uom, uom_category, res_partner_res_partner_category_rel, res_partner_bank,
    res_company_users_rel, department_user_rel, hr_department, res_users, res_company, res_partner, res_partner_category,
    res_partner_industry, res_partner_title, res_bank, res_country_state, res_country,
    res_currency, account_account_type, account_analytic_group, account_analytic_tag, account_tax_group, ir_model_data RESTART IDENTITY CASCADE`)
}

export const closeDb = () => sequelize.close()
export { sequelize }
