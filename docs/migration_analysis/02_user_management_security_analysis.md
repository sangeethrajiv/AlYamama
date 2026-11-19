# 02 — User Management & Access Control Analysis

> Legend: **[V]** verified from source/DB · **[I]** inferred · **[U]** unverified.
> No credentials or password values are reproduced. Password checks returned **counts only**.

---

## 1. Actual data model

### 1.1 Tables and volumes

| Odoo model | Table | Rows | Notes |
|---|---|---:|---|
| `res.users` | `res_users` | 97 (84 active, 13 inactive) | 94 internal, 3 `share=true` (portal/public) |
| `res.partner` | `res_partner` | 6,136 (6,069 active) | users link via `res_users.partner_id`; **no partner is shared by 2 users** |
| `res.company` | `res_company` | 6 | |
| `res.groups` | `res_groups` | 139 | 38 of them are in category "Technical Settings" (feature toggles, not roles) |
| user↔group | `res_groups_users_rel` | 2,339 | |
| group inheritance | `res_groups_implied_rel` | 86 rows / 65 groups | Odoo 12 name (not `group_implied_rel`) |
| `ir.model.access` | `ir_model_access` | 1,025 (all active) | |
| `ir.rule` | `ir_rule` | 229 (220 active) | |
| allowed companies | `res_company_users_rel` | 144 | |
| login log | `res_users_log` | 54 rows (2021-11 → 2026-11) | |
| `ir.model` | `ir_model` | 677 | |

### 1.2 `res.users` columns (Odoo 12 + custom) **[V]**

Core: `id, active, login, password, company_id, partner_id, signature, action_id, share, alias_id, notification_type, odoobot_state, sale_team_id, target_sales_*, create/write uid/date`.
Custom/added: `token_name`, `device_reg_id` (`api_configuration` — mobile API token & FCM device id), `user_signature` (binary, `account_customization`), `sidebar_type`, `chatter_position` (`muk_web_theme`), `helpdesk_target_*` (`att_helpdesk`), `website_id`; M2M/O2M fields `user_department_ids` (`purchase_request`), `lead_sale_team_ids` (`crm_customization`), `location_info` (`api_connection`).

There is **no** `password_crypt` column and `auth_crypt` is not installed: Odoo 12 `base` stores the PBKDF2 hash directly in `res_users.password`.

### 1.3 `res.partner` (contact) fields relevant to accounting **[V]**

Odoo 12 booleans `customer`, `supplier`, `employee` (no `customer_rank`). Hierarchy via `parent_id` (1,754 children) and `commercial_partner_id`; `is_company` = 3,690. Credit/debit limits `credit_limit`, `debit_limit`. Custom (`sale_custom`): `arabic_name`, `arabic_city_name`, `arabic_street2_name`, `vat_arabic`, `cash_customer`, `cr_number`, `customer_code`, `discount`, `fax`, `vandor_number`. ZATCA (`l10n_sa_edi`): `l10n_sa_registered_name`, `l10n_sa_edi_building_number`, `l10n_sa_edi_plot_identification`, `l10n_sa_additional_identification_scheme/number`, `country_code`. Also `customer_discount` (`att_customer_pricelist`), `company_name_code`, `wasl_status`, `ext_res_id` (vehicle sync).

`property_account_receivable_id`, `property_account_payable_id`, `property_payment_term_id`, `property_account_position_id` are **company-dependent `ir.property` fields**, not columns (see §4.4).

### 1.4 Companies **[V]**

| id | Name | Parent | Active users with this *default* company |
|---:|---|---|---:|
| 1 | Flames of Al Yamama Trading Co | – | 1 |
| 5 | Flames of Al-Yamama Hydraulic Co | 1 | 48 |
| 6 | Flames of Al Yamama Agriculture Co | 1 | 0 |
| 7 | Team Yamama | 1 | 32 |
| 9 | Al Yamama Advanced Logistics Services Co | 1 | 3 |
| 12 | Corporate | 1 | 0 |

All six use the same currency (id 153, **SAR**) and chart template `Saudi Arabia - Chart of Accounts`. Allowed-company distribution: 85 users have 1 company, 2 have 2, 1 has 3, 2 have 5, 7 have 6. **11 active users can switch among >1 company.** 82 active users hold `base.group_multi_company`.

---

## 2. Workflows

