# 08 — Migration Risks and Challenges

Each risk lists: **Problem · Why it occurs · Impact · Possible solution · Priority**. Evidence tags: **[V]** verified, **[I]** inferred. Priority is relative to this migration's success (High / Medium / Low). No time estimates are given.

---

## Summary table

| # | Risk | Priority |
|---|---|---|
| R1 | Odoo ORM behaviour → explicit Node logic | High |
| R2 | Custom model/override migration (62 custom modules) | High |
| R3 | Computed, related and stored fields | High |
| R4 | Many2many relationships | Medium |
| R5 | Record rules & permission semantics | High |
| R6 | Multi-company security | High |
| R7 | Accounting accuracy (rounding, totals, tax) | High |
| R8 | Journal-entry consistency (balance check disabled) | High |
| R9 | Reconciliation & residuals | High |
| R10 | ZATCA Phase 2 continuity | High |
| R11 | Product master & company-dependent properties | High |
| R12 | Stock valuation (FIFO, real-time, landed cost, force-date) | High |
| R13 | Quant/stock consistency & concurrency | High |
| R14 | Database schema redesign | Medium |
| R15 | API integration (mobile, external) | High |
| R16 | Microfrontend integration | Medium |
| R17 | Authentication sharing / credential migration | High |
| R18 | Deployment & version management | Medium |
| R19 | Legacy data migration & cutover | High |
| R20 | Testing & validation | High |
| R21 | Audit trail / chatter loss | Medium |
| R22 | Reporting parity | High |
| R23 | Odoo 12 end-of-support / environment hygiene | Medium |
| R24 | Unknown/undocumented business rules | High |
| R25 | Data quality anomalies | Medium |
| R26 | Attachments volume (9.3 GB) | Medium |

---

## R1 — Odoo ORM → Node.js mapping
* **Problem:** Odoo's ORM applies ACL, rules, defaults, computed fields, constraints, translations, tracking and cascades implicitly on every `create/write/unlink`.
* **Why:** 615 models, 3,327 FKs; behaviour spread over Python overrides in standard + custom code.
* **Impact:** Silent loss of business rules; inconsistent data.
* **Solution:** Document each in-scope model's *behaviour contract* (create/write hooks, constraints, defaults); implement as domain services with tests; do not auto-generate CRUD from tables.
* **Priority:** High

## R2 — Custom model migration
* **Problem:** 62 custom/third-party modules; 44 of them own fields on models whose names fall in the in-scope families (`res.users/groups/company/partner`, `account.*`, `product.*`, `stock.*`, `uom.*` — includes report wizards; DB-verified) (e.g., `account.invoice` has **110 columns**, 29 from `account_customization`, 17 from `subscription_management`, 13 from `att_installation_request`).
* **Why:** Years of incremental customisation; invoices carry non-accounting data (maintenance counts, vehicle details, subscriptions).
* **Impact:** A naive 1:1 table copy will import unrelated domains; omitting fields breaks reports/features.
* **Solution:** Classify each field **keep / move to extension table / drop**; extract non-core invoice attributes (subscription, maintenance, vehicle) into separate extension entities owned by their business modules; confirm out-of-scope modules' dependencies with business owners.
* **Priority:** High

## R3 — Computed, related and stored fields
* **Problem:** Stored computed fields (`amount_total`, `amount_residual`, `reconciled`, invoice `residual`, `number` = related `move_id.name`, `state`, quant quantities).
* **Why:** Odoo recomputes on dependency change; Node must recompute explicitly in the same transaction.
* **Impact:** Divergent balances, wrong paid/open status.
* **Solution:** Catalogue every stored computed field on in-scope models; implement as calculators; add reconciliation tests (recompute from lines and compare with stored values on a data sample/all rows).
* **Priority:** High

## R4 — Many2many relationships
* **Problem:** Relation tables with Odoo naming (`account_invoice_line_tax` 95,403 rows, `account_invoice_payment_rel` 22,035, `user_category_user_group_rel`, `res_groups_users_rel` 2,339, `delivery_note_ids`, `vehicle_ids`, `landed_cost_ids`, `compatible_edi_ids`).
* **Why:** No surrogate keys; composite uniqueness assumed.
* **Impact:** Duplicate/missing links, slow joins.
* **Solution:** Explicit join tables with composite PKs and FKs; import in dependency order; verify cardinalities.
* **Priority:** Medium

## R5 — Record rules and permissions
* **Problem:** 229 `ir.rule` records with domain expressions, relation traversal, global-vs-group combination, follower-based access, `user.*` variables.
* **Why:** Row-level security is data-driven, not role-driven.
* **Impact:** Data leaks (too permissive) or lock-out (too strict).
* **Solution:** Rule register + policy engine + a **per-user "visible-record count" parity test** between Odoo and the new system for a set of sampled users and models.
* **Priority:** High

