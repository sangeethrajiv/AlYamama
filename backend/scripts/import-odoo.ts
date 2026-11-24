/**
 * Copies the Contacts tables from the Odoo 12 database into this one.
 *
 *   npm run import:odoo                 everything
 *   npm run import:odoo -- --company 3  only partners of company 3 (plus shared ones)
 *   npm run import:odoo -- --no-images  skip the filestore images (much faster)
 *   npm run import:odoo -- --unit       load into the test database
 *   npm run import:odoo -- --truncate   empty the target tables first
 *
 * Properties of this importer:
 *   * The Odoo connection is READ ONLY (BEGIN READ ONLY), so the source cannot change.
 *   * Odoo ids are kept, and recorded in ir_model_data (module 'odoo12').
 *   * Re-running updates the same rows (ON CONFLICT (id) DO UPDATE); it never duplicates.
 *   * Partners load in two passes, because parent_id and commercial_partner_id
 *     point at rows that may not exist yet.
 *   * Images live in the Odoo filestore, not in the database: the bytes are read
 *     from ir_attachment.store_fname under the filestore directory.
 */
import * as fs from 'fs'
import * as path from 'path'
import type { Client } from 'pg'
import { config } from '../src/config'
import { makeClient, withOdooReadOnly } from '../src/db'
import { recordExternalIds, resetSequences, upsert, type Row } from './lib/import-helpers'


const argv = process.argv.slice(2)
const flag = (name: string) => argv.includes(`--${name}`)
const value = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

const COMPANY = value('company') ? Number(value('company')) : undefined
const WITH_IMAGES = !flag('no-images')
const TARGET_DB = flag('unit') ? config.unitDatabase : config.db.database

/** Where Odoo keeps the filestore: <data_dir>/filestore/<database>. */
const FILESTORE =
  value('filestore') ||
  path.join(process.env.ODOO_DATA_DIR || path.join(process.env.HOME || '', '.local/share/Odoo'), 'filestore', config.odoo.database)

const log = (...a: unknown[]) => console.log(...a)

// ----------------------------------------------------------------- tables ---

/**
 * Each entry: the target table, the columns to copy, and the SELECT that reads
 * them from Odoo. `select` may rename or cast where the two schemas differ.
 */
interface TableSpec {
  table: string
  model: string
  columns: string[]
  select: string
}

const SPECS: TableSpec[] = [
  {
    table: 'res_currency',
    model: 'res.currency',
    columns: ['id', 'name', 'symbol', 'active'],
    select: `SELECT id, name, symbol, active FROM res_currency`,
  },
  {
    table: 'res_country',
    model: 'res.country',
    columns: ['id', 'name', 'code', 'address_format', 'currency_id', 'phone_code', 'name_position', 'vat_label', 'local_name'],
    select: `SELECT id, name, code, address_format, currency_id, phone_code, name_position, vat_label, local_name FROM res_country`,
  },
  {
    table: 'res_country_state',
    model: 'res.country.state',
    columns: ['id', 'country_id', 'name', 'code'],
    select: `SELECT id, country_id, name, code FROM res_country_state`,
  },
  {
    table: 'res_partner_title',
    model: 'res.partner.title',
    columns: ['id', 'name', 'shortcut'],
    select: `SELECT id, name, shortcut FROM res_partner_title`,
  },
  {
    table: 'res_partner_industry',
    model: 'res.partner.industry',
    columns: ['id', 'name', 'full_name', 'active'],
    select: `SELECT id, name, full_name, active FROM res_partner_industry`,
  },
  {
    table: 'res_partner_category',
    model: 'res.partner.category',
    columns: ['id', 'name', 'color', 'parent_id', 'parent_path', 'active'],
    select: `SELECT id, name, color, parent_id, parent_path, active FROM res_partner_category ORDER BY coalesce(parent_path, '')`,
  },
  {
    table: 'res_bank',
    model: 'res.bank',
    columns: ['id', 'name', 'street', 'street2', 'zip', 'city', 'state', 'country', 'email', 'phone', 'active', 'bic'],
    select: `SELECT id, name, street, street2, zip, city, state, country, email, phone, active, bic FROM res_bank`,
  },
]

