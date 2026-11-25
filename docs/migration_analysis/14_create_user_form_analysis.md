# 14. Create User form (`res.users`) – live page analysis

> **Page:** `http://127.0.0.1:5000/web?#id=&action=1130&model=res.users&view_type=form&menu_id=611`
> **Instance:** Odoo 12.0, database `yamama_live_191126`, inspected 2026-11-24 as `admin` (uid 2, lang `en_US`, tz `Asia/Riyadh`).
> **Scope:** `res.users` only. `hr.employee` was not touched.
> **Nothing was created, saved or modified.** Only read calls were made (`read`, `search_read`, `fields_get`, `fields_view_get`, `default_get`, `onchange`, `check_access_rights`).

## Method and evidence levels

No browser was available, so the page was not rendered or scrolled. Everything comes from the running server's own metadata over JSON-RPC:

| Tag | Meaning |
|---|---|
| **Live** | Returned by the running Odoo (`fields_view_get` for the merged form, `fields_get`, `default_get`, `ir.*` records) |
| **Source** | Read from the local Odoo source tree. It is the running code, but the message was not triggered on the live page |
| **Unverified** | Could not be confirmed without rendering the page or triggering an action |

---

## 1. Page identity

| Item | Value | Evidence |
|---|---|---|
| Menu id 611 | name `Users`, top-level (no parent), **no action of its own**, restricted to group id 172 (`GCC User Manager`) | Live |
| Action id 1130 | name `Users`, XML id `att_gcc_users.action_gcc_users`, type `ir.actions.act_window` | Live |
| `res_model` / `view_mode` | `res.users` / `tree,form` (views: tree id 145, form id 144) | Live |
| Action domain | `[('is_gcc_user', '=', True), ('id', 'not in', [1, 2])]` | Live |
| Action context | `{'default_is_gcc_user': True, 'no_reset_password': True}` | Live |
| Page limit | 80 records per list page | Live |
| Form view | id 144, `base.view_users_form`, name `res.users.form`, root `<form string="Users">` | Live |
| Form-view extensions applied | `purchase_request.res_user_department` (1451), `att_gcc_users.view_users_form_gcc_inherit` (2113), `auth_signup.res_users_view_form` (324), `api_configuration.view_res_users_forms_inherit1122` (1492), `mail.view_users_form_mail` (297), `mail_bot.res_users_view_form` (351), `base.user_groups_view` (148), `account_customization.res_user_user_signature` (1549) | Live |
| Which menu child opens action 1130 | Not checked (menu 611 itself has no action) | Unverified |
| Admin can create / write `res.users` | Yes / Yes (`check_access_rights`) | Live |

`res.users` is `_inherits` of `res.partner` through `partner_id`. `name`, `email`, `lang`, `tz`, `image`, `signup_url` and `signup_valid` are related fields stored on the partner, not on the user.

## 2. Page structure (in render order)

```
Form "Users"
├─ Header (statusbar bar)
│   ├─ Button  "Send Reset Password Instructions"   (visible when state = 'active')
│   ├─ Button  "Send an Invitation Email"           (visible when state = 'new')
│   └─ Statusbar  state  ("Never Connected" → "Confirmed")
└─ Sheet
    ├─ Hidden: id
    ├─ Button box
    │   └─ Stat button (toggle_active, icon fa-check) → boolean_button widget on `active`
    ├─ Alert (green)  password-reset / invitation link banner  [only if signup_valid]
    │       "A password reset has been requested for this user. An email containing the following link has been sent:"   (state = 'active')
    │       "An invitation email containing the following subscription link has been sent:"                              (state = 'new')
    │       signup_url (url widget)
    ├─ Alert (blue)   archived-contact banner                  [only if active = False]
    │       "The contact linked to this user is still active"
    │       "You can archive the contact" + partner_id (readonly)
    ├─ Avatar image                      image
    ├─ Title block
    │   ├─ Label "Name"                  name (H1, required)
    │   ├─ Hidden: email
    │   ├─ Label "Email Address"         login (H2)
    │   ├─ Label "Departments"           user_department_ids (many2many_tags)
    │   └─ Hidden group: partner_id
    ├─ Hidden group: token_name, device_reg_id
    └─ Notebook (2 tabs)
        ├─ Tab "Access Rights"
        │   ├─ Group "Multi Companies"       [only if companies_count > 1]
        │   │     Allowed Companies · Current Company · (hidden) Companies count
        │   ├─ Group (User Type, all hidden)  sel_groups_1_9_10 (radio, invisible)
        │   ├─ Group "Application Accesses"   [only if User type = Internal User]   (21 selection fields)
        │   └─ Group (4 columns)              [only if User type = Internal User]   (64 visible + 43 hidden checkboxes)
        │         13 headed sections: Sales … Other   (see section 6)
        └─ Tab "Preferences"
            ├─ Group "Localization"           Password · Set Password · Language · Timezone · Signature (image)
            │                                 hidden: tz_offset
            ├─ Group "GCC"                    (whole group invisible) pseudo_name, is_gcc_user
            ├─ Group "Menus Customization"    (whole group invisible) action_id
            └─ Group "Messaging and Social"   Notification Management · Alias · Alias Contact Security · Signature
                                              hidden: odoobot_state
```

The tab headings, section headings and button strings above are taken verbatim from the live merged arch.

## 3. Field inventory (all fields in the form, except the 129 group fields (22 `sel_groups_*` + 107 `in_group_*`) in section 6)

Required / readonly shown are the **effective** values: the model attribute, overridden by the form arch where the arch sets one. "Default" is `default_get` on a new record with the action context.

