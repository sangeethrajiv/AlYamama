-- 005-accounting-core.sql  Accounting phase 1: core ledger.
--
-- Table and column names follow Odoo 12 (verified against yamama_LIVE_sep_26).
-- Deliberate differences:
--   * Invoices are NOT a separate account_invoice table. account_move carries a
--     move_type (entry, out_invoice, out_refund, in_invoice, in_refund, ...) as
--     in Odoo 13+. Importing the old account.invoice rows later maps into it.
--   * money is numeric, never double precision.
--   * Fields owned by other apps (sale, purchase, stock valuation, payment
--     providers, l10n_sa e-invoicing) are plain nullable integers/varchars with
--     NO foreign key, marked "EXTERNAL". Nothing in this phase reads them.
--   * Analytic accounts, bank statements and assets come in later phases, so
--     their ids here are plain integers too.
--   * No data is inserted by this file.

-- ------------------------------------------------------------ company settings ---
ALTER TABLE res_company
  ADD COLUMN fiscalyear_lock_date date,
  ADD COLUMN period_lock_date     date,
  ADD COLUMN tax_lock_date        date,
  ADD COLUMN fiscalyear_last_day  integer NOT NULL DEFAULT 31,
  ADD COLUMN fiscalyear_last_month integer NOT NULL DEFAULT 12,
  ADD COLUMN account_receivable_id integer,   -- defaults, set after accounts exist
  ADD COLUMN account_payable_id    integer,
  ADD COLUMN income_account_id     integer,
  ADD COLUMN expense_account_id    integer,
  ADD COLUMN currency_exchange_journal_id integer,
  ADD COLUMN default_sale_tax_id   integer,
  ADD COLUMN default_purchase_tax_id integer;

ALTER TABLE res_currency
  ADD COLUMN rounding       numeric(12, 6) NOT NULL DEFAULT 0.01,
  ADD COLUMN decimal_places integer NOT NULL DEFAULT 2,
  ADD COLUMN position       varchar DEFAULT 'after';

-- --------------------------------------------------------------- currency rates ---
CREATE TABLE res_currency_rate (
  id          serial PRIMARY KEY,
  name        date NOT NULL,                       -- the rate date
  rate        numeric(20, 10) NOT NULL DEFAULT 1.0, -- units of this currency per 1 company currency
  currency_id integer NOT NULL REFERENCES res_currency (id) ON DELETE CASCADE,
  company_id  integer REFERENCES res_company (id) ON DELETE SET NULL,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT res_currency_rate_unique_name_per_day UNIQUE (name, currency_id, company_id),
  CONSTRAINT res_currency_rate_positive CHECK (rate > 0)
);
CREATE INDEX res_currency_rate_currency_idx ON res_currency_rate (currency_id, name);

-- ------------------------------------------------------------------ accounts ---
CREATE TABLE account_account_type (
  id                      serial PRIMARY KEY,
  name                    varchar NOT NULL,
  include_initial_balance boolean DEFAULT false,
  type                    varchar NOT NULL DEFAULT 'other',
  internal_group          varchar,
  note                    text,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT account_account_type_type_check
    CHECK (type IN ('other', 'receivable', 'payable', 'liquidity')),
  CONSTRAINT account_account_type_group_check
    CHECK (internal_group IS NULL OR internal_group IN ('equity', 'asset', 'liability', 'income', 'expense'))
);

-- Account groups (e.g. "10", "101" prefixes) used for hierarchy and reports.
CREATE TABLE account_group (
  id               serial PRIMARY KEY,
  parent_id        integer REFERENCES account_group (id) ON DELETE CASCADE,
  parent_path      varchar,
  name             varchar NOT NULL,
  code_prefix      varchar,
  company_id       integer REFERENCES res_company (id) ON DELETE CASCADE,  -- Odoo 12 groups are shared by all companies
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now()
);

CREATE TABLE account_account (
  id              serial PRIMARY KEY,
  name            varchar NOT NULL,
  code            varchar NOT NULL,
  currency_id     integer REFERENCES res_currency (id) ON DELETE SET NULL,
  deprecated      boolean DEFAULT false,
  user_type_id    integer NOT NULL REFERENCES account_account_type (id) ON DELETE RESTRICT,
  internal_type   varchar,                 -- stored related: user_type_id.type
  internal_group  varchar,                 -- stored related: user_type_id.internal_group
  reconcile       boolean DEFAULT false,
  note            text,
  company_id      integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  group_id        integer REFERENCES account_group (id) ON DELETE SET NULL,
  last_time_entries_checked timestamp,
  centralized     boolean DEFAULT false,
  list_customer_in_pl_report boolean DEFAULT false,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT account_account_code_company_uniq UNIQUE (code, company_id)
);
CREATE INDEX account_account_company_idx ON account_account (company_id, code);

