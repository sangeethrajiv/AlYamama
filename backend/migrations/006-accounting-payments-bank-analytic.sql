-- 006-accounting-payments-bank-analytic.sql  Accounting phase 2.
-- Payments (customer and vendor), bank statements with their lines, analytic accounts.
-- Names follow Odoo 12. Not created, owned by other apps: payment providers/transactions
-- (EXTERNAL payment_transaction_id is a plain integer), cheques, assets (next phase).

-- ------------------------------------------------------------------ analytic ---
CREATE TABLE account_analytic_group (
  id serial PRIMARY KEY, name varchar NOT NULL,
  parent_id integer REFERENCES account_analytic_group (id) ON DELETE CASCADE, parent_path varchar,
  description text, company_id integer REFERENCES res_company (id) ON DELETE SET NULL,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now()
);
CREATE TABLE account_analytic_tag (
  id serial PRIMARY KEY, name varchar NOT NULL, active boolean DEFAULT true,
  company_id integer REFERENCES res_company (id) ON DELETE SET NULL,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now()
);
CREATE TABLE account_analytic_account (
  id serial PRIMARY KEY, name varchar NOT NULL, code varchar, active boolean DEFAULT true,
  group_id integer REFERENCES account_analytic_group (id) ON DELETE SET NULL,
  partner_id integer REFERENCES res_partner (id) ON DELETE SET NULL,
  company_id integer REFERENCES res_company (id) ON DELETE RESTRICT,
  currency_id integer REFERENCES res_currency (id) ON DELETE SET NULL,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now()
);
ALTER TABLE account_move_line
  ADD CONSTRAINT account_move_line_analytic_fkey FOREIGN KEY (analytic_account_id)
  REFERENCES account_analytic_account (id) ON DELETE SET NULL;
CREATE TABLE account_analytic_line (
  id serial PRIMARY KEY, name varchar NOT NULL, date date NOT NULL DEFAULT current_date,
  amount numeric(16, 4) NOT NULL DEFAULT 0,          -- credit - debit of the journal item
  unit_amount numeric(16, 4) DEFAULT 0,
  account_id integer NOT NULL REFERENCES account_analytic_account (id) ON DELETE RESTRICT,
  partner_id integer REFERENCES res_partner (id) ON DELETE SET NULL,
  company_id integer REFERENCES res_company (id) ON DELETE SET NULL,
  move_id integer REFERENCES account_move_line (id) ON DELETE CASCADE,
  general_account_id integer REFERENCES account_account (id) ON DELETE SET NULL,
  product_id integer REFERENCES product_product (id) ON DELETE SET NULL,
  ref varchar,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now()
);
CREATE INDEX account_analytic_line_account_idx ON account_analytic_line (account_id, date);

-- ------------------------------------------------------------------ payments ---
CREATE TABLE account_payment (
  id                     serial PRIMARY KEY,
  name                   varchar,                         -- the payment's move number once posted
  state                  varchar NOT NULL DEFAULT 'draft',
  payment_type           varchar NOT NULL,                -- inbound | outbound | transfer
  partner_type           varchar,                         -- customer | supplier
  partner_id             integer REFERENCES res_partner (id) ON DELETE RESTRICT,
  amount                 numeric(16, 4) NOT NULL,
  currency_id            integer REFERENCES res_currency (id) ON DELETE SET NULL,
  payment_date           date NOT NULL DEFAULT current_date,
  communication          varchar,
  journal_id             integer NOT NULL REFERENCES account_journal (id) ON DELETE RESTRICT,
  payment_method_code    varchar NOT NULL DEFAULT 'manual', -- manual | check | batch_deposit ...
  destination_account_id integer REFERENCES account_account (id) ON DELETE RESTRICT,
  move_id                integer REFERENCES account_move (id) ON DELETE SET NULL,
  company_id             integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  payment_transaction_id integer,                         -- EXTERNAL payment providers
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_payment_amount_positive CHECK (amount > 0),
  CONSTRAINT account_payment_state_check CHECK (state IN ('draft', 'posted', 'sent', 'reconciled', 'cancelled')),
  CONSTRAINT account_payment_type_check CHECK (payment_type IN ('inbound', 'outbound', 'transfer')),
  CONSTRAINT account_payment_partner_type_check CHECK (partner_type IS NULL OR partner_type IN ('customer', 'supplier'))
);
CREATE INDEX account_payment_partner_idx ON account_payment (partner_id, state);
ALTER TABLE account_move_line
  ADD CONSTRAINT account_move_line_payment_fkey FOREIGN KEY (payment_id)
  REFERENCES account_payment (id) ON DELETE SET NULL;
-- invoices a payment was registered against
CREATE TABLE account_invoice_payment_rel (
  payment_id integer NOT NULL REFERENCES account_payment (id) ON DELETE CASCADE,
  invoice_id integer NOT NULL REFERENCES account_move (id) ON DELETE CASCADE,
  PRIMARY KEY (payment_id, invoice_id)
);

-- ------------------------------------------------------------- bank statements ---
CREATE TABLE account_bank_statement (
  id               serial PRIMARY KEY,
  name             varchar NOT NULL,
  reference        varchar,
  date             date NOT NULL DEFAULT current_date,
  journal_id       integer NOT NULL REFERENCES account_journal (id) ON DELETE RESTRICT,
  company_id       integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  balance_start    numeric(16, 4) NOT NULL DEFAULT 0,
  balance_end_real numeric(16, 4) NOT NULL DEFAULT 0,     -- the balance printed on the bank's statement
  state            varchar NOT NULL DEFAULT 'open',       -- open | confirm
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_bank_statement_state_check CHECK (state IN ('open', 'confirm'))
);
CREATE TABLE account_bank_statement_line (
  id           serial PRIMARY KEY,
  statement_id integer NOT NULL REFERENCES account_bank_statement (id) ON DELETE CASCADE,
  sequence     integer DEFAULT 1,
  date         date NOT NULL,
  name         varchar NOT NULL,                          -- label from the bank
  ref          varchar,
  partner_id   integer REFERENCES res_partner (id) ON DELETE SET NULL,
  amount       numeric(16, 4) NOT NULL,                   -- + money in, - money out
  journal_id   integer REFERENCES account_journal (id) ON DELETE RESTRICT,
  company_id   integer REFERENCES res_company (id) ON DELETE RESTRICT,
  move_id      integer REFERENCES account_move (id) ON DELETE SET NULL,  -- set once booked/reconciled
  note         text,
  create_uid integer, create_date timestamp DEFAULT now(), write_uid integer, write_date timestamp DEFAULT now(),
  CONSTRAINT account_bank_statement_line_amount_nonzero CHECK (amount <> 0)
);
CREATE INDEX account_bank_statement_line_stmt_idx ON account_bank_statement_line (statement_id);
ALTER TABLE account_move_line
  ADD CONSTRAINT account_move_line_statement_fkey FOREIGN KEY (statement_id)
  REFERENCES account_bank_statement (id) ON DELETE SET NULL,
  ADD CONSTRAINT account_move_line_statement_line_fkey FOREIGN KEY (statement_line_id)
  REFERENCES account_bank_statement_line (id) ON DELETE SET NULL;

-- Suspense account for bank statement lines that are booked but not matched yet.
ALTER TABLE res_company ADD COLUMN account_journal_suspense_account_id integer REFERENCES account_account (id) ON DELETE SET NULL;