/** The partner columns copied straight across (same name in both schemas). */
const PARTNER_PLAIN = [
  'id', 'name', 'display_name', 'title', 'ref', 'lang', 'tz', 'vat', 'website', 'comment',
  'barcode', 'active', 'customer', 'supplier', 'employee', 'function', 'type',
  'street', 'street2', 'zip', 'city', 'state_id', 'country_id', 'email', 'phone', 'mobile',
  'is_company', 'industry_id', 'company_id', 'color', 'partner_share',
  'commercial_company_name', 'company_name', 'date',
  'arabic_name', 'arabic_street2_name', 'arabic_city_name', 'vat_arabic', 'customer_code',
  'vandor_number', 'cr_number', 'cash_customer', 'fax', 'company_name_code',
  'l10n_sa_edi_building_number', 'l10n_sa_edi_plot_identification',
  'l10n_sa_additional_identification_scheme', 'l10n_sa_additional_identification_number',
  'l10n_sa_registered_name',
  'create_uid', 'create_date', 'write_uid', 'write_date',
]

/** Columns written in the second pass, once every partner row exists. */
const PARTNER_LINKS = ['parent_id', 'commercial_partner_id', 'user_id']

/** Numeric in this schema, double precision in Odoo: cast explicitly. */
const PARTNER_NUMERIC = ['credit_limit', 'discount', 'customer_discount']

const SCHEMES = new Set(['TIN', 'CRN', 'MOM', 'MLS', '700', 'SAG', 'NAT', 'GCC', 'IQA', 'PAS', 'OTH'])
const TYPES = new Set(['contact', 'invoice', 'delivery', 'other', 'private', 'child_company', 'manager'])

async function importImages(odoo: Client, target: Client, partnerIds: Set<number>, companyIds: Set<number>) {
  if (!fs.existsSync(FILESTORE)) {
    log(`images: filestore not found at ${FILESTORE}; skipped`)
    return
  }
  // Odoo attachment field -> [target table, target column, ids that exist in the target]
  const targets: Record<string, [string, string, Set<number>]> = {
    'res.partner:image': ['res_partner', 'image', partnerIds],
    'res.partner:image_sign': ['res_partner', 'image_sign', partnerIds],
    'res.partner:image_seal': ['res_partner', 'image_seal', partnerIds],
    'res.company:company_header_boxed': ['res_company', 'company_header_boxed', companyIds],
    'res.company:company_footer_boxed': ['res_company', 'company_footer_boxed', companyIds],
  }
  const { rows } = await odoo.query<{ res_model: string; res_id: number; res_field: string; store_fname: string | null; db_datas: Buffer | null }>(
    `SELECT res_model, res_id, res_field, store_fname, db_datas FROM ir_attachment
      WHERE (res_model = 'res.partner' AND res_field IN ('image', 'image_sign', 'image_seal'))
         OR (res_model = 'res.company' AND res_field IN ('company_header_boxed', 'company_footer_boxed'))`,
  )
  let written = 0
  let missing = 0
  for (const r of rows) {
    const t = targets[`${r.res_model}:${r.res_field}`]
    if (!t || !t[2].has(r.res_id)) continue
    let bytes: Buffer | null = r.db_datas ? Buffer.from(r.db_datas.toString(), 'base64') : null
    if (!bytes && r.store_fname) {
      const file = path.join(FILESTORE, r.store_fname)
      if (fs.existsSync(file)) bytes = fs.readFileSync(file)
      else { missing++; continue }
    }
    if (!bytes) continue
    await target.query(`UPDATE ${t[0]} SET ${t[1]} = $1 WHERE id = $2`, [bytes, r.res_id])
    written++
  }
  log(`images: ${written} written${missing ? `, ${missing} file(s) missing from the filestore` : ''}`)
}

