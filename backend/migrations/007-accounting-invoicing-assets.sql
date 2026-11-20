-- 007-accounting-invoicing-assets.sql  Accounting phase 3: the Invoicing menus.
--
-- Covers the Odoo menus in the customer screenshots:
--   Customers : Invoices / Cash / Credit / Proforma / Progressive, Credit Notes,
--               Internal Voucher, Payments
--   Vendors   : Bills, To Approve, Approved, Refund, Payable Voucher, Payments
--   Accounting: Assets, Asset Types, Generate Assets Entries, Tax Adjustments
--   Config    : Incoterms, Reconciliation Models, Fiscal Year (lock dates, in 005)
--
-- Sources in yamama_LIVE_sep_26: account_invoice (custom columns), att_internal_voucher,
-- att_account_voucher, account_asset_category/asset/depreciation_line, account_incoterms,
-- account_reconcile_model.
--
-- EXTERNAL (other apps): subscriptions, vehicles/GPS, purchase, stock picking, landed cost,
-- ZATCA e-invoicing, approval-level routing. Those are plain nullable columns with no FK
-- and no behaviour; they are listed at the end of the account_move block.

-- ------------------------------------------------------- invoice categories ---
ALTER TABLE account_journal
  ADD COLUMN invoice_category varchar;            -- cash | credit | proforma: the default for its invoices
ALTER TABLE account_journal
  ADD CONSTRAINT account_journal_invoice_category_check
    CHECK (invoice_category IS NULL OR invoice_category IN ('cash', 'credit', 'proforma'));

ALTER TABLE account_move
  -- Customers > Invoices submenus. 'credit' is the ordinary invoice on payment terms.
  ADD COLUMN invoice_category varchar NOT NULL DEFAULT 'credit',
  -- Proforma: not a tax invoice yet. Converting it issues the real one.
  ADD COLUMN proforma_of_id   integer REFERENCES account_move (id) ON DELETE SET NULL,
  -- Progressive (milestone) billing on a contract.
  ADD COLUMN is_progressive      boolean NOT NULL DEFAULT false,
  ADD COLUMN contract_amount     numeric(16, 4),
  ADD COLUMN previously_billed   numeric(16, 4) NOT NULL DEFAULT 0,
  ADD COLUMN progress_percentage numeric(8, 4),
  ADD COLUMN retainage_amount    numeric(16, 4) NOT NULL DEFAULT 0,
  ADD COLUMN progressive_parent_id integer REFERENCES account_move (id) ON DELETE SET NULL,
  -- Vendors > To Approve / Approved. Odoo column: request_status.
  ADD COLUMN request_status   varchar NOT NULL DEFAULT 'not_required',
  ADD COLUMN approver_id      integer REFERENCES res_users (id) ON DELETE SET NULL,
  ADD COLUMN approved_on      timestamp,
  ADD COLUMN reject_reason    varchar,
  ADD COLUMN prepared_by      integer REFERENCES res_users (id) ON DELETE SET NULL,
  -- plain invoice fields that exist in Odoo and have no other home
  ADD COLUMN incoterm_id      integer,
  ADD COLUMN partner_bank_id  integer REFERENCES res_partner_bank (id) ON DELETE SET NULL,
  ADD COLUMN partner_shipping_id integer REFERENCES res_partner (id) ON DELETE SET NULL,
  ADD COLUMN contact_id       integer REFERENCES res_partner (id) ON DELETE SET NULL,
  ADD COLUMN client_order_ref varchar,
  ADD COLUMN payment_notes    text,
  ADD COLUMN show_discount    boolean NOT NULL DEFAULT false,
  ADD COLUMN company_seal_required boolean NOT NULL DEFAULT false,
  ADD COLUMN pr_number        varchar,
  ADD COLUMN po_number        varchar,
  ADD COLUMN vendor_project   varchar,
  ADD COLUMN group_task       varchar,
  -- EXTERNAL: no behaviour here, kept so an import never loses the value.
  ADD COLUMN ext_is_subscription   boolean NOT NULL DEFAULT false,  -- subscription app
  ADD COLUMN ext_subscription_id   integer,
  ADD COLUMN ext_subscription_type varchar,
  ADD COLUMN ext_start_date   date,
  ADD COLUMN ext_end_date     date,
  ADD COLUMN ext_frequency    varchar,
  ADD COLUMN ext_vehicle_details text,                              -- GPS / vehicles app
  ADD COLUMN ext_picking_id   integer,                              -- stock
  ADD COLUMN ext_landed_cost_id integer,
  ADD COLUMN ext_asset_rental_id integer,                           -- asset rental app
  ADD COLUMN ext_approval_level_id integer,                         -- approval routing app
  ADD COLUMN ext_team_id      integer;                              -- sales team

