import { expect } from 'chai'
import { env, resetTables, sequelize } from '../test-helper'
import { CONSTRAINT_MESSAGES } from '../middleware'
import { Uom, UomCategory } from './uom/uom.model'
import { ProductCategory } from './category/product-category.model'
import { ProductProduct, ProductTemplate } from './product/product.model'
import { Location, Warehouse } from './warehouse/stock.model'
import { Company } from '../core/company/company.model'
import { Partner } from '../contacts/partner/partner.model'
import { convertQty, createUom, createUomCategory, deleteUom, factorInv, roundToRounding, updateUom } from './uom/uom.service'
import { createCategory, deleteCategory, updateCategory, categoryAndDescendantIds } from './category/product-category.service'
import { archiveProduct, createProduct, deleteProduct, updateProduct } from './product/product.service'
import { createLocation, deleteLocation, updateLocation } from './warehouse/location.service'
import { updateWarehouse } from './warehouse/warehouse.service'
import { buildWhere, filterCounts, readGroup } from './product/product.search'

/** One test per Odoo 12 behaviour in docs/CLAUDE_main.md section 6 for uom, product and stock. */

const constraintOf = (e: unknown) => (e as { parent?: { constraint?: string } }).parent?.constraint
const rejects = async (fn: () => Promise<unknown>) => {
  try { await fn() } catch (e) { return e as Error }
  expect.fail('expected the call to be rejected')
}

