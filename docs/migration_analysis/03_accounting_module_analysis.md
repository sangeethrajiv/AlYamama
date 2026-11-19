# 03 — Accounting Module Analysis

> Legend: **[V]** verified (source/DB) · **[I]** inferred · **[U]** unverified.
> Source references are to `TY-employee-odoo/odoo_server/addons/account/...` unless stated.
> **Key fact:** this is **Odoo 12**. Customer invoices and vendor bills are **`account.invoice`** records; `account.move` / `account.move.line` are the *journal entries* they generate. The two models must be migrated as a pair.

---

## 1. Installed accounting stack **[V]**

| Layer | Modules |
|---|---|
| Standard | `account`, `account_cancel`, `account_payment`, `account_bank_statement_import`, `account_facturx`, `analytic`, `l10n_sa`, `base_vat`, `payment`, `payment_transfer`, `snailmail_account` |
| Third-party/OCA | `account_financial_report` (OCA), `om_account_asset`, `account_payment_other_company` (OCA), `currency_rate_inverted`, `date_range`, `report_xlsx`, `landedcost_custom` |
| Custom (Apps Team) | `account_customization`, `att_progressive_invoicing`, `att_account_qr_code`, `att_qr_code_base`, `account_voucher_extension`, `account_reports`, `account_reports_excel`, `cumulative_reports`, `att_analytic_reports`, `vat_due_report_excel`, `asset_management_extended`, `request_approval_levels` |
| E-invoicing backport | `account_edi`, `account_edi_ubl_cii`, `l10n_sa_edi` (ZATCA Phase 2) |

---

## 2. Live data profile **[V]**

### 2.1 Volumes and states
| Item | Value |
|---|---|
| Journal entries `account_move` | 118,858 — `posted` 118,834 (2018-09-18 → 2026-11-09), `draft` 24 |
| Journal items `account_move_line` | 346,169 (12,746 with `amount_currency ≠ 0`; 46,222 `reconciled`) |
| Entries by journal type | general 42,649 · cash 28,011 · purchase 19,715 · sale 17,558 · bank 10,925 |
| Invoices `account_invoice` | 36,454 |
| &nbsp;&nbsp;`out_invoice` | 17,361 → open 9,903 · paid 7,449 · cancel 7 · draft 2 |
| &nbsp;&nbsp;`in_invoice` | 18,894 → paid 17,631 · open 1,232 · cancel 20 · draft 6 · **approved 5** |
| &nbsp;&nbsp;`out_refund` | 184 → paid 114 · open 70 |
| &nbsp;&nbsp;`in_refund` | 15 → paid 12 · open 3 |
| Payments `account_payment` | 21,839 — posted: supplier-outbound 17,001, customer-inbound 3,872, other 6; cancelled 664; draft 296 |
| Inter-company payments (`other_move_id` set) | 1,371 |
| Reconciliation | 25,771 `account_partial_reconcile` (102 with `amount_currency`), 20,449 `account_full_reconcile` |
| Accounts `account_account` | 851 across 6 companies (106 / 187 / 125 / 159 / 123 / 151); 8 receivable, 38 payable, 19 liquidity, 2 deprecated |
| Journals | 64 (general 24, bank 18, sale 10, purchase 6, cash 6); all 64 use `ir.sequence` **`no_gap`** with 490 date-range rows |
| Taxes | **13** (all `percent`, none price-included): 15 % (sale/purchase), 5 %, 10 % (purchase, inactive), 0 % |
| Fiscal positions | **0** |
| Bank statements / lines | **0 / 0** — bank reconciliation workflow is **not used** |
| Payment terms | 23 |
| Analytic accounts / lines / tags | 138 / 4,531 / 1 |
| Reconcile models | 1 |
| Fixed assets | 1,309 (`om_account_asset`) |
| Vouchers | 116 `att_account_voucher`, 173 `att_internal_voucher` |
| Progressive invoices | 3 `progressive.invoice`; 98 invoices flagged `is_progressive_invoice` |
| Lock dates | `period_lock_date` and `fiscalyear_lock_date` **NULL on all 6 companies** |
| Currencies | 10 active (SAR base + AED, BHD, CAD, CHF, EUR, GBP, INR, JPY, USD), 177 rate rows. Invoices: SAR 36,168 (99.2 %), USD 146, EUR 52, BHD 52, AED 28 |

### 2.2 Data-integrity probes (read-only SQL) **[V]**
* Unbalanced entries (|Σdebit − Σcredit| > 0.005): **0**.
* Posted entries with **no lines**: **5**.
* Entries whose journal is in a different company: **0**; entries with lines from >1 company: **0**.
* Non-draft invoices with null `number`: 0 (except `approved`: 5, which is expected before validation); invoices non-draft without `move_id`: 0 (`cancel` ones 27 and `draft`/`approved` 13 have none by design).
* 1 stock move dated before 2015 (min 2002-06-17) — data-quality anomaly.

