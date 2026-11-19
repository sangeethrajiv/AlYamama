# 11 — Final Feasibility Summary

**Scope:** User Management & Access Control · Accounting · Products & Inventory.
**Nature:** analysis only — nothing was implemented, modified or migrated; the database was accessed read-only.
**Basis:** live DB `yamama_live_18_09_26` (PostgreSQL 17.9), Odoo 12.0 source, 62 custom/third-party modules. Tags: **[V]** verified · **[I]** inferred · **[U]** unverified. Details in docs 01–10.

---

## Headline facts that change the plan

1. **The system is Odoo 12**, not a recent version. Invoices are `account.invoice` (states `draft/to_approve/approved/open/in_payment/paid/cancel`); `account.move` is the generated journal entry. The handover document assumes a newer data model (`account.move` invoices, `customer_rank`, `posted` invoices) and needs correction (doc 01 §8).
2. **ZATCA Phase 2 is already live** (5,770 invoices `sent`; 5 companies in `prod` mode) via a backported EDI stack. It must be preserved, not added later.
3. **Journal-entry balance validation is disabled in code** by `account_payment_other_company` (`_post_validate` override). Data is clean today (0 unbalanced, 0 cross-company) but nothing enforces it. 5 posted entries have no lines. **No lock dates** are set on any company.
4. **27 % of journal entries (32,176 / 118,858) come from stock moves.** Inventory valuation (FIFO, real-time) is inseparable from accounting.
5. **Product variants are unused** (20,327 templates = 20,327 products; 0 attributes). **Bank statements are unused** (0). **Fiscal positions are unused** (0). Only 13 taxes, all percentage.
6. **Company-dependent `ir.property` values** carry costs (17,385), accounts and valuation settings — a major schema redesign item.
7. **Security is rule-driven**: 1,025 ACL rows, 229 record rules (128 company-based using `user.company_id` + `child_of` over a parent/child company tree), 14 user categories, 82 approval-level rules. It does not reduce to simple RBAC.
8. **Legacy API exposure**: 52+ `auth="none"` token-based mobile endpoints; plaintext secrets in the server config; `list_db=True`, `cors=*`.

---

## Answers to the eleven required questions

### 1. Is this migration technically feasible?
**Yes — technically feasible, with high effort and concentrated risk in four places:** accounting posting/reconciliation accuracy, ZATCA Phase 2 continuity, stock valuation (FIFO layers) parity, and the record-rule/multi-company security model. The data volumes are modest (97 users, 36 k invoices, 346 k journal items, 35 k move lines, 20 k products), so there is no scale obstacle. The difficulty is behavioural fidelity, not capacity.

### 2. What can be implemented using Node.js + Express?
All backend capabilities in scope: authentication/authorization and policy engine, master data, product catalog and per-company settings, inventory (moves, quants, lots, adjustments, landed costs), the accounting posting engine, tax/FX, invoices, payments, reconciliation, approvals, vouchers, reports/exports, scheduled jobs, ZATCA integration (with compliance effort), file/PDF services. Express supplies only HTTP; the structure (modules, transactions, validation, policy) must be designed explicitly (doc 06).

### 3. What can be implemented using Angular Microfrontends?
The three areas can be separate remotes — **Users**, **Accounting**, **Products & Inventory** — plus a **Master Data** remote for contacts/UoM/currency, under one **shell** (login, company switcher, menu, permissions, i18n/RTL). Cross-module screens link via stable URLs. Business-critical calculations stay server-side (doc 05).

### 4. Which architecture is recommended?
* **Frontend:** Nx monorepo, Angular shell + remotes with Module/Native Federation, released as one train initially.
* **Backend:** **modular monolith** on Node.js + Express (TypeScript), one PostgreSQL cluster with schema-per-module. Microservices are **not** recommended: stock→ledger commits must be ACID, and the scale does not need independent scaling.
* **Database:** PostgreSQL (already in use). New clean schema with `legacy_odoo_id` mapping; money as `NUMERIC`; `ir.property` flattened (doc 09).

### 5. What are the most difficult parts of the migration?
1. Reconciliation (partial/full, FX difference, residuals) and matching Odoo's stored values.
2. ZATCA Phase 2 (signing, hash chain, CSIDs, key custody) without breaking the live chain.
3. FIFO real-time stock valuation with landed costs and the `force_date` back-dating.
4. Translating 229 record rules + approval levels into a policy engine with multi-company semantics.
5. Phased coexistence with Odoo (system of record per module, sync, cutover with open items).
6. Report parity (VAT due, trial balance, ledgers, ageing) and bilingual/Arabic PDFs.

### 6. Which Odoo features require special attention?
* `ir.rule` domains (global AND / group OR), `child_of`, `user.company_id` semantics, follower-based portal access.
* `ir.property` (company-dependent fields).
* Stored computed fields (`amount_residual`, `reconciled`, invoice totals, `number`).
* `no_gap` sequences with date ranges (64 journals, 490 ranges) + ZATCA chain index.
* `onchange` defaults that encode business behaviour (cash/credit invoice routing via context).
* `sudo()` usage and server actions (176 `code` actions) — not itemised.
* Chatter/tracking as de-facto audit trail.
* `account_payment_other_company` override of `_post_validate`.
* `stock_force_date` back-dating.

