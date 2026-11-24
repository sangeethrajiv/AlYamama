# 13 - Contact Master: Source-Verified Base `res.partner` Field Specification

> **Audience:** Node.js backend team (DB mapping) and Angular team (Contact List / Contact form).
> **Type:** analysis + read-only list query. No Odoo model, database schema, field or data was changed. DB access was read-only.
> **Odoo version:** **12.0** (`TY-employee-odoo/odoo_server/odoo/release.py` -> `version_info = (12, 0, 0, FINAL, 0, '')`).
> **Database inspected:** `yamama_live_191126` (`base` 12.0.1.3 installed).
> **Files:** `13_contact_master_fields.md` (this), `13_contact_master_fields.csv` (all 56 fields, machine-readable), `13_contact_master_list.sql` (the Contact Master list query).
> Complements `12_user_management_fields.md` (which covers `res.users`; its section 2 lists the same base partner fields in a user context).

## 0. Read this first - the brief assumed a newer Odoo

The brief's example field list matches Odoo 15-17. This system is **Odoo 12**, so the model is different. Nothing below was assumed from the examples; every field was taken from the source and checked against the DB.

| Example in the brief | Reality in Odoo 12 |
|---|---|
| `complete_name` | **Does not exist.** The full name is `display_name` (stored computed). |
| `image_1920`, `image_1024`, `image_512`, `image_256`, `image_128` | **Do not exist.** Odoo 12 has `image` (1024px), `image_medium` (128px), `image_small` (64px). |
| `customer_rank`, `supplier_rank` | **Do not exist.** Odoo 12 base declares booleans `customer` and `supplier`. |
| `industry_id` listed as an *exclusion* | In Odoo 12 it is declared **in base** (`res_partner.py:204`, model `res.partner.industry` is also base). Not inherited -> **included**. |
| `credit`, `debit`, `total_invoiced`, `invoice_ids`, `sale_order_count`, `purchase_order_count`, `property_*` | Correctly excluded: all are declared by `account` / `sale` / `purchase` / `product` / `stock`, not base. |
| `comment` (Notes) | Included (base). |
| `title`, `user_id`, `category_id`, `parent_id`, `child_ids` | Present in base as the brief expected. `user_id` is labelled **Salesperson**. |

## 1. How base fields were distinguished from inherited fields

| Check | Result |
|---|---|
| Parsed `class Partner` in `odoo/addons/base/models/res_partner.py` (AST, not regex) | **50** field declarations |
| Searched all of `odoo/addons/base` for other `_inherit = 'res.partner'` | **None** - no other base file extends the model; the `format.address.mixin` it inherits declares no fields |
| Live DB `ir_model_fields` for `res.partner` | 159 rows = 56 base + **103 from other modules** |
| Field ownership via `ir_model_data` (`module` of the **first** xmlid per field record) | **56 rows have `base` as first owner**; this equals the 50 source fields + 6 ORM magic fields (`id`, `create_*`, `write_*`, `__last_update`). **Exact match, none missing, none extra** |
| Source reflection: `required` | No base field is ORM-required (matches DB); `name` is only guarded by SQL CHECK `res_partner_check_name` |
| Why not just filter `ir_model_fields`? | It mixes base, 24 other modules and custom code. Ownership had to come from `ir_model_data` + source, as required |
| Fields that *other* modules re-declare (same field, changed attributes) | 13 base fields also list another module as owner: `name email phone mobile street street2 city zip state_id country_id vat` (`att_vehicle_sync`: only `track_visibility='onchange'`), `tz` (`create_user_wizard`: different default), `type` (`att_vehicle_sync`, `att_installation_request`: `selection_add`). They stay **base fields**; the changes are listed in section 5 |

## 2. Original base `res.partner` fields (all 56)

Legend - **RO** = readonly in field metadata. **Stored** = persisted by the ORM (column, M2M table or attachment). `-` = none. Group = logical grouping for the Contact screen only.