---

## 3. Chart of accounts

* One chart template for all companies: *Saudi Arabia – Chart of Accounts* (`account_chart_template` id 1) — accounts are **copied per company** (851 rows), so the CoA is *per-company data*, not a shared master.
* Account types (`account_account_type`): Expenses 393, Current Assets 80, Fixed Assets 78, Current Liabilities 62, Income 54, Cost of Revenue 49, Payable 38, Other Income 34, Equity 25, Bank and Cash 19, Receivable 8, Current Year Earnings 6, Non-current Assets 5. `internal_type` values: receivable / payable / liquidity / other.
* Custom fields: `account.account.centralized` (`account_financial_report`), report-grouping flags (`account_reports`).
* Account groups: `account.group` with 4 custom fields (`account_financial_report`).

## 4. Journals **[V]**
64 journals; each company has the standard set (INV/BILL/MISC/EXCH/CABA/CSH1/BNK1) plus custom: `STJ` Stock Journal (every company), `ICT` Inter Company Transfer, extra sale journals for **cash vs credit** invoices (`DCH` "Cash Sale Invoices", `CRH` "Credit Sale Invoices", `LCR` "Credit Sale Invoice") and named banks (Riyad Bank, SIB). Custom journal fields: `cash_customer`, `credit_note_name` (`account_customization`); ZATCA fields (`l10n_sa_chain_sequence_id`, `l10n_sa_serial_number`, `l10n_sa_csr`, `l10n_sa_production_csid_*`, `l10n_sa_latest_submission_hash`, `l10n_sa_compliance_checks_passed`); `edi_format_ids`. **The journal drives numbering, ZATCA chain and cash/credit routing** — journals are not simple lookup data.

---

## 5. Business logic — how Odoo 12 behaves here

### 5.1 Invoice lifecycle
Standard: `draft → open → paid | cancel` (with `in_payment` in later 12.0 builds). **Customised** states (`account_customization/models/account_invoice.py:757`): `draft → to_approve → approved → open → in_payment → paid | cancel`. `get_is_final_approve` (line 804) computes whether the current user is the last approver using `request.approval.levels` (amount limit, level, company, effective date, group). `confirm_request` (≈ line 210) writes `to_approve/approved` and records `invoice.request.history`. `action_invoice_open` is overridden (line 785) to allow validation from `draft` **or `approved`** and to reject zero/negative totals.

### 5.2 Posting an invoice (`account/models/account_invoice.py`)
1. `action_invoice_open` (line 902) → `action_date_assign` → **`action_move_create`** (line 1179).
2. `action_move_create`: builds journal-item dicts through `invoice_line_move_line_get` (line 1077) and `tax_line_move_line_get`, calls `compute_invoice_totals` (line 1052) which converts each line to company currency (`currency._convert`), creates the **receivable/payable line** by the partner's account, then `account.move.create` and `move.post(invoice=self)`.
3. `account.move.post` (`account_move.py:285`) assigns the **sequence number** from the journal's sequence (`sequence_id` or `refund_sequence_id`), sets `state='posted'`, then `_post_validate` (line 354).
4. `action_move_create` writes `move_id`, `date`, `move_name` back to the invoice (`account_invoice.py:1262-1264`); `number` is a **stored related field** `move_id.name` (line 247). `invoice_validate` (line 1289) then writes `state='open'`. Payments later reconcile against the receivable/payable item.
5. **Custom overlay:** `action_move_create` is extended (line 836) to copy `project_details` to the move; `_prepare_refund` (line 844) carries project details; discounts via `account_customization` `_compute_amount` (line 1498) **replaces** standard totals: `amount_untaxed = Σ price_subtotal`, `line_discount = Σ round(discount_amount)`, `amount_tax = Σ round(tax_line.amount_total)` — a business-specific rounding rule that must be reproduced digit-for-digit.

### 5.3 Debit/credit validation
Standard `assert_balanced` (`account_move.py:377`) runs an SQL check `abs(Σdebit − Σcredit) > 10^-max(5, currency_decimals)` and raises *"Cannot create unbalanced journal entry"*; `_post_validate` also rejects lines from other companies. **In this system `account_payment_other_company/models/account_move.py` overrides `_post_validate` to `return self._check_lock_date()` only — i.e., the balance assertion and same-company check are bypassed for *all* moves.** [V]
Impact: the application layer no longer prevents unbalanced or cross-company entries. The probes in §2.2 show **0 unbalanced** and **0 cross-company** entries *today*, but that is empirical, not enforced. The Node.js implementation must enforce balance in the domain layer **and** ideally with a deferred DB constraint trigger. Lock dates are unset, so `_check_lock_date` provides no real protection.

