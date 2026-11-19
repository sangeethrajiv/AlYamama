# 12 - Odoo 12 User Management: Source-Verified Field Specification

> **Audience:** Node.js backend team (DB mapping) and Angular team (User Management screens).
> **Type:** analysis only. No source code, database, API or UI was changed. DB access was read-only.
> **Odoo version:** 12.0 (`odoo/release.py` -> `version_info = (12, 0, 0, FINAL, 0, '')`), source `TY-employee-odoo/odoo_server`.
> **Database inspected:** `yamama_live_131126` (latest live copy; `base` 12.0.1.3, `contacts` 12.0.1.0 installed).

## 0. How this was verified

| Check | Result |
|---|---|
| Field declarations read from `odoo/addons/base/models/res_users.py` (class `Users`) and `res_partner.py` (class `Partner`) | 17 `res.users` + 50 `res.partner` declared fields |
| Same files diffed against an independent Odoo 12 tree (`ODOO/Epic/Odoo_version12/odoo_server`) after stripping CRLF | **0 differences** - the base models are stock Odoo 12, unmodified |
| Source field set vs live DB `ir_model_fields` rows whose first owner module is `base` | **Exact match**: 50/50 partner fields (+6 magic columns), all `res.users` fields. No base field missing, none invented |
| Origin module of each field | `ir_model_data` xmlid owners (`field_res_users__x`) in the DB, confirmed against the Python source |
| Help text and labels | DB reflection vs source: identical for all 50 partner fields |
| Physical columns | `information_schema.columns` for `res_users` / `res_partner`, plus `odoo/addons/base/data/base_data.sql` |
| `contacts` module | Read in full (`__manifest__.py`, `models/res_users.py`, `views/contact_views.xml`); 0 field xmlids owned by `contacts` in the DB |

Legend - **Req/RO** = ORM `required` / `readonly` attributes as reflected in `ir_model_fields`. **Stored** = persisted by the ORM. *Column* = a real PostgreSQL column. *Std UI* = used by the stock `base` Users views (`form`, `tree`, `prefs` = My Preferences form).

## 1. Standard `res.users` fields (module `base`)

Declared in `odoo/addons/base/models/res_users.py`, class `Users` (`_name='res.users'`, `_inherits={'res.partner': 'partner_id'}`, `_order='name, login'`). The last seven rows are ORM magic fields. `name` and `email` are re-declared in `res.users` as *inherited related* fields (`readonly=False`); they are **not** columns of `res_users`.


| Field | Label | Type -> Relation | Req | RO | Stored / where | Related / compute | Default | Help | Std UI | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| `partner_id` | Related Partner | many2one -> res.partner | Yes | No | DB column res_users.partner_id | - | none - ORM creates the partner automatically on create (_inherits) | Partner-related data of the user | form | Link to the user's contact record. Every user owns exactly one partner; all personal/contact data lives there. |
| `login` | Login | char | Yes | No | DB column res_users.login | - | none | Used to log into the system | form, tree | Login name (typically the e-mail). Unique; used for authentication. |
| `password` | Password | char | No | No | DB column res_users.password | compute _compute_password; inverse _set_password (writes PBKDF2 hash to column) | none (reads return '') | Keep empty if you don't want the user to be able to connect on the system. | - | PBKDF2-SHA512 hash (passlib) in column res_users.password. ORM treats it as a write-only virtual field; empty = cannot log in with password. |
| `new_password` | Set Password | char | No | No | Not stored - ORM computed/virtual | compute _compute_password; inverse _set_new_password (-> password) | none (reads return '') | Specify a value only when creating a user or if you're changing the user's password, otherwise leave empty. After a change of password, the user has to login again. | - | Virtual field used by the form to set a new password; never stored. Writing it sets password. |
| `signature` | Signature | html | No | No | DB column res_users.signature | - | none | - | form, prefs | HTML e-mail/chatter signature of the user. |
| `active` | Active | boolean | No | No | DB column res_users.active | - | True | - | form | Archive flag. Inactive users cannot log in. Separate from res_partner.active (kept in sync on create/toggle). |
| `action_id` | Home Action | many2one -> ir.actions.actions | No | No | DB column res_users.action_id | - | none | If specified, this action will be opened at log on for this user, in addition to the standard menu. | form | Action opened right after login (home action). |
| `groups_id` | Groups | many2many -> res.groups | No | No | M2M table res_groups_users_rel (uid, gid) | - | method _default_groups: groups of template user xmlid base.default_user | - | form | Security groups of the user (roles/permissions). Inheritance via implied groups is expanded on write. |
| `log_ids` | User log entries | one2many -> res.users.log | No | No | O2M inverse: res_users_log.create_uid (no column) | - | none | - | - | Login log (res.users.log rows created at each login; only magic fields create_uid/create_date are used). |
| `login_date` | Latest connection | datetime | No | No | Not stored - related, max/first res_users_log.create_date | log_ids.create_date | n/a (related) | - | tree | Timestamp of latest login, read from res_users_log. |
| `share` | Share User | boolean | No | Yes | DB column res_users.share | compute _compute_share (depends groups_id; compute_sudo=True); stored | computed: not user.has_group('base.group_user') | External user with limited access, created only for the purpose of sharing data. | - | True for external (portal/public) users: user is NOT in base.group_user. Recomputed when groups change. |
| `companies_count` | Number of Companies | integer | No | Yes | Not stored - ORM computed/virtual | compute _compute_companies_count | method _companies_count: total number of res.company records | - | form(hidden) | Total number of companies in the DB (UI helper to show/hide the multi-company block). |
| `tz_offset` | Timezone offset | char | No | Yes | Not stored - ORM computed/virtual | compute _compute_tz_offset (depends tz) | n/a (computed) | - | form(hidden), prefs | UTC offset (e.g. +0300) derived from the user's timezone; UI helper for timezone mismatch widget. |
| `company_id` | Company | many2one -> res.company | Yes | No | DB column res_users.company_id | - | method _get_company: env.user.company_id | The company this user is currently working for. | form, prefs | User's current/default company. Must be one of company_ids (constraint _check_company). |
| `company_ids` | Companies | many2many -> res.company | No | No | M2M table res_company_users_rel (user_id, cid) | - | method _get_company: env.user.company_id | - | form | Companies the user is allowed to switch between. |
| `name` | Name | char | No | No | NOT a res_users column - stored in res_partner.name via partner_id | partner_id.name | none | - | form, tree, prefs | User's display name = res_partner.name of the linked partner. |
| `email` | Email | char | No | No | NOT a res_users column - stored in res_partner.email via partner_id | partner_id.email | none | - | form(hidden), prefs | User e-mail = res_partner.email of the linked partner. Onchange: setting login to an e-mail copies it here. |
| `id` | ID | integer | No | Yes | DB column res_users.id | - | none | - | form(hidden) | Primary key. |
| `create_date` | Created on | datetime | No | Yes | DB column res_users.create_date | - | none | - | - | Creation timestamp (UTC). |
| `create_uid` | Created by | many2one -> res.users | No | Yes | DB column res_users.create_uid | - | none | - | - | Creator user. |
| `write_date` | Last Updated on | datetime | No | Yes | DB column res_users.write_date | - | none | - | - | Last write timestamp (UTC). |
| `write_uid` | Last Updated by | many2one -> res.users | No | Yes | DB column res_users.write_uid | - | none | - | - | Last writer user. |
| `__last_update` | Last Modified on | datetime | No | Yes | Not stored - ORM computed/virtual | - | none | - | - | Technical: max(write_date, create_date) for cache validation; not stored. |
| `display_name` | Display Name | char | No | Yes | Not stored - ORM computed/virtual | - | none | - | - | Technical display name (res.users: not stored; res.partner: stored computed, see list). |