| # | Field | Label | Type -> Relation | RO | Stored | Group | Storage | Compute / related | Default |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `id` | ID | integer | Yes | Yes | System | DB column res_partner.id (PK) | - | - |
| 2 | `name` | Name | char | No | Yes | Identity | DB column res_partner.name | - | - |
| 3 | `display_name` | Display Name | char | Yes | Yes | Identity | DB column res_partner.display_name (stored computed) | compute _compute_display_name; depends is_company, name, parent_id.name, type, company_name | - |
| 4 | `company_type` | Company Type | selection | No | No | Classification | Not stored - computed/inverse | compute _compute_company_type; inverse _write_company_type (maps is_company) | - |
| 5 | `is_company` | Is a Company | boolean | No | Yes | Classification | DB column res_partner.is_company | - | False |
| 6 | `type` | Address Type | selection | No | Yes | Classification | DB column res_partner.type | - | 'contact' |
| 7 | `title` | Title | many2one -> res.partner.title | No | Yes | Identity | DB column res_partner.title (FK res_partner_title) | - | - |
| 8 | `function` | Job Position | char | No | Yes | Identity | DB column res_partner.function | - | - |
| 9 | `parent_id` | Related Company | many2one -> res.partner | No | Yes | Hierarchy | DB column res_partner.parent_id (FK res_partner, ON DELETE SET NULL) | - | - |
| 10 | `parent_name` | Parent name | char | Yes | No | Hierarchy | Not stored - related | related parent_id.name (readonly) | - |
| 11 | `child_ids` | Contacts | one2many -> res.partner | No | No (inverse) | Hierarchy | O2M inverse of res_partner.parent_id (no column) | - | - |
| 12 | `commercial_partner_id` | Commercial Entity | many2one -> res.partner | Yes | Yes | Hierarchy | DB column res_partner.commercial_partner_id (stored computed) | compute _compute_commercial_partner; depends is_company, parent_id.commercial_partner_id | - |
| 13 | `commercial_company_name` | Company Name Entity | char | Yes | Yes | Hierarchy | DB column res_partner.commercial_company_name (stored computed) | compute _compute_commercial_company_name | - |
| 14 | `company_name` | Company Name | char | No | Yes | Hierarchy | DB column res_partner.company_name | - | - |
| 15 | `ref` | Internal Reference | char | No | Yes | Identity | DB column res_partner.ref | - | - |
| 16 | `vat` | Tax ID | char | No | Yes | Identity | DB column res_partner.vat | - | - |
| 17 | `barcode` | Barcode | char | No | Yes | Identity | DB column res_partner.barcode | - | - |
| 18 | `date` | Date | date | No | Yes | Identity | DB column res_partner.date | - | - |
| 19 | `comment` | Notes | text | No | Yes | Identity | DB column res_partner.comment | - | - |
| 20 | `email` | Email | char | No | Yes | Contact info | DB column res_partner.email | - | - |
| 21 | `email_formatted` | Formatted Email | char | Yes | No | Contact info | Not stored - computed | compute _compute_email_formatted | - |
| 22 | `phone` | Phone | char | No | Yes | Contact info | DB column res_partner.phone | - | - |
| 23 | `mobile` | Mobile | char | No | Yes | Contact info | DB column res_partner.mobile | - | - |
| 24 | `website` | Website | char | No | Yes | Contact info | DB column res_partner.website | - | - |
| 25 | `street` | Street | char | No | Yes | Address | DB column res_partner.street | - | - |
| 26 | `street2` | Street2 | char | No | Yes | Address | DB column res_partner.street2 | - | - |
| 27 | `city` | City | char | No | Yes | Address | DB column res_partner.city | - | - |
| 28 | `state_id` | State | many2one -> res.country.state | No | Yes | Address | DB column res_partner.state_id (FK res_country_state, ON DELETE RESTRICT) | - | - |
| 29 | `zip` | Zip | char | No | Yes | Address | DB column res_partner.zip | - | - |
| 30 | `country_id` | Country | many2one -> res.country | No | Yes | Address | DB column res_partner.country_id (FK res_country, ON DELETE RESTRICT) | - | - |
| 31 | `contact_address` | Complete Address | char | Yes | No | Address | Not stored - computed | compute _compute_contact_address | - |
| 32 | `lang` | Language | selection | No | Yes | Preferences | DB column res_partner.lang | - | env.lang (context language) |
| 33 | `tz` | Timezone | selection | No | Yes | Preferences | DB column res_partner.tz | - | context 'tz' |
| 34 | `tz_offset` | Timezone offset | char | Yes | No | Preferences | Not stored - computed | compute _compute_tz_offset; depends tz | - |
| 35 | `user_id` | Salesperson | many2one -> res.users | No | Yes | Responsibility | DB column res_partner.user_id (FK res_users, ON DELETE SET NULL) | - | - |
| 36 | `company_id` | Company | many2one -> res.company | No | Yes | Responsibility | DB column res_partner.company_id (FK res_company, ON DELETE SET NULL) | - | method _default_company |
| 37 | `category_id` | Tags | many2many -> res.partner.category | No | Yes | Classification | M2M table res_partner_res_partner_category_rel (partner_id, category_id) | - | method _default_category (context category_id) |
| 38 | `industry_id` | Industry | many2one -> res.partner.industry | No | Yes | Classification | DB column res_partner.industry_id (FK res_partner_industry) | - | - |
| 39 | `customer` | Is a Customer | boolean | No | Yes | Flags | DB column res_partner.customer | - | True |
| 40 | `supplier` | Is a Vendor | boolean | No | Yes | Flags | DB column res_partner.supplier | - | False/None |
| 41 | `employee` | Employee | boolean | No | Yes | Flags | DB column res_partner.employee | - | False/None |
| 42 | `credit_limit` | Credit Limit | float | No | Yes | Flags | DB column res_partner.credit_limit | - | - |
| 43 | `active` | Active | boolean | No | Yes | Status | DB column res_partner.active | - | True |
| 44 | `bank_ids` | Banks | one2many -> res.partner.bank | No | No (inverse) | Relations | O2M inverse of res_partner_bank.partner_id (no column) | - | - |
| 45 | `user_ids` | Users | one2many -> res.users | No | No (inverse) | Relations | O2M inverse of res_users.partner_id (no column) | - | - |
| 46 | `partner_share` | Share Partner | boolean | Yes | Yes | Status | DB column res_partner.partner_share (stored computed) | compute _compute_partner_share; depends user_ids.share | - |
| 47 | `color` | Color Index | integer | No | Yes | Technical | DB column res_partner.color | - | 0 |
| 48 | `image` | Image | binary | No | Yes | Images | Binary attachment=True -> ir_attachment (res_field=image) | - | - |
| 49 | `image_medium` | Medium-sized image | binary | No | Yes | Images | Binary attachment=True -> ir_attachment (res_field=image_medium) | - | - |
| 50 | `image_small` | Small-sized image | binary | No | Yes | Images | Binary attachment=True -> ir_attachment (res_field=image_small) | - | - |
| 51 | `self` | Self | many2one -> res.partner | Yes | No | Technical | Not stored - computed | compute _compute_get_ids | - |
| 52 | `create_date` | Created on | datetime | Yes | Yes | System | DB column res_partner.create_date | - | - |
| 53 | `create_uid` | Created by | many2one -> res.users | Yes | Yes | System | DB column res_partner.create_uid (FK res_users) | - | - |
| 54 | `write_date` | Last Updated on | datetime | Yes | Yes | System | DB column res_partner.write_date | - | - |
| 55 | `write_uid` | Last Updated by | many2one -> res.users | Yes | Yes | System | DB column res_partner.write_uid (FK res_users) | - | - |
| 56 | `__last_update` | Last Modified on | datetime | Yes | No | System | Not stored - computed | max(write_date, create_date) | - |