### 5.4 Payments & reconciliation
* `account.payment.post` (`account_payment.py:589`) creates the payment move (liquidity ↔ receivable/payable), then reconciles with the invoice's open item (`invoice.register_payment`, `account_invoice.py:1012`).
* `account.move.line.reconcile` (`account_move.py:892`): matches debit and credit items per account/partner, creates **`account.partial.reconcile`** rows (amount in company currency and `amount_currency`), triggers **exchange-difference** entries (EXCH journal) when currency rates differ, and creates **`account.full.reconcile`** when residual reaches zero (`_compute_amount_residual`/`reconciled` flags on `account.move.line`; `_compute_residual` on invoice, line 105).
* 25,771 partials and 20,449 fulls exist; 102 partials with foreign-currency amounts. Residuals on `account_move_line` (`amount_residual`, `amount_residual_currency`) are **stored computed values** that must be migrated consistently.
* Custom: **inter-company payment** — `account_payment_other_company.create_move_other_company()` creates a second entry in another company's journal using `due_from_account_id`/`due_to_account_id`/`due_fromto_payment_journal_id` on `res.company`; 1,371 payments use it. **Voucher** documents (`att.account.voucher`, `att.internal.voucher`) with approval histories are a **parallel payment-request workflow**.

### 5.5 Taxes
* `account.tax` (`account.py:1007 _compute_amount`, `:1047 compute_all`): percent / fixed / group / division / python (`account_tax_python` available). Only **percent**, non-price-included taxes exist. `compute_all` handles rounding per line or per total (`round_globally` company setting), tax-on-tax, and tax-account split into base + tax lines; the result populates `account.invoice.tax` (34,844 rows) and invoice-line M2M `account_invoice_line_tax` (95,403 rows).
* Custom fields: `l10n_sa_is_retention`, `l10n_sa_exemption_reason_code` (ZATCA), `default` (`sale_custom`).
* Tax is **per company** (taxes 1,3,4,26,31 → company 5; 7,8,9,27 → company 7; 12,13,28 → company 9; 34 → company 12).

### 5.6 Currency conversion
`res.currency._convert` (`base/models/res_currency.py:188`) uses the rate at the invoice/entry date for the company; `round` honours `rounding` (0.01 for most, **JPY 1.0**). `currency_rate_inverted` adds an inverted-rate field. **Standard Odoo stores a rate per (currency, company, date)** with `rate` semantics "units of currency per base"; `res_currency_rate` has 177 rows, so most conversions use the nearest earlier date **[I]**.

### 5.7 Sequences
Every journal sequence is `no_gap` (PostgreSQL row-lock increment in `ir.sequence`, implemented with `SELECT … FOR UPDATE` semantics through `_next_do`), with 490 date-range sub-sequences and a separate refund sequence on some journals. Numbering is therefore **gapless and per-company/per-year**. ZATCA additionally needs a separate **chain index (ICV)** per journal (`l10n_sa_chain_sequence_id`) and the **previous-invoice hash (PIH)**.

### 5.8 Reversal and cancellation
* **Cancel invoice** (`action_invoice_cancel`, line 939 + custom override at `account_customization:161`): only if `journal.update_posted` is true (62 of 64 journals; the two exceptions are `ICT` journals ids 54 and 56) — it *cancels the move* and un-reconciles.
* **Refund / credit note**: wizard `account.invoice.refund` (`_prepare_refund`); `account.move.reversal` custom inherit exists. `account.move._reverse_move` swaps debit/credit; `auto_reverse` + cron "Account; Reverse entries" (daily).
* Posted ZATCA-reported invoices **must not be cancelled** under the regulation **[I]** — the target system needs a rule forcing credit/debit notes for reported invoices.

### 5.9 E-invoicing — ZATCA (already live) **[V]**
* `account.edi.document` 5,770 rows — all `sa_zatca`, all `sent`; `l10n_sa_api_mode`: **prod 5 companies, sandbox 1**.
* Invoice columns: `l10n_sa_uuid`, `l10n_sa_invoice_hash`, `l10n_sa_invoice_signature`, `l10n_sa_chain_index`, `l10n_sa_confirmation_datetime`, `l10n_sa_delivery_date`, `l10n_sa_qr_code_str`, `edi_state`, `edi_html_response`; plus Phase-1-style `qr_image`, `einv_sa_qr_code_str` (`att_account_qr_code`).
* Cron "EDI : Perform web services operations" (daily). Company holds the private key; journal holds CSR/CSID JSON.
* **Consequence:** the migration must not break the hash chain, UUID uniqueness, or signing identity. The XML builder (`account.edi.xml.ubl_21.zatca`), signing (XAdES), CSID onboarding and reporting/clearance calls are the highest-risk compliance items.

