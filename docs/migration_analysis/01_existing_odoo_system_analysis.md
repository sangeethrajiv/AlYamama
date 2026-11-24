# 01 — Existing Odoo System Analysis

**Scope:** Technical feasibility analysis only. Nothing was implemented, modified or migrated.
**Audience:** Developers, team leads, project managers.
**Evidence date:** 2026-11-16.

> Legend: **[V]** = verified directly from source code or database. **[I]** = inferred (reasoned, not directly observed). **[U]** = unverified / not accessible.

---

## 1. What was actually accessible

| Resource | Access | Notes |
|---|---|---|
| Odoo core source (`TY-employee-odoo/odoo_server`) | **Read** | `odoo/release.py` → `version_info = (12, 0, 0, FINAL, 0)` **[V]** |
| Standard addons (`odoo_server/addons`, 284 dirs) | **Read** | Incl. `account`, `stock`, `stock_account`, `product`, `uom`, `l10n_sa`, `l10n_ae` |
| Custom addons — `TY-employee-odoo/custom_addons` (46 dirs) | **Read** | |
| Custom addons — `hydraulic_workshop_odoo/custom_addons` (44 dirs) | **Read** | Listed first in `addons_path`, so it wins on name clashes |
| Live PostgreSQL 17.9 on `localhost:5432`, DB `yamama_live_191126` (≈4 GB) | **Read-only** | Every session forced `default_transaction_read_only=on`. Only `SELECT` was issued |
| Dump `yamama_live_18_09_26_backup_before_muk_uninstall.dump` (1.6 GB, created 2026-11-04) | Header only (`pg_restore -l`) | **Not restored.** Not compared against the live DB **[U]** |
| `yamama.config` (Odoo server config) | **Read** | Credentials exist in plaintext. **Values are not reproduced in any report** |
| Running Odoo instance / UI | **Not used** | The Odoo server was not started; computed fields, onchanges and views were analysed from source, not executed |
| `odoo_to_node_migration_handover.md` | Read | Cross-checked against reality in §9 below |

Other databases on the same server (`gsp16_*`, `gpp_*`, `whizpot_live_sep2826`) were **not touched** — out of scope.

---

## 2. Platform facts