**Selection values**

| Field | Values |
|---|---|
| `type` (stock) | `contact`=Contact, `invoice`=Invoice address, `delivery`=Shipping address, `other`=Other address, `private`=Private Address. Default `contact`. |
| `company_type` | `person`=Individual, `company`=Company (derived from `is_company`) |
| `lang` | Dynamic: `res.lang.get_installed()`. Live DB: only `en_US` active (all 6,364 partners hold `en_US`). |
| `tz` | Dynamic: `pytz.all_timezones`. Live: `Asia/Calcutta` 5,602, `Asia/Riyadh` 757, empty 5. |

**Required fields:** none at ORM level. **Read-only fields:** the 15 marked RO above (`id`, `display_name`, `parent_name`, `commercial_partner_id`, `commercial_company_name`, `email_formatted`, `contact_address`, `tz_offset`, `partner_share`, `self`, `create_date`, `create_uid`, `write_date`, `write_uid`, `__last_update`).

## 3. Excluded fields and their originating modules (103 fields, 25 modules)

Declared on `res.partner` by a module other than `base` (first owner from `ir_model_data`). Of the 25 originating modules, 15 are standard Odoo 12 apps (present in `odoo_server/addons`) and 10 are custom project modules. The classification is by which addon folder contains the module. **None is used by the Contact Master.**

