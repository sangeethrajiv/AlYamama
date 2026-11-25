-- 013: the three res.company images shown on the Company form (same names as Odoo 12), stored as bytea like res_partner.image.
-- company_seal is a plain column in Odoo; the header and footer images are attachments there (read from the filestore by the importer).
ALTER TABLE res_company
  ADD COLUMN company_seal          bytea,
  ADD COLUMN company_header_boxed  bytea,
  ADD COLUMN company_footer_boxed  bytea;
