-- 014: res.company "Intercompany Payment Configuration" (same names as Odoo 12).
-- Plain ids with no foreign key on purpose: the accounts and the journal are loaded by the accounting importer, which runs
-- after the company import, so a key here would fail the first import. The names are looked up when the form is read.
ALTER TABLE res_company
  ADD COLUMN due_from_account_id            integer,
  ADD COLUMN due_to_account_id              integer,
  ADD COLUMN due_fromto_payment_journal_id  integer;
