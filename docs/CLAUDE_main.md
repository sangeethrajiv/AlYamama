# CLAUDE.md: Yamama Node ERP, Phase 1 (Contacts, then inventory basics)

Read this first. Field detail is in `docs/field-map-phase1.md`.

## 1. Project in brief
- Apps Team is replacing a live **Odoo 12 CE** system with a **Node.js/TypeScript ERP**. 5 operating companies plus a parent (Flames of Al Yamama Trading Co.), 6 `res_company` rows. Live DB ~3.9 GB, PostgreSQL.
- Go-live is a **cut-over company by company**: no shared-DB coexistence, no two-way sync. The data migration must be repeatable and per company.
- Overall order: accounting-first, on a **thin core** grown in the order accounting needs. Phase 1 (this file) = **Contacts**, then **inventory basics**. Accounting comes after.
- Live volumes (usage check, 2026-10-16): 6,049 partners, 6 companies, 20,224 product templates = 20,224 products (no real variants), 10,815 lots.

## 2. How to work with me (hard rules)
- **Never assume.** If anything is unclear, stop and ask one clear question at a time, with short options and your recommendation marked. Not every flow in the Odoo code is in use; ask before treating one as active.
- **Be token-frugal.** Read only the files needed. No exhaustive code reads, no deep DB dives. Lead with the answer, then one piece of evidence (file:line or query result). Go deeper only when asked.
- **Analysis before implementation** for anything not already decided below. Do not invent architecture beyond section 3.
- Say what you verified and what you only inferred. End with numbered open questions.
- Database access is read-only against the Odoo 12 DB. Any query on the live DB is a script I run myself.
- Do not change existing files or data without telling me first.
- Do not state any estimate as a percentage of AI help.

## 3. Decisions already made (treat as firm)
**Database**: PostgreSQL 16+, the same engine as live Odoo 12. `numeric` for money and quantities (never JS floats; use decimal.js). Real FKs and CHECK constraints. `jsonb` for translated names. `pg_trgm` and `unaccent` for search. Row-level security on `company_id` as a second safety net. Queues with `SKIP LOCKED` (pg-boss).