| Item | Value | Status |
|---|---|---|
| Odoo version | **12.0 Community** (Python 3) | [V] source + `ir_module_module.latest_version` = `12.0.x` |
| Database engine | **PostgreSQL** (server 17.9) | [V] — *not* MariaDB (the handover mentions both) |
| Database size | ≈ 4,042 MB; 836 public tables; 677 `ir_model` rows (615 non-`ir.*`); 3,327 FKs; 9 views; 1 SQL function | [V] |
| Largest tables | `helpdesk_ticket` 1.9 GB (attachments inline), `mail_message` 679 MB (1.10 M rows), `mail_tracking_value` 298 MB, `account_move_line` 116 MB (346 k rows), `account_invoice` 107 MB (36 k rows) | [V] |
| File storage | 125,351 attachments, ≈ 9.3 GB, all `type=binary` (filestore location in config is under another user's home → **filestore not accessible** **[U]**) | [V]/[U] |
| Languages active | `en_US` only. Arabic data is held in **separate custom fields** (`arabic_name`, `vat_arabic`, …), not in translations | [V] |
| Companies | 6 (`res_company`): 1 parent + 5 children (see doc 02) | [V] |
| Server mode | `workers = 0`, `proxy_mode = True`, `list_db = True`, `dbfilter` unset, `cors_origins = *` | [V] — hardening concerns noted in doc 08 |
| Odoo 12 support status | Odoo 12 is no longer a supported Odoo release | [I] (general knowledge) |

---

## 3. Module inventory

132 modules `installed` (253 `uninstalled`, 27 `uninstallable`).

| Origin | Count | Examples |
|---|---:|---|
| Standard Odoo 12 (present in `odoo_server/addons` or `odoo/addons`) | 70 (69 + `base`) | `account`, `stock`, `stock_account`, `product`, `purchase`, `sale`, `mrp`, `l10n_sa`, `hr*`, `crm` |
| Custom / OCA / third-party | 62 | listed below |

### 3.1 Custom modules relevant to the three target areas

| Module | Origin | What it touches | Python LOC |
|---|---|---|---:|
| `create_user_wizard` | Apps Team | User creation, category→group mapping, mass group update | – |
| `request_approval_levels` | Apps Team | Amount-limit approval levels by company/group/type; extends `res.groups` | – |
| `att_multi_company_customers` | Apps Team | Rewrites `base.res_partner_rule` (partner visibility) | – |
| `api_configuration`, `api_connection` | Apps Team | Mobile/external HTTP API, token stored on `res.users` | 2,641 / 6,723 |
| `account_customization` | Apps Team | `account.invoice` approval workflow, discounts, Arabic amount-in-words, cash/credit invoice flags, bank details | 2,178 |
| `att_progressive_invoicing` | Apps Team | `progressive.invoice` (blanket PO) linked to invoices | – |
| `att_account_qr_code`, `att_qr_code_base` | Apps Team | Invoice QR (`qr_image`, `einv_sa_qr_code_str`) — ZATCA Phase 1 style | – |
| `account_edi`, `account_edi_ubl_cii`, `l10n_sa_edi` | Manifest says "Odoo S.A."/"Odoo" at `12.0.x`, but **not in Odoo 12's standard addons dir** → backports/copies **[I]** | ZATCA **Phase 2** e-invoicing (UUID, hash chain, signature, CSID, `account.edi.document`) | 2,159 / 3,761 / 2,712 |
| `account_voucher_extension` | Manifest "Odoo S.A." but custom name **[I]** | `att.account.voucher` (Payable Voucher), `att.internal.voucher` + approval histories | 1,001 |
| `account_payment_other_company` | OCA (Open Source Integrators) | Inter-company payments; **overrides `account.move._post_validate`** (see doc 03) | 359 |
| `account_reports`, `account_reports_excel`, `account_financial_report` (OCA), `cumulative_reports`, `att_analytic_reports`, `vat_due_report_excel` | Apps Team / OCA | Custom financial reports (GL, partner ledger, trial balance, tax/VAT) | 1,629 / 1,395 / 7,813 / 1,049 / 851 / – |
| `currency_rate_inverted` | OCA | `res.currency.currency_rate_inverted` | – |
| `om_account_asset` | Odoo Mates | Fixed assets (1,309 `account_asset_asset` rows) | 1,009 |
| `asset_management_extended`, `att_asset_project_delivery_custom` | Apps Team | Asset rental, project delivery | 859 / 431 |
| `stock_customization` | Apps Team | `product.main.head`, `att.product.type/subtype` | 378 |
| `stock_force_date` | Apps Team | Back-dating of stock pickings and their journal entries | – |
| `landedcost_custom` | OCA-derived | Landed cost on vendor invoices | 454 |
| `delivery_order_custom` | Apps Team | `delivery.order`, `direct.delivery.order`, `product.lot.track` | 3,391 |
| `att_product_tracking` | Apps Team | Auto lot numbering on receipts | – |
| `att_customer_pricelist` | Apps Team | Per-customer price fields | 1,097 |
| `product_ageing_report`, `att_inventory_consumption_report` | Apps Team | Stock reports/wizards | 649 / 387 |
| `sale_custom`, `purchase_custom`, `purchase_custom_data`, `purchase_request` | Apps Team / OCA | Extra partner/product/tax fields, purchase approval | 3,121 / 732 / – / 3,182 |
| `subscription_management`, `att_vehicle_sync`, `att_installation_request`, `att_helpdesk`, `crm*`, `hr*`, `oh_hr_zk_attendance` | Apps Team / others | **Out of scope** (vehicle telematics, helpdesk, CRM, HR) — only their cross-links to scope areas are noted | – |

`vat_due_report_excel` exists in **both** custom addon folders; only one is loaded (the `hydraulic_workshop_odoo` copy wins by `addons_path` order) **[V]** — confirm which one is the intended source of truth.

### 3.2 Fields added by custom modules to core models in scope (counts per module, DB-verified)

| Core model | Custom fields (module → count) |
|---|---|
| `account.invoice` | `account_customization` 29, `subscription_management` 17, `att_installation_request` 13, `account_edi` 9, `l10n_sa_edi` 9, `att_account_qr_code` 5, others 1–2 → **110 columns total** on `account_invoice` |
| `account.invoice.line` | `subscription_management` 23, `account_customization` 10, `om_account_asset` 4 |
| `account.journal` | `l10n_sa_edi` 10, `account_edi` 2, `account_customization` 2 |
| `account.tax` | `l10n_sa_edi` 3, `sale_custom` 1 |
| `account.payment` | `account_payment_other_company` 3, `account_customization` 1 |
| `res.company` | `l10n_sa_edi` 8, `hr_attendance_custom` 5, `account_customization` 5, … |
| `res.partner` | `sale_custom` 10, `l10n_sa_edi` 6, `att_vehicle_sync` 4, … |
| `res.users` | `att_helpdesk` 3, `api_configuration` 2, `muk_web_theme` 2, `account_customization` 1, `purchase_request` 1, … |
| `product.template` | `sale_custom` 4, `purchase_custom` 2, `om_account_asset` 2, `crm_customization` 2, `stock_customization` 1, … |
| `stock.picking` | `landedcost_custom` 3, `stock_force_date` 1, `delivery_order_custom` 1, `att_asset_project_delivery_custom` 1 |

Full field names are listed in docs 02–04.

---

## 4. Data volume snapshot (live DB)

| Area | Table | Rows |
|---|---|---:|
| Users | `res_users` (84 active of 97) | 97 |
| Contacts | `res_partner` (6,069 active) | 6,136 |
| Accounting | `account_account` | 851 |
| | `account_journal` | 64 |
| | `account_invoice` / `account_invoice_line` | 36,454 / 101,023 |
| | `account_move` / `account_move_line` | 118,858 / 346,169 |
| | `account_payment` | 21,839 |
| | `account_partial_reconcile` / `account_full_reconcile` | 25,771 / 20,449 |
| | `account_tax` / `account_fiscal_position` | 13 / **0** |
| | `account_bank_statement(_line)` | **0 / 0** |
| | `account_edi_document` (all `sa_zatca`, all `sent`) | 5,770 |
| | `account_asset_asset` | 1,309 |
| Products | `product_template` = `product_product` | 20,327 (1:1) |
| | `product_category` | 121 |
| | `product_supplierinfo` | 2,412 |
| | `uom_uom` | 48 |
| | `product_attribute` / `_value` | **0 / 0** |
| Inventory | `stock_move` / `stock_move_line` | 34,534 / 35,253 |
| | `stock_quant` | 19,021 |
| | `stock_picking` | 9,049 |
| | `stock_production_lot` | 10,900 |
| | `stock_warehouse` / `stock_location` | 6 / 64 |
| | `stock_inventory` (adjustments) | 498 |
| | `stock_landed_cost` | 77 |

---

## 5. Standard vs. custom behaviour — summary

| Capability | Standard Odoo 12 | Custom/changed in this system |
|---|---|---|
| Invoice model | `account.invoice` (+ generated `account.move`) | + approval states, discounts, progressive invoicing, ZATCA fields, subscription/maintenance fields |
| Invoice states | `draft → open → paid/cancel` (+`in_payment`) | + `to_approve`, `approved` (`account_customization/models/account_invoice.py:757`) |
| Journal-entry balance check | `assert_balanced()` in `_post_validate` | **Disabled** by `account_payment_other_company` (doc 03) |
| Partner visibility rule | `base.res_partner_rule` | Rewritten by `att_multi_company_customers` |
| User creation | Settings → Users | + wizard with 14 "user categories" mapping to group sets |
| Approvals | none | `request.approval.levels` (82 rows) for PO, PR, vouchers, invoices |
| E-invoicing | none in Odoo 12 | ZATCA Phase 2 backport, live in production mode on 5 companies, sandbox on 1 |
| Stock valuation | `stock_account` | + `stock_force_date` back-dating; `landedcost_custom` |

---

## 6. Dependencies between the three target areas (preview — detail in doc 07)

* `account.invoice` ↔ `res.partner` ↔ `res.company` ↔ `product.product` (invoice lines).
* `account.move` ← `stock.move` (`account_move.stock_move_id`): **32,176 of 118,858 journal entries (27 %) originate from stock moves** **[V]**. Inventory valuation is therefore inseparable from accounting.
* `ir_property` (company-dependent fields) links partner, product and category to accounts: 87 categories carry `property_cost_method = fifo`, 85 carry `property_valuation = real_time`, 17,385 product rows carry a `standard_price` property.

---

## 7. What was NOT verified

* Runtime behaviour of computed/onchange methods (server not started).
* QWeb reports and XML views (counted: 2,059 views, 80 report definitions, 658 window actions) — not individually reviewed.
* The ZATCA private key / CSID values were **deliberately not read** (stored in `res_company.l10n_sa_private_key` and `account_journal.l10n_sa_*_csid_json`).
* Whether the `.dump` file and the live database are identical.
* Filestore contents (path not accessible).
* Out-of-scope modules (HR, CRM, helpdesk, vehicle sync) beyond cross-links.

---

## 8. Immediate corrections to the handover document

The handover file was written from a generic/newer-Odoo mental model. Items that **do not match the actual system** **[V]**:

| Handover statement | Actual system |
|---|---|
| Invoices are `account.move` with `state = 'posted'` | Invoices are **`account.invoice`**; states `draft/to_approve/approved/open/in_payment/paid/cancel`. `account.move` has only `draft/posted` and is the *accounting entry* |
| Partner flags `customer_rank > 0` / `supplier_rank > 0` | Odoo 12 uses booleans **`customer` / `supplier`** (4,207 customer-only, 1,714 supplier-only, 48 both) |
| `account.payable` / `account.receivable` | These are account **types** (`account_account_type.type`), not models |
| "Cash invoices via Point of Sale" | `point_of_sale` is **not installed**. Cash invoices are separate sale journals (e.g., `DCH` "Cash Sale Invoices") with `cash_customer` / `cash_invoice` flags |
| "PostgreSQL / MariaDB" | PostgreSQL only |
| Fiscal positions, bank statements, reconciliation models in use | `account_fiscal_position` = 0 rows, `account_bank_statement` = 0 rows, 1 reconcile model |
| ZATCA Phase 1 *and* Phase 2 "if handled in Node" | **Phase 2 is already live** in Odoo (5,770 invoices `sent`) — it must be preserved, not added |
| Approval flow `to_approve → approved` described as vendor-bill specific | The code (`account_customization/models/account_invoice.py`) is **not restricted by invoice type**; 6 approval levels exist for `account.invoice`. In the data, the only non-standard states present are 5 `approved` **vendor bills** (0 `to_approve` right now). Whether customer invoices use it is **[U]** — confirm with the business |
| Audit field `create_uid`, `write_uid`, etc. | Correct for Odoo 12 |
| `type='product'/'consu'/'service'` | Correct for Odoo 12 |
