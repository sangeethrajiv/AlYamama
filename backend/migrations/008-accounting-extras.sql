-- 008-accounting-extras.sql  Accounting phase 4.
--   * cash-basis tax: the company's cash-basis journal, and cash-basis entries die with the reconcile that made them
--   * bank statement import: a per-line import id so a file imported twice adds nothing new
--   * notes and attachments on documents (Odoo's chatter and ir.attachment)
-- Currency exchange differences need no new column: Odoo 12 posts them in the company's exchange journal
-- (res_company.currency_exchange_journal_id, from 005) using that journal's default accounts.

ALTER TABLE res_company
  ADD COLUMN tax_cash_basis_journal_id integer REFERENCES account_journal (id) ON DELETE SET NULL;
ALTER TABLE res_company
  ADD CONSTRAINT res_company_exchange_journal_fkey FOREIGN KEY (currency_exchange_journal_id)
  REFERENCES account_journal (id) ON DELETE SET NULL;

-- A cash-basis entry belongs to the partial reconcile that triggered it; unreconciling deletes it.
ALTER TABLE account_move
  ADD CONSTRAINT account_move_tax_cash_basis_rec_fkey FOREIGN KEY (tax_cash_basis_rec_id)
  REFERENCES account_partial_reconcile (id) ON DELETE CASCADE;

ALTER TABLE account_bank_statement_line ADD COLUMN unique_import_id varchar;
CREATE UNIQUE INDEX account_bank_statement_line_import_uniq
  ON account_bank_statement_line (journal_id, unique_import_id) WHERE unique_import_id IS NOT NULL;

CREATE TABLE account_note (
  id         serial PRIMARY KEY,
  res_model  varchar NOT NULL,                 -- account.move, account.payment, ...
  res_id     integer NOT NULL,
  kind       varchar NOT NULL DEFAULT 'note',  -- note (typed by a user) | log (written by the system)
  body       text NOT NULL,
  author_id  integer REFERENCES res_users (id) ON DELETE SET NULL,
  create_date timestamp NOT NULL DEFAULT now(),
  CONSTRAINT account_note_kind_check CHECK (kind IN ('note', 'log'))
);
CREATE INDEX account_note_record_idx ON account_note (res_model, res_id, id);

CREATE TABLE account_attachment (
  id          serial PRIMARY KEY,
  res_model   varchar NOT NULL,
  res_id      integer NOT NULL,
  name        varchar NOT NULL,
  mimetype    varchar,
  file_size   integer NOT NULL,
  data        bytea NOT NULL,
  create_uid  integer REFERENCES res_users (id) ON DELETE SET NULL,
  create_date timestamp NOT NULL DEFAULT now()
);
CREATE INDEX account_attachment_record_idx ON account_attachment (res_model, res_id);