### 2.1 User creation / editing (standard + custom)
* **Standard:** Settings → Users (`res.users` form). Creating a user auto-creates a `res.partner` (`_inherits`).
* **Custom (`create_user_wizard`):** wizard `create.user.wizard` (fields: company, `user_type` → `user.category.master`, name, email, login, password, `open_user`, `disable_user`), plus `upgrade.user.permission` and `mass.user.group.update`. A **user category** is a named set of groups (`user_category_user_group_rel`). 14 categories exist: Employees; Salesman (Own Documents / Quotation Only / All Documents / Manager); Accounting (Billing / Manager); Direct Stock Out; Purchase Request (User / HOD / CEO); Purchase Order (User / HOD / CEO). **Permissions are assigned by category → group set, not by direct group editing.** This is the real RBAC model the Node.js team must replicate.
* Groups created by this module: `create_user_wizard` Manager (1 member), User (4).

### 2.2 Authentication **[V]**
* Web login: `res.users.authenticate` / `_check_credentials` (`odoo/addons/base/models/res_users.py:289`). Hash: `pbkdf2_sha512` via `passlib` (`DEFAULT_CRYPT_CONTEXT`, line 31). The context also lists `plaintext` for legacy upgrade.
* Password state in DB (counts only): **69 users with PBKDF2 hashes, 28 with empty password, 0 plaintext.** The 28 empty are accounts that cannot log in with a password (inactive/portal/system) — exact breakdown **[U]**.
* `auth_signup` is installed (invite/reset-by-email flow with `signup_token`, `signup_expiration` on `res_partner`).
* **Custom mobile/API authentication** (`api_connection/controllers/main.py`): `POST /api/authenticate` (`auth="none"`, `csrf=False`) calls `common.authenticate(DB, username, password)`, then writes a generated **`token_name`** into `res_users` and stores `device_reg_id` (FCM). 52 `@route` endpoints in that controller; subsequent calls pass `user_id` in the request params (e.g., lines 252, 319, 388 …) **[V]**. `api_configuration` adds more (`/api/list_of_approvals`, `/api/EmployeeList`, `/api/CreateAttachment`).
  * The Odoo config also contains `api_user_id`, `api_url`, `api_user_password` keys — some integration with an external service exists **[I]**; its identity is **[U]**.

### 2.3 Groups, implied groups
* 86 implied relations; e.g., group inheritance chain Accounting *Billing* → *Adviser* (`account.group_account_invoice` → `account_user` → `account_manager`) is standard.
* Most-held groups (active+inactive): `Tax display B2B` 97, plus 38 feature-toggle groups (e.g., *Manage Pricelist Items*, *Manage Lots/Serial Numbers*, *Multi Currencies*, *Technical Features*) held by ~94 users. **These are UI feature flags implied by `base.group_user`, not roles** — do not model them as roles in Node.
* Role-like groups, active members: `account.group_account_invoice` 24, `account_user` 16, `account_manager` 11, `stock.group_stock_user` 22, `stock_manager` 11, `purchase_user` 43, `purchase_manager` 30, `sale_salesman` 34, `sale_manager` 13, `base.group_system` 6, `base.group_erp_manager` 6, `base.group_portal` 1.
* Custom role groups: Payable Voucher (User 8 / HOD 0 / CEO 0), Internal Voucher (User 6 / HOD 0 / CEO 0), Purchase Order (User 15, HOD 4, CEO 2, RFQ Create 5, Account Manager 4, Initial Approval 1) + `Initial Approval` 3, `Final Approval` 2, `Direct Delivery User` 5, `View Cumulative Account Reports` 4, `Analytic Account: Read Only` 1.

### 2.4 Model-level CRUD — `ir.model.access`
1,025 rows; 82 have **no group** (apply to everyone). Permission-pattern distribution (R W C D): `1111` 523, `1000` 357, `1110` 95, `1100` 20, `1010` 13, `1101` 5, `1001` 1, `0000` 11. Rows by model prefix: `account` 142, `product` 102, `stock` 89, `ir` 65, `res` 56, `att` 50 …
Semantics **[V]** (Odoo 12 core): access is the **union** across the user's groups — if *any* group (or a group-less row) grants the permission, it is allowed. A model with *no* ACL rows is open to all; this behaviour must be replicated deliberately.

### 2.5 Record-level — `ir.rule`
229 rules (220 active): **121 global** (no group) and 108 group-scoped. Semantics: global rules are combined with **AND**; group rules are combined with **OR**, and the result is ANDed with globals. Rule pattern census:

| Pattern | Count |
|---|---:|
| Domain references company (`child_of [user.company_id.id]` etc.) | 128 |
| References `user.id` (ownership) | 38 |
| References `state` | 5 |
| References `company_ids` (only `res.users` rules) | 2 |

