-- 016: two product relations the Angular UI shows, stored the way Odoo 12 stores them.
--   product_type_id (many2one -> att.product.type, label "Product Genre"): the lookup table, as in stock_customization.
--   taxes_id        (many2many -> account.tax,     label "Customer Taxes"): the product_taxes_rel table, same name and columns as Odoo.
-- product_template.product_genre (added in 004) was an Angular-only text field for the same purpose; it is no longer read or written.
CREATE TABLE att_product_type (
  id         serial PRIMARY KEY,
  name       varchar NOT NULL,
  active     boolean DEFAULT true,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now()
);

-- NOT VALID: products imported before this table existed keep their value; every new write is checked.
ALTER TABLE product_template
  ADD CONSTRAINT product_template_product_type_id_fkey
    FOREIGN KEY (product_type_id) REFERENCES att_product_type (id) ON DELETE RESTRICT NOT VALID;

CREATE TABLE product_taxes_rel (
  prod_id integer NOT NULL REFERENCES product_template (id) ON DELETE CASCADE,
  tax_id  integer NOT NULL REFERENCES account_tax (id) ON DELETE CASCADE,
  PRIMARY KEY (prod_id, tax_id)
);
CREATE INDEX product_taxes_rel_tax_idx ON product_taxes_rel (tax_id);