**Model layer**
- Declarative TypeScript models through `defineModel()` and field helpers `f.char / f.text / f.integer / f.float / f.monetary / f.boolean / f.date / f.datetime / f.selection / f.binary / f.many2one / f.one2many / f.many2many / f.computed`.
- A **registry** merges all model definitions at start-up in addon dependency order. **No runtime module install** from the UI.
- Own thin ORM on **Kysely** over **node-postgres** (not Prisma, TypeORM or MikroORM).
- Per-request **`Env`** = `{ db|trx, uid, companyId, allowedCompanyIds, lang }`. Every write request runs in one transaction.
- o2m and m2m writes use Odoo's command format `(0,0,vals)`, `(1,id,vals)`, `(2,id)`, `(3,id)`, `(4,id)`, `(5)`, `(6,0,[ids])`.
- Field-type rule (same as Odoo): **m2o = FK column, o2m = no column (the other side's m2o), m2m = two-column relation table.**
- Reference sketch of `defineModel`, base fields, mixins and the create runtime: `/mnt/project-files/framework/odoo-style-models-in-node.md` (example code, not a finished library).

**Schema and migrations**
- **Same table and column names as Odoo 12 where possible** (`res_partner`, `product_template`, ...) so data copy is mostly `INSERT ... SELECT`.
- **No silent ALTER at boot.** `erp migrate` diffs registry vs DB, writes a reviewable migration file, then applies it. Data migrations (renames, backfills) are hand-written per addon version.
- An `ir_model_data`-style **external id table from day one**; migrated records keep their Odoo id as an external id.

**Multi-company**: like Odoo 13+. Each user has allowed companies; the switcher multi-selects them and one is the current company that defaults and new records follow. Some users are single-company only and never see a switcher. Company-owned tables carry `company_id` (mixin `CompanyOwned`, indexed, default from env). A global filter by `allowedCompanyIds` replaces Odoo's hand-written record rules. Relations may declare `checkCompany`.

**Languages**: bilingual Arabic/English **UI and record data** (partner and product names), RTL. Translated fields are `jsonb` `{en, ar}` (see open question 1 for the exact keys and for the existing Arabic custom fields).

**Repo layout** (addon folders, one `index.ts` manifest per addon with name, version, depends, models, data):
```
packages/core/        registry, defineModel, fields, ORM runtime, env, migrate CLI, security stub
addons/base/          res.company, res.users (minimal), res.country, res.country.state, res.currency stub
addons/contacts/      res.partner and friends (Phase 1a)
addons/product/       uom.*, product.category, product.template/product (Phase 1b)
addons/account/ ...   later phases
apps/server/          HTTP API (Fastify or NestJS, still open)
apps/web/             React (Vite SPA); browser never touches the DB
```
**Server**: Fastify or NestJS is still **open** (decide with me before writing server code). **Client**: React SPA on Vite preferred; Next.js is acceptable only as a shell, the ERP core stays a separate Node server. Client libraries proposed: TanStack Query/Table, Ant Design or Mantine (good RTL), i18next. Also proposed: zod at the API boundary, Vitest, Playwright.

**Build order inside the core** (thin core, simplified): CRUD slice first (models, ORM, generic list/form), then logic engine (computes, constraints, onchange), then actions/wizards, reports/chatter, security last. Design in from day one even if rules are deferred: all writes through the model runtime (security stub), login, `company_id` plus company check, audit columns (`create_uid/create_date/write_uid/write_date`), and a public-method whitelist on the generic `call()`.

## 4. Phase 1 scope
**In**
- 1a **Contacts**: `res.partner`, `res.partner.category` (tags), `res.partner.title`, `res.partner.industry`, `res.partner.bank`, `res.bank`, `res.country`, `res.country.state` (+ `res.country.group` only if needed), and the minimum of `res.company`/`res.users` that partners reference.
- 1b **Inventory basics**: `uom.category`, `uom.uom`, `product.category`, `product.template`, `product.product` (one variant per template).
- Generic CRUD API with `search / read / create / write / unlink / name_search`, constraints, translated fields, multi-company filter, external ids, `erp migrate`, and a repeatable per-company data loader from Odoo 12 for these models.
- UI: **minimal**. A generic list and form per model is enough (search by name en/ar, code, CR, VAT).

**Out of scope for Phase 1**: accounting (journals, moves, ZATCA, receivable/payable accounts), groups/ACL/record rules (stub only), mail/chatter, pricelists, stock moves/warehouses/lots, sale/purchase, helpdesk, reports, wizards, mobile API, payroll/HR. Where a partner or product field points at an out-of-scope model (account, pricelist, payment term, user group), **create the column as a plain nullable integer without FK and flag it in the migration**, do not stub the whole model. Ask me if unsure.

## 5. Target models and fields
Full field lists, Odoo 12 column names, types, constraints and the mapping table are in **`docs/field-map-phase1.md`**. Summary of what must exist:
- `res.partner`: Odoo 12 base fields (name, parent_id, is_company, type, ref, vat, lang, tz, street..country_id, email/phone/mobile, website, function, title, industry_id, category_id m2m, credit_limit, barcode, comment, active, `customer`/`supplier`/`employee` flags, company_id, user_id, images) **plus** the Yamama custom fields: `arabic_name, arabic_street2_name, arabic_city_name, vat_arabic, customer_code, vandor_number (sic), cr_number, cash_customer, discount, fax, company_name_code, customer_discount`, and the ZATCA buyer fields `l10n_sa_edi_building_number, l10n_sa_edi_plot_identification, l10n_sa_additional_identification_scheme, l10n_sa_additional_identification_number, l10n_sa_registered_name`. Whether to keep each custom field is open (docs/open-questions.md).
- `product.template` / `product.product`: Odoo 12 base plus `arabic_name, internal_short_code, is_teltonika_product`, `product_type_id` (att.product.type, genre/subtype/main head classification, Phase 1b+), `no_discount`, `purchase_request`, `is_vehicle_subscription`. `product.category` adds `arabic_name, sequence_code, lot_sequence_id`. The property/accounting fields are deferred (section 4).

## 6. Odoo 12 behaviours that must be preserved
Verified from `TY-employee-odoo/odoo_server` (line numbers will differ in your copy; re-check before relying):
- `res.partner`: SQL CHECK `type='contact' AND name IS NOT NULL OR type != 'contact'` ("Contacts require a name"). `_check_parent_id` forbids recursive parents. Commercial fields (e.g. `vat`) sync from the commercial partner to children; address fields sync for `type='contact'` children. `display_name` is computed (parent name + child name). `company_type` is computed from `is_company`. `type` selection: contact, invoice, delivery, other, plus the custom `child_company` and `manager` (att_installation_request).
- `res.partner.bank`: unique `(sanitized_acc_number, company_id)`; `sanitized_acc_number` = account number stripped of non-alphanumerics, stored.
- `res.country`: unique `name`, unique `code`. `res.country.state`: unique `(country_id, code)`.
- `uom.category`: unique `measure_type`. `uom.uom`: CHECK `factor != 0`, `rounding > 0`, reference unit must have `factor = 1`; only one reference unit per category (constraint `_check_category_reference_uniqueness`); `factor_inv` is the inverse of `factor` (bigger units store `factor = 1/factor_inv`); `uom_type` in bigger/reference/smaller. UoM conversion rounding equals Odoo's (golden test needed).
- `product.product`: unique `barcode`. `product.template`: `uom_id` and `uom_po_id` must be in the same category (`_check_uom`). `type` selection: consu, service, plus storable `product` (from stock). `tracking`: none, lot, serial. One variant per template (live data has no attribute variants). `default_code` and `barcode` on the template are computed from the single variant.
- `res.partner.category` is a tree (`parent_id`, `parent_path`); `product.category` is a tree with `complete_name` computed ("Parent / Child").
- Archive semantics via `active`. Names and ordering as in Odoo (`res.partner` order `display_name`; `product.template` order `name`).
- Unique custom constraint: `res.partner.company_name_code` unique (delivery_order_custom).

## 7. Where the Odoo 12 source is
- `TY-employee-odoo.zip` (and `hydraulic_workshop_odoo.zip`) in `/mnt/project-files/`. The TY zip holds the **unmodified Odoo 12 core** under `TY-employee-odoo/odoo_server/` and custom addons under `custom_addons/`. They depend on each other; treat as one system.
- Core files: `odoo/addons/base/models/res_partner.py`, `res_bank.py`, `res_country.py`, `res_company.py`; `addons/uom/models/uom_uom.py`; `addons/product/models/product_template.py`, `product.py`. Custom: `sale_custom`, `l10n_sa_edi`, `att_installation_request`, `delivery_order_custom`, `att_customer_pricelist`, `stock_customization`, `att_product_tracking`, `purchase_request`, `subscription_management`.
- **Where this file or docs/field-map lacks detail, read the Odoo source above. Do not invent fields.** The field map was produced by a static AST scan of those files; selection values, defaults and onchange logic were only partly checked.
- Other references (read only if needed): `/mnt/project-files/framework/node-erp-core-framework.md` (architecture, sections 2 and 3.2), `flow-catalogue/odoo12-flow-catalogue.md` (section 2.1 contacts), `accounting/` (contact/product master comparisons with Zoho and QuickBooks, inventory-accounting connection).

## 8. Code conventions
- TypeScript strict, ESM, Node LTS. One model per file, named `<model>.ts` (e.g. `partner.ts`); extensions of another addon's model live in the extending addon and are merged by the registry.
- Model names dotted (`res.partner`); table = name with dots to underscores unless overridden; keep Odoo's column names.
- No raw string-built SQL; Kysely or parameterised `sql` tagged templates. All writes go through the model runtime, never direct table inserts from services.
- No floats for money or quantities. Dates: `date` vs `timestamp` as in Odoo.
- Every company-owned model uses `CompanyOwned`; every model gets audit columns.
- Tests: Vitest against a throwaway PostgreSQL database per run. Each Odoo behaviour in section 6 gets a test. Golden-data tests compare against rows exported from Odoo.
- Secrets only from environment variables; none in the repo.

## 9. DB connection setup
- One `pg.Pool` per process (`max` about 20), Kysely `PostgresDialect`. Settings from env vars: `PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD`.
- Two databases locally: the **new** dev DB (read-write) and a **read-only** copy of the Odoo 12 DB for loader work. Never write to the Odoo copy.
- One DB, companies separated by `company_id`; no multi-database selector.
- Extensions: `CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent;`. Hosting (on-prem vs cloud, extension limits) is an open question.

## 10. Suggested first tasks (in order; confirm with me before starting each block)
1. Repo skeleton (section 3 layout), TS config, lint, Vitest harness with throwaway PG DB, env config.
2. `packages/core`: fields, `defineModel`, registry with dependency-ordered addon loader, base fields and mixins (`CompanyOwned`, `Active`).
3. `erp migrate`: registry-to-schema diff, migration file generation, apply, external id table.
4. ORM runtime on Kysely: create/write/read/search/unlink, domains, o2m/m2m commands, translated jsonb fields, `Env`, transaction per request, company filter, constraints.
5. `addons/base`: `res.company` (6 rows, parent link), minimal `res.users`, `res.country`, `res.country.state`, `res.currency` stub.
6. `addons/contacts`: `res.partner.category`, `title`, `industry`, `res.bank`, `res.partner.bank`, then `res.partner` with Odoo constraints and the custom fields I confirm.
7. Per-company loader for the contacts tables from the Odoo 12 copy (external ids, counts match: 6,049 partners overall), with a count and spot-check report.
8. Minimal generic list/form UI for partners (en/ar search, RTL).
9. `addons/product`: `uom.category`, `uom.uom`, `product.category`, `product.template`, `product.product`, with loader and tests.

## 11. Acceptance checks for Phase 1
- `erp migrate` on an empty DB creates all Phase 1 tables; running it twice produces no diff; no boot-time ALTER.
- Each constraint in section 6 has a passing test (violating row rejected with the Odoo message).
- Create/edit/archive a partner in Arabic and English; name search works in both; `unaccent` search works.
- Multi-company: a single-company user sees only that company's partners and products; a user with two allowed companies sees both and new records follow the current company.
- Per-company loader: row counts per model equal the Odoo source for that company; migrated rows keep Odoo ids as external ids; re-running does not duplicate.
- UoM conversion results equal Odoo on a golden set.
- No monetary or quantity value passes through a JS float.

## 12. Open questions
Not guessed. **Ask me before building anything that depends on one.**
1. Translated-name storage: jsonb keys `{en, ar}` or `{en_US, ar_001}`? Odoo 12 stores translations in `ir_translation` and partner `name` is not translatable; custom `arabic_name` columns exist on partner, product and category. Keep them, or merge into the jsonb name?
2. Which custom partner fields stay (`fax, discount, customer_discount, cash_customer, customer_code, vandor_number, cr_number, vat_arabic, arabic_*`, ZATCA buyer fields, `company_name_code`, `image_sign/image_seal`)? Are `child_company` and `manager` partner types used?
3. Keep `customer`/`supplier` boolean flags as in Odoo 12 (one row, both flags)? Zoho and QuickBooks use separate records.
4. Is `employee` flag / employees in scope for Contacts?
5. Product: which `type` values and `tracking` modes are used; keep `att.product.type` (genre/subtype/main head) in 1b?
6. Server framework: Fastify or NestJS. Hosting and allowed PG extensions.
7. Parent company: do parent users see and post in child companies by default?
8. Placeholder columns for out-of-scope FKs (accounts, pricelist, payment terms): confirm plain integer approach.
9. Runtime module install and admin-editable screens are parked (working assumption: deploy only, code-defined views).