| UI label | Technical name | Type | Required | Readonly | Default (new form) | Visible? | Where / widget | Relation / storage |
|---|---|---|---|---|---|---|---|---|
| (statusbar) Status | `state` | selection | No | **Yes** | none (computed) | Yes | Header, `statusbar` | non-stored compute |
| Active | `active` | boolean | No | No | `True` | Yes | Button box, `boolean_button` (terminology `active`) | `res_users.active`; shows a stat button, label from the widget |
| (image) | `image` | binary | No | No | none | Yes | Avatar, `image` widget, preview `image_medium` | related `partner_id.image` |
| Name | `name` | char | **Yes** (arch `required=1`; model: No) | No | none | Yes | H1 | related `partner_id.name` |
| Email | `email` | char | No | No | none | **Hidden** | title block | related `partner_id.email` |
| Email Address (label overridden; field string is `Login`) | `login` | char | **Yes** | No | none | Yes | H2; `on_change` | `res_users.login` |
| Departments (label overridden; field string is `User Department`) | `user_department_ids` | many2many | No | No | none | Yes | H2, `many2many_tags`, can_create/can_write | → `hr.department` (display relation only; 15 records exist) |
| Related Partner | `partner_id` | many2one | arch `required=0` (model: Yes, auto-created through `_inherits`) | **Yes** (arch) | none | Hidden (twice) and shown as read-only link only in the archived banner | | → `res.partner`, `res_users.partner_id` |
| Token | `token_name` | char | No | No | none | **Hidden** | | `res_users.token_name` |
| Device registered Id | `device_reg_id` | char | No | No | none | **Hidden** | | `res_users.device_reg_id` |
| Allowed Companies | `company_ids` | many2many | No | No | `[(6,0,[1])]` | If `companies_count > 1` | "Multi Companies" group, `many2many_tags`, `no_create` | → `res.company` (rel table `res_company_users_rel`) |
| Current Company | `company_id` | many2one | **Yes** | No | `1` (Flames of Al Yamama Trading Co) | If `companies_count > 1` | "Multi Companies" group, context `{'user_preference': 0}` | → `res.company`, `res_users.company_id` |
| Companies count | `companies_count` | integer | No | **Yes** | `6` | **Hidden** | "Multi Companies" group | non-stored compute |
| User types | `sel_groups_1_9_10` | selection (radio) | No | No | `1` (Internal User) | **Hidden** | "User Type" group | virtual → `res.groups` 1/9/10 |
| Password | `password` | char | No | No | none | Yes | Preferences › Localization | non-stored; help: "Keep empty if you don't want the user to be able to connect on the system." |
| Set Password | `new_password` | char | No | No | none | Yes | Preferences › Localization | non-stored; help: "Specify a value only when creating a user or if you're changing the user's password, otherwise leave empty. After a change of password, the user has to login again." |
| Language | `lang` | selection | No | No | `en_US` | Yes | Preferences › Localization | related `partner_id.lang` |
| Timezone | `tz` | selection | No | No | `Asia/Calcutta` | Yes | Preferences › Localization; widget `timezone_mismatch` (`tz_offset_field: tz_offset`); `on_change` | related `partner_id.tz` |
| Timezone offset | `tz_offset` | char | No | **Yes** | none | **Hidden** | | non-stored compute |
| Signature | `user_signature` | binary | No | No | none | Yes | Preferences › Localization, `image` widget, class `oe_avatar` | `res_users.user_signature` |
| Pseudo Name | `pseudo_name` | char | No | No | none | **Hidden** (group "GCC" invisible) | | `res_users.pseudo_name` |
| GCC User | `is_gcc_user` | boolean | No | No | `True` (from context `default_is_gcc_user`) | **Hidden** (group "GCC" invisible) | | `res_users.is_gcc_user` |
| Home Action | `action_id` | many2one | No | No | none | **Hidden** (group "Menus Customization" invisible) | | → `ir.actions.actions`. Help: "If specified, this action will be opened at log on for this user, in addition to the standard menu." |
| Notification Management | `notification_type` | selection (radio) | **Yes** | No | `email` | Yes | Preferences › Messaging and Social | `res_users.notification_type` |
| Alias | `alias_id` | many2one | No | No | none | Yes | Preferences › Messaging and Social; `on_change` | → `mail.alias`. Help: "Email address internally associated with this user. Incoming emails will appear in the user's notifications." |
| Alias Contact Security | `alias_contact` | selection | No | No | none | If `alias_id` is set | Preferences › Messaging and Social | related `alias_id.alias_contact` |
| OdooBot Status | `odoobot_state` | selection | Yes (model) | arch `readonly=0` | `not_initialized` | **Hidden** | | `res_users.odoobot_state` |
| Signature | `signature` | html | No | No | none | Yes | Preferences › Messaging and Social | `res_users.signature` |
| ID | `id` | integer | No | **Yes** | none | **Hidden** | top of sheet | magic field |
| Signup URL | `signup_url` | char | No | **Yes** | none | Only inside the green banner | `url` widget | related `partner_id.signup_url` |
| Signup Token is Valid | `signup_valid` | boolean | No | **Yes** | none | **Hidden** (drives the green banner) | | related `partner_id.signup_valid` |

Both `Name` fields: the form has a `<label for="name">` with no `string`, so the page shows the field string **Name**.
The "Signature" label appears twice on the Preferences tab: the binary image `user_signature` (Localization) and the HTML `signature` (Messaging and Social).

### Field help text (tooltips)

The arch defines no `title`, `placeholder` or `confirm` attributes. The only tooltip text is the model `help` that Odoo shows on hover. These were returned live:

| Field | Help |
|---|---|
| `login` | Used to log into the system |
| `password` | Keep empty if you don't want the user to be able to connect on the system. |
| `new_password` | Specify a value only when creating a user or if you're changing the user's password, otherwise leave empty. After a change of password, the user has to login again. |
| `company_id` | The company this user is currently working for. |
| `partner_id` | Partner-related data of the user |
| `action_id` | If specified, this action will be opened at log on for this user, in addition to the standard menu. |
| `alias_id` | Email address internally associated with this user. Incoming emails will appear in the user's notifications. |
| `alias_contact` | Policy to post a message on the document using the mailgateway. - everyone: everyone can post; partners: only authenticated partners; followers: only followers of the related document or members of following channels |
| `notification_type` | Policy on how to handle Chatter notifications: Handle by Emails: notifications are sent to your email address; Handle in Odoo: notifications appear in your Odoo Inbox |
| `lang` | All the emails and documents sent to this contact will be translated in this language. |
| `tz` | The partner's timezone, used to output proper date and time values inside printed reports. It is important to set a value for this field. You should use the same timezone that is otherwise used to pick and render date and time values: your computer's timezone. |
| `image` | This field holds the image used as avatar for this contact, limited to 1024x1024px |
| `sel_groups_1_9_10` | Portal: Portal members have specific access rights (such as record rules and restricted menus). They usually do not belong to the usual Odoo groups. Public: Public users have specific access rights (such as record rules and restricted menus). They usually do not belong to the usual Odoo groups. |
| `sel_groups_53_54` | Officer: The user will be able to approve document created by employees. Manager: The user will have access to the human resources configuration as well as statistic reports. |
| `sel_groups_70_68_69` | Manual Attendance: The user will gain access to the human resources attendance menu, enabling him to manage his own attendance. |
| `sel_groups_171` | ATT General Menu Access: Grants visibility of the Discuss, Website, Employees, Leaves, Dashboards (and any other configured) top menus. Remove this group from a user to hide those menus, unless the user also holds another group that independently grants access to the same menu (e.g. HR User/Manager for Employees). |
| Several `in_group_*` | Same text as the group's comment (see section 6.3) |

## 4. Dropdown / selection options

