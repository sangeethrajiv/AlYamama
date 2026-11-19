# 10 — Migration Roadmap

Milestone-based and module-wise. **No time estimates are given.** Order is adjusted from the requested sequence where the verified dependencies require it (see §9, "Changes from the proposed order").

Evidence: docs 01–08. Every milestone ends only when its **completion criteria** are met and signed off.

---

## Milestone 1 — Architecture & database analysis (finish and lock)

* **Scope:** Confirm findings in docs 01–09; close the open questions (doc 11); produce the analysis artefacts listed below; choose target schema approach and transition model.
* **Dependencies:** access to business owners (Finance, Stores, Purchasing, HR/IT for users).
* **Backend work:** none (decisions only): target schema conventions, ORM choice, secret management, CI baseline.
* **Frontend work:** none (decisions only): Nx workspace layout, federation decision, design-system choice.
* **Analysis artefacts to produce:** access control matrix, rule register (229), role catalogue, `sudo()` inventory, server-action inventory (176 `code` actions) for in-scope models, field classification (keep/extension/drop) for `account.invoice` (110 cols) and partner/product/company, report inventory, consumer inventory of `/api/*`, data-quality report (5 empty entries, negative quants, orphan data), decision on ZATCA strategy.
* **Testing requirements:** reproducibility of every count in the reports by SQL; peer review of rules and approval levels with business users.
* **Major risks:** R2, R24, R10 (strategy), R15.
* **Completion criteria:** signed-off scope (what is in/out: MRP, assets, subscriptions, vouchers, helpdesk links); signed field classification; signed ZATCA strategy; signed transition model (system of record per phase).

## Milestone 2 — User Management & Access Control

* **Scope:** companies (security view), users, roles/permissions, role templates (14 categories), sessions/tokens, audit log, approval-level configuration data model (read/maintain).
* **Dependencies:** M1 decisions (permission model, company scope semantics).
* **Backend work:** authentication (login/refresh/logout/revoke, MFA option), password-hash import with rehash-on-login, permission model seeded from `ir_model_access` + groups, **policy engine** for in-scope models (company, ownership, HOD, portal), company-context middleware, audit service, user/role admin APIs, legacy `/api/authenticate` adapter (if mobile stays).
* **Frontend work:** shell login/session, company switcher, menu from permissions, route guards/directives, Users MFE (users, roles, role templates, mass role update, approval levels).
* **Testing requirements:** per-user parity tests (visible records per model and company vs Odoo for a sampled set including company-1, multi-company and portal users); authorization negative tests; password migration test with real hash samples in a sandbox; token revocation tests.
* **Major risks:** R5, R6, R17, R15.
* **Completion criteria:** parity report accepted; no endpoint reachable without authn+authz (automated check); users from Odoo can log in (with rehash) in test; audit log captures auth events.

## Milestone 3 — Contacts & required master data (and accounting master)

*(Merged adjustment: the CoA, journals, taxes and sequences are pulled into this milestone because partner accounting properties and product accounting settings depend on them.)*

* **Scope:** currencies & rates (incl. inverted-rate behaviour), UoM, countries, payment terms, partners (core + Arabic + ZATCA fields + credit limits + company visibility), partner bank accounts; chart of accounts per company (851 accounts), journals (64, with numbering and cash/credit routing), taxes (13), analytic accounts (138); sequence service; partner accounting properties.
* **Dependencies:** M2 (companies, authz).
* **Backend work:** masterdata + accounting-master modules; sequence service (gapless, per journal/year; 490 ranges); import scripts (read-only extraction from Odoo → staging → target) for these tables; duplicates/consolidation rules for 6,136 partners.
* **Frontend work:** Master Data MFE (contacts, currencies, UoM); Accounting MFE skeleton (CoA, journals, taxes configuration).
* **Testing requirements:** row counts and checksums vs Odoo; partner visibility parity; sequence concurrency tests; account→type→report mapping check.
* **Major risks:** R6, R11 (partner properties), R25.
* **Completion criteria:** all master tables reconciled to Odoo (counts, key fields); sequences continue exactly from Odoo's next numbers in a dry run; partner/company visibility parity accepted.

## Milestone 4 — Products & Inventory (quantities)

* **Scope:** product categories (121) and products (20,327; single-table, no variants), supplier prices (2,412), pricelist(s), **per-company product settings** (flattened `ir.property`), warehouses (6), locations (64), picking types (49), lots (10,900), pickings (9,049), moves (34,534)/move lines, quants (19,021), inventory adjustments (498).
* **Dependencies:** M3 (accounts for category settings, UoM, taxes, partners).
* **Backend work:** catalog + inventory modules; stock commands (confirm/assign/validate/cancel/return/adjust); transactional quant updates; lot sequence by category; negative-stock policy; **valuation hooks defined but valuation entries still produced by Odoo** until M6/M7 (or stub with no posting) — decision recorded in M1.
* **Frontend work:** Inventory MFE (products, categories, pickings, moves, quants, lots, adjustments); lot/serial UX.
* **Testing requirements:** quants = Σ done move lines per (product, location, lot); concurrency tests for reservation/validation; UoM conversion tests; golden scenarios for receipt/delivery/internal/adjustment; resolution parity for per-company accounts/costs for every product.
* **Major risks:** R11, R12 (deferred), R13, R25.
* **Completion criteria:** quantity parity by product/location/lot with Odoo; scenario tests pass; no unresolved accounts for any product.