## R6 — Multi-company security
* **Problem:** Rules use `user.company_id` (active company) with `child_of`; company 1 is parent of all others; `product.template` rule uses equality; `res.partner` rule customised to expose partners of internal users; 11 users span >1 company; inter-company payments write two companies' ledgers.
* **Why:** Emergent behaviour of the parent/child tree.
* **Impact:** Users seeing or editing another company's data, or accounting entries in the wrong company.
* **Solution:** Make company scope explicit in every repository query; decide the target semantics (explicit allowed-companies list vs hierarchy); write tests for company-1 and multi-company users; keep inter-company posting as a single transaction.
* **Priority:** High

## R7 — Accounting accuracy
* **Problem:** Custom `_compute_amount` (discount rounding), per-line vs global tax rounding, currency rounding (JPY 1.0), multi-currency conversion at invoice date.
* **Why:** Rounding rules differ subtly; JS floats are inexact.
* **Impact:** Cent-level differences multiplied across 36 k invoices → audit and ZATCA mismatches.
* **Solution:** Decimal arithmetic; port the exact formulas; **golden-master test**: recompute totals for **all** 36,454 invoices and compare to stored values; zero tolerance policy defined with Finance.
* **Priority:** High

## R8 — Journal-entry consistency
* **Problem:** `account_payment_other_company` overrides `_post_validate` and **disables the balance and same-company checks** (verified); lock dates are unset; 5 posted entries have no lines.
* **Why:** Inter-company payment convenience override.
* **Impact:** The legacy system guarantees nothing at write time; hidden defects could exist beyond current probes (0 unbalanced, 0 cross-company today).
* **Solution:** Enforce balance in domain layer and DB (deferred constraint); investigate the 5 empty entries; add explicit inter-company posting that is balanced *per company*; set lock dates before cutover.
* **Priority:** High

## R9 — Reconciliation challenges
* **Problem:** 25,771 partial + 20,449 full reconciliations; 102 partials with foreign currency; exchange-difference entries; `amount_residual(_currency)` stored per line.
* **Why:** Reconciliation matches many-to-many items with partial amounts and FX.
* **Impact:** Wrong AR/AP ageing, wrong paid/open states, wrong partner balances.
* **Solution:** Migrate **existing** reconciliation records verbatim (do not re-run matching); implement the reconciliation service for *new* matches; validate residuals per partner/account against Odoo.
* **Priority:** High

## R10 — ZATCA Phase 2 continuity
* **Problem:** 5,770 invoices already reported (`sent`) from 5 production companies; hash chain (`l10n_sa_invoice_hash`, `l10n_sa_chain_index`), UUIDs, signatures, CSIDs, private keys held in Odoo.
* **Why:** Regulator requires an unbroken chain and consistent identity.
* **Impact:** Regulatory non-compliance, rejected invoices, penalties.
* **Solution:** Decide strategy early: (a) keep Odoo's ZATCA module as signer during transition, or (b) re-implement with a sandbox certification cycle; preserve ICV/PIH continuity; secure key transfer via secret manager; never copy keys into code or logs.
* **Priority:** High

## R11 — Product master and `ir.property`
* **Problem:** Cost (`standard_price` 17,385 props), accounts, valuation and cost method are company-dependent properties; category defaults vs product overrides.
* **Why:** Odoo stores them as generic `ir_property` rows (res_id, company_id, value_*).
* **Impact:** Wrong accounts on postings if resolution order (product → category → company default) is not replicated.
* **Solution:** Flatten to typed per-company tables; replicate fallback order; validate that every product resolves to the same accounts as in Odoo.
* **Priority:** High

## R12 — Stock valuation
* **Problem:** FIFO + real-time valuation; layers (`remaining_qty`, `remaining_value`); landed costs (77); `stock_force_date` changes dates of moves and entries; FIFO vacuum for negative stock.
* **Why:** Cost layers are state, not derivable from current quantities alone.
* **Impact:** Inventory value ≠ GL stock account; wrong COGS.
* **Solution:** Migrate layer state; reconcile `Σ remaining_value` with GL valuation account per company before cutover; treat back-dated pickings explicitly; decide how to handle negative stock.
* **Priority:** High

## R13 — Inventory transaction consistency & concurrency
* **Problem:** Quant updates need row-level locking; 19 negative internal quants; reservations.
* **Why:** Parallel validations in Node (multiple instances) can oversell or double-count.
* **Impact:** Incorrect on-hand, duplicate reservations.
* **Solution:** Transactional update with `FOR UPDATE`/upsert; moves as truth; nightly quant-vs-moves reconciliation job.
* **Priority:** High

## R14 — Database schema redesign
* **Problem:** Whether to reuse Odoo's schema or redesign (naming, `ir_property`, M2M names, soft-delete via `active`, no money type, `res_partner` as universal contact).
* **Why:** Odoo's schema is ORM-oriented (836 tables).
* **Impact:** Re-work if the decision is changed mid-project.
* **Solution:** Decide up front (doc 09): new clean schema with `legacy_odoo_id` mapping + import scripts; keep Odoo column semantics where reports depend on them.
* **Priority:** Medium