| Field | UI label | Options (stored value → label) | Default |
|---|---|---|---|
| `state` | Status | `new` → Never Connected · `active` → Confirmed | computed |
| `notification_type` | Notification Management (radio) | `email` → Handle by Emails · `inbox` → Handle in Odoo | `email` |
| `alias_contact` | Alias Contact Security | `everyone` → Everyone · `partners` → Authenticated Partners · `followers` → Followers only · `employees` → Authenticated Employees | none |
| `lang` | Language | `en_US` → English (**only one language is installed**; Arabic is not offered) | `en_US` |
| `tz` | Timezone | 589 entries (pytz names, full list in Appendix A) | `Asia/Calcutta` (company default `default_user_tz` of company 1) |
| `odoobot_state` (hidden) | OdooBot Status | `not_initialized`, `onboarding_emoji`, `onboarding_attachement`, `onboarding_command`, `onboarding_ping`, `idle`, `disabled` | `not_initialized` |
| `sel_groups_1_9_10` (hidden radio) | User types | `1` → Internal User · `9` → Portal · `10` → Public | `1` |
| `company_id`, `company_ids` | Current Company / Allowed Companies | 6 companies: 1 Flames of Al Yamama Trading Co · 5 Flames of Al-Yamama Hydraulic Co · 6 Flames of Al Yamama Agriculture Co · 7 Team Yamama · 9 Al Yamama Advanced Logistics Services Co · 12 Corporate | `company_id` = 1 |
| `user_department_ids` | Departments | Records of `hr.department` (15 exist). Names not listed: **unverified** | none |
| `alias_id` | Alias | Records of `mail.alias`. Not enumerated: **unverified** | none |
| `action_id` (hidden) | Home Action | Records of `ir.actions.actions`. Not enumerated | none |
| 21 `sel_groups_*` fields | Application Accesses | See section 6.2 | see 6.2 |

## 5. Buttons and exact UI strings

| Element | Exact text | Technical | Visible when |
|---|---|---|---|
| Header button | **Send Reset Password Instructions** | `type=object`, `action_reset_password` | `state = 'active'` |
| Header button | **Send an Invitation Email** | `type=object`, `action_reset_password`, context `{'create_user': 1}` | `state = 'new'` |
| Stat button | (no text; `boolean_button` shows "Active"/"Archived" from the widget) | `type=object`, `toggle_active`, icon `fa-check`, class `oe_stat_button` | always |
| Green banner, line 1 | A password reset has been requested for this user. An email containing the following link has been sent: | | `signup_valid` true and `state = 'active'` |
| Green banner, line 2 | An invitation email containing the following subscription link has been sent: | | `signup_valid` true and `state = 'new'` |
| Blue banner | The contact linked to this user is still active | | `active = False` |
| Blue banner | You can archive the contact | followed by `partner_id` | `active = False` |
| Banner close links | `x` (anchor with `aria-label="Close"`) | | |
| Tabs | **Access Rights**, **Preferences** | `page name="access_rights"` and an unnamed page | |
| Group headings | Multi Companies · Application Accesses · Localization · Messaging and Social · (hidden: GCC, Menus Customization, User Type, Technical Settings, Extra Rights) | | |
| Label overrides | `Email Address` (for `login`), `Departments` (for `user_department_ids`), `Allowed Companies`, `Current Company`, `Companies count` | | |

There is no Save or Discard button defined in the arch. Those come from the standard Odoo 12 form control panel, which I could not render, so they are **unverified**.
Whether either header button is visible on an unsaved record depends on how `state` computes for a new record. `state` is not returned by `default_get` or the login `onchange`, so its value on a blank form is **unverified**.

---

## 6. Access rights

### 6.1 User type (`sel_groups_1_9_10`)

The control is hidden, so it cannot be changed on this form. The new record defaults to **Internal User** (`base.group_user`, id 1), which keeps both groups below visible. Portal (id 9) and Public (id 10) would hide them.

### 6.2 Application Accesses (21 selection fields, one per application)

Each is a dropdown that maps to one or more `res.groups`. A blank option removes the group.

| UI label | Technical field | Options (group id = shown text) | Default on new form |
|---|---|---|---|
| GCC User Manager | `sel_groups_172` | (blank); 172 = GCC User Manager | (blank) |
| Asset Rental | `sel_groups_149` | (blank); 149 = Users | (blank) |
| Auto backup access | `sel_groups_85` | (blank); 85 = Manager | (blank) |
| Inventory | `sel_groups_40_41` | (blank); 40 = User; 41 = Manager | (blank) |
| Manufacturing | `sel_groups_137_138` | (blank); 137 = User; 138 = Manager | 138 = Manager |
| Purchases | `sel_groups_81_82` | (blank); 81 = User; 82 = Manager | 82 = Manager |
| Employees | `sel_groups_53_54` | (blank); 53 = Officer; 54 = Manager | (blank) |
| Overtime | `sel_groups_142_143` | (blank); 142 = Overtime User; 143 = Overtime Manager | (blank) |
| API Configuration Access | `sel_groups_125` | (blank); 125 = Dashboard Access Manager | (blank) |
| Contracts | `sel_groups_58` | (blank); 58 = Manager | (blank) |
| Leaves | `sel_groups_59_60` | (blank); 59 = Officer; 60 = Manager | (blank) |
| Attendance | `sel_groups_70_68_69` | (blank); 70 = Manual Attendance; 68 = Officer; 69 = Manager | (blank) |
| After-Sales | `sel_groups_159_160` | (blank); 159 = User; 160 = Manager | 160 = Manager |
| ZK Machine | `sel_groups_72` | (blank); 72 = Clear data from zk machine | (blank) |
| Consumable Delivery Orders | `sel_groups_158` | (blank); 158 = Consumables Delivery User | (blank) |
| Direct Delivery | `sel_groups_144` | (blank); 144 = Direct Delivery User | (blank) |
| Direct User Creation | `sel_groups_73_74` | (blank); 73 = User; 74 = Manager | (blank) |
| User Notify List | `sel_groups_67` | (blank); 67 = Manager | (blank) |
| Website | `sel_groups_151_152` | (blank); 151 = Restricted Editor; 152 = Editor and Designer | 152 = Editor and Designer |
| Administration | `sel_groups_2_3` | (blank); 2 = Access Rights; 3 = Settings | (blank) |
| ATT Menu Access | `sel_groups_171` | (blank); 171 = ATT General Menu Access | (blank) |

### 6.3 Per-application checkboxes (group `col=4`, shown only when User type = Internal User)


**Section: Sales**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Discounts | `in_group_48` | 48 | `sale_custom.group_discount_configuration` | 13 (Sales / Manager) | No |
| Manager | `in_group_13` | 13 | `sales_team.group_sale_manager` | 140 (Sales Quotation Management / Sale Quotation Only User), 12 (Sales / User: All Documents) | No |
| Teltonika User Config | `in_group_165` | 165 | `sale_custom.group_teltonika_user_configuration` | - | No |
| User: All Documents | `in_group_12` | 12 | `sales_team.group_sale_salesman_all_leads` | 140 (Sales Quotation Management / Sale Quotation Only User), 11 (Sales / User: Own Documents Only) | No |
| User: Own Documents Only | `in_group_11` | 11 | `sales_team.group_sale_salesman` | 1 (User types / Internal User), 141 (Sales Quotation Management / Sale Quotation Approver) | No |

