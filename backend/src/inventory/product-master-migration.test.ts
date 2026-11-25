import { expect } from 'chai'
import type { Client } from 'pg'
import { config } from '../config'
import { makeClient, maintenanceClient } from '../db'
import { resetTables, sequelize } from '../test-helper'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { buildPath, byDepth, changedColumns, chunk, extName, migrateProductMaster, pickCost, sameValue, type Options } from '../../scripts/lib/product-master'

/**
 * The product master migration, run for real between two throwaway databases: an Odoo-shaped source built here and the
 * test database as the target. Nothing in it touches accounting_26_live or the Odoo copy.
 */

const SOURCE_DB = `${config.db.database}_src`
const DEFAULTS: Options = { execute: true, update: false, allowPartial: false, cost: true }

const SOURCE_DDL = `
  DROP TABLE IF EXISTS product_taxes_rel, ir_property, product_product, product_template, att_product_type, product_category, uom_uom, uom_category;
  CREATE TABLE uom_category (id int PRIMARY KEY, name varchar, measure_type varchar);
  CREATE TABLE uom_uom (id int PRIMARY KEY, name varchar, category_id int, factor numeric, rounding numeric, active boolean, uom_type varchar, measure_type varchar, view_name varchar);
  CREATE TABLE product_category (id int PRIMARY KEY, name varchar, complete_name varchar, parent_id int, parent_path varchar, arabic_name varchar, sequence_code varchar);
  CREATE TABLE att_product_type (id int PRIMARY KEY, name varchar, active boolean);
  CREATE TABLE product_template (id int PRIMARY KEY, name varchar, sequence int, description text, description_purchase text, description_sale text, description_picking text,
    description_pickingout text, description_pickingin text, type varchar, tracking varchar, rental boolean, categ_id int, uom_id int, uom_po_id int, company_id int,
    responsible_id int, product_type_id int, list_price numeric, volume numeric, weight numeric, sale_ok boolean, purchase_ok boolean, active boolean, color int,
    default_code varchar, sale_delay numeric, arabic_name varchar, internal_short_code varchar, no_discount boolean, is_teltonika_product boolean,
    is_vehicle_subscription boolean, purchase_request boolean, margin_perc numeric, internal_type varchar, create_date timestamp, write_date timestamp);
  CREATE TABLE product_product (id int PRIMARY KEY, product_tmpl_id int);
  CREATE TABLE ir_property (name varchar, res_id varchar, company_id int, value_float double precision);
  CREATE TABLE product_taxes_rel (prod_id int, tax_id int);

  INSERT INTO uom_category VALUES (10, 'Unit', 'unit'), (11, 'Weight', 'weight');
  INSERT INTO uom_uom VALUES (100, 'EA', 10, 1, 0.01, true, 'reference', 'unit', NULL), (101, 'Dozen', 10, 0.0833333333, 0.01, true, 'bigger', 'unit', NULL),
    (102, 'kg', 11, 1, 0.001, true, 'reference', 'weight', NULL);
  INSERT INTO product_category VALUES (50, 'All', 'All', NULL, '50/', NULL, NULL), (51, 'Pumps', 'All / Pumps', 50, '50/51/', 'مضخات', 'PMP'),
    (52, 'Gear', 'All / Pumps / Gear', 51, '50/51/52/', NULL, NULL);
  INSERT INTO att_product_type VALUES (7, 'Hardware Sales & Support', true);
  INSERT INTO product_template (id, name, type, tracking, categ_id, uom_id, uom_po_id, product_type_id, list_price, active, default_code, internal_type, sale_ok, purchase_ok, margin_perc)
    VALUES (900, 'Pump A', 'product', 'lot', 52, 100, 101, 7, 10.5, true, 'P1', 'material', true, true, 0),
           (901, 'Hose', 'consu', 'none', 51, 102, 102, NULL, 3, false, NULL, '', true, true, 0),
           (902, 'Pump A', 'product', 'lot', 52, 100, NULL, NULL, 11, true, 'P1', 'material', true, true, 0);
  INSERT INTO product_product VALUES (5000, 900), (5001, 901);
  INSERT INTO ir_property VALUES ('standard_price', 'product.product,5000', NULL, 4.25), ('standard_price', 'product.product,5001', 9, 1.5);
  INSERT INTO product_taxes_rel VALUES (900, 3000), (902, 3000);
`

