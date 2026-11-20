-- Product fields the Angular UI needs on top of 003.
--   standard_price : Odoo stores it company-dependent in ir_property; here one value per product.
--   margin_perc, internal_type : real Odoo columns on product_template.
--   product_genre : Angular-only field, no Odoo column; stored so it persists.
--   active on the two category tables: Odoo has none; it is the UI's archive flag.
-- taxes_id (account.tax) is not stored: there is no account module yet.
ALTER TABLE product_template
  ADD COLUMN standard_price numeric(16, 4) NOT NULL DEFAULT 0,
  ADD COLUMN margin_perc    numeric(16, 4) NOT NULL DEFAULT 0,
  ADD COLUMN internal_type  varchar,
  ADD COLUMN product_genre  varchar;

ALTER TABLE product_template
  ADD CONSTRAINT product_template_internal_type_check
    CHECK (internal_type IS NULL OR internal_type IN ('material', 'labour', 'overhead'));

ALTER TABLE product_category ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE uom_category     ADD COLUMN active boolean NOT NULL DEFAULT true;
