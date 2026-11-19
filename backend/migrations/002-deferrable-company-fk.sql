-- 002-deferrable-company-fk.sql
--
-- The importer loads res_partner before res_company, because every company row
-- points at a partner (res_company.partner_id). res_partner.company_id points
-- back, so the two tables are mutually dependent and must load inside one
-- transaction with the check postponed to COMMIT.
--
-- DEFERRABLE INITIALLY IMMEDIATE keeps normal application behaviour unchanged:
-- the constraint is still checked at statement time unless a transaction asks
-- for SET CONSTRAINTS ALL DEFERRED, which only the importer does.

ALTER TABLE res_partner DROP CONSTRAINT res_partner_company_id_fkey;
ALTER TABLE res_partner
  ADD CONSTRAINT res_partner_company_id_fkey FOREIGN KEY (company_id)
      REFERENCES res_company (id) ON DELETE SET NULL
      DEFERRABLE INITIALLY IMMEDIATE;

-- Same reasoning for a bank account that belongs to a company.
ALTER TABLE res_partner_bank DROP CONSTRAINT res_partner_bank_company_id_fkey;
ALTER TABLE res_partner_bank
  ADD CONSTRAINT res_partner_bank_company_id_fkey FOREIGN KEY (company_id)
      REFERENCES res_company (id) ON DELETE SET NULL
      DEFERRABLE INITIALLY IMMEDIATE;

-- And for a user's company.
ALTER TABLE res_users DROP CONSTRAINT res_users_company_id_fkey;
ALTER TABLE res_users
  ADD CONSTRAINT res_users_company_id_fkey FOREIGN KEY (company_id)
      REFERENCES res_company (id) ON DELETE RESTRICT
      DEFERRABLE INITIALLY IMMEDIATE;
