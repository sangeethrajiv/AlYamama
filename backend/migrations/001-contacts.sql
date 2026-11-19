-- 001-contacts.sql  Phase 1: Contacts (res.partner and friends)
--
-- Table and column names are the Odoo 12 ones so that importing from the Odoo
-- database is mostly INSERT ... SELECT. Verified against yamama_LIVE_sep_26.
--
-- Deliberate differences from Odoo 12, all noted in docs/SYSTEM_REFERENCE.md:
--   * money/percent are numeric, not double precision (no JS floats);
--   * image / image_sign / image_seal are bytea columns here, while Odoo keeps
--     the bytes in ir_attachment + filestore;
--   * res_company and res_users hold only the columns Contacts needs, and
--     res_users has no password column;
--   * FKs between res_partner, res_company and res_users are DEFERRABLE so the
--     importer can load the three tables inside one transaction.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Odoo's own unaccent wrapper is IMMUTABLE so it can be used in an index.
CREATE OR REPLACE FUNCTION erp_unaccent(text)
  RETURNS text AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- ---------------------------------------------------------------- lookups ---
CREATE TABLE res_currency (
  id          serial PRIMARY KEY,
  name        varchar NOT NULL,
  symbol      varchar,
  active      boolean DEFAULT true,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT res_currency_unique_name UNIQUE (name)
);

CREATE TABLE res_country (
  id              serial PRIMARY KEY,
  name            varchar NOT NULL,
  code            varchar(2),
  address_format  text,
  currency_id     integer REFERENCES res_currency (id) ON DELETE SET NULL,
  phone_code      integer,
  name_position   varchar,
  vat_label       varchar,
  local_name      varchar,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT res_country_name_uniq UNIQUE (name),
  CONSTRAINT res_country_code_uniq UNIQUE (code)
);

CREATE TABLE res_country_state (
  id          serial PRIMARY KEY,
  country_id  integer NOT NULL REFERENCES res_country (id) ON DELETE CASCADE,
  name        varchar NOT NULL,
  code        varchar NOT NULL,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT res_country_state_name_code_uniq UNIQUE (country_id, code)
);
CREATE INDEX res_country_state_country_id_index ON res_country_state (country_id);

CREATE TABLE res_partner_title (
  id        serial PRIMARY KEY,
  name      varchar NOT NULL,
  shortcut  varchar,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now()
);

CREATE TABLE res_partner_industry (
  id         serial PRIMARY KEY,
  name       varchar,
  full_name  varchar,
  active     boolean DEFAULT true,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now()
);

-- Tag tree. parent_path is Odoo's materialised path ("1/4/9/"), used for child_of searches.
CREATE TABLE res_partner_category (
  id           serial PRIMARY KEY,
  name         varchar NOT NULL,
  color        integer,
  parent_id    integer REFERENCES res_partner_category (id) ON DELETE CASCADE,
  parent_path  varchar,
  active       boolean DEFAULT true,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now()
);
CREATE INDEX res_partner_category_parent_path_index ON res_partner_category (parent_path varchar_pattern_ops);

CREATE TABLE res_bank (
  id       serial PRIMARY KEY,
  name     varchar NOT NULL,
  street   varchar,
  street2  varchar,
  zip      varchar,
  city     varchar,
  state    integer REFERENCES res_country_state (id) ON DELETE SET NULL,  -- Odoo column name
  country  integer REFERENCES res_country (id) ON DELETE SET NULL,       -- Odoo column name
  email    varchar,
  phone    varchar,
  active   boolean DEFAULT true,
  bic      varchar,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now()
);
CREATE INDEX res_bank_bic_index ON res_bank (bic);

-- ------------------------------------------------- company / user (stubs) ---
-- Only what Contacts needs. Accounting, stock and HR columns are out of scope.
CREATE TABLE res_company (
  id                       serial PRIMARY KEY,
  name                     varchar NOT NULL,
  parent_id                integer REFERENCES res_company (id) ON DELETE SET NULL,
  partner_id               integer NOT NULL,  -- FK added after res_partner exists
  currency_id              integer REFERENCES res_currency (id) ON DELETE SET NULL,
  sequence                 integer DEFAULT 10,
  email                    varchar,
  phone                    varchar,
  company_registry         varchar,
  default_user_tz          varchar,
  l10n_sa_registered_name  varchar,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now()
);