### 7. What are the major User Management challenges?
* Record rules and multi-company: active-company semantics, company 1 as parent seeing all children, 11 multi-company users, customised partner visibility rule.
* Authorization that depends on **amount, level, date, company** (approval levels), not just role.
* Credential migration (PBKDF2-SHA512 hashes, 28 password-less accounts, mobile tokens) and static token risk.
* Role design: 139 groups, of which 38 are feature toggles; 14 user categories are the real role templates.
* Hardening: `auth="none"` endpoints, plaintext secrets, `cors=*`, `list_db=True` on the legacy system.

### 8. What are the major Accounting challenges?
* Exact replication of custom invoice totals/discount/rounding and tax computation (decimal arithmetic).
* Posting engine that enforces balance, company and lock dates (currently not enforced).
* Reconciliation + exchange-difference logic and migration of 46 k reconciled items.
* Gapless numbering and cutover with 9,903 open customer invoices and 1,232 open vendor bills.
* ZATCA Phase 2 continuity; Arabic amount-in-words and bilingual output.
* Inter-company payments, vouchers, progressive invoicing, cash/credit journals, fixed assets (scope).
* Financial and VAT reports parity.

### 9. What are the major Products and Inventory challenges?
* Flattening `ir.property` into per-company settings and preserving account/cost resolution.
* FIFO layers, real-time valuation entries, landed costs (77), back-dated pickings.
* Concurrent quant updates and reservations; 19 negative internal quants (negative-stock policy).
* Lot tracking on 18,646 storable products; lot sequencing by category.
* Scope of MRP/procurement (6 MRP types, 48 rules, 27 routes) and delivery-order customisations (506 + 7,363 records).
* UoM categories and conversions (48 UoMs); data-quality anomalies (a 2002-dated move).

### 10. What should be clarified with the Node.js and Angular teams before development?

**Node.js team**
1. ORM/query builder strategy (raw SQL for posting/reconciliation?), TypeScript standards, migration tool.
2. Decimal/money library and rounding rules agreed with Finance.
3. Transaction/isolation conventions; idempotency keys; error-code catalogue.
4. Job scheduler and idempotent job design (reverse entries, depreciation, ZATCA retry).
5. PDF/XLSX engine with Arabic/RTL support.
6. Secret management and where ZATCA keys/CSIDs will live.
7. Policy-engine design for rule translation and parity-test approach.
8. Hosting, observability and backup requirements; CI/CD.
9. Compatibility façade for the legacy `/api/*` mobile endpoints — who owns it, and for how long?
10. ZATCA strategy: keep Odoo signer as adapter vs native implementation.

**Angular team**
1. Federation approach (Module vs Native Federation), Angular version, single release train vs independent deploys.
2. Design system/component library and Arabic/RTL strategy; accessibility baseline.
3. Auth model in the shell (token in memory + refresh cookie), mobile/web parity.
4. Permission model exposure (`/me/permissions`) and company-switch behaviour.
5. State-management standard per remote; caching/invalidation rules.
6. Table/report patterns for large lists (server paging, async export).
7. Handling of onchange-style defaults (server "preview/defaults" endpoints).
8. Contract testing between Angular and the API (OpenAPI codegen).

**Business/Product decisions required from both**
* What stays in Odoo during transition and for how long; system-of-record per module.
* In/out of scope: MRP, fixed assets, subscriptions, vouchers, helpdesk/vehicle links, product variants.
* Opening-balance vs full-history migration; chatter retention.
* Company scope semantics (hierarchy vs explicit allowed-companies list).
* Negative-stock policy; lock-date policy.

### 11. What should be the implementation sequence?
1. **Milestone 1** — lock analysis, scope, ZATCA strategy, transition model.
2. **Milestone 2** — IAM: users, roles, companies, policy engine, audit, auth.
3. **Milestone 3** — Master data **plus accounting master** (CoA, journals, taxes, sequences), partners.
4. **Milestone 4** — Products & inventory quantities.
5. **Milestone 5** — Accounting engine: posting, tax, FX, approvals, ledgers.
6. **Milestone 6** — Invoices, payments, reconciliation, inventory valuation postings, ZATCA, reports.
7. **Milestone 7** — Integration, parallel run, cutover.
(Differences from the handover's order and the rationale are in doc 10 §9.)

---

## Recommended immediate actions (non-implementation)
1. Correct the handover document using doc 01 §8.
2. Harden the legacy Odoo instance and **rotate credentials** that exist in plaintext in `yamama.config` (not reproduced in these reports).
3. Decide the ZATCA strategy and scope exclusions.
4. Produce the analysis artefacts listed in doc 10 (Milestone 1).
5. Freeze policy: define lock dates and a data-freeze approach for the eventual cutover.

## Limitations of this analysis
Odoo server not executed; views/reports not individually reviewed; filestore, ZATCA secrets and out-of-scope modules not inspected; dump vs live DB equality unverified; server-action contents not itemised; some counts (e.g., anglo-saxon setting, customer-invoice approval usage) flagged **[U]** in the individual reports.