**Section: Installation Request**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Manager | `in_group_153` | 153 | `att_installation_request.group_att_installation_request_managers` | - | No |
| Sales Person | `in_group_155` | 155 | `att_installation_request.group_att_installation_request_sales_person` | - | No |
| Sales Person : Own Documents | `in_group_168` | 168 | `att_installation_request.group_att_installation_request_sales_person_own_documents` | - | No |
| Support | `in_group_163` | 163 | `att_installation_request.group_att_installation_request_support` | - | No |
| Technician | `in_group_154` | 154 | `att_installation_request.group_att_installation_request_users` | - | No |
| Warehouse Manager | `in_group_156` | 156 | `att_installation_request.group_att_installation_request_wh_manager` | - | No |

**Section: Sales Quotation Management**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Sale Quotation Approver | `in_group_141` | 141 | `sale_custom.sale_quotation_approver` | 140 (Sales Quotation Management / Sale Quotation Only User) | No |
| Sale Quotation Only User | `in_group_140` | 140 | `sale_custom.sale_quotation_only_access` | 148 (Sales Quotation Management / View Quotations) | No |
| Teltonika User | `in_group_164` | 164 | `sale_custom.group_teltonika_user` | - | No |
| View Quotations | `in_group_148` | 148 | `sale_custom.sale_quotation_read_access` | - | No |

**Section: Accounting & Finance**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Accountant | `in_group_26` | 26 | `account.group_account_user` | 23 (Accounting & Finance / Billing) | No |
| Billing | `in_group_23` | 23 | `account.group_account_invoice` | 1 (User types / Internal User) | No |
| Billing Manager | `in_group_27` | 27 | `account.group_account_manager` | 23 (Accounting & Finance / Billing) | No |
| Final Approval | `in_group_124` | 124 | `purchase_custom_data.group_account_final_invoice_approval` | 123 (Accounting & Finance / Initial Approval) | No |
| Initial Approval | `in_group_123` | 123 | `purchase_custom_data.group_account_initial_invoice_approval` | 23 (Accounting & Finance / Billing) | No |
| Subscription Approver | `in_group_166` | 166 | `subscription_management.group_subscription_approver` | 23 (Accounting & Finance / Billing) | No |

**Section: Document**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| IT Renewal | `in_group_132` | 132 | `(no xml id)` | - | No |
| Licenses & Company Registration Renewals | `in_group_133` | 133 | `(no xml id)` | - | No |
| Manager | `in_group_127` | 127 | `employee_document_management.group_document_manager` | 126 (Document / User) | No |
| User | `in_group_126` | 126 | `employee_document_management.group_document_user` | - | No |

**Section: HR Custom**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Allow Cancel Leaves | `in_group_64` | 64 | `hr_holidays_custom.group_allow_cancel_leave` | - | No |
| HR Hierarchy Access Group | `in_group_56` | 56 | `hr_custom.group_hr_hierarchy_access` | - | No |
| Leave First Level Approver | `in_group_61` | 61 | `hr_holidays_custom.group_leave_first_level` | 59 (Leaves / Officer) | No |
| Leave Request for Others | `in_group_65` | 65 | `hr_holidays_custom.group_leave_request_others` | 62 (HR Custom / Leave Second Level Approver) | No |
| Leave Second Level Approver | `in_group_62` | 62 | `hr_holidays_custom.group_leave_second_level` | 61 (HR Custom / Leave First Level Approver) | No |
| Leave Superior Access | `in_group_63` | 63 | `hr_holidays_custom.group_leave_superior_access` | 62 (HR Custom / Leave Second Level Approver) | No |
| Log Access Group | `in_group_55` | 55 | `hr_custom.group_hr_log_access` | - | No |

**Section: Internal Voucher**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Internal Voucher CEO | `in_group_136` | 136 | `account_voucher_extension.group_att_internal_voucher_ceo` | 26 (Accounting & Finance / Accountant) | No |
| Internal Voucher HOD | `in_group_135` | 135 | `account_voucher_extension.group_att_internal_voucher_hod` | 26 (Accounting & Finance / Accountant) | No |
| Internal Voucher User | `in_group_134` | 134 | `account_voucher_extension.group_att_internal_voucher_employee` | 26 (Accounting & Finance / Accountant) | No |

**Section: Payable Voucher**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Payable Voucher CEO | `in_group_131` | 131 | `account_voucher_extension.group_att_account_voucher_ceo` | 26 (Accounting & Finance / Accountant) | No |
| Payable Voucher HOD | `in_group_130` | 130 | `account_voucher_extension.group_att_account_voucher_hod` | 26 (Accounting & Finance / Accountant) | No |
| Payable Voucher User | `in_group_129` | 129 | `account_voucher_extension.group_att_account_voucher_employee` | 26 (Accounting & Finance / Accountant) | No |

**Section: Purchase Orders**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Purchase Order Account Manager | `in_group_121` | 121 | `purchase_custom_data.group_purchase_order_account_manager` | 120 (Purchase Orders / Purchase Order HOD) | No |
| Purchase Order HOD | `in_group_120` | 120 | `purchase_custom_data.group_purchase_order_hod` | 119 (Purchase Orders / Purchase Order User) | No |
| Purchase Order Initial Approval | `in_group_162` | 162 | `purchase_custom_data.group_purchase_order_initial_approval` | 119 (Purchase Orders / Purchase Order User) | No |
| Purchase Order RFQ Create | `in_group_118` | 118 | `purchase_custom_data.group_purchase_order_rfq_create` | 1 (User types / Internal User) | No |
| Purchase Orders CEO | `in_group_122` | 122 | `purchase_custom_data.groups_purchase_order_ceo` | 121 (Purchase Orders / Purchase Order Account Manager) | No |
| Purchase Order User | `in_group_119` | 119 | `purchase_custom_data.group_purchase_order_user` | 1 (User types / Internal User) | No |

**Section: Purchase Request**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Purchase Request Account Manager | `in_group_90` | 90 | `purchase_request.group_purchase_request_account_manager` | 89 (Purchase Request / Purchase Request HOD) | No |
| Purchase Request: All Documents | `in_group_145` | 145 | `purchase_request.group_purchase_request_user_all_documents` | 88 (Purchase Request / Purchase Request User) | No |
| Purchase Request CEO | `in_group_91` | 91 | `purchase_request.group_purchase_request_ceo` | 90 (Purchase Request / Purchase Request Account Manager) | No |
| Purchase Request HOD | `in_group_89` | 89 | `purchase_request.group_purchase_request_hod` | 88 (Purchase Request / Purchase Request User) | No |
| Purchase Request Manager | `in_group_92` | 92 | `purchase_request.group_purchase_request_manager` | 88 (Purchase Request / Purchase Request User) | No |
| Purchase Request User | `in_group_88` | 88 | `purchase_request.group_purchase_request_user` | 1 (User types / Internal User) | No |
| Purchase RFQ Create | `in_group_87` | 87 | `purchase_request.group_purchase_rfq_create` | 1 (User types / Internal User) | No |