| Originating module | Fields |
|---|---|
| `account` (standard) | `bank_account_count`:integer, `contract_ids`:one2many, `contracts_count`:integer, `credit`:monetary, `currency_id`:many2one, `debit`:monetary, `debit_limit`:monetary, `has_unreconciled_entries`:boolean, `invoice_ids`:one2many, `invoice_warn`:selection, `invoice_warn_msg`:text, `journal_item_count`:integer, `last_time_entries_checked`:datetime, `property_account_payable_id`:many2one, `property_account_position_id`:many2one, `property_account_receivable_id`:many2one, `property_payment_term_id`:many2one, `property_supplier_payment_term_id`:many2one, `ref_company_ids`:one2many, `total_invoiced`:monetary, `trust`:selection |
| `api_connection` (custom) | `location_info`:one2many |
| `att_customer_pricelist` (custom) | `customer_discount`:float |
| `att_helpdesk` (custom) | `ticket_count`:integer |
| `att_installation_request` (custom) | `child_company_ids`:one2many |
| `att_vehicle_sync` (custom) | `extension_number`:char, `ext_res_id`:integer, `log_ids`:one2many, `wasl_status`:boolean |
| `auth_signup` (standard) | `signup_expiration`:datetime, `signup_token`:char, `signup_type`:char, `signup_url`:char, `signup_valid`:boolean |
| `bus` (standard) | `im_status`:char |
| `calendar` (standard) | `calendar_last_notif_ack`:datetime |
| `crm` (standard) | `meeting_count`:integer, `meeting_ids`:many2many, `opportunity_count`:integer, `opportunity_ids`:one2many |
| `delivery_order_custom` (custom) | `company_name_code`:char |
| `l10n_sa_edi` (custom) | `country_code`:char, `l10n_sa_additional_identification_number`:char, `l10n_sa_additional_identification_scheme`:selection, `l10n_sa_edi_building_number`:char, `l10n_sa_edi_plot_identification`:char, `l10n_sa_registered_name`:char |
| `mail` (standard) | `activity_date_deadline`:date, `activity_ids`:one2many, `activity_state`:selection, `activity_summary`:char, `activity_type_id`:many2one, `activity_user_id`:many2one, `channel_ids`:many2many, `is_blacklisted`:boolean, `message_attachment_count`:integer, `message_bounce`:integer, `message_channel_ids`:many2many, `message_follower_ids`:one2many, `message_has_error`:boolean, `message_has_error_counter`:integer, `message_ids`:one2many, `message_is_follower`:boolean, `message_main_attachment_id`:many2one, `message_needaction`:boolean, `message_needaction_counter`:integer, `message_partner_ids`:many2many, `message_unread`:boolean, `message_unread_counter`:integer |
| `partner_autocomplete` (standard) | `additional_info`:char, `partner_gid`:integer |
| `payment` (standard) | `payment_token_count`:integer, `payment_token_ids`:one2many |
| `portal` (standard) | `website_message_ids`:one2many |
| `product` (standard) | `property_product_pricelist`:many2one |
| `purchase` (standard) | `property_purchase_currency_id`:many2one, `purchase_order_count`:integer, `purchase_warn`:selection, `purchase_warn_msg`:text, `supplier_invoice_count`:integer |
| `purchase_request` (custom) | `image_seal`:binary, `image_sign`:binary |
| `sale` (standard) | `sale_order_count`:integer, `sale_order_ids`:one2many, `sale_warn`:selection, `sale_warn_msg`:text |
| `sale_custom` (custom) | `arabic_city_name`:char, `arabic_name`:char, `arabic_street2_name`:char, `cash_customer`:boolean, `cr_number`:char, `customer_code`:char, `discount`:float, `fax`:char, `vandor_number`:char, `vat_arabic`:char |
| `sales_team` (standard) | `team_id`:many2one |
| `stock` (standard) | `picking_warn`:selection, `picking_warn_msg`:text, `property_stock_customer`:many2one, `property_stock_supplier`:many2one |
| `subscription_management` (custom) | `vehicle_ids`:one2many |
| `website` (standard) | `website_id`:many2one |