## R15 — API integration
* **Problem:** Mobile app and possibly external systems use 52+ `/api/*` endpoints with static token and client-supplied `user_id`; `api_user_*` settings in config indicate other integrations; 101 `auth="none"` routes in custom code overall.
* **Why:** Evolved without a formal contract.
* **Impact:** Mobile breakage at cutover; security exposure if replicated blindly.
* **Solution:** Inventory consumers; publish OpenAPI; provide a compatibility façade for legacy endpoints with improved auth; deprecate gradually.
* **Priority:** High

## R16 — Microfrontend integration
* **Problem:** Federation version skew, shared state, duplicated UI, permission drift.
* **Why:** Multiple independently built bundles.
* **Impact:** Broken runtime loading, inconsistent UX.
* **Solution:** Nx monorepo, strict shared versions, contract tests, single release train initially (doc 05).
* **Priority:** Medium

## R17 — Authentication sharing / credential migration
* **Problem:** PBKDF2-SHA512 hashes (69), 28 empty passwords, mobile tokens, `auth_signup` invitations.
* **Why:** Passlib hash format and Odoo-specific token handling.
* **Impact:** Mass password resets, or weak migration.
* **Solution:** Verify hash compatibility in a sandbox; rehash on login; revoke legacy tokens; require MFA for finance/admin roles; never print or log hashes.
* **Priority:** High

## R18 — Deployment and version management
* **Problem:** Parallel run with Odoo; many environments; secrets.
* **Why:** Odoo remains the system of record during phased migration.
* **Impact:** Divergent data and configuration; plaintext secrets (observed in `yamama.config`).
* **Solution:** IaC, secret manager, versioned API/contracts, feature flags per module; rotate every credential that was in plaintext.
* **Priority:** Medium

## R19 — Legacy data migration & cutover
* **Problem:** 36 k invoices, 118 k entries, 346 k lines, 21.8 k payments, 20 k products, 34.5 k stock moves; open items (9,903 customer invoices, 1,232 vendor bills); no lock dates; module-wise rollout means two systems live.
* **Why:** Phased approach needs coexistence and a sync strategy.
* **Impact:** Double entry, missing documents, balance mismatches.
* **Solution:** Define the **system-of-record per module per phase**; one-way sync with explicit ownership; freeze windows via lock dates; opening-balance vs full-history decision; rehearsal imports with reconciliation reports.
* **Priority:** High

## R20 — Testing and validation
* **Problem:** No automated test baseline for custom behaviour; Odoo `tests/` for standard modules are not a substitute.
* **Why:** Business rules live in code and tribal knowledge.
* **Impact:** Undetected regressions.
* **Solution:** Golden-master comparisons (totals, taxes, residuals, stock, valuation, permissions); UAT with Finance/Stores; parallel runs; scenario catalogue from real documents.
* **Priority:** High

## R21 — Audit trail / chatter loss
* **Problem:** 1.1 M messages, 1.8 M tracking values attached to documents.
* **Why:** Odoo `mail.thread` tracking.
* **Impact:** Loss of who-changed-what evidence; approval history partly in chatter.
* **Solution:** Decide retention: migrate approval histories (`invoice.request.history`, voucher histories) as first-class data; archive chatter read-only.
* **Priority:** Medium

## R22 — Reporting parity
* **Problem:** Custom report modules (trial balance, GL, partner ledger, VAT due Excel, cumulative, ageing, consumption).
* **Why:** Reports are bespoke SQL/ORM with filters and Arabic/bilingual layouts.
* **Impact:** Finance cannot close periods or file VAT.
* **Solution:** Report inventory with owners; reproduce with parameterised SQL; side-by-side validation per period.
* **Priority:** High

## R23 — Odoo 12 end-of-support / environment hygiene
* **Problem:** Odoo 12 is not a supported release; config shows `list_db=True`, `cors_origins=*`, plaintext secrets.
* **Why:** Legacy hosting.
* **Impact:** Security exposure while the migration is in progress.
* **Solution:** Immediate hardening of the legacy instance (restrict DB listing, CORS, rotate secrets) independent of migration.
* **Priority:** Medium

## R24 — Undocumented business rules
* **Problem:** 176 `code` server actions, onchange logic, custom context keys (`cash_customer`), approval-level data.
* **Why:** Logic in data and code.
* **Impact:** Missed requirements discovered after go-live.
* **Solution:** Inventory server actions in scope; structured interviews with Finance, Stores, Purchasing; shadow-run.
* **Priority:** High

## R25 — Data quality anomalies
* **Problem:** 5 posted entries with no lines, 1 stock move dated 2002, 19 negative internal quants, 245 partners with no company, `vat_due_report_excel` in two copies, 13 inactive/28 password-less users.
* **Why:** Years of operational use.
* **Impact:** Import failures or false mismatches.
* **Solution:** Data-quality report before import; explicit "migrate / fix / exclude" decisions.
* **Priority:** Medium

## R26 — Attachments
* **Problem:** 125 k attachments (9.3 GB) stored as binary in DB/filestore; the filestore path was not accessible.
* **Why:** Odoo default storage.
* **Impact:** Missing invoice PDFs/documents.
* **Solution:** Export to object storage with checksum manifest; keep a legacy-id → URL mapping.
* **Priority:** Medium