describe('product master migration', () => {
  let source: Client
  let target: Client
  let taxId: number

  const run = (over: Partial<Options> = {}) => migrateProductMaster(source, target, { ...DEFAULTS, ...over })
  const n = async (table: string) => Number(((await sequelize.query(`SELECT count(*)::int AS n FROM ${table}`))[0] as Array<{ n: number }>)[0].n)
  const one = async (sql: string, replacements: Record<string, unknown> = {}) => ((await sequelize.query(sql, { replacements }))[0] as Array<Record<string, any>>)[0]

  before(async () => {
    const m = maintenanceClient()
    await m.connect()
    await m.query(`DROP DATABASE IF EXISTS "${SOURCE_DB}" WITH (FORCE)`)
    await m.query(`CREATE DATABASE "${SOURCE_DB}" ENCODING 'UTF8' TEMPLATE template0`)
    await m.end()
    source = makeClient({ ...config.db, database: SOURCE_DB })
    await source.connect()
    target = makeClient(config.db)
    await target.connect()
  })

  after(async () => {
    await source.end()
    await target.end()
    const m = maintenanceClient()
    await m.connect()
    await m.query(`DROP DATABASE IF EXISTS "${SOURCE_DB}" WITH (FORCE)`)
    await m.end()
  })

  beforeEach(async () => {
    await resetTables()
    await source.query(SOURCE_DDL)
    // a customer tax that exists in the target under a different id than in the source
    const partner = await Partner.create({ name: 'Co', is_company: true, type: 'contact' } as never)
    const company = await Company.create({ name: 'Co', partner_id: partner.id } as never)
    taxId = (await one("INSERT INTO account_tax (name, type_tax_use, amount_type, amount, company_id) VALUES ('VAT 15%', 'sale', 'percent', 15, :c) RETURNING id", { c: company.id })).id
    await sequelize.query("INSERT INTO ir_model_data (module, name, model, res_id) VALUES ('odoo12', 'account_tax_3000', 'account.tax', :t)", { replacements: { t: taxId } })
  })

  describe('helpers', () => {
    it('orders categories parents first, builds paths from target ids and chunks lists', () => {
      expect(byDepth([{ id: 3, parent_path: '1/2/3/' }, { id: 1, parent_path: '1/' }, { id: 2, parent_path: '1/2/' }]).map(r => r.id)).to.deep.equal([1, 2, 3])
      expect(buildPath(null, 7)).to.equal('7/')
      expect(buildPath('7/', 9)).to.equal('7/9/')
      expect(chunk([1, 2, 3, 4, 5], 2)).to.deep.equal([[1, 2], [3, 4], [5]])
      expect(extName('product.template', 12)).to.equal('product_template_12')
    })

    it('compares values the way the database does', () => {
      expect(sameValue('10.0000', 10)).to.equal(true)
      expect(sameValue('0.08333', '0.0833')).to.equal(false)
      expect(sameValue(null, '')).to.equal(false)
      expect(sameValue(true, true)).to.equal(true)
      expect(sameValue(new Date('2026-01-01T00:00:00Z'), '2026-01-01T00:00:00.000Z')).to.equal(true)
      expect(changedColumns(['a', 'b'], { a: 1, b: '2' }, { a: '1.0', b: 3 })).to.deep.equal(['b'])
    })

    it("picks a product's cost: own company first, then no company, then the lowest company", () => {
      const rows = [{ company_id: 9, value: 1 }, { company_id: null, value: 2 }, { company_id: 5, value: 3 }]
      expect(pickCost(rows, 5)).to.equal(3)
      expect(pickCost(rows, 7)).to.equal(3)
      expect(pickCost(rows.filter(r => r.company_id !== 5), 7)).to.equal(1)
      expect(pickCost([{ company_id: null, value: 2 }], 7)).to.equal(2)
      expect(pickCost([], 7)).to.equal(undefined)
    })
  })

  it('a dry run does the real work, verifies it and writes nothing', async () => {
    const r = await run({ execute: false })
    expect(r.committed).to.equal(false)
    expect(r.failures).to.deep.equal([])
    expect(r.checks.filter(c => !c.ok)).to.deep.equal([])
    expect(r.counts['product.template'].inserted).to.equal(3)
    for (const t of ['product_template', 'product_category', 'uom_uom', 'uom_category', 'att_product_type', 'product_taxes_rel']) expect(await n(t), t).to.equal(0)
    expect(await n('ir_model_data')).to.equal(1)
  })

  it('copies everything with new ids, keeps every relationship and never creates a variant', async () => {
    // rows already in the target push its ids away from the source ids
    await sequelize.query("INSERT INTO uom_category (id, name, measure_type) VALUES (900, 'Other', NULL)")
    await sequelize.query("INSERT INTO product_category (id, name, complete_name, parent_path) VALUES (900, 'Local', 'Local', '900/')")
    const r = await run()
    expect(r.committed).to.equal(true)
    expect(r.failures).to.deep.equal([])
    expect(r.counts).to.deep.include({ 'uom.category': { inserted: 2, updated: 0, skipped: 0, linked: 0, failed: 0 } })
    expect(r.counts['uom.uom'].inserted).to.equal(3)
    expect(r.counts['product.category'].inserted).to.equal(3)
    expect(r.counts['product.template'].inserted).to.equal(3)
    expect(r.counts['product.taxes'].inserted).to.equal(2)

    const ext = async (model: string, src: number) => (await one('SELECT res_id FROM ir_model_data WHERE module = \'odoo12\' AND name = :n', { n: extName(model, src) })).res_id as number
    const pumpA = await ext('product.template', 900)
    expect(pumpA).to.not.equal(900)
    const gear = await ext('product.category', 52), pumps = await ext('product.category', 51), all = await ext('product.category', 50)
    const ea = await ext('uom.uom', 100), dozen = await ext('uom.uom', 101)

    const p = await one('SELECT * FROM product_template WHERE id = :id', { id: pumpA })
    expect([p.name, p.categ_id, p.uom_id, p.uom_po_id, p.default_code, p.list_price, p.standard_price, p.type, p.tracking]).to.deep.equal(['Pump A', gear, ea, dozen, 'P1', '10.5000', '4.2500', 'product', 'lot'])
    expect(p.product_type_id).to.equal(await ext('att.product.type', 7))
    // a product without a purchase unit gets its sales unit; an empty internal type stays empty; archived stays archived
    const noPo = await one('SELECT * FROM product_template WHERE id = :id', { id: await ext('product.template', 902) })
    expect(noPo.uom_po_id).to.equal(ea)
    const hose = await one('SELECT * FROM product_template WHERE id = :id', { id: await ext('product.template', 901) })
    expect([hose.internal_type, hose.active, hose.standard_price]).to.deep.equal([null, false, '1.5000'])

    // category hierarchy and path built from the target ids
    const g = await one('SELECT * FROM product_category WHERE id = :id', { id: gear })
    expect([g.parent_id, g.parent_path, g.complete_name]).to.deep.equal([pumps, `${all}/${pumps}/${gear}/`, 'All / Pumps / Gear'])
    expect((await one('SELECT * FROM product_category WHERE id = :id', { id: pumps })).sequence_code).to.equal('PMP')
    // unit -> category and conversion factor
    const d = await one('SELECT * FROM uom_uom WHERE id = :id', { id: dozen })
    expect([d.category_id, d.factor, d.uom_type]).to.deep.equal([await ext('uom.category', 10), '0.0833333333', 'bigger'])
    // customer taxes: the source tax id is translated to the target tax
    expect((await sequelize.query('SELECT tax_id FROM product_taxes_rel WHERE prod_id = :id', { replacements: { id: pumpA } }))[0]).to.deep.equal([{ tax_id: taxId }])
    // variants are never created
    expect(await n('product_product')).to.equal(0)
    expect(r.checks.every(c => c.ok)).to.equal(true)
  })

  it('is idempotent: a second run finds everything and changes nothing', async () => {
    await run()
    const before = { products: await n('product_template'), links: await n('product_taxes_rel'), ext: await n('ir_model_data') }
    const r = await run()
    expect(r.committed).to.equal(true)
    expect(r.counts['product.template']).to.deep.equal({ inserted: 0, updated: 0, skipped: 3, linked: 0, failed: 0 })
    expect(r.counts['product.category'].inserted).to.equal(0)
    expect(r.counts['product.taxes'].inserted).to.equal(0)
    expect({ products: await n('product_template'), links: await n('product_taxes_rel'), ext: await n('ir_model_data') }).to.deep.equal(before)
  })

  it('matches rows that exist without an external id by business key instead of duplicating them', async () => {
    await sequelize.query("INSERT INTO uom_category (id, name, measure_type) VALUES (77, 'Weights', 'weight')")
    await sequelize.query("INSERT INTO product_category (id, name, complete_name, parent_path) VALUES (88, 'All', 'All', '88/')")
    await sequelize.query("INSERT INTO att_product_type (id, name) VALUES (66, 'hardware sales & support')")
    const r = await run()
    expect(r.counts['uom.category']).to.deep.include({ inserted: 1, linked: 1 })
    expect(r.counts['product.category']).to.deep.include({ inserted: 2, linked: 1 })
    expect(r.counts['att.product.type']).to.deep.include({ inserted: 0, linked: 1 })
    expect(await n('uom_category')).to.equal(2)
    expect(await n('product_category')).to.equal(3)
    // kg now points at the existing weight category, and "Pumps" at the existing "All"
    expect((await one("SELECT category_id FROM uom_uom WHERE name = 'kg'")).category_id).to.equal(77)
    expect((await one("SELECT parent_id FROM product_category WHERE name = 'Pumps'")).parent_id).to.equal(88)
    expect((await one("SELECT product_type_id FROM product_template WHERE default_code = 'P1' LIMIT 1")).product_type_id).to.equal(66)
  })

  it('leaves rows that are already there alone, and only changes them with --update', async () => {
    await run()
    await source.query("UPDATE product_template SET name = 'Pump A (renamed)', list_price = 12 WHERE id = 900")
    const skipped = await run()
    expect(skipped.counts['product.template']).to.deep.include({ updated: 0, skipped: 3 })
    expect(skipped.warnings.join(' ')).to.match(/1 row\(s\) already in the target differ/)
    expect((await one("SELECT count(*)::int AS n FROM product_template WHERE name = 'Pump A (renamed)'")).n).to.equal(0)

    const dry = await run({ update: true, execute: false })
    expect(dry.changes['product.template']).to.deep.equal({ name: 1, list_price: 1 })
    expect((await one("SELECT count(*)::int AS n FROM product_template WHERE name = 'Pump A (renamed)'")).n).to.equal(0)

    const updated = await run({ update: true })
    expect(updated.counts['product.template']).to.deep.include({ updated: 1, skipped: 2 })
    expect((await one("SELECT list_price FROM product_template WHERE name = 'Pump A (renamed)'")).list_price).to.equal('12.0000')
  })

  it('names the record that fails and rolls everything back, unless --allow-partial', async () => {
    await source.query("UPDATE product_template SET type = 'bogus' WHERE id = 901")
    const r = await run()
    expect(r.committed).to.equal(false)
    expect(r.failures).to.have.length(1)
    expect(r.failures[0]).to.include({ model: 'product.template', sourceId: 901 })
    expect(r.failures[0].reason).to.match(/product_template_type_check/)
    expect(await n('product_template')).to.equal(0)
    expect(await n('product_category')).to.equal(0)

    const partial = await run({ allowPartial: true })
    expect(partial.committed).to.equal(true)
    expect(partial.counts['product.template']).to.deep.include({ inserted: 2, failed: 1 })
    expect(await n('product_template')).to.equal(2)
    // the product that failed has no external id, so a later fixed run inserts it
    await source.query("UPDATE product_template SET type = 'consu' WHERE id = 901")
    const fixed = await run()
    expect(fixed.counts['product.template']).to.deep.include({ inserted: 1, skipped: 2, failed: 0 })
  })

  it('leaves an unknown company, user or tax empty and says so', async () => {
    await source.query('UPDATE product_template SET company_id = 99, responsible_id = 98 WHERE id = 900')
    await source.query('INSERT INTO product_taxes_rel VALUES (900, 3999)')
    const r = await run()
    expect(r.committed).to.equal(true)
    expect(r.warnings.join('\n')).to.match(/company has no counterpart/)
    expect(r.warnings.join('\n')).to.match(/responsible user has no counterpart/)
    expect(r.warnings.join('\n')).to.match(/1 tax link\(s\) skipped: tax 3999 is not in the target/)
    expect(r.counts['product.taxes'].inserted).to.equal(2)
  })

  it('can leave the cost alone', async () => {
    await run({ cost: false })
    expect((await one("SELECT standard_price FROM product_template WHERE default_code = 'P1' LIMIT 1")).standard_price).to.equal('0.0000')
  })
})