-- Accounts allowed on a journal (m2m).
-- (journal_id FK added after account_journal exists.)

-- ------------------------------------------------------------------- taxes ---
CREATE TABLE account_tax_group (
  id         serial PRIMARY KEY,
  name       varchar NOT NULL,
  sequence   integer DEFAULT 10,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now()
);

CREATE TABLE account_tax (
  id               serial PRIMARY KEY,
  name             varchar NOT NULL,
  type_tax_use     varchar NOT NULL,                    -- sale | purchase | none
  amount_type      varchar NOT NULL DEFAULT 'percent',  -- group | fixed | percent | division
  active           boolean DEFAULT true,
  company_id       integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  sequence         integer NOT NULL DEFAULT 1,
  amount           numeric(16, 4) NOT NULL DEFAULT 0,
  account_id       integer REFERENCES account_account (id) ON DELETE RESTRICT,
  refund_account_id integer REFERENCES account_account (id) ON DELETE RESTRICT,
  description      varchar,                             -- label on invoices
  price_include    boolean NOT NULL DEFAULT false,
  include_base_amount boolean NOT NULL DEFAULT false,
  analytic         boolean DEFAULT false,
  tax_group_id     integer REFERENCES account_tax_group (id) ON DELETE SET NULL,
  tax_exigibility  varchar DEFAULT 'on_invoice',        -- on_invoice | on_payment
  cash_basis_account_id integer REFERENCES account_account (id) ON DELETE SET NULL,
  cash_basis_base_account_id integer REFERENCES account_account (id) ON DELETE SET NULL,
  -- l10n_sa
  l10n_sa_is_retention boolean DEFAULT false,
  l10n_sa_exemption_reason_code varchar,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT account_tax_name_company_uniq UNIQUE (name, company_id, type_tax_use),
  CONSTRAINT account_tax_type_use_check CHECK (type_tax_use IN ('sale', 'purchase', 'none')),
  CONSTRAINT account_tax_amount_type_check CHECK (amount_type IN ('group', 'fixed', 'percent', 'division')),
  CONSTRAINT account_tax_exigibility_check CHECK (tax_exigibility IN ('on_invoice', 'on_payment'))
);

-- Children of a tax of amount_type 'group'.
CREATE TABLE account_tax_filiation_rel (
  parent_tax integer NOT NULL REFERENCES account_tax (id) ON DELETE CASCADE,
  child_tax  integer NOT NULL REFERENCES account_tax (id) ON DELETE CASCADE,
  PRIMARY KEY (parent_tax, child_tax)
);

-- ------------------------------------------------------------ payment terms ---
CREATE TABLE account_payment_term (
  id         serial PRIMARY KEY,
  name       varchar NOT NULL,
  active     boolean DEFAULT true,
  note       text,
  company_id integer REFERENCES res_company (id) ON DELETE SET NULL,
  sequence   integer NOT NULL DEFAULT 10,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now()
);

CREATE TABLE account_payment_term_line (
  id               serial PRIMARY KEY,
  payment_id       integer NOT NULL REFERENCES account_payment_term (id) ON DELETE CASCADE,
  value            varchar NOT NULL DEFAULT 'balance',   -- balance | percent | fixed
  value_amount     numeric(16, 4) DEFAULT 0,
  days             integer NOT NULL DEFAULT 0,
  day_of_the_month integer,
  option           varchar NOT NULL DEFAULT 'day_after_invoice_date',
  sequence         integer NOT NULL DEFAULT 10,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT account_payment_term_line_value_check CHECK (value IN ('balance', 'percent', 'fixed')),
  CONSTRAINT account_payment_term_line_option_check
    CHECK (option IN ('day_after_invoice_date', 'after_invoice_month', 'day_following_month', 'day_current_month'))
);