**Other `base` behaviour tied to these fields (all in `res_users.py`)**

* SQL constraint `login_key`: `UNIQUE (login)`.
* Python constraints: `_check_company` (`company_id` must be in `company_ids`), `_check_action_id` (home action cannot be the App Switcher).
* `create()` runs with `default_customer=False`, copies `active` to the partner and aligns `partner.company_id` with `company_id`. `write()` forbids activating the superuser (id 1) and deactivating yourself; `unlink()` forbids deleting id 1.
* `password` hash scheme: `pbkdf2_sha512` (passlib `DEFAULT_CRYPT_CONTEXT`, `plaintext` accepted only for legacy upgrade). Column is created by `base_data.sql` as `password varchar default null`, which is why a field the ORM calls non-stored still has a column.
* `SELF_READABLE_FIELDS` / `SELF_WRITEABLE_FIELDS` limit what a user may read/write on themself (writeable: `signature, action_id, company_id, email, name, image, image_medium, image_small, lang, tz`).
* **Virtual (non-DB) fields generated at runtime** by `GroupsView`/`UsersView`: `in_group_<group_id>` (boolean) and `sel_groups_<id1>_<id2>...` (selection). They only render the groups checkboxes/dropdowns of the form and are folded into `groups_id` on write. They are not in `ir_model_fields` and have no storage - the Node API should expose `groups_id` only.
* Group membership: `res_groups_users_rel(uid, gid)`; implied groups are expanded by `UsersImplied.create/write` (`res_groups_implied_rel`).

## 2. Related `res.partner` fields used in User Management (module `base`)

All 50 fields declared on `res.partner` in `odoo/addons/base/models/res_partner.py` plus the 6 magic fields. They are reachable from a user through `res.users.partner_id`. Every one except `company_id`, `tz_offset`, `display_name` and the magic fields is also **exposed on `res.users`** as an *inherited related field* (`related='partner_id.<field>'`, `inherited=True`, read/write goes to the partner row). Exception handled by the ORM: because `res.users` has its own `active`, the partner's flag is exposed on the user as **`active_partner`** (`related='partner_id.active'`). For `company_id`, `tz_offset`, `display_name` and the magic fields `res.users` has **its own** field of the same name (section 1) - they are different data.

The stock Users views use only: `name`, `email` (hidden), `image` (+`image_medium` preview), `lang`, `tz`. Everything else is in scope but **not visible in the Odoo form**.


