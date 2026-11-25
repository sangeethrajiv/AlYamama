-- 012: the res.company fields shown on the Company form that were not stored yet (same names as Odoo 12).
-- Not included on purpose: fields pointing at tables this schema does not have (incoterm, barcode nomenclature,
-- HR managers, intercompany accounts / journal) and the binary seal / header / footer images.
ALTER TABLE res_company
  ADD COLUMN bank_details_sale_quote boolean,
  ADD COLUMN cash_invoice            boolean,
  ADD COLUMN credit_invoice          boolean,
  ADD COLUMN division                varchar,
  ADD COLUMN company_representation  varchar,
  ADD COLUMN social_twitter          varchar,
  ADD COLUMN social_facebook         varchar,
  ADD COLUMN social_github           varchar,
  ADD COLUMN social_linkedin         varchar,
  ADD COLUMN social_youtube          varchar,
  ADD COLUMN social_googleplus       varchar,
  ADD COLUMN social_instagram        varchar;
