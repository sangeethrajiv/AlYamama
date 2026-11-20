-- 009-accounting-core-fixups.sql  Aligns databases that applied the first version of 005 with the final one.
-- Every statement is safe to run on a database that already has the final 005 (it changes nothing there).
--   * Odoo 12 account groups are shared by all companies, so company_id is optional.
--   * yamama_LIVE_sep_26 has two journals with code INV in company 12, so the code is indexed, not unique.
ALTER TABLE account_group ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE account_journal DROP CONSTRAINT IF EXISTS account_journal_code_company_uniq;
CREATE INDEX IF NOT EXISTS account_journal_code_company_idx ON account_journal (code, company_id);