describe('inventory', () => {
  beforeEach(resetTables)

  /** A unit category with its reference unit, the minimum a product needs. */
  async function unitCategory(name = 'Unit', measure: string | null = 'unit') {
    const cat = await createUomCategory({ name, measure_type: measure }, env())
    const ref = await createUom({ name: `${name} ref`, category_id: cat.id, uom_type: 'reference' }, env())
    return { cat, ref }
  }

  // ---------------------------------------------------------------- uom ---
  describe('uom', () => {
    it('allows only one category per measurement type', async () => {
      await createUomCategory({ name: 'Unit', measure_type: 'unit' }, env())
      const e = await rejects(() => createUomCategory({ name: 'Another unit', measure_type: 'unit' }, env()))
      expect(constraintOf(e)).to.equal('uom_category_uom_category_unique_type')
      expect(CONSTRAINT_MESSAGES[constraintOf(e)!]).to.equal('You can have only one category per measurement type.')
    })

    it('forces the reference unit factor to 1', async () => {
      const cat = await createUomCategory({ name: 'Weight', measure_type: 'weight' }, env())
      const kg = await createUom({ name: 'kg', category_id: cat.id, uom_type: 'reference', factor: '7' }, env())
      expect(kg.factor).to.equal('1')
    })

    it('rejects a factor of 0 and a rounding of 0 or less', async () => {
      const { cat } = await unitCategory()
      const a = await rejects(() => createUom({ name: 'zero', category_id: cat.id, uom_type: 'bigger', factor: '0' }, env()))
      expect(a.message).to.equal('The conversion ratio for a unit of measure cannot be 0!')
      const b = await rejects(() => createUom({ name: 'round', category_id: cat.id, uom_type: 'bigger', factor: '2', rounding: '0' }, env()))
      expect(b.message).to.equal('The rounding precision must be strictly positive.')
    })

    it('keeps exactly one active reference unit per category', async () => {
      const { cat } = await unitCategory()
      const e = await rejects(() => createUom({ name: 'second ref', category_id: cat.id, uom_type: 'reference' }, env()))
      expect(e.message).to.match(/should only have one reference unit of measure/)
    })

    it('needs a reference unit before any other unit in a new category', async () => {
      const cat = await createUomCategory({ name: 'Length', measure_type: 'length' }, env())
      const e = await rejects(() => createUom({ name: 'cm', category_id: cat.id, uom_type: 'smaller', factor: '100' }, env()))
      expect(e.message).to.match(/should have a reference unit of measure/)
    })

    it('stores factor as 1 / factor_inv for a bigger unit', async () => {
      const { cat } = await unitCategory()
      const dozen = await createUom({ name: 'Dozen', category_id: cat.id, uom_type: 'bigger', factor_inv: '12' }, env())
      expect(factorInv(dozen.factor)).to.equal('12')
      // 1/12 is not representable in a float: the stored value is exact to 40 digits
      expect(dozen.factor.startsWith('0.0833333333333333333')).to.equal(true)
    })

    it('copies measure_type from the category', async () => {
      const { cat, ref } = await unitCategory('Weight', 'weight')
      expect(ref.measure_type).to.equal('weight')
      await sequelize.query(`UPDATE uom_category SET measure_type = NULL WHERE id = ${cat.id}`)
    })

    it('refuses to delete a unit that a product uses', async () => {
      const { ref } = await unitCategory()
      const categ = await createCategory({ name: 'All' }, env())
      await createProduct({ name: 'Bolt', categ_id: categ.id, uom_id: ref.id }, env())
      const e = await rejects(() => deleteUom(ref.id))
      expect(e.message).to.match(/used by 1 product/)
    })

    it('refuses to delete a unit of the time category', async () => {
      const { ref } = await unitCategory('Working Time', 'time')
      const e = await rejects(() => deleteUom(ref.id))
      expect(e.message).to.match(/should rather archive it/)
    })

    it('archives a unit through active', async () => {
      const { cat } = await unitCategory()
      const box = await createUom({ name: 'Box', category_id: cat.id, uom_type: 'bigger', factor: '0.5' }, env())
      await updateUom(box.id, { active: false }, env())
      expect((await Uom.findByPk(box.id))!.active).to.equal(false)
    })

    it('converts between units of one category without float error', async () => {
      const { cat, ref } = await unitCategory()
      const dozen = await createUom({ name: 'Dozen', category_id: cat.id, uom_type: 'bigger', factor_inv: '12' }, env())
      // 3 dozen -> units: 3 / (1/12) * 1 = 36 exactly
      expect(roundToRounding(convertQty('3', dozen, ref), ref.rounding)).to.equal('36')
      // and back
      expect(roundToRounding(convertQty('36', ref, dozen), '0.01')).to.equal('3')
    })

    it('refuses to convert between categories', async () => {
      const a = await unitCategory('Unit', 'unit')
      const b = await unitCategory('Weight', 'weight')
      expect(() => convertQty('1', a.ref, b.ref)).to.throw(/different Category/)
    })
  })

  // --------------------------------------------------------- categories ---
  describe('product categories', () => {
    it('builds complete_name as "Parent / Child" and parent_path', async () => {
      const all = await createCategory({ name: 'All' }, env())
      const sale = await createCategory({ name: 'Saleable', parent_id: all.id }, env())
      const tools = await createCategory({ name: 'Tools', parent_id: sale.id }, env())
      expect(all.complete_name).to.equal('All')
      expect(sale.complete_name).to.equal('All / Saleable')
      expect(tools.complete_name).to.equal('All / Saleable / Tools')
      expect(tools.parent_path).to.equal(`${all.id}/${sale.id}/${tools.id}/`)
    })

    it('recomputes the subtree when a category is renamed or moved', async () => {
      const a = await createCategory({ name: 'A' }, env())
      const b = await createCategory({ name: 'B', parent_id: a.id }, env())
      const c = await createCategory({ name: 'C', parent_id: b.id }, env())
      const other = await createCategory({ name: 'Other' }, env())
      await updateCategory(a.id, { name: 'A2' }, env())
      expect((await ProductCategory.findByPk(c.id))!.complete_name).to.equal('A2 / B / C')
      await updateCategory(b.id, { parent_id: other.id }, env())
      const moved = await ProductCategory.findByPk(c.id)
      expect(moved!.complete_name).to.equal('Other / B / C')
      expect(moved!.parent_path).to.equal(`${other.id}/${b.id}/${c.id}/`)
    })

    it('forbids recursive categories', async () => {
      const a = await createCategory({ name: 'A' }, env())
      const b = await createCategory({ name: 'B', parent_id: a.id }, env())
      const e = await rejects(() => updateCategory(a.id, { parent_id: b.id }, env()))
      expect(e.message).to.equal('You cannot create recursive categories.')
    })

    it('finds a category and its descendants (child_of)', async () => {
      const a = await createCategory({ name: 'A' }, env())
      const b = await createCategory({ name: 'B', parent_id: a.id }, env())
      const c = await createCategory({ name: 'C', parent_id: b.id }, env())
      const x = await createCategory({ name: 'X' }, env())
      const ids = await categoryAndDescendantIds(a.id)
      expect(ids.sort()).to.deep.equal([a.id, b.id, c.id].sort())
      expect(ids).to.not.include(x.id)
    })

    it('refuses to delete a category with sub-categories or products', async () => {
      const { ref } = await unitCategory()
      const a = await createCategory({ name: 'A' }, env())
      const b = await createCategory({ name: 'B', parent_id: a.id }, env())
      expect((await rejects(() => deleteCategory(a.id))).message).to.match(/sub-categor/)
      await createProduct({ name: 'P', categ_id: b.id, uom_id: ref.id }, env())
      expect((await rejects(() => deleteCategory(b.id))).message).to.match(/used by 1 product/)
    })
  })

  // ------------------------------------------------------------ products ---
  describe('products', () => {
    let categId: number
    let ea: Uom
    let dozen: Uom
    let kg: Uom

    beforeEach(async () => {
      categId = (await createCategory({ name: 'All' }, env())).id
      const unit = await unitCategory('Unit', 'unit')
      ea = unit.ref
      dozen = await createUom({ name: 'Dozen', category_id: unit.cat.id, uom_type: 'bigger', factor_inv: '12' }, env())
      kg = (await unitCategory('Weight', 'weight')).ref
    })

    it('creates one variant with the template, and syncs reference, weight and barcode', async () => {
      const t = await createProduct({ name: 'Pump', categ_id: categId, uom_id: ea.id, default_code: 'P-1', barcode: '6281000010011', weight: '2.5', type: 'product' }, env())
      const variants = await ProductProduct.findAll({ where: { product_tmpl_id: t.id } })
      expect(variants).to.have.length(1)
      expect(variants[0].default_code).to.equal('P-1')
      expect(variants[0].barcode).to.equal('6281000010011')
      expect(variants[0].weight).to.equal('2.5000')
      expect(t.type).to.equal('product')
    })

    it('defaults the purchase unit to the sales unit', async () => {
      const t = await createProduct({ name: 'Pump', categ_id: categId, uom_id: ea.id }, env())
      expect(t.uom_po_id).to.equal(ea.id)
    })

    it('rejects sales and purchase units from different categories (_check_uom)', async () => {
      const e = await rejects(() => createProduct({ name: 'Pump', categ_id: categId, uom_id: ea.id, uom_po_id: kg.id }, env()))
      expect(e.message).to.equal('The default Unit of Measure and the purchase Unit of Measure must be in the same category.')
      const ok = await createProduct({ name: 'Eggs', categ_id: categId, uom_id: ea.id, uom_po_id: dozen.id }, env())
      expect(ok.uom_po_id).to.equal(dozen.id)
    })

    it('checks the units again when only one is changed', async () => {
      const t = await createProduct({ name: 'Pump', categ_id: categId, uom_id: ea.id }, env())
      const e = await rejects(() => updateProduct(t.id, { uom_po_id: kg.id }, env()))
      expect(e.message).to.match(/same category/)
    })

    it('keeps the barcode unique across products', async () => {
      await createProduct({ name: 'A', categ_id: categId, uom_id: ea.id, barcode: '123' }, env())
      const e = await rejects(() => createProduct({ name: 'B', categ_id: categId, uom_id: ea.id, barcode: '123' }, env()))
      expect(CONSTRAINT_MESSAGES[constraintOf(e)!]).to.equal('A barcode can only be assigned to one product !')
    })

    it('allows many products without a barcode', async () => {
      await createProduct({ name: 'A', categ_id: categId, uom_id: ea.id }, env())
      await createProduct({ name: 'B', categ_id: categId, uom_id: ea.id, barcode: '' }, env())
      expect(await ProductTemplate.count()).to.equal(2)
    })

    it('updates the variant when the template changes', async () => {
      const t = await createProduct({ name: 'A', categ_id: categId, uom_id: ea.id, default_code: 'X1' }, env())
      await updateProduct(t.id, { default_code: 'X2', barcode: '999', weight: '4' }, env())
      const v = (await ProductProduct.findOne({ where: { product_tmpl_id: t.id } }))!
      expect([v.default_code, v.barcode, v.weight]).to.deep.equal(['X2', '999', '4.0000'])
    })

    it('archives the variant with the template', async () => {
      const t = await createProduct({ name: 'A', categ_id: categId, uom_id: ea.id }, env())
      await archiveProduct(t.id, false, env())
      expect((await ProductTemplate.findByPk(t.id))!.active).to.equal(false)
      expect((await ProductProduct.findOne({ where: { product_tmpl_id: t.id } }))!.active).to.equal(false)
    })

    it('accepts the three types and rejects others', async () => {
      for (const type of ['consu', 'service', 'product']) {
        expect((await createProduct({ name: `T-${type}`, categ_id: categId, uom_id: ea.id, type }, env())).type).to.equal(type)
      }
      const e = await rejects(() => createProduct({ name: 'bad', categ_id: categId, uom_id: ea.id, type: 'nonsense' }, env()))
      expect(e.message).to.match(/product type/)
    })

    it('keeps prices as exact strings', async () => {
      const t = await createProduct({ name: 'Price', categ_id: categId, uom_id: ea.id, list_price: '1402.1234' }, env())
      expect(t.list_price).to.equal('1402.1234')
      expect(typeof t.list_price).to.equal('string')
    })

    it('deletes the template together with its variant', async () => {
      const t = await createProduct({ name: 'Gone', categ_id: categId, uom_id: ea.id }, env())
      await deleteProduct(t.id)
      expect(await ProductTemplate.count()).to.equal(0)
      expect(await ProductProduct.count()).to.equal(0)
    })

    describe('search view', () => {
      beforeEach(async () => {
        const sub = await createCategory({ name: 'Tools', parent_id: categId }, env())
        await createProduct({ name: 'Hydraulic Pump', categ_id: sub.id, uom_id: ea.id, type: 'product', tracking: 'lot', default_code: 'HP-100', barcode: '5551' }, env())
        await createProduct({ name: 'Café Filter', categ_id: categId, uom_id: ea.id, type: 'consu' }, env())
        await createProduct({ name: 'Installation', categ_id: categId, uom_id: ea.id, type: 'service', sale_ok: true, purchase_ok: false }, env())
        const old = await createProduct({ name: 'Old Pump', categ_id: sub.id, uom_id: ea.id, type: 'product' }, env())
        await archiveProduct(old.id, false, env())
      })

      const names = async (q: Parameters<typeof buildWhere>[0]) =>
        (await ProductTemplate.findAll({ where: await buildWhere(q, env()), order: [['name', 'ASC']] })).map(p => p.name)

      it('searches name, reference and barcode', async () => {
        expect(await names({ q: 'pump' })).to.deep.equal(['Hydraulic Pump'])
        expect(await names({ q: 'HP-100' })).to.deep.equal(['Hydraulic Pump'])
        expect(await names({ q: '5551' })).to.deep.equal(['Hydraulic Pump'])
        expect(await names({ q: '5551', field: 'barcode' })).to.deep.equal(['Hydraulic Pump'])
      })

      it('ignores accents', async () => {
        expect(await names({ q: 'cafe' })).to.deep.equal(['Café Filter'])
      })

      it('hides archived products unless asked', async () => {
        expect(await names({})).to.not.include('Old Pump')
        expect(await names({ active: 'false' })).to.deep.equal(['Old Pump'])
        expect(await names({ active: 'all' })).to.include('Old Pump')
      })

      it('ORs filters in a group and ANDs across groups', async () => {
        expect(await names({ filters: 'storable,service' })).to.deep.equal(['Hydraulic Pump', 'Installation'])
        expect(await names({ filters: 'storable,service,lot_tracked' })).to.deep.equal(['Hydraulic Pump'])
        expect(await names({ filters: 'can_purchase' })).to.not.include('Installation')
      })

      it('includes sub-categories when filtering by category (child_of)', async () => {
        const sub = (await ProductCategory.findOne({ where: { name: 'Tools' } }))!
        expect(await names({ categ_id: categId })).to.have.length(3)
        expect(await names({ categ_id: sub.id })).to.deep.equal(['Hydraulic Pump'])
      })

      it('counts per filter and groups with counts', async () => {
        const counts = await filterCounts({}, env())
        expect(counts).to.include({ all: 3, storable: 1, consumable: 1, service: 1, archived: 1 })
        const groups = await readGroup('type', {}, env())
        expect(Object.fromEntries(groups.map(g => [g.label, g.count]))).to.deep.equal({ 'Storable Product': 1, Consumable: 1, Service: 1 })
      })
    })
  })

  // ------------------------------------------------------------ locations ---
  describe('stock locations', () => {
    it('builds complete_name as "Parent/Child" and parent_path', async () => {
      const root = await createLocation({ name: 'Physical Locations', usage: 'view' }, env())
      const wh = await createLocation({ name: 'WH', usage: 'view', location_id: root.id }, env())
      const stock = await createLocation({ name: 'Stock', usage: 'internal', location_id: wh.id }, env())
      expect(stock.complete_name).to.equal('Physical Locations/WH/Stock')
      expect(stock.parent_path).to.equal(`${root.id}/${wh.id}/${stock.id}/`)
    })

    it('requires a name', async () => {
      const e = await rejects(() => createLocation({ name: '  ', usage: 'internal' }, env()))
      expect(e.message).to.equal('You have to set a name for this location.')
    })

    it('rejects an unknown usage', async () => {
      const e = await rejects(() => createLocation({ name: 'X', usage: 'warp' }, env()))
      expect(e.message).to.match(/location type/)
    })

    it('forbids recursive locations', async () => {
      const a = await createLocation({ name: 'A', usage: 'view' }, env())
      const b = await createLocation({ name: 'B', usage: 'view', location_id: a.id }, env())
      const e = await rejects(() => updateLocation(a.id, { location_id: b.id }, env()))
      expect(e.message).to.equal('Error ! You cannot create recursive locations.')
    })

    it('recomputes names below a renamed location', async () => {
      const a = await createLocation({ name: 'A', usage: 'view' }, env())
      const b = await createLocation({ name: 'B', usage: 'internal', location_id: a.id }, env())
      await updateLocation(a.id, { name: 'A2' }, env())
      expect((await Location.findByPk(b.id))!.complete_name).to.equal('A2/B')
    })

    it('archives the sub-locations with their parent', async () => {
      const a = await createLocation({ name: 'A', usage: 'view' }, env())
      const b = await createLocation({ name: 'B', usage: 'internal', location_id: a.id }, env())
      await updateLocation(a.id, { active: false }, env())
      expect((await Location.findByPk(b.id))!.active).to.equal(false)
    })

    it('keeps the barcode unique per company', async () => {
      const mk = async (name: string) => (await Partner.create({ name, is_company: true, type: 'contact' } as never)).id
      const c1 = await Company.create({ name: 'C1', partner_id: await mk('c1') } as never)
      const c2 = await Company.create({ name: 'C2', partner_id: await mk('c2') } as never)
      await createLocation({ name: 'L1', usage: 'internal', barcode: 'BC1', company_id: c1.id }, env())
      const e = await rejects(() => createLocation({ name: 'L2', usage: 'internal', barcode: 'BC1', company_id: c1.id }, env()))
      expect(CONSTRAINT_MESSAGES[constraintOf(e)!]).to.equal('The barcode for a location must be unique per company !')
      await createLocation({ name: 'L3', usage: 'internal', barcode: 'BC1', company_id: c2.id }, env()) // other company: fine
    })

    it('refuses to delete a location that has sub-locations', async () => {
      const a = await createLocation({ name: 'A', usage: 'view' }, env())
      await createLocation({ name: 'B', usage: 'internal', location_id: a.id }, env())
      expect((await rejects(() => deleteLocation(a.id))).message).to.match(/sub-location/)
    })
  })

  // ----------------------------------------------------------- warehouses ---
  describe('warehouses', () => {
    async function warehouse(name: string, code: string, companyId: number) {
      const view = await createLocation({ name: code, usage: 'view', company_id: companyId }, env())
      const stock = await createLocation({ name: 'Stock', usage: 'internal', location_id: view.id, company_id: companyId }, env())
      return Warehouse.create({ name, code, company_id: companyId, view_location_id: view.id, lot_stock_id: stock.id } as never)
    }
    const company = async (name: string) => {
      const p = await Partner.create({ name, is_company: true, type: 'contact' } as never)
      return Company.create({ name, partner_id: p.id } as never)
    }

    it('keeps name and code unique per company', async () => {
      const c1 = await company('C1')
      const c2 = await company('C2')
      await warehouse('Main', 'WH', c1.id)
      const dupName = await rejects(() => warehouse('Main', 'W2', c1.id))
      expect(CONSTRAINT_MESSAGES[constraintOf(dupName)!]).to.equal('The name of the warehouse must be unique per company!')
      const dupCode = await rejects(() => warehouse('Other', 'WH', c1.id))
      expect(CONSTRAINT_MESSAGES[constraintOf(dupCode)!]).to.equal('The code of the warehouse must be unique per company!')
      await warehouse('Main', 'WH', c2.id) // another company may reuse both
    })

    it('renames the view location when the code changes', async () => {
      const c = await company('C')
      const w = await warehouse('Main', 'WH', c.id)
      await updateWarehouse(w.id, { code: 'MN' }, env())
      expect((await Location.findByPk(w.view_location_id))!.name).to.equal('MN')
      expect((await Location.findByPk(w.lot_stock_id))!.complete_name).to.equal('MN/Stock')
    })

    it('refuses to change the routing steps, which are not built yet', async () => {
      const c = await company('C')
      const w = await warehouse('Main', 'WH', c.id)
      const e = await rejects(() => updateWarehouse(w.id, { reception_steps: 'two_steps' } as never, env()))
      expect(e.message).to.match(/cannot be changed yet/)
    })
  })
})