Rules by module: base 20, account 16, att_installation_request 15, sale 13, hr_holidays 13, purchase_request 12, stock 11, hr_custom 10, employee_document_management 9, sale_custom 9, subscription_management 7, … (46 modules contribute rules).

Examples in scope **[V]**:
* `account.invoice` — *Invoice multi-company*; *Portal Personal Account Invoices* `[('message_partner_ids','child_of',[user.commercial_partner_id.id])]` (relies on **follower** records).
* `account.move`/`account.move.line` — multi-company.
* `stock.picking.type` — `['|', ('warehouse_id','=',False), '|', ('warehouse_id.company_id','=',False), ...child_of...]` (traverses a relation).
* `product.template` — `['|',('company_id','=',user.company_id.id),('company_id','=',False)]` (**exact match, not `child_of`**), while most others use `child_of`.
* `product.template` — *Teltonika Products Only in Sale Quotation Lines* `[('is_teltonika_product','=',True)]` (a business-flag rule).
* `res.partner` — `['|','|',('partner_share','=',False),('company_id','child_of',[user.company_id.id]),('company_id','=',False)]`, **rewritten by `att_multi_company_customers`**; plus private-address rules by `type`.
* `res.users` — `['|',('id','=',1),('company_ids','child_of',[user.company_id.id])]`.
* `purchase.request` — rules by requester, by HOD department (`user.user_department_ids.ids`), and follower.

### 2.6 Multi-company semantics (important and non-obvious)
* Odoo 12 rules use **`user.company_id`** (the *currently selected* company), **not** `user.company_ids`. Switching company in the UI changes `user.company_id`; rule results change accordingly.
* All five operating companies are **children of company 1**; rules use `child_of`. Therefore a user whose **active company is 1** sees all child companies' records. Only 1 active user defaults to company 1 today **[V]**, but any user who switches to company 1 sees everything. This is *emergent behaviour* the new system must either replicate on purpose or replace with an explicit rule.
* `product.template` and `product.pricelist` rules use equality, so a company-1 user does **not** see child-company products via that rule.
* `res.partner` visibility: 245 partners have `company_id` NULL (shared); 3,254 belong to company 5, 2,476 to company 7, 146 to 9, 4 to 6, 4 to 12, 7 to 1. Because the rule exempts `partner_share = false` partners, partners of internal users are always visible.
* `account.payment` supports inter-company payments (`account_payment_other_company`: 1,371 payments have `other_move_id`) with Due-From/Due-To accounts on `res.company` — cross-company accounting writes happen in **one** transaction under elevated rights **[I]** (standard OCA module uses `sudo`).

### 2.7 Field-, view- and menu-level security
* 301 of 568 `ir.ui.menu` records are group-restricted; 41 `ir.ui.view` group relations. `ir_model_fields_group_rel` has 0 field-level group restrictions in the DB (Python-declared `groups=` attributes are **not** persisted there and were not enumerated) **[U]**.
* Wizards and buttons rely on `groups="…"` in XML views — these become Angular route guards/directives (doc 05).

### 2.8 Active/inactive, administrator
* `active=false` users: 13. `res_users.active` is honored in `res.users.authenticate`.
* Super-user: uid 1 bypasses ACL and record rules (`base.group_system` + `SUPERUSER_ID`). Python code calls `sudo()` extensively (standard and custom); the effective permission model in Odoo is "ACL/rules **plus** every `sudo()`".
* `base.group_system` has 6 active members, `base.group_erp_manager` 6.

---

## 3. Node.js + Express migration analysis

### 3.1 Recommended approach
| Concern | Recommendation | Reason |
|---|---|---|
| Authentication | Short-lived **JWT access token** (≈ minutes) + **rotating refresh token** in `HttpOnly; Secure; SameSite` cookie. Server-side session store (PostgreSQL/Redis) for revocation | Needed for web + the existing mobile app; revocation required because Odoo currently has a static per-user mobile token |
| Password hashes | Import PBKDF2-SHA512 hashes **as-is** (`passlib` format `$pbkdf2-sha512$rounds$salt$hash`, ab64 encoding), verify with a compatible library, **re-hash to argon2id on first successful login** | Avoids forced reset for 69 accounts. Format compatibility **[U]** — must be tested with real hashes in a secure sandbox |
| Mobile API | Re-issue tokens via standard login/refresh; keep legacy `/api/authenticate` shape behind an adapter until mobile app is updated | `device_reg_id` + `token_name` are already stored per user |
| Authorization model | **Permission-based** (`resource:action`), roles = bundles of permissions, plus **policy layer** for record scope | Odoo's ACL maps to permissions; rules do not map to roles |
| Role definitions | Seed from the 14 `user.category.master` categories + the ~30 real role groups. Do **not** import the 38 "Technical Settings" feature groups as roles — convert to feature flags | Keeps role count small |
| Company scoping | `company_id` injected from the request context (active company claim + allowed list) and applied by the repository layer | Mirrors `user.company_id` semantics but makes it explicit |
| Middleware order | `requestId → authn → companyContext → authzPermission → handler → repository(policy-scope) → audit` | Central, testable, reusable by all modules |
| Audit | Re-implement `create_uid/write_uid/create_date/write_date` and chatter-style tracking (`mail_tracking_value` has 1.8 M rows) via an audit/event table | Odoo's tracked changes are a compliance expectation in finance |