**Section: Job Estimation**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| CRM CR No. Required | `in_group_170` | 170 | `crm_customization.group_crm_cr_no_required` | 1 (User types / Internal User) | No |
| Manager | `in_group_76` | 76 | `crm_customization.group_job_estimations_manager` | 75 (Job Estimation / User) | No |
| User | `in_group_75` | 75 | `crm_customization.group_job_estimations_user` | 1 (User types / Internal User) | No |

**Section: Subscription User**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Subscription Data Manager | `in_group_167` | 167 | `subscription_management.subscription_data_manager` | - | No |
| Subscription Manager | `in_group_147` | 147 | `subscription_management.subscription_manager` | 146 (Subscription User / Subscription User) | No |
| Subscription User | `in_group_146` | 146 | `subscription_management.subscription_user` | - | No |

**Section: Other**

| UI label | Technical field | Group id | Group XML id | Implies (group ids) | Checked on new form |
|---|---|---|---|---|---|
| Access to Private Addresses | `in_group_8` | 8 | `base.group_private_addresses` | - | Yes |
| Multi-website | `in_group_150` | 150 | `website.group_multi_website` | - | No |
| Product Creation | `in_group_128` | 128 | `sale_custom.group_product_creation` | - | No |
| Quotation Templates | `in_group_37` | 37 | `sale_management.group_sale_order_template` | - | No |
| Show Settings & Contacts Menu | `in_group_173` | 173 | `(no xml id)` | - | No |
| Tax display B2B | `in_group_24` | 24 | `account.group_show_line_subtotals_tax_excluded` | - | Yes |
| Tax display B2C | `in_group_25` | 25 | `account.group_show_line_subtotals_tax_included` | - | No |

### 6.4 Hidden checkboxes that are still part of the form (`invisible="1"`)


**Hidden section: Technical Settings**

| Technical field | Label (group name) | Group XML id | Checked on new form |
|---|---|---|---|
| `in_group_32` | Addresses in Sales Orders | `sale.group_delivery_invoice_address` | No |
| `in_group_29` | Allow the cash rounding management | `account.group_cash_rounding` | No |
| `in_group_30` | Allow to define fiscal years of more or less than a year | `account.group_fiscal_year` | No |
| `in_group_16` | Analytic Accounting | `analytic.group_analytic_accounting` | No |
| `in_group_17` | Analytic Accounting Tags | `analytic.group_analytic_tags` | No |
| `in_group_169` | Analytic Account: Read Only | `account_customization.group_analytic_readonly` | No |
| `in_group_28` | A warning can be set on a partner (Account) | `account.group_warning_account` | No |
| `in_group_47` | A warning can be set on a partner (Stock) | `stock.group_warning_stock` | No |
| `in_group_84` | A warning can be set on a product or a customer (Purchase) | `purchase.group_warning_purchase` | No |
| `in_group_34` | A warning can be set on a product or a customer (Sale) | `sale.group_warning_sale` | No |
| `in_group_33` | Discount on lines | `sale.group_discount_per_so_line` | No |
| `in_group_50` | Display incoterms on Sales Order and related invoices | `sale_stock.group_display_incoterm` | No |
| `in_group_43` | Display Serial & Lot Number in Delivery Slips | `stock.group_lot_on_delivery_slip` | No |
| `in_group_71` | Enable PIN use | `hr_attendance.group_hr_attendance_use_pin` | No |
| `in_group_49` | Enable Route on Sales Order Line | `sale_stock.group_route_so_lines` | No |
| `in_group_57` | Hidden Menus | `hr_custom.group_hidden_menu` | No |
| `in_group_36` | Manage delivery dates from sales orders. | `sale.group_sale_order_dates` | No |
| `in_group_46` | Manage Different Stock Owners | `stock.group_tracking_owner` | No |
| `in_group_42` | Manage Lots / Serial Numbers | `stock.group_production_lot` | Yes |
| `in_group_38` | Manage Multiple Stock Locations | `stock.group_stock_multi_locations` | No |
| `in_group_15` | Manage Multiple Units of Measure | `uom.group_uom` | Yes |
| `in_group_39` | Manage Multiple Warehouses | `stock.group_stock_multi_warehouses` | No |
| `in_group_44` | Manage Packages | `stock.group_tracking_lot` | No |
| `in_group_19` | Manage Pricelist Items | `product.group_pricelist_item` | Yes |
| `in_group_21` | Manage Product Packaging | `product.group_stock_packaging` | No |
| `in_group_22` | Manage Product Variants | `product.group_product_variant` | No |
| `in_group_45` | Manage Push and Pull inventory flows | `stock.group_adv_location` | No |
| `in_group_83` | Manage Vendor Price | `purchase.group_manage_vendor_price` | Yes |
| `in_group_139` | Manage Work Order Operations | `mrp.group_mrp_routings` | No |
| `in_group_20` | Pricelists On Product | `product.group_product_pricelist` | No |
| `in_group_35` | Pro-forma Invoices | `sale.group_proforma_sales` | Yes |
| `in_group_157` | Purchase Type:Local Access | `purchase_custom.group_purchase_type_access` | No |
| `in_group_18` | Sales Pricelists | `product.group_sale_pricelist` | Yes |
| `in_group_14` | Show Lead Menu | `crm.group_use_lead` | Yes |
| `in_group_161` | Show SLA Policies | `att_helpdesk.group_use_sla` | Yes |
| `in_group_31` | Use products on vendor bills | `account.group_products_in_bills` | Yes |
| `in_group_86` | View Cumulative Account Reports | `cumulative_reports.group_view_cumulative_report` | No |
| `in_group_66` | View My Dashboards | `hr_holidays_custom.group_view_dashboards` | No |

**Hidden section: Extra Rights**

| Technical field | Label (group name) | Group XML id | Checked on new form |
|---|---|---|---|
| `in_group_7` | Contact Creation | `base.group_partner_manager` | Yes |
| `in_group_174` | Contact Creation (copy) | `(no xml id)` | No |
| `in_group_4` | Multi Companies | `base.group_multi_company` | Yes |
| `in_group_5` | Multi Currencies | `base.group_multi_currency` | Yes |
| `in_group_6` | Technical Features | `base.group_no_one` | Yes |

The group names, categories and implied groups above are **Live** (`res.groups`, `ir.model.data`). Groups with no XML id (`in_group_132`, `in_group_133`, `in_group_174`, `in_group_173`) were created from the UI/data and have no external identifier.