## Milestone 5 — Accounting foundation (posting engine & approvals)

* **Scope:** posting engine (journal entries/items with balance + company + lock-date checks), tax engine (percent taxes, per-line/global rounding, the custom discount/rounding in `_compute_amount`), FX conversion & rounding, entry numbering, approval engine (82 levels; invoice/voucher/PO/PR types), reversal/cancellation rules, lock dates, opening balances loader, report primitives (trial balance, GL, partner ledger).
* **Dependencies:** M3 (accounting master), M2 (approvals/authz).
* **Backend work:** accounting module core; deferred balance constraint; reversal/auto-reverse job; fiscal lock-date management; analytic distribution; read models for ledgers.
* **Frontend work:** Accounting MFE: journal entry view/create, ledgers, trial balance, approvals UI.
* **Testing requirements:** replay of a sample of historical entries through the engine producing identical lines/amounts; unbalanced/cross-company rejection tests; rounding golden tests; lock-date tests; trial balance parity per company and period.
* **Major risks:** R7, R8, R22.
* **Completion criteria:** trial balance and GL parity with Odoo for agreed periods; engine rejects invalid entries; sign-off from Finance on rounding rules.

## Milestone 6 — Invoicing, payments, reconciliation (+ valuation & e-invoicing)

* **Scope:** customer invoices/credit notes, vendor bills/debit notes with the approval states; progressive invoicing; cash/credit invoice routing; payments (incl. inter-company), vouchers (payable/internal); reconciliation (partial/full, FX difference, residuals); **inventory valuation postings** (FIFO layers, real-time, landed costs, `force_date`); fixed assets (if in scope); ZATCA Phase 2 per the M1 strategy; VAT due report and remaining financial reports; PDF/Arabic output.
* **Dependencies:** M4, M5.
* **Backend work:** invoicing, payment, reconciliation services; valuation service integrated with inventory moves in one transaction; einvoicing module/adapter; report service; job runner (ZATCA retry, auto-reverse, depreciation).
* **Frontend work:** invoice/bill forms, payment registration, reconciliation UI, voucher screens, valuation views, ZATCA status, report screens/exports.
* **Testing requirements:** recompute all 36,454 invoice totals and compare; reconciliation residual parity per partner/account; valuation parity (`Σ remaining_value` vs GL stock accounts per company); ZATCA sandbox certification and chain-continuity tests; VAT report parity per period.
* **Major risks:** R7, R9, R10, R12, R22.
* **Completion criteria:** AR/AP ageing, VAT report and stock valuation reconcile to Odoo; ZATCA flow certified for the chosen strategy; Finance sign-off.

## Milestone 7 — Integration, testing, parallel run, cutover

* **Scope:** end-to-end scenarios (sell, buy, inventory adjust, inter-company payment, asset purchase, voucher approval); performance tests at production volumes; migration rehearsals; mobile/API compatibility; security review; cutover plan and rollback plan; decommissioning plan for Odoo modules.
* **Dependencies:** M2–M6.
* **Backend work:** hardening, observability, backup/restore, data-sync/freeze procedures, final delta import scripts.
* **Frontend work:** UX polish, accessibility, RTL/Arabic verification, error handling, performance.
* **Testing requirements:** UAT per role; parallel run with daily reconciliation reports; penetration test; disaster-recovery test; data-migration dress rehearsals with timing and checksums.
* **Major risks:** R19, R20, R15, R18.
* **Completion criteria:** UAT sign-off; two consecutive rehearsal cutovers reconcile with zero unexplained differences; lock dates set in Odoo for migrated periods; rollback tested.

---

## 9. Changes from the proposed order (and why)
1. **Accounting master data moved into Milestone 3** (CoA, journals, taxes, sequences). Reason: partner accounting properties and product category/account settings (87–88 `ir.property` rows per category setting) cannot be loaded without accounts.
2. **Inventory quantities (M4) before the posting engine (M5), valuation postings after (M6).** Reason: 27 % of journal entries come from stock moves; valuation needs the ledger engine, but quantities do not.
3. **Approvals engine placed in M5** (with the posting engine) while approval-level *configuration* is in M2. Reason: invoices/vouchers can't be posted per policy without it.
4. **ZATCA strategy decided in M1**, implemented/adapted in M6. Reason: regulatory risk and key custody.
5. Scope exclusions (HR, CRM, helpdesk, vehicle sync, subscriptions) are treated as **external dependencies** that still read/write invoices (`subscription_management` adds 17 invoice and 23 line columns) — their integration is an M1 decision.

## 10. Sign-off gates
Each milestone requires: updated risk register, test report, data reconciliation report, security review of new endpoints, and written acceptance by the module owner (Finance for M3, M5, M6; Stores for M4; IT/Admin for M2).