### 5.10 Reports
Custom/OCA reports: trial balance, general ledger, partner ledger, aged balance, tax report, VAT due report (Excel), cumulative reports, analytic reports, financial report builder. Odoo 12 `account.financial.report` is a **hierarchical definition** (parent/child, sign, domain on account types) that drives P&L/Balance Sheet. These reports are SQL/ORM aggregations over `account_move_line` (346 k rows) with company, date, partner, analytic filters — the **definitions, not just the numbers**, are what needs migration.

---

## 6. Accounting ↔ product/contact dependencies **[V]**
* `account.invoice.line.product_id → product.product`, `uom_id → uom.uom`, `account_id` derived from **product/category `ir.property`** (`property_account_income_id` 14 rows, `property_account_expense_id` 130 rows, plus stock accounts).
* `account.invoice.partner_id → res.partner`; receivable/payable account from partner `ir.property` (7 receivable + 21 payable property rows).
* `account.move.stock_move_id` → 32,176 entries from stock valuation.
* Contacts: customer/supplier flags, `vat`, ZATCA address/identification fields drive e-invoice XML.

---

## 7. Node.js + Express feasibility — accounting

| Area | Feasible? | Notes |
|---|---|---|
| Chart of accounts, journals, taxes, currencies, payment terms | **Yes** | Straightforward master data; journals carry numbering/ZATCA config |
| Posting engine (invoice → balanced entry) | **Yes, but not CRUD** | Must be a domain service executing in **one SQL transaction**: compute totals → generate lines → balance check → number allocation (`SELECT … FOR UPDATE`) → state change |
| Gapless sequences | **Yes** | Counter table per (journal, fiscal year) with row lock; same pattern as `no_gap` |
| Tax computation | **Yes** | Port `compute_all` semantics; use decimal arithmetic. Only 4 tax rates in use, so the surface is small — but rounding mode (per line vs global) and the **custom discount/rounding in `_compute_amount`** must match |
| Multi-currency & exchange differences | **Yes, with effort** | Needs rate lookup by date, company, rounding; exchange-difference entries on reconcile |
| Reconciliation (partial/full, residuals, FX diff) | **Yes, hardest standard part** | Implement as a dedicated reconciliation service; keep `amount_residual` consistent transactionally |
| Approval workflow | **Yes** | Workflow/guard service over `request.approval.levels` data |
| Inter-company payments, vouchers | **Yes** | Custom logic; clear specs needed |
| ZATCA Phase 2 | **Possible, high risk** | UBL 2.1 XML, canonicalisation, XAdES-BES signature, CSID lifecycle, PIH/ICV chain. Node has the crypto primitives; **legal/regulatory conformance testing** is the work. Option: keep Odoo ZATCA module running as an adapter during transition |
| Financial reports | **Yes** | Rebuild as SQL views / parameterised queries; verify against Odoo outputs line-by-line |
| Fixed assets (`om_account_asset`) | Possible | Depreciation board generation (monthly cron) — decide whether in scope **[U]** |
| Bank statement import/reconciliation | Not needed today | 0 statements |

### Risks specific to accounting
1. **Float arithmetic** — JS `number` is unsafe for money. Use `NUMERIC` in PostgreSQL and a decimal library in Node.
2. **Balance enforcement is currently absent** (§5.3) — migrate a *stricter* rule, but first investigate the 5 line-less posted entries and any intentional unbalanced use.
3. **Stored computed fields** (`amount_residual`, `reconciled`, invoice `residual`, `amount_total_signed`, `state='paid'`) must be recomputed identically; otherwise AR/AP ageing differs.
4. **Cutover during open items** — 9,903 open customer invoices + 1,232 open vendor bills + open payments/partial reconciliations.
5. **No lock dates set** — prior-period data can still change in Odoo until frozen; a migration cut-off requires an explicit freeze.
6. **Voucher/approval flows** are business-specific and not documented elsewhere.
7. **Cash vs credit invoice logic** is encoded across journal flags, company flags (`cash_invoice`, `credit_invoice`), partner flag `cash_customer` and context keys (`cash_customer`) in `default_get` — easy to lose.
8. **Arabic output**: amount-in-words in Arabic (`set_amt_in_arabic_words`, `amt_in_arabic_words`), bilingual PDFs.