Summary of what the access-right area contains:

| Area | Count | Notes |
|---|---|---|
| User type radio | 1 (hidden) | Internal User / Portal / Public |
| Application Accesses dropdowns | 21 | 6 of them pre-select a value (see 6.2) |
| Visible checkboxes | 64 | in 13 headed sections |
| Hidden checkboxes | 43 | 38 under "Technical Settings", 5 under "Extra Rights" |

Pre-selected on a new form: dropdowns **Manufacturing = Manager**, **Purchases = Manager**, **After-Sales = Manager**, **Website = Editor and Designer**. Checked checkboxes: `in_group_42, 15, 19, 83, 35, 18, 14, 161, 31, 7, 4, 5, 6, 8, 24`. Of these only `in_group_8` (Access to Private Addresses) and `in_group_24` (Tax display B2B) are visible; the rest are hidden "Technical Settings" / "Extra Rights" items.
These defaults come from the template user's groups plus implied groups. I did not verify which template record supplies them.

---

## 7. Field relationships and related models

| Field | Relation | Detail |
|---|---|---|
| `partner_id` | many2one → `res.partner` | `res.users` `_inherits` `res.partner`. A partner row is auto-created with the user. Not set on the form |
| `name`, `email`, `lang`, `tz`, `image`, `signup_url`, `signup_valid` | related to `partner_id.<field>` | stored on `res.partner` |
| `company_id` | many2one → `res.company` | FK `res_users_company_id_fkey` |
| `company_ids` | many2many → `res.company` | |
| `user_department_ids` | many2many → `hr.department` | join table has FKs `department_user_rel_user_id_fkey` / `department_user_rel_dept_id_fkey` (`purchase_request`). Display relation only |
| `alias_id` | many2one → `mail.alias` | FK `res_users_alias_id_fkey`; `alias_contact` is related to `alias_id.alias_contact` |
| `action_id` | many2one → `ir.actions.actions` | hidden |
| `sel_groups_*`, `in_group_*` | virtual (non-stored) | each reads/writes `res.groups` membership (`groups_id`), see section 6 |
| `is_gcc_user`, `pseudo_name`, `token_name`, `device_reg_id`, `user_signature` | plain columns on `res_users` | added by `att_gcc_users` and related custom modules |

Model constraints on `res.users` (`ir.model.constraint`, **Live**): `res_users_login_key` registered three times as `unique(login)`, `unique(login)`, and `unique(login, website_id)`. The last one is the effective rule from the `website` module.
Constraints on the inherited partner: `res_partner_check_name` (`check((type='contact' and name is not null) or (type!='contact'))`) and `unique(company_name_code)`.

## 8. Conditional visibility and form behaviour

| Rule | Trigger | Effect | Evidence |
|---|---|---|---|
| Reset-password button | `state != 'active'` | hidden | Live |
| Invitation button | `state != 'new'` | hidden | Live |
| Green banner | `signup_valid != True` | hidden; inner line 1 hidden unless `state = 'active'`, line 2 hidden unless `state = 'new'` | Live |
| Blue banner | `active = True` | hidden | Live |
| "Multi Companies" group | `companies_count <= 1` | hidden (on this DB the count defaults to 6, so it is shown) | Live |
| "Application Accesses" group and the 4-column checkbox group | `sel_groups_1_9_10 != 1` | hidden (shown by default because it defaults to 1) | Live |
| `alias_contact` | `alias_id = False` | hidden | Live |
| `login` | `on_change` | **No visible effect**: `onchange` for `login` returned an empty `value` and no warning for both `someone@example.com` and `notanemail` | Live |
| `tz` | `on_change`, widget `timezone_mismatch` | widget compares the chosen timezone with the browser's using `tz_offset`. Rendered warning not seen | Unverified |
| `partner_id`, `alias_id` | `on_change` flag set | not triggered | Unverified |
| `active` | stat button `toggle_active` | archives/unarchives the user. Behaviour on an unsaved record not exercised | Unverified |
| Defaults | action context | `default_is_gcc_user = True` pre-sets `is_gcc_user`; `no_reset_password = True` is passed to the context (its effect is not visible in the arch) | Live (context), Unverified (effect) |

## 9. Warning, validation and confirmation messages

I did not save or submit anything, so **no message was triggered on the live page**. Messages below are exact strings read from the running source code. They show where each rule lives, not that the page shows them in that form.

| Trigger | Message | Source |
|---|---|---|
| Duplicate login (base rule) | You can not have two users with the same login ! | `base/models/res_users.py` `_sql_constraints` (the live DB constraint is `unique(login, website_id)`; its own message text is **unverified**) |
| Partner without a name | Contacts require a name. | `base/models/res_partner.py` |
| Current Company not in Allowed Companies | The chosen company is not in the allowed companies for this user | `base/models/res_users.py` |
| Home action = App Switcher | The "App Switcher" action cannot be selected as home action. | `base/models/res_users.py` |
| Archive/activate the superuser | You cannot activate the superuser. | `base/models/res_users.py` |
| Deactivate yourself | You cannot deactivate the user you're currently logged in as. | `base/models/res_users.py` |
| Delete the admin user | You can not remove the admin user as it is used internally for resources created by Odoo (updates, module installation, ...) | `base/models/res_users.py` |
| Own password written directly | Please use the change password wizard (in User Preferences or User menu) to change your own password. | `base/models/res_users.py` |
| Empty password | Setting empty passwords is not allowed for security reasons! | `base/models/res_users.py` (exact trigger on this form **unverified**) |
| Reset/invite with no email | Cannot send email: user %s has no email address. | `auth_signup/models/res_users.py` (`action_reset_password`) |
| Missing required field (client) | The following fields are invalid: | `web` static JS (the field list follows) |
| Leaving with unsaved changes (client) | The record has been modified, your changes will be discarded. Do you want to proceed? | `web` static JS |

The arch defines **no** `confirm=` attributes, so no confirmation dialog is attached to any button on this form.

## 10. Not verified

- Rendered page: tab layout, field order on screen, hover tooltips, placeholders (the arch has none), Save/Discard controls, widget rendering.
- Value of `state` on an unsaved record and therefore which header button appears.
- Names of `hr.department`, `mail.alias`, and `ir.actions.actions` records offered by the many2one/many2many fields.
- Any validation message actually shown on the page; the `unique(login, website_id)` message text.
- Which template user supplies the pre-checked group defaults.
- Which menu under menu 611 opens action 1130.
- One extra read: `hr.department` record **count** (15) was fetched only to size the Departments dropdown. No other `hr.*` model and no `hr.employee` data was read.

---

## Appendix A – `tz` options (589)