### 3.2 What maps cleanly to RBAC
* Model-level ACLs with fixed groups (`ir.model.access`, 1,025 rows) → permission matrix export.
* Group membership and group inheritance (`implied_ids`) → role composition.
* User categories → role templates.
* Menu/button visibility → permission-check directives on the Angular side (UI only; **server must enforce**).

### 3.3 What does **not** map to simple RBAC
| Odoo feature | Why | Proposed handling |
|---|---|---|
| Domain-based `ir.rule` (229) with `user`, `time`, relation traversal, `child_of`, `in`, `|`/`&` operators | Row filter is an expression over *data*, not a role | Build a **policy engine**: translate each rule into a typed query predicate (SQL fragment / ORM scope). Keep a rule-by-rule test matrix |
| Global vs group rules (AND vs OR combination) | Non-trivial composition | Implement exactly the Odoo 12 algorithm; unit-test with sampled users |
| Follower-based access (`message_partner_ids`) for portal/PR | Access depends on collaboration data | Need a followers table in the new design or replace with explicit ACL |
| Approval-level authorization (`request.approval.levels`: 82 rows by company, group, amount limit, effective date, type) | Authorization depends on **amount + date + company + level order** | Model as an **approval service** (workflow definition + guard), not a role |
| `sudo()` calls and `with_context(allowed_company_ids)` in Python | Implicit privilege escalation | Inventory each `sudo()` in the migrated workflows; encode as explicit "system actor" commands with audit |
| Computed-field visibility via `groups=` on fields | Field-level read masking | Response DTO shaping per permission |
| Portal users reading their own invoices/POs | Record scope by commercial partner | Separate scope: `partner_scope = commercial_partner_id` |
| Record rules protecting state (e.g., 5 rules mention `state`) | Business rule rather than security | Move into domain service state machine |
| Company rewrites by custom module (partner visibility) | Behaviour differs from standard | Replicate the **modified** rule, not Odoo's default |

### 3.4 Security risks and difficulties
| # | Risk | Evidence |
|---|---|---|
| 1 | **Unauthenticated-style endpoints**: 117 `auth="none"` routes across custom code (some in non-installed modules); installed: `att_vehicle_sync` 16, `att_installation_request` 4, `att_helpdesk` 4, `api_connection` 52, `api_configuration` ≥3. The `api_connection` handlers trust a client-supplied `user_id` after token check | [V] routes; trust pattern [I] — verify before copying behaviour |
| 2 | Static, non-expiring mobile token in `res_users.token_name` | [V] field exists; expiry logic **[U]** |
| 3 | Sensitive material in DB: ZATCA private key (`res_company.l10n_sa_private_key`), CSID JSON (`account_journal`) | [V] — need secret management (KMS/Vault) in target |
| 4 | Config hardening: `list_db=True`, `cors_origins=*`, plaintext DB/SMTP/API credentials in `yamama.config`, `admin_passwd` set | [V] — rotate credentials after the handover; do not copy into the new project |
| 5 | Cross-company leakage via `child_of` and company-1 | see §2.6 |
| 6 | Over-broad group-less ACLs (82 rows) | [V] — review each in the matrix |
| 7 | Role explosion if all 139 groups are imported | [I] |
| 8 | Loss of tracked changes (chatter) = audit gap | 1.1 M `mail_message`, 1.8 M tracking rows |
| 9 | 13 inactive and 28 password-less users — risk of reactivating stale accounts at import | [V] |

### 3.5 Deliverables to produce *before* Milestone 2 (analysis artefacts, not code)
1. **Access Control Matrix** export: `(group, model, R/W/C/D)` from `ir_model_access` joined with membership counts.
2. **Rule register**: all 229 rules with domain, groups, perms, owning module, and a classification (company / ownership / state / portal / business flag).
3. **Role catalogue**: 14 categories × groups.
4. **`sudo()` inventory** for in-scope workflows.
5. **User reconciliation list**: 97 users → keep / merge / retire.
