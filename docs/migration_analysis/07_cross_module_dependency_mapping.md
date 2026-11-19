# 07 — Cross-Module Dependency Mapping

> **[V]** verified from DB/source · **[I]** inferred.

---

## 1. Measured coupling (foreign keys from accounting / stock / product / uom tables into shared masters) **[V]**

| Referenced table | FKs from `account_*`, `stock_*`, `product_*`, `uom_*` tables |
|---|---:|
| `res_users` (audit `create_uid`/`write_uid`, owners, approvers) | 286 |
| `res_company` | 51 |
| `account_journal` | 45 |
| `account_account` | 44 |
| `stock_location` | 38 |
| `res_partner` | 32 |
| `product_product` | 29 |
| `res_currency` | 19 |
| `account_tax` | 19 |
| `account_invoice` | 17 |
| `product_template` | 15 |
| `account_analytic_account` | 13 |
| `uom_uom` | 11 |
| `stock_move` | 9 |
| `account_move` | 7 |

Row-level couplings: 162,758 of 346,169 journal items carry a `product_id`; 279,810 carry a `partner_id`; 96,129 of 101,023 invoice lines carry a `product_id`; 32,176 journal entries carry `stock_move_id`.

---

## 2. Dependency analysis by pair

### 2.1 Users ↔ Access Rights
* **Depends on:** `res_users` ↔ `res_groups` (2,339 memberships) ↔ `ir_model_access` (1,025) ↔ `ir_rule` (229); user categories (14) → groups.
* **Shared master:** users/groups/ACL — consumed by *every* module for authorization and by 286 audit FKs.
* **Cross-boundary workflow:** approval levels (`request.approval.levels`) reference `res.groups` and `res.company`; approval of invoices/vouchers/POs asks "does this user hold this group at this level?".
* **Blocks others:** **Yes — hard prerequisite** for all modules (authentication, audit columns, record scope).

### 2.2 Users ↔ Companies
* `res_users.company_id` (default company) + `res_company_users_rel` (allowed companies, 144 rows). Rules use `user.company_id` and `child_of` over a **parent/child company tree** (company 1 is parent of 5, 6, 7, 9, 12).
* **Shared master:** `res_company` (51 FKs from in-scope tables) incl. accounting config: `fiscalyear_lock_date`, `period_lock_date` (both NULL), `currency_id`, `chart_template_id`, `due_from/to_account_id`, ZATCA key/mode, `landed_cost_journal_id`, cash/credit invoice flags.
* **Blocks others:** **Yes** — every accounting and stock row has `company_id`; every query needs company scope.

### 2.3 Contacts ↔ Accounting
* `res_partner` (6,136) → `account_invoice.partner_id`, `account_move_line.partner_id` (279,810 lines), payments, vouchers, reconciliation (per-partner matching), ledgers, credit/debit limits, VAT/ZATCA identity (`vat`, `l10n_sa_*`, `cr_number`, `customer_code`, `cash_customer`).
* Company-dependent partner accounts (`property_account_receivable_id`/`payable_id`, `property_payment_term_id`) require the **chart of accounts** to exist before contacts can be fully loaded.
* **Circular:** partner accounting properties → accounts; invoices → partners. Break the cycle by loading **partner core data first, partner accounting properties after CoA**.

### 2.4 Products ↔ Accounting
* `product_product` → invoice lines (96,129), journal items (162,758). Income/expense accounts, taxes and (for storable products) stock accounts come from **product + category `ir.property`** (income 14, expense 130, valuation 87, input 88, output 88).
* `account.tax` ↔ products via `product_taxes_rel` / `product_supplier_taxes_rel`.
* Asset category (`om_account_asset`) on product → drives asset creation from vendor bills.
* **Blocks:** accounting invoice logic needs product master + account resolution; product master needs account IDs ⇒ **CoA before product accounting settings**.

### 2.5 Products ↔ Inventory
* `product_template` ↔ `stock_move` / `stock_quant` / `stock_production_lot` / `stock_warehouse_orderpoint`; UoM conversion; tracking (`lot` on 18,646 products) forces lot handling in every receipt/delivery.
* **Master/transaction boundary:** products are master; moves/quants are transactions. Opening stock must be derived consistently from quants.

### 2.6 Taxes ↔ Accounting
* `account_tax` (13) → `account_invoice_tax` (34,844), `account_invoice_line_tax` (95,403), `account_move_line.tax_line_id`, tax report grids, ZATCA exemption codes (`l10n_sa_*`). Tax accounts reference `account_account`.
* **Blocks invoicing:** tax engine must be ready before invoices; tax per company.

### 2.7 Inventory valuation ↔ Accounting
* `stock.move` done → entry in `STJ` journal (`account_move.stock_move_id`; 32,176 entries) using category-level accounts; FIFO layers in `stock_move` (`remaining_qty`, `remaining_value`, `value`); landed costs adjust valuation; `stock_force_date` sets entry dates.
* Vendor bill ↔ receipt matching (`purchase_stock`): price-difference postings depend on the company's anglo-saxon accounting setting — **[U]**, not checked.
* **Hard coupling:** inventory **cannot go live with valuation** before the accounting posting engine exists; quantities **can** go live earlier (if valuation posting is deferred or still done by Odoo).

---

## 3. Dependency graph (build order)