CREATE TABLE res_users (
  id                 serial PRIMARY KEY,
  login              varchar NOT NULL,
  partner_id         integer NOT NULL,  -- FK added after res_partner exists
  company_id         integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT,
  active             boolean DEFAULT true,
  share              boolean DEFAULT false,
  notification_type  varchar DEFAULT 'email',
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT res_users_login_uniq UNIQUE (login)
);

-- Allowed companies per user (Odoo 13+ style; Odoo 12 had one company per user).
CREATE TABLE res_company_users_rel (
  cid  integer NOT NULL REFERENCES res_company (id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES res_users (id) ON DELETE CASCADE,
  PRIMARY KEY (cid, user_id)
);

-- ------------------------------------------------------------- res_partner ---
CREATE TABLE res_partner (
  id          serial PRIMARY KEY,
  name        varchar,
  display_name varchar,                    -- stored computed
  title       integer REFERENCES res_partner_title (id) ON DELETE SET NULL,  -- Odoo column name
  parent_id   integer REFERENCES res_partner (id) ON DELETE SET NULL,
  ref         varchar,
  lang        varchar,
  tz          varchar,
  user_id     integer,                     -- FK added below (res_users)
  vat         varchar,
  website     varchar,
  comment     text,
  credit_limit numeric(16, 2),             -- Odoo: double precision
  barcode     varchar,
  active      boolean DEFAULT true,
  customer    boolean DEFAULT true,
  supplier    boolean DEFAULT false,
  employee    boolean DEFAULT false,
  function    varchar,
  type        varchar DEFAULT 'contact',
  street      varchar,
  street2     varchar,
  zip         varchar,
  city        varchar,
  state_id    integer REFERENCES res_country_state (id) ON DELETE RESTRICT,
  country_id  integer REFERENCES res_country (id) ON DELETE RESTRICT,
  email       varchar,
  phone       varchar,
  mobile      varchar,
  is_company  boolean DEFAULT false,
  industry_id integer REFERENCES res_partner_industry (id) ON DELETE SET NULL,
  company_id  integer REFERENCES res_company (id) ON DELETE SET NULL,
  color       integer DEFAULT 0,
  partner_share boolean DEFAULT false,     -- stored computed
  commercial_partner_id integer REFERENCES res_partner (id) ON DELETE SET NULL,  -- stored computed
  commercial_company_name varchar,         -- stored computed
  company_name varchar,
  date        date,

  -- images (Odoo keeps these in ir_attachment + filestore)
  image       bytea,
  image_sign  bytea,
  image_seal  bytea,

  -- Yamama custom fields (sale_custom, att_customer_pricelist, delivery_order_custom)
  arabic_name          varchar,
  arabic_street2_name  varchar,
  arabic_city_name     varchar,
  vat_arabic           varchar,
  customer_code        varchar,
  vandor_number        varchar,            -- spelling kept from Odoo
  cr_number            varchar,
  cash_customer        boolean DEFAULT false,
  fax                  varchar,
  discount             numeric(6, 3),      -- Odoo: double precision
  customer_discount    numeric(6, 3),      -- Odoo: double precision
  company_name_code    varchar,

  -- ZATCA buyer identification (l10n_sa_edi)
  l10n_sa_edi_building_number                varchar,
  l10n_sa_edi_plot_identification            varchar,
  l10n_sa_additional_identification_scheme   varchar,
  l10n_sa_additional_identification_number   varchar,
  l10n_sa_registered_name                    varchar,

  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now(),

  -- Odoo 12 base: "Contacts require a name"
  CONSTRAINT res_partner_check_name
    CHECK ((type = 'contact' AND name IS NOT NULL) OR type <> 'contact'),
  -- delivery_order_custom: "Company Code already exists!"
  CONSTRAINT res_partner_company_name_code UNIQUE (company_name_code),
  -- base selection + child_company (att_installation_request) and manager (att_vehicle_sync)
  CONSTRAINT res_partner_type_check
    CHECK (type IN ('contact', 'invoice', 'delivery', 'other', 'private', 'child_company', 'manager')),
  CONSTRAINT res_partner_scheme_check
    CHECK (l10n_sa_additional_identification_scheme IS NULL
           OR l10n_sa_additional_identification_scheme IN ('TIN', 'CRN', 'MOM', 'MLS', '700', 'SAG', 'NAT', 'GCC', 'IQA', 'PAS', 'OTH'))
);

ALTER TABLE res_company
  ADD CONSTRAINT res_company_partner_id_fkey FOREIGN KEY (partner_id)
      REFERENCES res_partner (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE res_users
  ADD CONSTRAINT res_users_partner_id_fkey FOREIGN KEY (partner_id)
      REFERENCES res_partner (id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE res_partner
  ADD CONSTRAINT res_partner_user_id_fkey FOREIGN KEY (user_id)
      REFERENCES res_users (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX res_partner_parent_id_index ON res_partner (parent_id);
CREATE INDEX res_partner_company_id_index ON res_partner (company_id);
CREATE INDEX res_partner_commercial_partner_id_index ON res_partner (commercial_partner_id);
CREATE INDEX res_partner_country_id_index ON res_partner (country_id);
CREATE INDEX res_partner_state_id_index ON res_partner (state_id);
CREATE INDEX res_partner_user_id_index ON res_partner (user_id);
CREATE INDEX res_partner_active_index ON res_partner (active);
CREATE INDEX res_partner_display_name_index ON res_partner (display_name);
-- Odoo 12 builds this one by hand in _auto_init.
CREATE INDEX res_partner_vat_index ON res_partner (regexp_replace(upper(vat), '[^A-Z0-9]+', '', 'g'));

-- Search indexes: accent-insensitive trigram, for the Contacts search view.
CREATE INDEX res_partner_name_trgm ON res_partner USING gin (erp_unaccent(name) gin_trgm_ops);
CREATE INDEX res_partner_display_name_trgm ON res_partner USING gin (erp_unaccent(display_name) gin_trgm_ops);
CREATE INDEX res_partner_arabic_name_trgm ON res_partner USING gin (arabic_name gin_trgm_ops);
CREATE INDEX res_partner_email_trgm ON res_partner USING gin (erp_unaccent(email) gin_trgm_ops);
CREATE INDEX res_partner_phone_trgm ON res_partner USING gin (phone gin_trgm_ops);
CREATE INDEX res_partner_mobile_trgm ON res_partner USING gin (mobile gin_trgm_ops);
CREATE INDEX res_partner_ref_trgm ON res_partner USING gin (erp_unaccent(ref) gin_trgm_ops);
CREATE INDEX res_partner_cr_number_trgm ON res_partner USING gin (cr_number gin_trgm_ops);
CREATE INDEX res_partner_customer_code_trgm ON res_partner USING gin (customer_code gin_trgm_ops);

-- Tags m2m (Odoo's default relation table name and column order)
CREATE TABLE res_partner_res_partner_category_rel (
  partner_id   integer NOT NULL REFERENCES res_partner (id) ON DELETE CASCADE,
  category_id  integer NOT NULL REFERENCES res_partner_category (id) ON DELETE CASCADE,
  PRIMARY KEY (partner_id, category_id)
);
CREATE INDEX res_partner_res_partner_category_rel_category_id_index
  ON res_partner_res_partner_category_rel (category_id);

CREATE TABLE res_partner_bank (
  id                    serial PRIMARY KEY,
  acc_number            varchar NOT NULL,
  sanitized_acc_number  varchar,           -- stored computed
  acc_holder_name       varchar,
  partner_id            integer NOT NULL REFERENCES res_partner (id) ON DELETE CASCADE,
  bank_id               integer REFERENCES res_bank (id) ON DELETE SET NULL,
  sequence              integer DEFAULT 10,
  currency_id           integer REFERENCES res_currency (id) ON DELETE SET NULL,
  company_id            integer REFERENCES res_company (id) ON DELETE SET NULL,
  show_in_report        boolean DEFAULT false,   -- account_customization
  iban                  varchar,                 -- account_customization
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT res_partner_bank_unique_number UNIQUE (sanitized_acc_number, company_id)
);
CREATE INDEX res_partner_bank_partner_id_index ON res_partner_bank (partner_id);

-- --------------------------------------------------------- external ids ---
-- ir_model_data equivalent: every imported row keeps its Odoo id.
CREATE TABLE ir_model_data (
  id      serial PRIMARY KEY,
  module  varchar NOT NULL,
  name    varchar NOT NULL,
  model   varchar NOT NULL,
  res_id  integer,
  noupdate boolean DEFAULT false,
  create_uid  integer, create_date timestamp DEFAULT now(),
  write_uid   integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT ir_model_data_module_name_uniq UNIQUE (module, name)
);
CREATE INDEX ir_model_data_model_res_id_index ON ir_model_data (model, res_id);