Africa/Abidjan, Africa/Accra, Africa/Addis_Ababa, Africa/Algiers, Africa/Asmara, Africa/Asmera, Africa/Bamako, Africa/Bangui, Africa/Banjul, Africa/Bissau, Africa/Blantyre, Africa/Brazzaville, Africa/Bujumbura, Africa/Cairo, Africa/Casablanca, Africa/Ceuta, Africa/Conakry, Africa/Dakar, Africa/Dar_es_Salaam, Africa/Djibouti, Africa/Douala, Africa/El_Aaiun, Africa/Freetown, Africa/Gaborone, Africa/Harare, Africa/Johannesburg, Africa/Juba, Africa/Kampala, Africa/Khartoum, Africa/Kigali, Africa/Kinshasa, Africa/Lagos, Africa/Libreville, Africa/Lome, Africa/Luanda, Africa/Lubumbashi, Africa/Lusaka, Africa/Malabo, Africa/Maputo, Africa/Maseru, Africa/Mbabane, Africa/Mogadishu, Africa/Monrovia, Africa/Nairobi, Africa/Ndjamena, Africa/Niamey, Africa/Nouakchott, Africa/Ouagadougou, Africa/Porto-Novo, Africa/Sao_Tome, Africa/Timbuktu, Africa/Tripoli, Africa/Tunis, Africa/Windhoek, America/Adak, America/Anchorage, America/Anguilla, America/Antigua, America/Araguaina, America/Argentina/Buenos_Aires, America/Argentina/Catamarca, America/Argentina/ComodRivadavia, America/Argentina/Cordoba, America/Argentina/Jujuy, America/Argentina/La_Rioja, America/Argentina/Mendoza, America/Argentina/Rio_Gallegos, America/Argentina/Salta, America/Argentina/San_Juan, America/Argentina/San_Luis, America/Argentina/Tucuman, America/Argentina/Ushuaia, America/Aruba, America/Asuncion, America/Atikokan, America/Atka, America/Bahia, America/Bahia_Banderas, America/Barbados, America/Belem, America/Belize, America/Blanc-Sablon, America/Boa_Vista, America/Bogota, America/Boise, America/Buenos_Aires, America/Cambridge_Bay, America/Campo_Grande, America/Cancun, America/Caracas, America/Catamarca, America/Cayenne, America/Cayman, America/Chicago, America/Chihuahua, America/Coral_Harbour, America/Cordoba, America/Costa_Rica, America/Creston, America/Cuiaba, America/Curacao, America/Danmarkshavn, America/Dawson, America/Dawson_Creek, America/Denver, America/Detroit, America/Dominica, America/Edmonton, America/Eirunepe, America/El_Salvador, America/Ensenada, America/Fort_Nelson, America/Fort_Wayne, America/Fortaleza, America/Glace_Bay, America/Godthab, America/Goose_Bay, America/Grand_Turk, America/Grenada, America/Guadeloupe, America/Guatemala, America/Guayaquil, America/Guyana, America/Halifax, America/Havana, America/Hermosillo, America/Indiana/Indianapolis, America/Indiana/Knox, America/Indiana/Marengo, America/Indiana/Petersburg, America/Indiana/Tell_City, America/Indiana/Vevay, America/Indiana/Vincennes, America/Indiana/Winamac, America/Indianapolis, America/Inuvik, America/Iqaluit, America/Jamaica, America/Jujuy, America/Juneau, America/Kentucky/Louisville, America/Kentucky/Monticello, America/Knox_IN, America/Kralendijk, America/La_Paz, America/Lima, America/Los_Angeles, America/Louisville, America/Lower_Princes, America/Maceio, America/Managua, America/Manaus, America/Marigot, America/Martinique, America/Matamoros, America/Mazatlan, America/Mendoza, America/Menominee, America/Merida, America/Metlakatla, America/Mexico_City, America/Miquelon, America/Moncton, America/Monterrey, America/Montevideo, America/Montreal, America/Montserrat, America/Nassau, America/New_York, America/Nipigon, America/Nome, America/Noronha, America/North_Dakota/Beulah, America/North_Dakota/Center, America/North_Dakota/New_Salem, America/Ojinaga, America/Panama, America/Pangnirtung, America/Paramaribo, America/Phoenix, America/Port-au-Prince, America/Port_of_Spain, America/Porto_Acre, America/Porto_Velho, America/Puerto_Rico, America/Rainy_River, America/Rankin_Inlet, America/Recife, America/Regina, America/Resolute, America/Rio_Branco, America/Rosario, America/Santa_Isabel, America/Santarem, America/Santiago, America/Santo_Domingo, America/Sao_Paulo, America/Scoresbysund, America/Shiprock, America/Sitka, America/St_Barthelemy, America/St_Johns, America/St_Kitts, America/St_Lucia, America/St_Thomas, America/St_Vincent, America/Swift_Current, America/Tegucigalpa, America/Thule, America/Thunder_Bay, America/Tijuana, America/Toronto, America/Tortola, America/Vancouver, America/Virgin, America/Whitehorse, America/Winnipeg, America/Yakutat, America/Yellowknife, Antarctica/Casey, Antarctica/Davis, Antarctica/DumontDUrville, Antarctica/Macquarie, Antarctica/Mawson, Antarctica/McMurdo, Antarctica/Palmer, Antarctica/Rothera, Antarctica/South_Pole, Antarctica/Syowa, Antarctica/Troll, Antarctica/Vostok, Arctic/Longyearbyen, Asia/Aden, Asia/Almaty, Asia/Amman, Asia/Anadyr, Asia/Aqtau, Asia/Aqtobe, Asia/Ashgabat, Asia/Ashkhabad, Asia/Baghdad, Asia/Bahrain, Asia/Baku, Asia/Bangkok, Asia/Barnaul, Asia/Beirut, Asia/Bishkek, Asia/Brunei, Asia/Calcutta, Asia/Chita, Asia/Choibalsan, Asia/Chongqing, Asia/Chungking, Asia/Colombo, Asia/Dacca, Asia/Damascus, Asia/Dhaka, Asia/Dili, Asia/Dubai, Asia/Dushanbe, Asia/Gaza, Asia/Harbin, Asia/Hebron, Asia/Ho_Chi_Minh, Asia/Hong_Kong, Asia/Hovd, Asia/Irkutsk, Asia/Istanbul, Asia/Jakarta, Asia/Jayapura, Asia/Jerusalem, Asia/Kabul, Asia/Kamchatka, Asia/Karachi, Asia/Kashgar, Asia/Kathmandu, Asia/Katmandu, Asia/Khandyga, Asia/Kolkata, Asia/Krasnoyarsk, Asia/Kuala_Lumpur, Asia/Kuching, Asia/Kuwait, Asia/Macao, Asia/Macau, Asia/Magadan, Asia/Makassar, Asia/Manila, Asia/Muscat, Asia/Nicosia, Asia/Novokuznetsk, Asia/Novosibirsk, Asia/Omsk, Asia/Oral, Asia/Phnom_Penh, Asia/Pontianak, Asia/Pyongyang, Asia/Qatar, Asia/Qyzylorda, Asia/Rangoon, Asia/Riyadh, Asia/Saigon, Asia/Sakhalin, Asia/Samarkand, Asia/Seoul, Asia/Shanghai, Asia/Singapore, Asia/Srednekolymsk, Asia/Taipei, Asia/Tashkent, Asia/Tbilisi, Asia/Tehran, Asia/Tel_Aviv, Asia/Thimbu, Asia/Thimphu, Asia/Tokyo, Asia/Tomsk, Asia/Ujung_Pandang, Asia/Ulaanbaatar, Asia/Ulan_Bator, Asia/Urumqi, Asia/Ust-Nera, Asia/Vientiane, Asia/Vladivostok, Asia/Yakutsk, Asia/Yangon, Asia/Yekaterinburg, Asia/Yerevan, Atlantic/Azores, Atlantic/Bermuda, Atlantic/Canary, Atlantic/Cape_Verde, Atlantic/Faeroe, Atlantic/Faroe, Atlantic/Jan_Mayen, Atlantic/Madeira, Atlantic/Reykjavik, Atlantic/South_Georgia, Atlantic/St_Helena, Atlantic/Stanley, Australia/ACT, Australia/Adelaide, Australia/Brisbane, Australia/Broken_Hill, Australia/Canberra, Australia/Currie, Australia/Darwin, Australia/Eucla, Australia/Hobart, Australia/LHI, Australia/Lindeman, Australia/Lord_Howe, Australia/Melbourne, Australia/NSW, Australia/North, Australia/Perth, Australia/Queensland, Australia/South, Australia/Sydney, Australia/Tasmania, Australia/Victoria, Australia/West, Australia/Yancowinna, Brazil/Acre, Brazil/DeNoronha, Brazil/East, Brazil/West, CET, CST6CDT, Canada/Atlantic, Canada/Central, Canada/East-Saskatchewan, Canada/Eastern, Canada/Mountain, Canada/Newfoundland, Canada/Pacific, Canada/Saskatchewan, Canada/Yukon, Chile/Continental, Chile/EasterIsland, Cuba, EET, EST, EST5EDT, Egypt, Eire, Europe/Amsterdam, Europe/Andorra, Europe/Astrakhan, Europe/Athens, Europe/Belfast, Europe/Belgrade, Europe/Berlin, Europe/Bratislava, Europe/Brussels, Europe/Bucharest, Europe/Budapest, Europe/Busingen, Europe/Chisinau, Europe/Copenhagen, Europe/Dublin, Europe/Gibraltar, Europe/Guernsey, Europe/Helsinki, Europe/Isle_of_Man, Europe/Istanbul, Europe/Jersey, Europe/Kaliningrad, Europe/Kiev, Europe/Kirov, Europe/Lisbon, Europe/Ljubljana, Europe/London, Europe/Luxembourg, Europe/Madrid, Europe/Malta, Europe/Mariehamn, Europe/Minsk, Europe/Monaco, Europe/Moscow, Europe/Nicosia, Europe/Oslo, Europe/Paris, Europe/Podgorica, Europe/Prague, Europe/Riga, Europe/Rome, Europe/Samara, Europe/San_Marino, Europe/Sarajevo, Europe/Simferopol, Europe/Skopje, Europe/Sofia, Europe/Stockholm, Europe/Tallinn, Europe/Tirane, Europe/Tiraspol, Europe/Ulyanovsk, Europe/Uzhgorod, Europe/Vaduz, Europe/Vatican, Europe/Vienna, Europe/Vilnius, Europe/Volgograd, Europe/Warsaw, Europe/Zagreb, Europe/Zaporozhye, Europe/Zurich, GB, GB-Eire, GMT, GMT+0, GMT-0, GMT0, Greenwich, HST, Hongkong, Iceland, Indian/Antananarivo, Indian/Chagos, Indian/Christmas, Indian/Cocos, Indian/Comoro, Indian/Kerguelen, Indian/Mahe, Indian/Maldives, Indian/Mauritius, Indian/Mayotte, Indian/Reunion, Iran, Israel, Jamaica, Japan, Kwajalein, Libya, MET, MST, MST7MDT, Mexico/BajaNorte, Mexico/BajaSur, Mexico/General, NZ, NZ-CHAT, Navajo, PRC, PST8PDT, Pacific/Apia, Pacific/Auckland, Pacific/Bougainville, Pacific/Chatham, Pacific/Chuuk, Pacific/Easter, Pacific/Efate, Pacific/Enderbury, Pacific/Fakaofo, Pacific/Fiji, Pacific/Funafuti, Pacific/Galapagos, Pacific/Gambier, Pacific/Guadalcanal, Pacific/Guam, Pacific/Honolulu, Pacific/Johnston, Pacific/Kiritimati, Pacific/Kosrae, Pacific/Kwajalein, Pacific/Majuro, Pacific/Marquesas, Pacific/Midway, Pacific/Nauru, Pacific/Niue, Pacific/Norfolk, Pacific/Noumea, Pacific/Pago_Pago, Pacific/Palau, Pacific/Pitcairn, Pacific/Pohnpei, Pacific/Ponape, Pacific/Port_Moresby, Pacific/Rarotonga, Pacific/Saipan, Pacific/Samoa, Pacific/Tahiti, Pacific/Tarawa, Pacific/Tongatapu, Pacific/Truk, Pacific/Wake, Pacific/Wallis, Pacific/Yap, Poland, Portugal, ROC, ROK, Singapore, Turkey, UCT, US/Alaska, US/Aleutian, US/Arizona, US/Central, US/East-Indiana, US/Eastern, US/Hawaii, US/Indiana-Starke, US/Michigan, US/Mountain, US/Pacific, US/Pacific-New, US/Samoa, UTC, Universal, W-SU, WET, Zulu, Etc/GMT, Etc/GMT+0, Etc/GMT+1, Etc/GMT+10, Etc/GMT+11, Etc/GMT+12, Etc/GMT+2, Etc/GMT+3, Etc/GMT+4, Etc/GMT+5, Etc/GMT+6, Etc/GMT+7, Etc/GMT+8, Etc/GMT+9, Etc/GMT-0, Etc/GMT-1, Etc/GMT-10, Etc/GMT-11, Etc/GMT-12, Etc/GMT-13, Etc/GMT-14, Etc/GMT-2, Etc/GMT-3, Etc/GMT-4, Etc/GMT-5, Etc/GMT-6, Etc/GMT-7, Etc/GMT-8, Etc/GMT-9, Etc/GMT0, Etc/Greenwich, Etc/UCT, Etc/UTC, Etc/Universal, Etc/Zulu