Notes: `l10n_sa_edi` is a local (project) copy; `purchase_request` adds `image_seal` / `image_sign` (custom) - the Contact Master uses only base `image*`. These tables show why name-based exclusion is unsafe: `fax`, `discount`, `customer_code`, `cr_number`, `arabic_name` look like contact fields but all belong to `sale_custom` / `att_*`.

## 4. Field relationships (verified against source and `ir_model_fields`)

| Field | Field type | Related model | Relation detail | Description |
|---|---|---|---|---|
| `parent_id` | Many2one | `res.partner` | FK `res_partner.parent_id`, ON DELETE SET NULL; Python constraint forbids recursion | Parent company / contact (label "Related Company") |
| `child_ids` | One2many | `res.partner` | inverse of `parent_id`; domain `active = True` | Child contacts / addresses |
| `commercial_partner_id` | Many2one (stored computed, RO) | `res.partner` | FK, ON DELETE SET NULL | Top commercial entity of the hierarchy |
| `title` | Many2one | `res.partner.title` | FK `res_partner.title` | Contact title (7 rows live: Madam, Miss, Mister, Doctor, Professor, Engineer, Engr) |
| `country_id` | Many2one | `res.country` | FK, ON DELETE RESTRICT | Country |
| `state_id` | Many2one | `res.country.state` | FK, ON DELETE RESTRICT | State |
| `user_id` | Many2one | `res.users` | FK, ON DELETE SET NULL | Responsible user, labelled "Salesperson" |
| `company_id` | Many2one | `res.company` | FK, ON DELETE SET NULL; default `_default_company` | Company the contact belongs to (empty = shared) |
| `industry_id` | Many2one | `res.partner.industry` | FK, ON DELETE SET NULL | Industry (21 values live, none assigned) |
| `category_id` | Many2many | `res.partner.category` | table `res_partner_res_partner_category_rel` (`partner_id`, `category_id`) | Tags (0 links live) |
| `bank_ids` | One2many | `res.partner.bank` | inverse of `res_partner_bank.partner_id` | Bank accounts (base model) |
| `user_ids` | One2many | `res.users` | inverse of `res_users.partner_id` | Users linked to this contact |
| `create_uid`, `write_uid` | Many2one | `res.users` | FK, ON DELETE SET NULL | Created by / last updated by |
| `self` | Many2one (computed) | `res.partner` | QWeb helper | Technical; not a table field |

## 5. Live-database deviations from stock Odoo 12 (do not change the field list)

| Item | Stock | Live DB |
|---|---|---|
| `type` values | `contact, invoice, delivery, other, private` | plus `child_company`, `manager` (`selection_add` in `att_vehicle_sync` and `att_installation_request`). **259 partners are `manager`**, 6,105 are `contact`. A stock-only validator would reject them. |
| `tz` default | context timezone | company `default_user_tz` (`create_user_wizard`) |
| `track_visibility='onchange'` | none | on 11 base fields (`att_vehicle_sync`); mail tracking only |
| Extra DB constraint | only `check_name` | `res_partner_company_name_code UNIQUE` is owned by a custom module on a non-base column |
| Stored computed columns | - | `display_name`, `commercial_partner_id`, `commercial_company_name`, `partner_share` are maintained by the ORM; a Node-side insert/update must recompute them or they go stale |
| Binary fields | - | `image`, `image_medium`, `image_small` have **no column**; bytes are in `ir_attachment` (`res_model='res.partner'`, `res_field`, `res_id`) |

## 6. Approved Contact Master fields

All 56 fields in section 2 are approved as the Contact Master data model. The **Contact List** screen shows them in three tiers (also in the CSV, column `list_column`):

| Tier | Fields |
|---|---|
| **Default visible columns** | `display_name` (Name), `company_type`, `function`, `parent_id`, `email`, `phone`, `mobile`, `city`, `country_id`, `user_id`, `category_id`, `active` |
| **Optional columns** (user can add) | `name`, `type`, `title`, `child_ids` (count), `commercial_partner_id`, `commercial_company_name`, `ref`, `vat`, `website`, `street`, `street2`, `state_id`, `zip`, `lang`, `tz`, `company_id`, `industry_id`, `customer`, `supplier`, `employee`, `image` (avatar), `create_date`, `create_uid`, `write_date`, `write_uid` |
| **Hidden but loaded** | `id`, `is_company` |
| **Detail/form only, not list columns** | `comment`, `date`, `barcode`, `credit_limit`, `company_name`, `bank_ids`, `user_ids`, `partner_share`, `color`, `image_medium`, `image_small`, `email_formatted`, `contact_address`, `tz_offset`, `parent_name`, `self`, `__last_update` |