-- ---------------------------------------------------------- fiscal positions ---
CREATE TABLE account_fiscal_position (
  id           serial PRIMARY KEY,
  name         varchar NOT NULL,
  active       boolean DEFAULT true,
  company_id   integer NOT NULL REFERENCES res_company (id) ON DELETE CASCADE,
  note         text,
  auto_apply   boolean DEFAULT false,
  vat_required boolean DEFAULT false,
  country_id   integer REFERENCES res_country (id) ON DELETE SET NULL,
  sequence     integer DEFAULT 10,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now()
);
CREATE TABLE account_fiscal_position_tax (
  id            serial PRIMARY KEY,
  position_id   integer NOT NULL REFERENCES account_fiscal_position (id) ON DELETE CASCADE,
  tax_src_id    integer NOT NULL REFERENCES account_tax (id) ON DELETE CASCADE,
  tax_dest_id   integer REFERENCES account_tax (id) ON DELETE CASCADE
);
CREATE TABLE account_fiscal_position_account (
  id              serial PRIMARY KEY,
  position_id     integer NOT NULL REFERENCES account_fiscal_position (id) ON DELETE CASCADE,
  account_src_id  integer NOT NULL REFERENCES account_account (id) ON DELETE CASCADE,
  account_dest_id integer NOT NULL REFERENCES account_account (id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------- journals ---
CREATE TABLE account_journal (
  id                   serial PRIMARY KEY,
  name                 varchar NOT NULL,
  code                 varchar NOT NULL,
  active               boolean DEFAULT true,
  type                 varchar NOT NULL,                 -- sale | purchase | cash | bank | general
  default_credit_account_id integer REFERENCES account_account (id) ON DELETE RESTRICT,
  default_debit_account_id  integer REFERENCES account_account (id) ON DELETE RESTRICT,
  update_posted        boolean DEFAULT false,            -- allow cancelling posted entries
  group_invoice_lines  boolean DEFAULT false,
  sequence_id          integer,                          -- plain: sequences kept in account_sequence below
  refund_sequence_id   integer,
  sequence             integer DEFAULT 10,
  currency_id          integer REFERENCES res_currency (id) ON DELETE SET NULL,
  company_id           integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  refund_sequence      boolean DEFAULT false,
  at_least_one_inbound boolean DEFAULT false,
  at_least_one_outbound boolean DEFAULT false,
  profit_account_id    integer REFERENCES account_account (id) ON DELETE SET NULL,
  loss_account_id      integer REFERENCES account_account (id) ON DELETE SET NULL,
  bank_account_id      integer,                          -- res_partner_bank
  bank_statements_source varchar,
  post_at_bank_rec     boolean DEFAULT false,
  show_on_dashboard    boolean DEFAULT true,
  color                integer DEFAULT 0,
  cash_customer        boolean DEFAULT false,
  credit_note_name     varchar,
  country_code         varchar,
  -- EXTERNAL l10n_sa_edi: ZATCA onboarding data, unused until that module exists
  l10n_sa_serial_number varchar,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  -- Odoo 12 declares (code, company_id) unique, but yamama_LIVE_sep_26 has two journals with code INV in
  -- company 12 (Credit Sale Invoices, Cash Sale Invoices). Kept as they are, so the code is only indexed.
  CONSTRAINT account_journal_name_company_uniq UNIQUE (name, company_id),
  CONSTRAINT account_journal_type_check CHECK (type IN ('sale', 'purchase', 'cash', 'bank', 'general'))
);

CREATE INDEX account_journal_code_company_idx ON account_journal (code, company_id);

CREATE TABLE account_journal_type_control_rel (
  journal_id integer NOT NULL REFERENCES account_journal (id) ON DELETE CASCADE,
  type_id    integer NOT NULL REFERENCES account_account_type (id) ON DELETE CASCADE,
  PRIMARY KEY (journal_id, type_id)
);
CREATE TABLE account_account_type_rel (
  journal_id integer NOT NULL REFERENCES account_journal (id) ON DELETE CASCADE,
  account_id integer NOT NULL REFERENCES account_account (id) ON DELETE CASCADE,
  PRIMARY KEY (journal_id, account_id)
);

-- Gapless-ish numbering per journal and year (replaces ir_sequence for accounting).
CREATE TABLE account_sequence (
  id          serial PRIMARY KEY,
  journal_id  integer NOT NULL REFERENCES account_journal (id) ON DELETE CASCADE,
  is_refund   boolean NOT NULL DEFAULT false,
  year        integer NOT NULL,
  next_number integer NOT NULL DEFAULT 1,
  CONSTRAINT account_sequence_uniq UNIQUE (journal_id, is_refund, year)
);

-- ----------------------------------------------------------------- reconcile ---
CREATE TABLE account_full_reconcile (
  id               serial PRIMARY KEY,
  name             varchar NOT NULL,
  exchange_move_id integer,                       -- FK added after account_move
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now()
);

-- ------------------------------------------------------------------- moves ---
CREATE TABLE account_move (
  id             serial PRIMARY KEY,
  name           varchar NOT NULL DEFAULT '/',
  ref            varchar,
  date           date NOT NULL,
  journal_id     integer NOT NULL REFERENCES account_journal (id) ON DELETE RESTRICT,
  currency_id    integer REFERENCES res_currency (id) ON DELETE SET NULL,
  state          varchar NOT NULL DEFAULT 'draft',
  partner_id     integer REFERENCES res_partner (id) ON DELETE SET NULL,
  amount         numeric(16, 4) DEFAULT 0,          -- stored total debit
  narration      text,
  company_id     integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  matched_percentage numeric DEFAULT 0,
  tax_cash_basis_rec_id integer,
  auto_reverse   boolean DEFAULT false,
  reverse_date   date,
  reverse_entry_id integer REFERENCES account_move (id) ON DELETE SET NULL,
  reversed_entry_id integer REFERENCES account_move (id) ON DELETE SET NULL,
  -- invoice part (Odoo 13+ unified model)
  move_type      varchar NOT NULL DEFAULT 'entry',
  invoice_date   date,
  invoice_date_due date,
  invoice_origin varchar,
  invoice_payment_term_id integer REFERENCES account_payment_term (id) ON DELETE SET NULL,
  fiscal_position_id integer REFERENCES account_fiscal_position (id) ON DELETE SET NULL,
  commercial_partner_id integer REFERENCES res_partner (id) ON DELETE SET NULL,
  invoice_user_id integer REFERENCES res_users (id) ON DELETE SET NULL,
  amount_untaxed numeric(16, 4) DEFAULT 0,
  amount_tax     numeric(16, 4) DEFAULT 0,
  amount_total   numeric(16, 4) DEFAULT 0,
  amount_residual numeric(16, 4) DEFAULT 0,
  payment_state  varchar DEFAULT 'not_paid',
  -- EXTERNAL: owned by other apps; plain columns, no foreign keys, unused here
  stock_move_id  integer,            -- stock valuation
  sale_order_id  integer,            -- sale
  purchase_order_id integer,         -- purchase
  l10n_sa_uuid   varchar,            -- l10n_sa_edi (ZATCA)
  l10n_sa_invoice_hash varchar,
  project_details integer,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT account_move_state_check CHECK (state IN ('draft', 'posted', 'cancel')),
  CONSTRAINT account_move_type_check CHECK (move_type IN
    ('entry', 'out_invoice', 'out_refund', 'in_invoice', 'in_refund', 'out_receipt', 'in_receipt')),
  CONSTRAINT account_move_payment_state_check CHECK (payment_state IN
    ('not_paid', 'in_payment', 'paid', 'partial', 'reversed'))
);
CREATE INDEX account_move_journal_date_idx ON account_move (journal_id, date);
CREATE INDEX account_move_partner_idx ON account_move (partner_id);
CREATE INDEX account_move_state_idx ON account_move (state);
CREATE INDEX account_move_type_idx ON account_move (move_type, company_id);
-- a posted name is unique per journal
CREATE UNIQUE INDEX account_move_name_journal_uniq ON account_move (name, journal_id)
  WHERE state = 'posted' AND name <> '/';

ALTER TABLE account_full_reconcile
  ADD CONSTRAINT account_full_reconcile_exchange_move_fkey
  FOREIGN KEY (exchange_move_id) REFERENCES account_move (id) ON DELETE SET NULL;

CREATE TABLE account_move_line (
  id                serial PRIMARY KEY,
  move_id           integer NOT NULL REFERENCES account_move (id) ON DELETE CASCADE,
  name              varchar,
  ref               varchar,
  account_id        integer NOT NULL REFERENCES account_account (id) ON DELETE RESTRICT,
  partner_id        integer REFERENCES res_partner (id) ON DELETE SET NULL,
  journal_id        integer REFERENCES account_journal (id) ON DELETE RESTRICT,   -- stored related
  company_id        integer REFERENCES res_company (id) ON DELETE RESTRICT,       -- stored related
  company_currency_id integer REFERENCES res_currency (id) ON DELETE SET NULL,
  currency_id       integer REFERENCES res_currency (id) ON DELETE SET NULL,
  user_type_id      integer REFERENCES account_account_type (id) ON DELETE SET NULL, -- stored related
  date              date,                                     -- stored related: move_id.date
  date_maturity     date,
  debit             numeric(16, 4) NOT NULL DEFAULT 0,
  credit            numeric(16, 4) NOT NULL DEFAULT 0,
  balance           numeric(16, 4) NOT NULL DEFAULT 0,        -- debit - credit
  amount_currency   numeric(16, 4) NOT NULL DEFAULT 0,
  amount_residual   numeric(16, 4) NOT NULL DEFAULT 0,
  amount_residual_currency numeric(16, 4) NOT NULL DEFAULT 0,
  debit_cash_basis  numeric(16, 4) DEFAULT 0,
  credit_cash_basis numeric(16, 4) DEFAULT 0,
  balance_cash_basis numeric(16, 4) DEFAULT 0,
  reconciled        boolean NOT NULL DEFAULT false,
  full_reconcile_id integer REFERENCES account_full_reconcile (id) ON DELETE SET NULL,
  blocked           boolean DEFAULT false,
  -- invoice-line part
  quantity          numeric(16, 4),
  product_id        integer REFERENCES product_product (id) ON DELETE SET NULL,
  product_uom_id    integer REFERENCES uom_uom (id) ON DELETE SET NULL,
  price_unit        numeric(16, 4) DEFAULT 0,
  discount          numeric(8, 4) DEFAULT 0,
  display_type      varchar,                                  -- NULL | line_section | line_note
  tax_line_id       integer REFERENCES account_tax (id) ON DELETE RESTRICT,   -- set on generated tax lines
  tax_base_amount   numeric(16, 4) DEFAULT 0,
  tax_exigible      boolean DEFAULT true,
  exclude_from_invoice_tab boolean DEFAULT false,
  -- plain ids, tables arrive in later phases or other apps
  analytic_account_id integer,        -- account_analytic_account (phase: analytic)
  payment_id        integer,          -- account_payment (phase: payments)
  statement_line_id integer,          -- account_bank_statement_line (phase: bank)
  statement_id      integer,
  asset_id          integer,          -- account_asset_asset (phase: assets)
  invoice_id        integer,          -- legacy Odoo 12 account.invoice, import reference only
  po_number         varchar,          -- EXTERNAL purchase
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT account_move_line_debit_credit_nonneg CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT account_move_line_display_type_check
    CHECK (display_type IS NULL OR display_type IN ('line_section', 'line_note'))
);
CREATE INDEX account_move_line_move_idx ON account_move_line (move_id);
CREATE INDEX account_move_line_account_idx ON account_move_line (account_id, date);
CREATE INDEX account_move_line_partner_idx ON account_move_line (partner_id, account_id) WHERE reconciled = false;
CREATE INDEX account_move_line_full_rec_idx ON account_move_line (full_reconcile_id);

-- taxes applied to an invoice line (m2m)
CREATE TABLE account_move_line_account_tax_rel (
  account_move_line_id integer NOT NULL REFERENCES account_move_line (id) ON DELETE CASCADE,
  account_tax_id       integer NOT NULL REFERENCES account_tax (id) ON DELETE RESTRICT,
  PRIMARY KEY (account_move_line_id, account_tax_id)
);

CREATE TABLE account_partial_reconcile (
  id                serial PRIMARY KEY,
  debit_move_id     integer NOT NULL REFERENCES account_move_line (id) ON DELETE CASCADE,
  credit_move_id    integer NOT NULL REFERENCES account_move_line (id) ON DELETE CASCADE,
  amount            numeric(16, 4) NOT NULL,
  amount_currency   numeric(16, 4),
  currency_id       integer REFERENCES res_currency (id) ON DELETE SET NULL,
  company_id        integer REFERENCES res_company (id) ON DELETE SET NULL,
  full_reconcile_id integer REFERENCES account_full_reconcile (id) ON DELETE SET NULL,
  max_date          date,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT account_partial_reconcile_amount_positive CHECK (amount > 0)
);
CREATE INDEX account_partial_reconcile_debit_idx  ON account_partial_reconcile (debit_move_id);
CREATE INDEX account_partial_reconcile_credit_idx ON account_partial_reconcile (credit_move_id);

-- Partner defaults used by invoices (Odoo stores these company-dependent in ir_property).
ALTER TABLE res_partner
  ADD COLUMN property_account_receivable_id integer REFERENCES account_account (id) ON DELETE SET NULL,
  ADD COLUMN property_account_payable_id    integer REFERENCES account_account (id) ON DELETE SET NULL,
  ADD COLUMN property_payment_term_id       integer REFERENCES account_payment_term (id) ON DELETE SET NULL,
  ADD COLUMN property_supplier_payment_term_id integer REFERENCES account_payment_term (id) ON DELETE SET NULL,
  ADD COLUMN property_account_position_id   integer REFERENCES account_fiscal_position (id) ON DELETE SET NULL;