| Field | Label | Type -> Relation | Req | RO | Stored / where | Related / compute | Default | Help | Std UI | Description |
|---|---|---|---|---|---|---|---|---|---|---|
| `name` | Name | char | No | No | DB column res_partner.name | - | none | - | form, tree, prefs | Contact name (required in practice for type=contact via SQL CHECK res_partner_check_name). |
| `display_name` | Display Name | char | No | Yes | DB column res_partner.display_name | compute _compute_display_name (depends is_company, name, parent_id.name, type, company_name); stored | none | - | - | Stored computed full name (includes parent company prefix for non-company contacts). |
| `date` | Date | date | No | No | DB column res_partner.date | - | none | - | - | Free date field on the contact (shown as "Date"). |
| `title` | Title | many2one -> res.partner.title | No | No | DB column res_partner.title | - | none | - | - | Contact title (Mr., Mrs., ...). |
| `parent_id` | Related Company | many2one -> res.partner | No | No | DB column res_partner.parent_id | - | none | - | - | Parent company of this contact (hierarchy). |
| `parent_name` | Parent name | char | No | Yes | Not stored - ORM computed/related | parent_id.name | none | - | - | Name of the parent company (related, read-only). |
| `child_ids` | Contacts | one2many -> res.partner | No | No | O2M inverse: res_partner.parent_id (no column) | - | none | - | - | Child contacts/addresses of this partner (active only). |
| `ref` | Internal Reference | char | No | No | DB column res_partner.ref | - | none | - | - | Internal reference code. |
| `lang` | Language | selection | No | No | DB column res_partner.lang | - | lambda: env.lang (current context language) | All the emails and documents sent to this contact will be translated in this language. | form, tree, prefs | Language used for e-mails/documents addressed to this contact; for a user also the UI language. |
| `tz` | Timezone | selection | No | No | DB column res_partner.tz | - | lambda: context.get('tz')  | The partner's timezone, used to output proper date and time values inside printed reports. It is important to set a value for this field. You should use the same timezone that is otherwise used to pick and render date and time values: your computer's timezone. | form, prefs | Timezone of the contact; for a user it is the user's timezone for date rendering. |
| `tz_offset` | Timezone offset | char | No | Yes | Not stored - ORM computed/related | compute _compute_tz_offset (depends tz) | none | - | - | UTC offset derived from tz (UI helper). |
| `user_id` | Salesperson | many2one -> res.users | No | No | DB column res_partner.user_id | - | none | The internal user in charge of this contact. | - | Salesperson - internal user responsible for this contact. |
| `vat` | Tax ID | char | No | No | DB column res_partner.vat | - | none | The Tax Identification Number. Complete it if the contact is subjected to government taxes. Used in some legal statements. | - | Tax identification number. |
| `bank_ids` | Banks | one2many -> res.partner.bank | No | No | O2M inverse: res_partner_bank.partner_id (no column) | - | none | - | - | Bank accounts (res.partner.bank) of the contact. |
| `website` | Website | char | No | No | DB column res_partner.website | - | none | - | - | Website URL. |
| `comment` | Notes | text | No | No | DB column res_partner.comment | - | none | - | - | Internal notes. |
| `category_id` | Tags | many2many -> res.partner.category | No | No | M2M table res_partner_res_partner_category_rel (partner_id, category_id) | - | method _default_category: res.partner.category with id = context 'category_id' | - | - | Tags / categories. |
| `credit_limit` | Credit Limit | float | No | No | DB column res_partner.credit_limit | - | none | - | - | Customer credit limit (plain float column in base). |
| `barcode` | Barcode | char | No | No | DB column res_partner.barcode | - | none | Use a barcode to identify this contact from the Point of Sale. | - | Barcode identifying the contact (legacy name ean13). |
| `active` | Active | boolean | No | No | DB column res_partner.active | - | True | - | - | Archive flag of the contact. For a user's partner it is mirrored from the user on create/toggle. |
| `customer` | Is a Customer | boolean | No | No | DB column res_partner.customer | - | True  (res.users.create runs with default_customer=False, so a user's partner gets customer=False) | Check this box if this contact is a customer. It can be selected in sales orders. | - | Contact is a customer (Odoo 12 boolean; no customer_rank). |
| `supplier` | Is a Vendor | boolean | No | No | DB column res_partner.supplier | - | none | Check this box if this contact is a vendor. It can be selected in purchase orders. | - | Contact is a vendor (Odoo 12 boolean; no supplier_rank). |
| `employee` | Employee | boolean | No | No | DB column res_partner.employee | - | none | Check this box if this contact is an Employee. | - | Contact is an employee (flag only; not linked to hr.employee by base). |
| `function` | Job Position | char | No | No | DB column res_partner.function | - | none | - | - | Job position / title text. |
| `type` | Address Type | selection | No | No | DB column res_partner.type | - | 'contact' | Used by Sales and Purchase Apps to select the relevant address depending on the context. | - | Address type: contact, invoice, delivery, other, private. |
| `street` | Street | char | No | No | DB column res_partner.street | - | none | - | - | Street line 1. |
| `street2` | Street2 | char | No | No | DB column res_partner.street2 | - | none | - | - | Street line 2. |
| `zip` | Zip | char | No | No | DB column res_partner.zip | - | none | - | - | ZIP / postal code. |
| `city` | City | char | No | No | DB column res_partner.city | - | none | - | - | City. |
| `state_id` | State | many2one -> res.country.state | No | No | DB column res_partner.state_id | - | none | - | - | State / province. |
| `country_id` | Country | many2one -> res.country | No | No | DB column res_partner.country_id | - | none | - | - | Country. |
| `email` | Email | char | No | No | DB column res_partner.email | - | none | - | form(hidden), prefs | E-mail address; for a user this is the user e-mail. |
| `email_formatted` | Formatted Email | char | No | Yes | Not stored - ORM computed/related | compute _compute_email_formatted | none | Format email address "Name <email@domain>" | - | Computed "Name <email>" string. |
| `phone` | Phone | char | No | No | DB column res_partner.phone | - | none | - | - | Phone. |
| `mobile` | Mobile | char | No | No | DB column res_partner.mobile | - | none | - | - | Mobile phone. |
| `is_company` | Is a Company | boolean | No | No | DB column res_partner.is_company | - | False | Check if the contact is a company, otherwise it is a person | - | True = company, False = person. |
| `industry_id` | Industry | many2one -> res.partner.industry | No | No | DB column res_partner.industry_id | - | none | - | - | Industry classification. |
| `company_type` | Company Type | selection | No | No | Not stored - ORM computed/related | compute _compute_company_type; inverse _write_company_type (interface-only field, maps to is_company) | none | - | - | UI-only person/company switch mapped to is_company (do not use in business logic). |
| `company_id` | Company | many2one -> res.company | No | No | DB column res_partner.company_id | - | method _default_company: res.company._company_default_get('res.partner') | - | - | Company the contact is restricted to (empty = shared). Kept equal to the user company on user create/write if set. |
| `color` | Color Index | integer | No | No | DB column res_partner.color | - | 0 | - | - | Color index (kanban). |
| `user_ids` | Users | one2many -> res.users | No | No | O2M inverse: res_users.partner_id (no column) | - | none | - | - | Inverse of res.users.partner_id: users linked to this partner (here at most one in this DB). |
| `partner_share` | Share Partner | boolean | No | Yes | DB column res_partner.partner_share | compute _compute_partner_share (depends user_ids.share); stored | none | Either customer (not a user), either shared user. Indicated the current partner is a customer without access or with a limited access created for sharing data. | - | Stored: True if partner has no user or only share (portal/public) users. |
| `contact_address` | Complete Address | char | No | Yes | Not stored - ORM computed/related | compute _compute_contact_address | none | - | - | Computed formatted full postal address. |
| `commercial_partner_id` | Commercial Entity | many2one -> res.partner | No | Yes | DB column res_partner.commercial_partner_id | compute _compute_commercial_partner (depends is_company, parent_id.commercial_partner_id); stored | none | - | - | Stored: top commercial entity (itself if company or no parent, else parent chain). |
| `commercial_company_name` | Company Name Entity | char | No | Yes | DB column res_partner.commercial_company_name | compute _compute_commercial_company_name; stored | none | - | - | Stored: name of the commercial company entity. |
| `company_name` | Company Name | char | No | No | DB column res_partner.company_name | - | none | - | - | Free-text company name typed for a person without a parent company. |
| `image` | Image | binary | No | No | Binary, attachment=True: stored in ir_attachment (res_model='res.partner', res_field='image', res_id=partner id), NOT a column | - | none | This field holds the image used as avatar for this contact, limited to 1024x1024px | form, prefs | Avatar, up to 1024x1024 (base64). For a user: the user picture. |
| `image_medium` | Medium-sized image | binary | No | No | Binary, attachment=True: stored in ir_attachment (res_model='res.partner', res_field='image_medium', res_id=partner id), NOT a column | - | none | Medium-sized image of this contact. It is automatically resized as a 128x128px image, with aspect ratio preserved. Use this field in form views or some kanban views. | form (preview) | Avatar 128x128, auto-resized from image. |
| `image_small` | Small-sized image | binary | No | No | Binary, attachment=True: stored in ir_attachment (res_model='res.partner', res_field='image_small', res_id=partner id), NOT a column | - | none | Small-sized image of this contact. It is automatically resized as a 64x64px image, with aspect ratio preserved. Use this field anywhere a small image is required. | - | Avatar 64x64, auto-resized from image. |
| `self` | Self | many2one -> res.partner | No | Yes | Not stored - ORM computed/related | compute _compute_get_ids (QWeb helper, returns self) | none | - | - | Technical QWeb helper returning the record itself. |
| `id` | ID | integer | No | Yes | DB column res_partner.id | - | none | - | - | Primary key. |
| `create_date` | Created on | datetime | No | Yes | DB column res_partner.create_date | - | none | - | - | Creation timestamp (UTC). |
| `create_uid` | Created by | many2one -> res.users | No | Yes | DB column res_partner.create_uid | - | none | - | - | Creator user. |
| `write_date` | Last Updated on | datetime | No | Yes | DB column res_partner.write_date | - | none | - | - | Last write timestamp (UTC). |
| `write_uid` | Last Updated by | many2one -> res.users | No | Yes | DB column res_partner.write_uid | - | none | - | - | Last writer user. |
| `__last_update` | Last Modified on | datetime | No | Yes | Not stored - ORM computed/related | - | none | - | - | Technical: max(write_date, create_date) for cache validation; not stored. |


**Selection values (technical value = label)**

| Field | Values |
|---|---|
| `type` | `contact`=Contact, `invoice`=Invoice address, `delivery`=Shipping address, `other`=Other address, `private`=Private Address. Default `contact`. |
| `company_type` | `person`=Individual, `company`=Company (derived from `is_company`; do not persist separately) |
| `lang` | Dynamic: `res.lang.get_installed()` -> codes of **active** languages (`res_lang.code`, e.g. `en_US`). In the live DB only `en_US` is active, yet user partners store other values - validate against `res_lang`, not a hard-coded list. |
| `tz` | Dynamic: Python `pytz.all_timezones` (`Etc/*` last). Live user partners hold `Asia/Calcutta` (67) and `Asia/Riyadh` (31), 3 empty. |

**Notes for the Node team**

* `image`, `image_medium`, `image_small` are `Binary(attachment=True)`: there is **no column**; the bytes live in `ir_attachment` (`res_model='res.partner'`, `res_field='image'|'image_medium'|'image_small'`, `res_id`=partner id; 6,344 rows each in the live DB). Odoo regenerates medium/small from `image`.
* `res_partner.display_name`, `partner_share`, `commercial_partner_id`, `commercial_company_name` are **stored computed** columns: they are maintained by Odoo's ORM, so a Node-side insert/update must recompute them or they go stale.
* SQL constraint `res_partner_check_name`: `CHECK ((type='contact' AND name IS NOT NULL) OR type<>'contact')`.

## 3. Standard Contacts module (`contacts`) fields

**Result: the standard `contacts` module adds no fields.**

| Item | Finding |
|---|---|
| `contacts/__manifest__.py` | `depends: ['base','mail']`, data: `views/contact_views.xml`, `application: True` |
| `contacts/models/` | One file, `res_users.py`: `_inherit=['res.users']` overriding the **method** `systray_get_activities()` (changes the Contacts systray icon/action). **No `fields.*` declaration** |
| `contacts/views/contact_views.xml` | Window actions `action_contacts`, `action_contacts_summary` on `res.partner` re-using `base.view_partner_form`, `base.view_partner_tree`, `base.res_partner_kanban_view`; menu items. No new field |
| DB | `select count(*) from ir_model_data where module='contacts' and model='ir.model.fields'` -> **0** |

So the "Contacts" form of a user is the plain `base` partner form: every contact field is the `base` list in section 2. Fields people associate with Contacts (activities, followers, messages, `signup_*`, `im_status`) come from `mail`, `auth_signup`, `bus` etc. and are listed in section 5.

## 4. User-Contact relationship

### 4.1 Model relationship

```
res_users (own columns)                       res_partner (contact columns)
-----------------------                       -----------------------------
id            PK                              id           PK
login  UNIQUE*                                name, email, phone, mobile, lang, tz, ...
password (PBKDF2 hash)       partner_id       image*  -> ir_attachment
active, share, signature     ------------>    active, company_id, ...
company_id -> res_company    NOT NULL, FK     user_id (salesperson) -> res_users.id
action_id  -> ir_actions     ON DELETE RESTRICT
groups_id  (M2M res_groups_users_rel)         user_ids (O2M) <- inverse of res_users.partner_id
company_ids (M2M res_company_users_rel)
```

* **Mechanism:** `res.users._inherits = {'res.partner': 'partner_id'}` = **delegation inheritance**. `res.users` has no copy of the partner data. Every partner field is presented on `res.users` as a related field `partner_id.<name>` flagged `inherited=True`; reading `user.city` queries `res_partner.city`, writing it updates the partner row.
* **Link:** `res_users.partner_id` -> `res_partner.id`, `NOT NULL`, FK `res_users_partner_id_fkey ON DELETE RESTRICT` (a partner cannot be deleted while a user points to it). Declared with `required=True, ondelete='restrict', auto_join=True, string='Related Partner'`.
* **Creation:** creating a `res.users` without `partner_id` makes the ORM create the `res.partner` first (with `name`, `email`, ... from the same values) and store its id. Creating a user whose partner already exists is also valid by passing `partner_id`.
* **Cardinality:** 1 user -> exactly 1 partner (column NOT NULL). A partner may have 0..n users in the schema (`user_ids` is O2M); in the live DB it is strictly 1:1 (101 users, 101 distinct partners). Plan for 0..n only if the Node model must stay Odoo-compatible.
* **Back references:** `res_partner.user_id` is *not* the user's own link - it is the **Salesperson** of a contact. The user-of-a-partner link is `res_users.partner_id` (O2M `user_ids`).
* **Name collisions:** `active`, `company_id`, `tz_offset` and the magic fields exist on both tables as independent fields (the partner's `active` is exposed on the user as `active_partner`). A user can be archived while the partner is active (4 users currently have `res_users.active <> res_partner.active`); Odoo only syncs on create / `toggle_active`.

### 4.2 Where each field lives

| Group | Fields | Physical location | Kind |
|---|---|---|---|
| `res.users` columns | `id, active, login, password, company_id, partner_id, signature, action_id, share, create_date, create_uid, write_date, write_uid` | `res_users` | direct (`share` stored computed) |
| `res.users` relation tables | `groups_id`, `company_ids` | `res_groups_users_rel`, `res_company_users_rel` | direct M2M |
| `res.users` inverse | `log_ids` | `res_users_log.create_uid` | direct O2M |
| `res.users` virtual | `new_password, companies_count, tz_offset, login_date` | none | computed / related, not stored |
| Partner data seen on the user | `name, email, image*, lang, tz, phone, mobile, street, ... (all section-2 fields except the shadowed names; partner `active` appears as `active_partner`)` | `res_partner` (images in `ir_attachment`) | **related (inherited) on `res.users`; direct on `res.partner`** |

### 4.3 Access recipe for Node.js

```sql
-- one user with its contact data
SELECT u.id, u.login, u.active, u.share, u.company_id,
       p.name, p.email, p.phone, p.mobile, p.lang, p.tz, p.function, p.street, p.city, p.country_id
FROM   res_users u
JOIN   res_partner p ON p.id = u.partner_id;
-- groups:    res_groups_users_rel  WHERE uid = u.id
-- companies: res_company_users_rel WHERE user_id = u.id
```

Write path: one transaction must touch **both** `res_partner` (contact data, then `display_name` / `commercial_*` recompute) and `res_users`, create the M2M rows, and mirror `active`/`company_id` onto the partner as Odoo does. Do not model partner fields as columns of the user table.

## 5. Excluded fields and their source modules

Everything below is declared on `res.users` / `res.partner` by a module **other than `base`** (first owner module from `ir_model_data`; multiple modules = declared by several, first is the origin). They are out of scope. Most owners are stock Odoo 12 dependency modules (`mail`, `mail_bot`, `auth_signup`, `bus`, `portal`, `calendar`, `crm`, `sales_team`, `sale`, `sale_crm`, `purchase`, `account`, `stock`, `product`, `payment`, `website`, `hr`, `resource`, `partner_autocomplete`); the rest are custom modules (for example `sale_custom`, `l10n_sa_edi`, `att_*`, `api_*`, `muk_web_theme`).


### 5.1 `res.users` fields excluded

| Source module(s) | Fields (technical name : type) |
|---|---|
| account_customization | `user_signature`:binary |
| api_configuration,api_connection | `device_reg_id`:char, `token_name`:char |
| api_connection | `location_info`:one2many |
| att_gcc_users | `is_gcc_user`:boolean, `pseudo_name`:char |
| att_helpdesk | `helpdesk_target_closed`:float, `helpdesk_target_rating`:float, `helpdesk_target_success`:float |
| auth_signup | `state`:selection |
| bus | `im_status`:char |
| crm | `target_sales_done`:integer, `target_sales_won`:integer |
| crm_customization | `lead_sale_team_ids`:one2many |
| hr | `employee_ids`:one2many |
| mail | `alias_contact`:selection, `alias_id`:many2one, `is_moderator`:boolean, `moderation_channel_ids`:many2many, `moderation_counter`:integer, `notification_type`:selection |
| mail_bot | `odoobot_state`:selection |
| muk_web_theme | `chatter_position`:selection, `sidebar_type`:selection |
| purchase | `property_purchase_currency_id`:many2one, `purchase_order_count`:integer, `purchase_warn`:selection, `purchase_warn_msg`:text, `supplier_invoice_count`:integer |
| purchase_request | `user_department_ids`:many2many |
| resource | `resource_calendar_id`:many2one, `resource_ids`:one2many |
| sale_crm | `target_sales_invoiced`:integer |
| sales_team | `sale_team_id`:many2one |
| website | `website_id`:many2one |


94 further `res.users` entries (listed in the DB metadata with no module of their own) are delegated copies of the excluded `res.partner` fields below and are not repeated.

### 5.2 `res.partner` fields excluded

| Source module(s) | Fields (technical name : type) |
|---|---|
| account | `bank_account_count`:integer, `contract_ids`:one2many, `contracts_count`:integer, `credit`:monetary, `currency_id`:many2one, `debit`:monetary, `debit_limit`:monetary, `has_unreconciled_entries`:boolean, `invoice_ids`:one2many, `invoice_warn`:selection, `invoice_warn_msg`:text, `journal_item_count`:integer, `last_time_entries_checked`:datetime, `property_account_payable_id`:many2one, `property_account_position_id`:many2one, `property_account_receivable_id`:many2one, `property_payment_term_id`:many2one, `property_supplier_payment_term_id`:many2one, `ref_company_ids`:one2many, `total_invoiced`:monetary, `trust`:selection |
| api_connection | `location_info`:one2many |
| att_customer_pricelist | `customer_discount`:float |
| att_helpdesk | `ticket_count`:integer |
| att_installation_request | `child_company_ids`:one2many |
| att_vehicle_sync | `ext_res_id`:integer, `extension_number`:char, `log_ids`:one2many, `wasl_status`:boolean |
| auth_signup | `signup_expiration`:datetime, `signup_token`:char, `signup_type`:char, `signup_url`:char, `signup_valid`:boolean |
| bus | `im_status`:char |
| calendar | `calendar_last_notif_ack`:datetime |
| crm | `meeting_count`:integer, `meeting_ids`:many2many, `opportunity_count`:integer, `opportunity_ids`:one2many |
| delivery_order_custom | `company_name_code`:char |
| l10n_sa_edi | `country_code`:char, `l10n_sa_additional_identification_number`:char, `l10n_sa_additional_identification_scheme`:selection, `l10n_sa_edi_building_number`:char, `l10n_sa_edi_plot_identification`:char, `l10n_sa_registered_name`:char |
| mail | `activity_date_deadline`:date, `activity_ids`:one2many, `activity_state`:selection, `activity_summary`:char, `activity_type_id`:many2one, `activity_user_id`:many2one, `channel_ids`:many2many, `is_blacklisted`:boolean, `message_attachment_count`:integer, `message_bounce`:integer, `message_channel_ids`:many2many, `message_follower_ids`:one2many, `message_has_error`:boolean, `message_has_error_counter`:integer, `message_ids`:one2many, `message_is_follower`:boolean, `message_main_attachment_id`:many2one, `message_needaction`:boolean, `message_needaction_counter`:integer, `message_partner_ids`:many2many, `message_unread`:boolean, `message_unread_counter`:integer |
| partner_autocomplete | `additional_info`:char, `partner_gid`:integer |
| payment | `payment_token_count`:integer, `payment_token_ids`:one2many |
| portal | `website_message_ids`:one2many |
| product | `property_product_pricelist`:many2one |
| purchase | `property_purchase_currency_id`:many2one, `purchase_order_count`:integer, `purchase_warn`:selection, `purchase_warn_msg`:text, `supplier_invoice_count`:integer |
| purchase_request | `image_seal`:binary, `image_sign`:binary |
| sale | `sale_order_count`:integer, `sale_order_ids`:one2many, `sale_warn`:selection, `sale_warn_msg`:text |
| sale_custom | `arabic_city_name`:char, `arabic_name`:char, `arabic_street2_name`:char, `cash_customer`:boolean, `customer_code`:char, `discount`:float, `fax`:char, `vandor_number`:char, `vat_arabic`:char |
| sale_custom,att_vehicle_sync | `cr_number`:char |
| sales_team,crm | `team_id`:many2one |
| stock | `picking_warn`:selection, `picking_warn_msg`:text, `property_stock_customer`:many2one, `property_stock_supplier`:many2one |
| subscription_management | `vehicle_ids`:one2many |
| website | `website_id`:many2one |


**Excluded but the Node team must know about them (inserts into `res_users` would fail otherwise)**

| Column in `res_users` | Owner module | NOT NULL | Python default | Values |
|---|---|---|---|---|
| `notification_type` | `mail` (standard) | Yes | `email` | `email`, `inbox` |
| `odoobot_state` | `mail_bot` (standard) | Yes | `not_initialized` | `not_initialized, onboarding_emoji, onboarding_attachement, onboarding_command, onboarding_ping, idle, disabled` |
| `sidebar_type` | `muk_web_theme` (custom) | Yes | `large` | `invisible, small, large` |
| `chatter_position` | `muk_web_theme` (custom) | Yes | `sided` | `normal, sided` |

These columns have **no SQL default** (defaults are applied by the ORM), so any direct insert must supply them. Other excluded columns in `res_users` are nullable.

**Live-DB deviations from stock Odoo 12** (the field list in sections 1, 2 and 6 and in the CSV is stock; these are the only places custom/other modules alter it - handle them in the Node layer if the live data must be preserved):

| Item | Stock Odoo 12 (this spec) | Live DB |
|---|---|---|
| `res.partner.type` values | `contact, invoice, delivery, other, private` | plus `child_company`, `manager` (`att_vehicle_sync`, `att_installation_request`); 259 partners are `manager`, all user partners are `contact` |
| `res.partner.tz` default | context timezone | company `default_user_tz` (`create_user_wizard`) |
| `res_users.login` uniqueness | `UNIQUE (login)` | `UNIQUE (login, website_id)` (`website`) |
| `name, street, street2, zip, city, state_id, country_id, email, phone, mobile, vat` | plain fields | same columns/types, only `track_visibility='onchange'` added (`att_vehicle_sync`) |

## 6. Final consolidated User Management field list

One row per field in scope. **Model** is the model that *owns the field definition and storage*. Partner rows are reachable from a user as `res.users.<field>` (inherited related) except the shadowed names noted in section 2 (`active` appears as `res.users.active_partner`). Full detail (labels, help text, defaults, selection values, descriptions) is in sections 1-2 and in `12_user_management_fields.csv` (same data, one row per field with every requested attribute).


| Model | Field | Type | Req | RO | Physical storage | Kind |
|---|---|---|---|---|---|---|
| `res.users` | `partner_id` | many2one -> res.partner | Yes | No | column res_users.partner_id | column |
| `res.users` | `login` | char | Yes | No | column res_users.login | column |
| `res.users` | `password` | char | No | No | column res_users.password | column |
| `res.users` | `new_password` | char | No | No | Not stored - ORM computed/virtual | computed, not stored |
| `res.users` | `signature` | html | No | No | column res_users.signature | column |
| `res.users` | `active` | boolean | No | No | column res_users.active | column |
| `res.users` | `action_id` | many2one -> ir.actions.actions | No | No | column res_users.action_id | column |
| `res.users` | `groups_id` | many2many -> res.groups | No | No | M2M table res_groups_users_rel (uid, gid) | relation table |
| `res.users` | `log_ids` | one2many -> res.users.log | No | No | O2M inverse: res_users_log.create_uid (no column) | inverse O2M (no column) |
| `res.users` | `login_date` | datetime | No | No | Not stored - related, max/first res_users_log.create_date | computed, not stored |
| `res.users` | `share` | boolean | No | Yes | column res_users.share | column |
| `res.users` | `companies_count` | integer | No | Yes | Not stored - ORM computed/virtual | computed, not stored |
| `res.users` | `tz_offset` | char | No | Yes | Not stored - ORM computed/virtual | computed, not stored |
| `res.users` | `company_id` | many2one -> res.company | Yes | No | column res_users.company_id | column |
| `res.users` | `company_ids` | many2many -> res.company | No | No | M2M table res_company_users_rel (user_id, cid) | relation table |
| `res.users` | `name` | char | No | No | NOT a res_users column - stored in res_partner.name via partner_id | related (stored on partner) |
| `res.users` | `email` | char | No | No | NOT a res_users column - stored in res_partner.email via partner_id | related (stored on partner) |
| `res.users` | `id` | integer | No | Yes | column res_users.id | column |
| `res.users` | `create_date` | datetime | No | Yes | column res_users.create_date | column |
| `res.users` | `create_uid` | many2one -> res.users | No | Yes | column res_users.create_uid | column |
| `res.users` | `write_date` | datetime | No | Yes | column res_users.write_date | column |
| `res.users` | `write_uid` | many2one -> res.users | No | Yes | column res_users.write_uid | column |
| `res.users` | `__last_update` | datetime | No | Yes | Not stored - ORM computed/virtual | computed, not stored |
| `res.users` | `display_name` | char | No | Yes | Not stored - ORM computed/virtual | computed, not stored |
| `res.partner` | `name` | char | No | No | column res_partner.name | column |
| `res.partner` | `display_name` | char | No | Yes | column res_partner.display_name | column |
| `res.partner` | `date` | date | No | No | column res_partner.date | column |
| `res.partner` | `title` | many2one -> res.partner.title | No | No | column res_partner.title | column |
| `res.partner` | `parent_id` | many2one -> res.partner | No | No | column res_partner.parent_id | column |
| `res.partner` | `parent_name` | char | No | Yes | Not stored - ORM computed/related | computed, not stored |
| `res.partner` | `child_ids` | one2many -> res.partner | No | No | O2M inverse: res_partner.parent_id (no column) | inverse O2M (no column) |
| `res.partner` | `ref` | char | No | No | column res_partner.ref | column |
| `res.partner` | `lang` | selection | No | No | column res_partner.lang | column |
| `res.partner` | `tz` | selection | No | No | column res_partner.tz | column |
| `res.partner` | `tz_offset` | char | No | Yes | Not stored - ORM computed/related | computed, not stored |
| `res.partner` | `user_id` | many2one -> res.users | No | No | column res_partner.user_id | column |
| `res.partner` | `vat` | char | No | No | column res_partner.vat | column |
| `res.partner` | `bank_ids` | one2many -> res.partner.bank | No | No | O2M inverse: res_partner_bank.partner_id (no column) | inverse O2M (no column) |
| `res.partner` | `website` | char | No | No | column res_partner.website | column |
| `res.partner` | `comment` | text | No | No | column res_partner.comment | column |
| `res.partner` | `category_id` | many2many -> res.partner.category | No | No | M2M table res_partner_res_partner_category_rel (partner_id, category_id) | relation table |
| `res.partner` | `credit_limit` | float | No | No | column res_partner.credit_limit | column |
| `res.partner` | `barcode` | char | No | No | column res_partner.barcode | column |
| `res.partner` | `active` | boolean | No | No | column res_partner.active | column |
| `res.partner` | `customer` | boolean | No | No | column res_partner.customer | column |
| `res.partner` | `supplier` | boolean | No | No | column res_partner.supplier | column |
| `res.partner` | `employee` | boolean | No | No | column res_partner.employee | column |
| `res.partner` | `function` | char | No | No | column res_partner.function | column |
| `res.partner` | `type` | selection | No | No | column res_partner.type | column |
| `res.partner` | `street` | char | No | No | column res_partner.street | column |
| `res.partner` | `street2` | char | No | No | column res_partner.street2 | column |
| `res.partner` | `zip` | char | No | No | column res_partner.zip | column |
| `res.partner` | `city` | char | No | No | column res_partner.city | column |
| `res.partner` | `state_id` | many2one -> res.country.state | No | No | column res_partner.state_id | column |
| `res.partner` | `country_id` | many2one -> res.country | No | No | column res_partner.country_id | column |
| `res.partner` | `email` | char | No | No | column res_partner.email | column |
| `res.partner` | `email_formatted` | char | No | Yes | Not stored - ORM computed/related | computed, not stored |
| `res.partner` | `phone` | char | No | No | column res_partner.phone | column |
| `res.partner` | `mobile` | char | No | No | column res_partner.mobile | column |
| `res.partner` | `is_company` | boolean | No | No | column res_partner.is_company | column |
| `res.partner` | `industry_id` | many2one -> res.partner.industry | No | No | column res_partner.industry_id | column |
| `res.partner` | `company_type` | selection | No | No | Not stored - ORM computed/related | computed, not stored |
| `res.partner` | `company_id` | many2one -> res.company | No | No | column res_partner.company_id | column |
| `res.partner` | `color` | integer | No | No | column res_partner.color | column |
| `res.partner` | `user_ids` | one2many -> res.users | No | No | O2M inverse: res_users.partner_id (no column) | inverse O2M (no column) |
| `res.partner` | `partner_share` | boolean | No | Yes | column res_partner.partner_share | column |
| `res.partner` | `contact_address` | char | No | Yes | Not stored - ORM computed/related | computed, not stored |
| `res.partner` | `commercial_partner_id` | many2one -> res.partner | No | Yes | column res_partner.commercial_partner_id | column |
| `res.partner` | `commercial_company_name` | char | No | Yes | column res_partner.commercial_company_name | column |
| `res.partner` | `company_name` | char | No | No | column res_partner.company_name | column |
| `res.partner` | `image` | binary | No | No | Binary, attachment=True: stored in ir_attachment (res_model='res.partner', res_field='image', res_id=partner id), NOT a column | attachment |
| `res.partner` | `image_medium` | binary | No | No | Binary, attachment=True: stored in ir_attachment (res_model='res.partner', res_field='image_medium', res_id=partner id), NOT a column | attachment |
| `res.partner` | `image_small` | binary | No | No | Binary, attachment=True: stored in ir_attachment (res_model='res.partner', res_field='image_small', res_id=partner id), NOT a column | attachment |
| `res.partner` | `self` | many2one -> res.partner | No | Yes | Not stored - ORM computed/related | computed, not stored |
| `res.partner` | `id` | integer | No | Yes | column res_partner.id | column |
| `res.partner` | `create_date` | datetime | No | Yes | column res_partner.create_date | column |
| `res.partner` | `create_uid` | many2one -> res.users | No | Yes | column res_partner.create_uid | column |
| `res.partner` | `write_date` | datetime | No | Yes | column res_partner.write_date | column |
| `res.partner` | `write_uid` | many2one -> res.users | No | Yes | column res_partner.write_uid | column |
| `res.partner` | `__last_update` | datetime | No | Yes | Not stored - ORM computed/related | computed, not stored |


## 7. Needs Verification

| Item | Why it could not be closed from the source/DB |
|---|---|
| Exact `tz` list for the Node validator | Generated at runtime from the installed `pytz` version; the Node tz library may differ slightly. Validate against values actually stored in `res_partner.tz`. |
| Exact `lang` list | Depends on active rows in `res_lang`, which is per-database data, not source. |
| Whether Node must keep the `res_users` / `res_partner` 1:1 guarantee | Schema allows 0..n users per partner; live data is 1:1. A business decision, not derivable from source. |

Everything else in sections 1-6 was confirmed in source **and** in the live DB metadata.