Basis for the default tier: the stock Odoo 12 Contact tree (`view_partner_tree`) shows `display_name`, `phone`, `email` and loads `function`, `user_id`, `is_company`, `country_id`, `parent_id`, `active`; address and mobile columns were added from the same base fields. Stock search filters: Individuals/Companies (`is_company`), Customers/Vendors (`customer`/`supplier`), Archived (`active`), group by `user_id`, `parent_id`, `country_id`.

**Contact vs company support:** `is_company` / `company_type` distinguishes them (live: 3,787 companies, 2,577 persons); `parent_id` / `child_ids` model the hierarchy (live: 1,856 children, 4 grandchildren). **Active/inactive:** `active` (live: 6,291 active, 73 archived).

## 7. Implementation

`13_contact_master_list.sql` is the Contact Master list: one `SELECT` over `res_partner` plus base lookup tables only (`res_partner_title`, `res_country`, `res_country_state`, `res_users`, `res_company`, `res_partner_industry`, `res_partner_category`). Aliases are the real field names; relational fields return `<field>` (id) and `<field>__name`; `child_ids` returns `child_ids__count`; `category_id` returns `category_id__names`.

* Verified: runs in a `BEGIN READ ONLY` transaction on `yamama_live_191126`; with the limit lifted it returns **6,291 rows = the active partner count**. A script check confirmed every `p.<column>` it reads is one of the 56 base fields.
* It creates no view, column or table and changes no data.
* Mapping for the Node layer: columns that are not physical (`company_type`, `child_ids`, `category_id`, `image*`, `email_formatted`, `contact_address`, `tz_offset`, `parent_name`, `self`, `user_ids`, `bank_ids`) are derived as shown in the CSV `storage` column.

## 8. Summary

**Included (56).** Every field declared in base `res.partner` (50) + the 6 ORM magic fields. Identity, classification, hierarchy, contact info, address, language/timezone, responsibility, flags, images, computed helpers and system fields.

**Excluded (103).** Everything declared on `res.partner` by another module, from 25 modules: 15 standard Odoo 12 apps (`account`, `auth_signup`, `bus`, `calendar`, `crm`, `mail`, `partner_autocomplete`, `payment`, `portal`, `product`, `purchase`, `sale`, `sales_team`, `stock`, `website`) and 10 custom project modules (`api_connection`, `att_customer_pricelist`, `att_helpdesk`, `att_installation_request`, `att_vehicle_sync`, `delivery_order_custom`, `l10n_sa_edi`, `purchase_request`, `sale_custom`, `subscription_management`). Field-by-field list in section 3.

**Judgement calls you may want to overrule.**
1. `customer`, `supplier`, `employee`, `credit_limit`, `vat`, `industry_id`, `barcode`, `bank_ids` and `user_id` ("Salesperson") sound like Sales/Purchase/Accounting/POS data, but in Odoo 12 they are **declared in base**. The brief's rule ("original base model is the source of truth") was applied, so they are included and marked *Optional* or *form only* so they do not clutter the list. Dropping them is a one-line change.
2. `industry_id` is on the brief's exclusion list but is a base field in v12; included for that reason.

**Relationships identified:** 11 relational fields + 2 audit users + `self` (section 4).

**Could not be verified / limits.**
* Odoo was not started, so compute/default/selection details come from reading the source (`res_partner.py`) and the DB; the DB does not store `compute` for non-manual fields. Defaults are as written in the source.
* `lang` and `tz` selections are dynamic; the live distinct values are reported, not a closed list.
* `type`: live data only contains `contact` (6,105) and `manager` (259). `child_company` is allowed by the custom modules but unused.
* One partner (id 1, "Flames of Al Yamama Trading Co") has `supplier` and `employee` NULL, so treat the three flags as nullable booleans.
* Counts are from the `yamama_live_191126` copy; they change with the data.