// ------------------------------------------------------------------- main ---

async function run() {
  if (!config.odoo.database) throw new Error('ODOO_PGDATABASE is not set in backend/.env')
  log(`source: ${config.odoo.database} (read-only)  ->  target: ${TARGET_DB}`)

  const target = makeClient({ ...config.db, database: TARGET_DB })
  await target.connect()
  const counts: Array<[string, number, number]> = []

  try {
    await target.query('BEGIN')
    // Deferred FKs let the three interlinked tables load inside one transaction.
    await target.query('SET CONSTRAINTS ALL DEFERRED')

    if (flag('truncate')) {
      await target.query(`TRUNCATE res_partner_res_partner_category_rel, res_partner_bank, res_company_users_rel,
        department_user_rel, hr_department, res_users, res_company, res_partner, res_partner_category, res_partner_industry, res_partner_title,
        res_bank, res_country_state, res_country, res_currency, ir_model_data RESTART IDENTITY CASCADE`)
      log('target tables truncated')
    }

    await withOdooReadOnly(async odoo => {
      // ---------------------------------------------------------- lookups ---
      for (const spec of SPECS) {
        const { rows } = await odoo.query<Row>(spec.select)
        const n = await upsert(target, spec.table, spec.columns, rows)
        await recordExternalIds(target, spec.model, rows.map(r => Number(r.id)))
        counts.push([spec.table, rows.length, n])
      }

      // ------------------------------------------- partners, first pass ---
      const where: string[] = []
      if (COMPANY !== undefined) where.push(`(company_id = ${COMPANY} OR company_id IS NULL)`)
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const partnerSelect = `SELECT ${PARTNER_PLAIN.join(', ')},
          ${PARTNER_NUMERIC.map(c => `${c}::numeric AS ${c}`).join(', ')},
          parent_id, commercial_partner_id, user_id
        FROM res_partner ${whereSql} ORDER BY id`
      const { rows: partners } = await odoo.query<Row>(partnerSelect)

      // Values Odoo allows but our CHECK constraints do not: report, do not crash.
      const badTypes = new Set<string>()
      const badSchemes = new Set<string>()
      for (const p of partners) {
        if (p.type && !TYPES.has(String(p.type))) { badTypes.add(String(p.type)); p.type = 'contact' }
        if (p.l10n_sa_additional_identification_scheme && !SCHEMES.has(String(p.l10n_sa_additional_identification_scheme))) {
          badSchemes.add(String(p.l10n_sa_additional_identification_scheme))
          p.l10n_sa_additional_identification_scheme = null
        }
        // The CHECK needs a name for type='contact'; Odoo's own data satisfies it,
        // but guard anyway so one bad row does not stop the run.
        if (p.type === 'contact' && (p.name === null || p.name === undefined || p.name === '')) p.name = `[no name ${p.id}]`
      }
      if (badTypes.size) log(`note: unexpected type value(s) mapped to 'contact': ${[...badTypes].join(', ')}`)
      if (badSchemes.size) log(`note: unknown ZATCA scheme(s) set to NULL: ${[...badSchemes].join(', ')}`)

      const firstPassCols = [...PARTNER_PLAIN, ...PARTNER_NUMERIC]
      const n1 = await upsert(target, 'res_partner', firstPassCols, partners)
      counts.push(['res_partner', partners.length, n1])
      await recordExternalIds(target, 'res.partner', partners.map(r => Number(r.id)))

      // ----------------------------------------------- companies, users ---
      const partnerIds = new Set(partners.map(p => Number(p.id)))

      const { rows: companies } = await odoo.query<Row>(
        `SELECT id, name, parent_id, partner_id, currency_id, sequence, email, phone,
                company_registry, default_user_tz, l10n_sa_registered_name,
                bank_details_sale_quote, cash_invoice, credit_invoice, division, company_representation, company_seal,
                due_from_account_id, due_to_account_id, due_fromto_payment_journal_id,
                social_twitter, social_facebook, social_github, social_linkedin, social_youtube, social_googleplus, social_instagram
           FROM res_company ${COMPANY !== undefined ? `WHERE id = ${COMPANY}` : ''} ORDER BY id`,
      )
      const companyCols = ['id', 'name', 'parent_id', 'partner_id', 'currency_id', 'sequence', 'email', 'phone', 'company_registry', 'default_user_tz', 'l10n_sa_registered_name',
        'bank_details_sale_quote', 'cash_invoice', 'credit_invoice', 'division', 'company_representation', 'company_seal',
        'due_from_account_id', 'due_to_account_id', 'due_fromto_payment_journal_id',
        'social_twitter', 'social_facebook', 'social_github', 'social_linkedin', 'social_youtube', 'social_googleplus', 'social_instagram']
      // A company's partner must exist; skip the company if its partner was filtered out.
      const usableCompanies = companies.filter(c => partnerIds.has(Number(c.partner_id)))
      const nC = await upsert(target, 'res_company', companyCols, usableCompanies)
      await recordExternalIds(target, 'res.company', usableCompanies.map(r => Number(r.id)))
      counts.push(['res_company', companies.length, nC])

      const companyIds = new Set(usableCompanies.map(c => Number(c.id)))
      const { rows: users } = await odoo.query<Row>(
        `SELECT id, login, partner_id, company_id, active, share, notification_type FROM res_users ORDER BY id`,
      )
      const usableUsers = users.filter(u => partnerIds.has(Number(u.partner_id)) && companyIds.has(Number(u.company_id)))
      const nU = await upsert(target, 'res_users', ['id', 'login', 'partner_id', 'company_id', 'active', 'share', 'notification_type'], usableUsers)
      await recordExternalIds(target, 'res.users', usableUsers.map(r => Number(r.id)))
      counts.push(['res_users', users.length, nU])

      // Allowed companies: every row of Odoo's res_company_users_rel (a user can have several), plus the user's own
      // company, which Odoo always keeps in the list.
      const userIds = new Set(usableUsers.map(u => Number(u.id)))
      const { rows: companyRels } = await odoo.query<Row>(`SELECT cid, user_id FROM res_company_users_rel`)
      const usableCompanyRels = [
        ...companyRels.filter(r => companyIds.has(Number(r.cid)) && userIds.has(Number(r.user_id))),
        ...usableUsers.map(u => ({ cid: u.company_id, user_id: u.id })),
      ]
      await upsert(target, 'res_company_users_rel', ['cid', 'user_id'], usableCompanyRels, 500, ['cid', 'user_id'])
      counts.push(['res_company_users_rel', companyRels.length, usableCompanyRels.length])

      // -------------------------------------------- departments (no hr.employee data) ---
      const { rows: departments } = await odoo.query<Row>(
        `SELECT id, name, complete_name, active, company_id, parent_id FROM hr_department ORDER BY id`,
      )
      for (const d of departments) if (!companyIds.has(Number(d.company_id))) d.company_id = null
      const nD = await upsert(target, 'hr_department', ['id', 'name', 'complete_name', 'active', 'company_id', 'parent_id'], departments)
      await recordExternalIds(target, 'hr.department', departments.map(r => Number(r.id)))
      counts.push(['hr_department', departments.length, nD])

      const departmentIds = new Set(departments.map(d => Number(d.id)))
      const { rows: deptRels } = await odoo.query<Row>(`SELECT user_id, dept_id FROM department_user_rel`)
      const usableDeptRels = deptRels.filter(r => userIds.has(Number(r.user_id)) && departmentIds.has(Number(r.dept_id)))
      await upsert(target, 'department_user_rel', ['user_id', 'dept_id'], usableDeptRels, 500, ['user_id', 'dept_id'])
      counts.push(['department_user_rel', deptRels.length, usableDeptRels.length])

      // ----------------------------------------- partners, second pass ---
      // parent_id / commercial_partner_id / user_id now have something to point at.
      let linked = 0
      for (const p of partners) {
        const parent = partnerIds.has(Number(p.parent_id)) ? p.parent_id : null
        const commercial = partnerIds.has(Number(p.commercial_partner_id)) ? p.commercial_partner_id : null
        const user = userIds.has(Number(p.user_id)) ? p.user_id : null
        if (parent === null && commercial === null && user === null) continue
        await target.query(
          `UPDATE res_partner SET parent_id = $1, commercial_partner_id = $2, user_id = $3 WHERE id = $4`,
          [parent, commercial, user, p.id],
        )
        linked++
      }
      log(`links: parent_id / commercial_partner_id / user_id set on ${linked} partner(s)`)

      // -------------------------------------------------- partner banks ---
      const { rows: pbanks } = await odoo.query<Row>(
        `SELECT id, acc_number, sanitized_acc_number, acc_holder_name, partner_id, bank_id,
                sequence, currency_id, company_id, show_in_report, iban
           FROM res_partner_bank ORDER BY id`,
      )
      const usableBanks = pbanks.filter(b => partnerIds.has(Number(b.partner_id)))
      for (const b of usableBanks) if (!companyIds.has(Number(b.company_id))) b.company_id = null
      const nB = await upsert(target, 'res_partner_bank',
        ['id', 'acc_number', 'sanitized_acc_number', 'acc_holder_name', 'partner_id', 'bank_id', 'sequence', 'currency_id', 'company_id', 'show_in_report', 'iban'],
        usableBanks)
      await recordExternalIds(target, 'res.partner.bank', usableBanks.map(r => Number(r.id)))
      counts.push(['res_partner_bank', pbanks.length, nB])

      // ------------------------------------------------------- tag links ---
      const { rows: tagRels } = await odoo.query<Row>(
        `SELECT partner_id, category_id FROM res_partner_res_partner_category_rel`,
      )
      const usableRels = tagRels.filter(r => partnerIds.has(Number(r.partner_id)))
      if (usableRels.length) {
        const params: unknown[] = []
        const tuples = usableRels.map(r => {
          params.push(r.partner_id, r.category_id)
          return `($${params.length - 1},$${params.length})`
        })
        await target.query(
          `INSERT INTO res_partner_res_partner_category_rel (partner_id, category_id)
           VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`,
          params,
        )
      }
      counts.push(['res_partner_..._category_rel', tagRels.length, usableRels.length])

      if (WITH_IMAGES) await importImages(odoo, target, partnerIds, companyIds)
      else log('images: skipped (--no-images)')
    })

    await resetSequences(target, [
      'res_currency', 'res_country', 'res_country_state', 'res_partner_title', 'res_partner_industry',
      'res_partner_category', 'res_bank', 'res_partner', 'res_company', 'res_users', 'res_partner_bank', 'hr_department', 'ir_model_data',
    ])

    await target.query('COMMIT')

    // -------------------------------------------------------- the report ---
    log('\n table                            source   loaded   now in target')
    log(' ------------------------------------------------------------------')
    for (const [table, src, loaded] of counts) {
      const real = table.includes('...') ? 'res_partner_res_partner_category_rel' : table
      const { rows } = await target.query<{ n: string }>(`SELECT count(*)::text AS n FROM ${real}`)
      log(` ${table.padEnd(32)} ${String(src).padStart(6)} ${String(loaded).padStart(8)} ${rows[0].n.padStart(15)}`)
    }
    const { rows: act } = await target.query<{ n: string }>(`SELECT count(*)::text AS n FROM res_partner WHERE active`)
    log(`\n active partners in target: ${act[0].n}`)
  } catch (e) {
    await target.query('ROLLBACK').catch(() => undefined)
    throw e
  } finally {
    await target.end()
  }
}

run().catch(e => {
  console.error(`import failed: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