ALTER TABLE account_move
  ADD CONSTRAINT account_move_invoice_category_check
    CHECK (invoice_category IN ('cash', 'credit', 'proforma', 'progressive')),
  ADD CONSTRAINT account_move_request_status_check
    CHECK (request_status IN ('not_required', 'to_approve', 'approved', 'rejected'));
CREATE INDEX account_move_category_idx ON account_move (invoice_category) WHERE move_type <> 'entry';
CREATE INDEX account_move_request_status_idx ON account_move (request_status) WHERE request_status <> 'not_required';

ALTER TABLE account_move_line
  ADD COLUMN sequence   integer NOT NULL DEFAULT 10,
  ADD COLUMN ext_subscription_type varchar,     -- EXTERNAL subscription app
  ADD COLUMN ext_main_task varchar;

-- ------------------------------------------------------------------ vouchers ---
-- att_internal_voucher: money moved between two of the company's own journals.
CREATE TABLE account_internal_voucher (
  id          serial PRIMARY KEY,
  name        varchar NOT NULL DEFAULT '/',
  amount      numeric(16, 4) NOT NULL,
  currency_id integer REFERENCES res_currency (id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT current_date,
  journal_id  integer NOT NULL REFERENCES account_journal (id) ON DELETE RESTRICT,  -- from
  destination_journal_id integer NOT NULL REFERENCES account_journal (id) ON DELETE RESTRICT, -- to
  description text,
  state       varchar NOT NULL DEFAULT 'draft',
  request_status varchar NOT NULL DEFAULT 'not_required',
  prepared_by integer REFERENCES res_users (id) ON DELETE SET NULL,
  verified_by integer REFERENCES res_users (id) ON DELETE SET NULL,
  approved_by integer REFERENCES res_users (id) ON DELETE SET NULL,
  reject_reason varchar,
  move_id     integer REFERENCES account_move (id) ON DELETE SET NULL,
  company_id  integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  ext_approval_level_id integer,                   -- EXTERNAL approval routing app
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_internal_voucher_amount_positive CHECK (amount > 0),
  CONSTRAINT account_internal_voucher_state_check CHECK (state IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT account_internal_voucher_status_check CHECK (request_status IN ('not_required', 'to_approve', 'approved', 'rejected')),
  CONSTRAINT account_internal_voucher_different_journals CHECK (journal_id <> destination_journal_id)
);

-- att_account_voucher: a vendor payment voucher (cheque or transfer), optionally for one bill.
CREATE TABLE account_payable_voucher (
  id           serial PRIMARY KEY,
  name         varchar NOT NULL DEFAULT '/',
  date         date NOT NULL DEFAULT current_date,
  partner_id   integer NOT NULL REFERENCES res_partner (id) ON DELETE RESTRICT,
  amount       numeric(16, 4) NOT NULL,
  currency_id  integer REFERENCES res_currency (id) ON DELETE SET NULL,
  payment_journal_id integer NOT NULL REFERENCES account_journal (id) ON DELETE RESTRICT,
  account_id   integer REFERENCES account_account (id) ON DELETE RESTRICT,   -- payable account
  suspense_account_id integer REFERENCES account_account (id) ON DELETE RESTRICT,
  payment_mode varchar NOT NULL DEFAULT 'transfer',     -- transfer | cheque
  invoice_id   integer REFERENCES account_move (id) ON DELETE SET NULL,      -- the bill being paid
  payment_id   integer REFERENCES account_payment (id) ON DELETE SET NULL,   -- created on approve
  state        varchar NOT NULL DEFAULT 'draft',
  request_status varchar NOT NULL DEFAULT 'not_required',
  prepared_by  integer REFERENCES res_users (id) ON DELETE SET NULL,
  approved_by  integer REFERENCES res_users (id) ON DELETE SET NULL,
  reject_reason varchar,
  po_number    varchar,
  reference    varchar,
  description  text,
  cheque_no    varchar,
  cheque_prepared_date date,
  cheque_approved_date date,
  cheque_paid_date date,
  company_id   integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  ext_approval_level_id integer,                   -- EXTERNAL approval routing app
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_payable_voucher_amount_positive CHECK (amount > 0),
  CONSTRAINT account_payable_voucher_state_check CHECK (state IN ('draft', 'posted', 'cancelled')),
  CONSTRAINT account_payable_voucher_status_check CHECK (request_status IN ('not_required', 'to_approve', 'approved', 'rejected')),
  CONSTRAINT account_payable_voucher_mode_check CHECK (payment_mode IN ('transfer', 'cheque'))
);
CREATE INDEX account_payable_voucher_partner_idx ON account_payable_voucher (partner_id, state);

-- -------------------------------------------------------------------- assets ---
CREATE TABLE account_asset_category (
  id          serial PRIMARY KEY,
  name        varchar NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  type        varchar NOT NULL DEFAULT 'purchase',      -- purchase (asset) | sale (deferred revenue)
  company_id  integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  journal_id  integer NOT NULL REFERENCES account_journal (id) ON DELETE RESTRICT,
  account_asset_id integer NOT NULL REFERENCES account_account (id) ON DELETE RESTRICT,        -- gross value
  account_depreciation_id integer NOT NULL REFERENCES account_account (id) ON DELETE RESTRICT, -- accumulated depreciation
  account_depreciation_expense_id integer NOT NULL REFERENCES account_account (id) ON DELETE RESTRICT,
  account_analytic_id integer REFERENCES account_analytic_account (id) ON DELETE SET NULL,
  method      varchar NOT NULL DEFAULT 'linear',        -- linear | degressive
  method_number integer NOT NULL DEFAULT 5,             -- number of depreciations
  method_period integer NOT NULL DEFAULT 12,            -- months between two depreciations
  method_progress_factor numeric(8, 4) NOT NULL DEFAULT 0.3,
  method_time varchar NOT NULL DEFAULT 'number',        -- number | end
  method_end  date,
  prorata     boolean NOT NULL DEFAULT false,
  open_asset  boolean NOT NULL DEFAULT false,           -- confirm the asset as soon as it is created
  group_entries boolean NOT NULL DEFAULT false,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_asset_category_type_check CHECK (type IN ('purchase', 'sale')),
  CONSTRAINT account_asset_category_method_check CHECK (method IN ('linear', 'degressive')),
  CONSTRAINT account_asset_category_method_time_check CHECK (method_time IN ('number', 'end')),
  CONSTRAINT account_asset_category_method_number_positive CHECK (method_number > 0),
  CONSTRAINT account_asset_category_method_period_check CHECK (method_period BETWEEN 1 AND 12)
);

CREATE TABLE account_asset_asset (
  id           serial PRIMARY KEY,
  name         varchar NOT NULL,
  code         varchar,
  active       boolean NOT NULL DEFAULT true,
  state        varchar NOT NULL DEFAULT 'draft',        -- draft | open | close
  category_id  integer NOT NULL REFERENCES account_asset_category (id) ON DELETE RESTRICT,
  company_id   integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  currency_id  integer REFERENCES res_currency (id) ON DELETE SET NULL,
  partner_id   integer REFERENCES res_partner (id) ON DELETE SET NULL,
  product_id   integer REFERENCES product_product (id) ON DELETE SET NULL,
  invoice_id   integer REFERENCES account_move (id) ON DELETE SET NULL,   -- the bill it came from
  account_analytic_id integer REFERENCES account_analytic_account (id) ON DELETE SET NULL,
  value        numeric(16, 4) NOT NULL,                 -- gross value
  salvage_value numeric(16, 4) NOT NULL DEFAULT 0,
  date         date NOT NULL DEFAULT current_date,      -- purchase date
  date_first_depreciation varchar NOT NULL DEFAULT 'asset',  -- asset | manual
  first_depreciation_manual_date date,
  method       varchar NOT NULL DEFAULT 'linear',
  method_number integer NOT NULL DEFAULT 5,
  method_period integer NOT NULL DEFAULT 12,
  method_progress_factor numeric(8, 4) NOT NULL DEFAULT 0.3,
  method_time  varchar NOT NULL DEFAULT 'number',
  method_end   date,
  prorata      boolean NOT NULL DEFAULT false,
  note         text,
  ext_asset_rental_id integer,                          -- EXTERNAL asset rental app
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_asset_asset_state_check CHECK (state IN ('draft', 'open', 'close')),
  CONSTRAINT account_asset_asset_method_check CHECK (method IN ('linear', 'degressive')),
  CONSTRAINT account_asset_asset_method_time_check CHECK (method_time IN ('number', 'end')),
  CONSTRAINT account_asset_asset_value_positive CHECK (value > 0),
  CONSTRAINT account_asset_asset_salvage_check CHECK (salvage_value >= 0 AND salvage_value < value)
);
CREATE INDEX account_asset_asset_category_idx ON account_asset_asset (category_id, state);
ALTER TABLE account_move_line
  ADD CONSTRAINT account_move_line_asset_fkey FOREIGN KEY (asset_id)
  REFERENCES account_asset_asset (id) ON DELETE SET NULL;

CREATE TABLE account_asset_depreciation_line (
  id           serial PRIMARY KEY,
  name         varchar NOT NULL,
  sequence     integer NOT NULL,
  asset_id     integer NOT NULL REFERENCES account_asset_asset (id) ON DELETE CASCADE,
  amount       numeric(16, 4) NOT NULL,                 -- depreciated this period
  remaining_value   numeric(16, 4) NOT NULL,
  depreciated_value numeric(16, 4) NOT NULL,
  depreciation_date date NOT NULL,
  move_id      integer REFERENCES account_move (id) ON DELETE SET NULL,
  move_check   boolean NOT NULL DEFAULT false,          -- the entry was generated
  move_posted_check boolean NOT NULL DEFAULT false,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_asset_depreciation_line_seq_uniq UNIQUE (asset_id, sequence)
);
CREATE INDEX account_asset_depreciation_line_due_idx ON account_asset_depreciation_line (depreciation_date) WHERE move_check = false;

-- ---------------------------------------------------------- config leftovers ---
CREATE TABLE account_incoterms (
  id     serial PRIMARY KEY,
  name   varchar NOT NULL,
  code   varchar NOT NULL,
  active boolean NOT NULL DEFAULT true,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_incoterms_code_uniq UNIQUE (code)
);
ALTER TABLE account_move
  ADD CONSTRAINT account_move_incoterm_fkey FOREIGN KEY (incoterm_id)
  REFERENCES account_incoterms (id) ON DELETE SET NULL;

-- A suggestion rule used by the bank reconciliation screen.
CREATE TABLE account_reconcile_model (
  id          serial PRIMARY KEY,
  name        varchar NOT NULL,
  sequence    integer NOT NULL DEFAULT 10,
  company_id  integer NOT NULL REFERENCES res_company (id) ON DELETE CASCADE,
  rule_type   varchar NOT NULL DEFAULT 'writeoff_button',  -- writeoff_button | writeoff_suggestion | invoice_matching
  auto_reconcile boolean NOT NULL DEFAULT false,
  match_nature varchar NOT NULL DEFAULT 'both',            -- amount_received | amount_paid | both
  match_label varchar,                                     -- contains | not_contains | match_regex
  match_label_param varchar,
  match_amount_min numeric(16, 4),
  match_amount_max numeric(16, 4),
  match_partner boolean NOT NULL DEFAULT false,
  journal_id  integer REFERENCES account_journal (id) ON DELETE CASCADE,
  -- the counterpart written off when the rule is applied
  account_id  integer REFERENCES account_account (id) ON DELETE SET NULL,
  label       varchar,
  amount_type varchar NOT NULL DEFAULT 'percentage',       -- fixed | percentage
  amount      numeric(16, 4) NOT NULL DEFAULT 100,
  tax_id      integer REFERENCES account_tax (id) ON DELETE SET NULL,
  force_tax_included boolean NOT NULL DEFAULT false,
  analytic_account_id integer REFERENCES account_analytic_account (id) ON DELETE SET NULL,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_reconcile_model_rule_type_check CHECK (rule_type IN ('writeoff_button', 'writeoff_suggestion', 'invoice_matching')),
  CONSTRAINT account_reconcile_model_nature_check CHECK (match_nature IN ('amount_received', 'amount_paid', 'both')),
  CONSTRAINT account_reconcile_model_amount_type_check CHECK (amount_type IN ('fixed', 'percentage')),
  CONSTRAINT account_reconcile_model_label_check CHECK (match_label IS NULL OR match_label IN ('contains', 'not_contains', 'match_regex'))
);

-- Fiscal years, so "Configuration > Fiscal Year" is a real list next to the lock dates on res_company.
CREATE TABLE account_fiscal_year (
  id         serial PRIMARY KEY,
  name       varchar NOT NULL,
  date_from  date NOT NULL,
  date_to    date NOT NULL,
  company_id integer NOT NULL REFERENCES res_company (id) ON DELETE CASCADE,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_fiscal_year_dates_check CHECK (date_to > date_from),
  CONSTRAINT account_fiscal_year_name_uniq UNIQUE (name, company_id)
);
