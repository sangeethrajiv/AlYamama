import { expect } from 'chai'
import { env, resetTables, sequelize } from '../../test-helper'
import { CONSTRAINT_MESSAGES } from '../../middleware'
import { Partner } from './partner.model'
import { Company } from '../../core/company/company.model'
import { PartnerCategory } from '../category/category.model'
import { archivePartner, createPartner, deletePartner, updatePartner } from './partner.service'
import { displayNameOf } from './partner.service'
import { buildWhere, filterCounts, readGroup } from './partner.search'

/**
 * One test per Odoo 12 behaviour listed in docs/CLAUDE_main.md section 6,
 * plus the CRUD and search paths.
 */
describe('contacts / res.partner', () => {
  beforeEach(resetTables)

  // ------------------------------------------------------- constraints ---
  describe('constraints', () => {
    it('refuses a contact without a name (res_partner_check_name)', async () => {
      try {
        await Partner.create({ type: 'contact', name: null } as never)
        expect.fail('the insert should have been rejected')
      } catch (e) {
        expect(String(e)).to.match(/res_partner_check_name/)
      }
    })

    it('allows an address child without a name', async () => {
      const company = await createPartner({ name: 'Parent Co', is_company: true }, env())
      const addr = await createPartner({ type: 'delivery', parent_id: company.id, city: 'Dammam' }, env())
      expect(addr.name).to.equal(null)
    })

    it('keeps company_name_code unique, with the Odoo message', async () => {
      await createPartner({ name: 'A', company_name_code: 'YAM-1' }, env())
      try {
        await createPartner({ name: 'B', company_name_code: 'YAM-1' }, env())
        expect.fail('the duplicate code should have been rejected')
      } catch (e) {
        const constraint = (e as { parent?: { constraint?: string } }).parent?.constraint
        expect(constraint).to.equal('res_partner_company_name_code')
        // The error handler turns that constraint into Odoo's own wording.
        expect(CONSTRAINT_MESSAGES[constraint!]).to.equal('Company Code already exists!')
      }
    })

    it('rejects a type outside the selection', async () => {
      try {
        await sequelize.query(`INSERT INTO res_partner (name, type) VALUES ('X', 'nonsense')`)
        expect.fail('the invalid type should have been rejected')
      } catch (e) {
        expect(String(e)).to.match(/res_partner_type_check/)
      }
    })

    it('accepts the two custom types used in the live data', async () => {
      const m = await createPartner({ name: 'A Manager', type: 'manager' }, env())
      const c = await createPartner({ name: 'A Child Co', type: 'child_company' }, env())
      expect([m.type, c.type]).to.deep.equal(['manager', 'child_company'])
    })
  })

  // --------------------------------------------------------- hierarchy ---
  describe('hierarchy', () => {
    it('forbids a recursive parent', async () => {
      const a = await createPartner({ name: 'A', is_company: true }, env())
      const b = await createPartner({ name: 'B', parent_id: a.id }, env())
      try {
        await updatePartner(a.id, { parent_id: b.id }, env())
        expect.fail('the recursion should have been rejected')
      } catch (e) {
        expect((e as Error).message).to.match(/recursive/i)
      }
    })

    it('forbids a record being its own parent', async () => {
      const a = await createPartner({ name: 'A' }, env())
      try {
        await updatePartner(a.id, { parent_id: a.id }, env())
        expect.fail('self-parenting should have been rejected')
      } catch (e) {
        expect((e as Error).message).to.match(/recursive/i)
      }
    })

    it('sets commercial_partner_id to the top company', async () => {
      const co = await createPartner({ name: 'Top Co', is_company: true }, env())
      const person = await createPartner({ name: 'Ali', parent_id: co.id }, env())
      const sub = await createPartner({ name: 'Sub Person', parent_id: person.id }, env())
      expect(person.commercial_partner_id).to.equal(co.id)
      const reloaded = await Partner.findByPk(sub.id)
      expect(reloaded!.commercial_partner_id).to.equal(co.id)
      expect(co.commercial_partner_id).to.equal(co.id)
    })

    it('refuses to delete a contact that still has children', async () => {
      const co = await createPartner({ name: 'Has Kids', is_company: true }, env())
      await createPartner({ name: 'Kid', parent_id: co.id }, env())
      try {
        await deletePartner(co.id, env())
        expect.fail('the delete should have been refused')
      } catch (e) {
        expect((e as Error).message).to.match(/child contact/i)
      }
    })
  })

  // ------------------------------------------------------ display_name ---
  describe('display_name', () => {
    it('is the plain name for a company', async () => {
      const co = await createPartner({ name: 'Yamama Steel', is_company: true }, env())
      expect(co.display_name).to.equal('Yamama Steel')
    })

    it('is "Company, Person" for a child person', async () => {
      const co = await createPartner({ name: 'Yamama Steel', is_company: true }, env())
      const p = await createPartner({ name: 'Khalid', parent_id: co.id }, env())
      expect(p.display_name).to.equal('Yamama Steel, Khalid')
    })

    it('falls back to the type label for an unnamed address', async () => {
      const co = await createPartner({ name: 'Yamama Steel', is_company: true }, env())
      const a = await createPartner({ type: 'delivery', parent_id: co.id }, env())
      expect(a.display_name).to.equal('Yamama Steel, Shipping address')
    })

    it('is recomputed on the children when the parent is renamed', async () => {
      const co = await createPartner({ name: 'Old Name', is_company: true }, env())
      const p = await createPartner({ name: 'Khalid', parent_id: co.id }, env())
      const grand = await createPartner({ name: 'Deep', parent_id: p.id }, env())
      await updatePartner(co.id, { name: 'New Name' }, env())
      const [rp, rg] = await Promise.all([Partner.findByPk(p.id), Partner.findByPk(grand.id)])
      expect(rp!.display_name).to.equal('New Name, Khalid')
      expect(rg!.display_name).to.equal('New Name, Deep')
      expect(rp!.commercial_company_name).to.equal('New Name')
    })

    it('matches Odoo _get_name for the pure function', () => {
      expect(displayNameOf({ name: 'Acme', is_company: true })).to.equal('Acme')
      expect(displayNameOf({ name: 'Ali', is_company: false, parent_id: 1 }, 'Acme')).to.equal('Acme, Ali')
      expect(displayNameOf({ name: 'Solo' })).to.equal('Solo')
    })
  })

  // ------------------------------------------------------------- syncs ---
  describe('field sync (Odoo _fields_sync)', () => {
    it('copies vat and credit_limit from the parent to a new child', async () => {
      const co = await createPartner({ name: 'Co', is_company: true, vat: '300112233400003', credit_limit: '5000.00' }, env())
      const child = await createPartner({ name: 'Child', parent_id: co.id }, env())
      expect(child.vat).to.equal('300112233400003')
      expect(Number(child.credit_limit)).to.equal(5000)
    })

    it('pushes a changed vat down to non-company children', async () => {
      const co = await createPartner({ name: 'Co', is_company: true, vat: '111' }, env())
      const child = await createPartner({ name: 'Child', parent_id: co.id }, env())
      const subCo = await createPartner({ name: 'SubCo', is_company: true, parent_id: co.id, vat: '999' }, env())
      await updatePartner(co.id, { vat: '222' }, env())
      const [rc, rs] = await Promise.all([Partner.findByPk(child.id), Partner.findByPk(subCo.id)])
      expect(rc!.vat).to.equal('222')
      // A child that is itself a company keeps its own commercial fields.
      expect(rs!.vat).to.equal('999')
    })

    it('copies the address to a child of type contact', async () => {
      const co = await createPartner({ name: 'Co', is_company: true, street: 'Al Kharj Road', city: 'Riyadh', zip: '11564' }, env())
      const child = await createPartner({ name: 'Child', parent_id: co.id, type: 'contact' }, env())
      expect(child.street).to.equal('Al Kharj Road')
      expect(child.city).to.equal('Riyadh')
    })

    it('pushes an address change down to contact children only', async () => {
      const co = await createPartner({ name: 'Co', is_company: true, city: 'Riyadh' }, env())
      const contact = await createPartner({ name: 'Person', parent_id: co.id, type: 'contact' }, env())
      const delivery = await createPartner({ name: 'Site', parent_id: co.id, type: 'delivery', city: 'Jubail' }, env())
      await updatePartner(co.id, { city: 'Dammam' }, env())
      const [rc, rd] = await Promise.all([Partner.findByPk(contact.id), Partner.findByPk(delivery.id)])
      expect(rc!.city).to.equal('Dammam')
      expect(rd!.city).to.equal('Jubail')
    })
  })

  // -------------------------------------------------------- custom data ---
  describe('Yamama custom fields', () => {
    it('stores the Arabic, ZATCA and code fields', async () => {
      const p = await createPartner({
        name: 'Yamama Trading',
        is_company: true,
        arabic_name: 'شركة اليمامة',
        arabic_city_name: 'الرياض',
        arabic_street2_name: 'طريق الخرج',
        vat_arabic: '٣٠٠١١٢',
        cr_number: '1010221134',
        customer_code: '50001',
        vandor_number: 'V-900',
        cash_customer: true,
        discount: '2.500',
        customer_discount: '1.250',
        fax: '+966 11 477 1001',
        l10n_sa_registered_name: 'Yamama Trading Co.',
        l10n_sa_additional_identification_scheme: 'CRN',
        l10n_sa_additional_identification_number: '1010221134',
        l10n_sa_edi_building_number: '1234',
        l10n_sa_edi_plot_identification: '5678',
      }, env())
      const r = await Partner.findByPk(p.id)
      expect(r!.arabic_name).to.equal('شركة اليمامة')
      expect(r!.cr_number).to.equal('1010221134')
      expect(r!.customer_code).to.equal('50001')
      expect(r!.vandor_number).to.equal('V-900')
      expect(r!.l10n_sa_additional_identification_scheme).to.equal('CRN')
      // Money and percentages come back as strings: no JS float anywhere.
      expect(r!.discount).to.equal('2.500')
      expect(typeof r!.customer_discount).to.equal('string')
    })

    it('does not validate the VAT format, as Odoo 12 does not', async () => {
      const p = await createPartner({ name: 'Odd VAT', vat: 'not-15-digits' }, env())
      expect(p.vat).to.equal('not-15-digits')
    })
  })

  // --------------------------------------------------------------- tags ---
  describe('tags', () => {
    it('accepts ids and names, creating the names that do not exist', async () => {
      const existing = await PartnerCategory.create({ name: 'VIP' } as never)
      const p = await createPartner({ name: 'Tagged', tags: [existing.id, 'Riyadh region'] }, env())
      const rows = await sequelize.query<{ name: string }>(
        `SELECT c.name FROM res_partner_res_partner_category_rel r
           JOIN res_partner_category c ON c.id = r.category_id
          WHERE r.partner_id = $1 ORDER BY c.name`,
        { bind: [p.id], type: 'SELECT' } as never,
      )
      expect((rows as unknown as Array<{ name: string }>).map(r => r.name)).to.deep.equal(['Riyadh region', 'VIP'])
    })

    it('replaces the tag set on update', async () => {
      const p = await createPartner({ name: 'Tagged', tags: ['A', 'B'] }, env())
      await updatePartner(p.id, { tags: ['C'] }, env())
      const rows = await sequelize.query(
        `SELECT c.name FROM res_partner_res_partner_category_rel r
           JOIN res_partner_category c ON c.id = r.category_id WHERE r.partner_id = $1`,
        { bind: [p.id], type: 'SELECT' } as never,
      )
      expect((rows as unknown as Array<{ name: string }>).map(r => r.name)).to.deep.equal(['C'])
    })
  })

  // ------------------------------------------------------------ archive ---
  describe('archive', () => {
    it('archives and restores through active', async () => {
      const p = await createPartner({ name: 'Temp' }, env())
      await archivePartner(p.id, false, env())
      expect((await Partner.findByPk(p.id))!.active).to.equal(false)
      await archivePartner(p.id, true, env())
      expect((await Partner.findByPk(p.id))!.active).to.equal(true)
    })
  })

  // ----------------------------------------------------------- multi-co ---
  describe('multi-company', () => {
    it('hides other companies and keeps shared records visible', async () => {
      const p1 = await createPartner({ name: 'Co1 partner', is_company: true }, env())
      const p2 = await createPartner({ name: 'Co2 partner', is_company: true }, env())
      const c1 = await Company.create({ name: 'Company One', partner_id: p1.id } as never)
      const c2 = await Company.create({ name: 'Company Two', partner_id: p2.id } as never)

      await createPartner({ name: 'Only in One', company_id: c1.id }, env())
      await createPartner({ name: 'Only in Two', company_id: c2.id }, env())
      await createPartner({ name: 'Shared', company_id: null }, env())

      const single = await Partner.findAll({ where: buildWhere({}, env({ allowedCompanyIds: [c1.id], companyId: c1.id })) })
      const names = single.map(r => r.name)
      expect(names).to.include('Only in One')
      expect(names).to.include('Shared')
      expect(names).to.not.include('Only in Two')

      const both = await Partner.findAll({ where: buildWhere({}, env({ allowedCompanyIds: [c1.id, c2.id] })) })
      expect(both.map(r => r.name)).to.include.members(['Only in One', 'Only in Two', 'Shared'])
    })

    it('defaults a new record to the current company', async () => {
      const p = await createPartner({ name: 'Host', is_company: true }, env())
      const co = await Company.create({ name: 'Host Co', partner_id: p.id } as never)
      const made = await createPartner({ name: 'New One' }, env({ companyId: co.id, allowedCompanyIds: [co.id] }))
      expect(made.company_id).to.equal(co.id)
    })
  })

  // ------------------------------------------------------------- search ---
  describe('search view', () => {
    beforeEach(async () => {
      await createPartner({ name: 'Al-Yamama Steel', is_company: true, customer: true, email: 'a@x.test', city: 'Riyadh', vat: '300112233400003', cr_number: '1010221134' }, env())
      await createPartner({ name: 'Dammam Tubes', is_company: true, supplier: true, customer: false, city: 'Dammam', customer_code: '50002' }, env())
      await createPartner({ name: 'Khalid Al-Otaibi', is_company: false, customer: true, mobile: '+966551234567' }, env())
      const archived = await createPartner({ name: 'Gone Co', is_company: true }, env())
      await archivePartner(archived.id, false, env())
    })

    it('searches across name, email, vat and code by default', async () => {
      const byName = await Partner.findAll({ where: buildWhere({ q: 'yamama' }, env()) })
      expect(byName.map(r => r.name)).to.deep.equal(['Al-Yamama Steel'])
      const byVat = await Partner.findAll({ where: buildWhere({ q: '300112233400003' }, env()) })
      expect(byVat).to.have.length(1)
      const byCode = await Partner.findAll({ where: buildWhere({ q: '50002' }, env()) })
      expect(byCode.map(r => r.name)).to.deep.equal(['Dammam Tubes'])
    })

    it('ignores accents and case', async () => {
      await createPartner({ name: 'Café Jubail', is_company: true }, env())
      const rows = await Partner.findAll({ where: buildWhere({ q: 'cafe jub' }, env()) })
      expect(rows.map(r => r.name)).to.deep.equal(['Café Jubail'])
    })

    it('does not search the Arabic columns for now', async () => {
      await createPartner({ name: 'Arabic Co', is_company: true, arabic_name: 'شركة اليمامة للتجارة' }, env())
      const rows = await Partner.findAll({ where: buildWhere({ q: 'اليمامة', field: 'name' }, env()) })
      expect(rows).to.have.length(0)
      // The value is still stored, ready to switch back on.
      expect((await Partner.findOne({ where: { name: 'Arabic Co' } }))!.arabic_name).to.equal('شركة اليمامة للتجارة')
    })

    it('hides archived records unless asked', async () => {
      const def = await Partner.findAll({ where: buildWhere({}, env()) })
      expect(def.map(r => r.name)).to.not.include('Gone Co')
      const arch = await Partner.findAll({ where: buildWhere({ active: 'false' }, env()) })
      expect(arch.map(r => r.name)).to.deep.equal(['Gone Co'])
      const all = await Partner.findAll({ where: buildWhere({ active: 'all' }, env()) })
      expect(all.map(r => r.name)).to.include('Gone Co')
    })

    it('ORs filters in the same group and ANDs different groups', async () => {
      // role: customers OR vendors  AND  kind: companies
      const rows = await Partner.findAll({ where: buildWhere({ filters: 'customers,vendors,companies' }, env()) })
      const names = rows.map(r => r.name).sort()
      expect(names).to.deep.equal(['Al-Yamama Steel', 'Dammam Tubes'])
    })

    it('returns counts per filter', async () => {
      const counts = await filterCounts({}, env())
      expect(counts.all).to.equal(3)
      expect(counts.companies).to.equal(2)
      expect(counts.individuals).to.equal(1)
      expect(counts.vendors).to.equal(1)
      expect(counts.archived).to.equal(1)
    })

    it('groups with counts', async () => {
      const groups = await readGroup('is_company', {}, env())
      const map = Object.fromEntries(groups.map(g => [g.label, g.count]))
      expect(map.Company).to.equal(2)
      expect(map.Individual).to.equal(1)
      const byCity = await readGroup('city', {}, env())
      expect(byCity.find(g => g.label === 'Riyadh')!.count).to.equal(1)
    })
  })

  // -------------------------------------------------------------- audit ---
  describe('audit columns', () => {
    it('stamps create_uid and write_uid from the request env', async () => {
      const p = await createPartner({ name: 'Audited' }, env({ uid: 7 }))
      expect(p.create_uid).to.equal(7)
      await updatePartner(p.id, { name: 'Audited 2' }, env({ uid: 9 }))
      const r = await Partner.findByPk(p.id)
      expect(r!.create_uid).to.equal(7)
      expect(r!.write_uid).to.equal(9)
    })

    it('ignores computed fields sent by a client', async () => {
      const p = await createPartner({ name: 'Real', display_name: 'Spoofed', commercial_company_name: 'Spoofed' }, env())
      expect(p.display_name).to.equal('Real')
    })
  })
})