```
IAM: users / roles / permissions / companies
        │
        ▼
Master data: currencies+rates · UoM · partners (core) · payment terms · countries
        │
        ├──────────────► Chart of Accounts · journals · taxes · sequences   (accounting master)
        │                         │
        ▼                         ▼
Partner accounting props    Product categories + per-company product settings
        │                         │
        └──────────┬──────────────┘
                   ▼
        Products · pricelists · vendor prices
                   │
                   ▼
        Inventory (quantities): warehouses · locations · pickings · moves · quants · lots
                   │
                   ▼
        Accounting engine: posting · tax · FX · sequences · approvals
                   │
        ┌──────────┼───────────────────────┐
        ▼          ▼                       ▼
   Invoices   Payments & reconciliation   Inventory valuation postings
        │          │                       │ (landed cost, force-date)
        └──────────┴───────────┬───────────┘
                               ▼
                 Reports · ZATCA e-invoicing · cutover
```

---

## 4. What must be ready before what

| Module | Must be ready first |
|---|---|
| IAM (users, roles, companies) | nothing (foundation) |
| Currencies & rates, UoM, countries | IAM |
| Partners (core) | IAM (companies) |
| Chart of accounts, journals, taxes, sequences, payment terms | IAM, currencies |
| Partner accounting properties | CoA, payment terms |
| Product categories & per-company settings | CoA (accounts), UoM |
| Products, vendor prices, pricelists | Categories, UoM, taxes, partners |
| Inventory (warehouses, locations, picking types) | IAM (companies) |
| Inventory transactions (quantities) | Products, locations, lots |
| Approval engine | IAM (groups, companies) |
| Invoicing | Partners, products, taxes, CoA, journals, sequences, approvals |
| Payments & reconciliation | Invoices, journals, currencies |
| Inventory valuation postings | Inventory transactions **and** accounting posting engine |
| ZATCA e-invoicing | Invoices (posted), partner ZATCA data, journal CSID/chain data |
| Reports | Everything above |

---

## 5. Shared master tables (single owner needed)

| Master | Proposed owner | Consumers |
|---|---|---|
| Users/roles/permissions/companies | `iam` | all |
| Currency & rates | `masterdata` | accounting, catalog, inventory (costs) |
| Partners | `masterdata` | accounting, inventory (pickings), approvals |
| UoM | `masterdata` | catalog, inventory, accounting (invoice lines) |
| Chart of accounts, journals, taxes, payment terms | `accounting` | catalog (accounts), inventory (valuation accounts), partners (properties) |
| Products & categories | `catalog` | inventory, accounting |
| Analytic accounts/tags | `accounting` | invoices, purchase, assets |

## 6. Workflows that cross module boundaries

1. **Sell:** quotation → delivery (inventory) → invoice (accounting) → payment → reconciliation → ZATCA report.
2. **Buy:** purchase request → approval (levels) → PO → receipt (inventory, lot creation, valuation entry) → vendor bill (approval, tax) → payment → reconciliation → landed cost.
3. **Inventory adjustment** → valuation entry in `STJ`.
4. **Inter-company payment** → entries in two companies, two journals.
5. **Voucher approvals** (payable/internal) → payment → ledger.
6. **Asset purchase** → vendor bill line with asset category → asset record + monthly depreciation entries.
7. **Delivery order / direct delivery** (`delivery_order_custom`) → picking → invoice (`delivery.custom.invoice`).

## 7. Dependencies that can block independent development

| Blocker | Why |
|---|---|
| Authorization/policy engine | Every module's API needs it |
| Company-scoped `ir.property` flattening | Products, partners and inventory all read per-company accounts/costs |
| Posting engine API | Inventory valuation, invoices, payments, assets, vouchers all post entries |
| Sequence service | Invoices, journal entries, pickings, lots (`att_product_tracking`), vouchers |
| Approval engine | Invoices, vouchers, PO/PR |
| ZATCA state (hash chain/ICV) | Invoice numbering and posting must preserve the chain |
| Report definitions | Needed for validation of migrated balances |
| Decision: what stays in Odoo during transition | Determines integration points (see doc 10) |

## 8. Realistic implementation sequence
1. **Foundation:** IAM + companies + audit + sequences + config/secrets. 
2. **Master data:** currencies/rates, UoM, partners (core), payment terms.
3. **Accounting master:** CoA, journals, taxes, payment terms, analytic accounts; then partner accounting properties.
4. **Catalog:** categories (with accounts), products, supplier info, pricelists.
5. **Inventory quantities:** warehouses/locations/picking types, lots, pickings, moves, quants, adjustments.
6. **Accounting engine:** posting, tax, FX, approvals, sequences; then **invoices**.
7. **Payments & reconciliation**, vouchers, inter-company.
8. **Inventory valuation postings** (FIFO layers, landed costs, force-date handling).
9. **Reports**, **ZATCA**, fixed assets (if in scope).
10. **Integration testing, parallel run, cutover.**

This differs from the handover's order (Phase 1 masters → invoicing → payments → reporting → cutover) in two ways: (a) Catalog and inventory quantities are placed before invoicing because invoice lines reference products (96,129 of 101,023 lines) and delivery-order/direct-delivery flows (`delivery_order_custom`) generate invoices from pickings — a pure invoicing-first order is possible if products are migrated first, so this is a preference, not a hard dependency; (b) valuation posting is deliberately **after** the accounting engine.
