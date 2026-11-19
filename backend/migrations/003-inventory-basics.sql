-- 003-inventory-basics.sql  Phase 1b: products, categories, units of measure,
-- warehouses, locations and operation types.
--
-- Table and column names are the Odoo 12 ones (verified against yamama_LIVE_sep_26).
-- Out of scope here and therefore NOT created: pickings, moves, quants, lots,
-- routes and pull rules, pricelists, taxes, accounts, supplier info, packaging,
-- attribute variants and reordering rules. Where a kept column pointed at one of
-- those (ir_sequence, att_product_type, routes) it is a plain nullable integer
-- with no foreign key, as agreed in docs/CLAUDE_main.md section 4.
--
-- Other deliberate differences from Odoo 12:
--   * money, weight and ratios are numeric, never double precision;
--   * the arabic_* columns are kept for data parity but are not exposed by the API;
--   * circular foreign keys (warehouse <-> location <-> operation type) are
--     DEFERRABLE so the importer can load them in one transaction.

-- ----------------------------------------------------------------------- uom ---
CREATE TABLE uom_category (
  id            serial PRIMARY KEY,
  name          varchar NOT NULL,
  measure_type  varchar,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  -- "You can have only one category per measurement type."
  CONSTRAINT uom_category_uom_category_unique_type UNIQUE (measure_type),
  CONSTRAINT uom_category_measure_type_check
    CHECK (measure_type IS NULL OR measure_type IN ('unit', 'weight', 'time', 'length', 'volume'))
);

CREATE TABLE uom_uom (
  id            serial PRIMARY KEY,
  name          varchar NOT NULL,
  category_id   integer NOT NULL REFERENCES uom_category (id) ON DELETE CASCADE,
  factor        numeric NOT NULL DEFAULT 1.0,
  rounding      numeric NOT NULL DEFAULT 0.01,
  active        boolean DEFAULT true,
  uom_type      varchar NOT NULL DEFAULT 'reference',
  measure_type  varchar,                -- stored related: category_id.measure_type
  view_name     varchar,                -- purchase_custom
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT uom_uom_factor_gt_zero CHECK (factor <> 0),
  CONSTRAINT uom_uom_rounding_gt_zero CHECK (rounding > 0),
  CONSTRAINT uom_uom_factor_reference_is_one
    CHECK ((uom_type = 'reference' AND factor = 1.0) OR uom_type <> 'reference'),
  CONSTRAINT uom_uom_uom_type_check CHECK (uom_type IN ('bigger', 'reference', 'smaller'))
);
CREATE INDEX uom_uom_category_id_index ON uom_uom (category_id);

-- -------------------------------------------------------------- product_category ---
CREATE TABLE product_category (
  id             serial PRIMARY KEY,
  name           varchar NOT NULL,
  complete_name  varchar,                -- stored computed: "Parent / Child"
  parent_id      integer REFERENCES product_category (id) ON DELETE CASCADE,
  parent_path    varchar,
  -- sale_custom / att_product_tracking
  arabic_name    varchar,
  sequence_code  varchar,
  sequence_id    integer,                -- ir_sequence: out of scope, plain integer
  lot_sequence_id integer,               -- ir_sequence: out of scope, plain integer
  removal_strategy_id integer,           -- stock removal strategy: out of scope
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now()
);
CREATE INDEX product_category_parent_id_index ON product_category (parent_id);
CREATE INDEX product_category_parent_path_index ON product_category (parent_path varchar_pattern_ops);
CREATE INDEX product_category_complete_name_index ON product_category (complete_name);

-- ----------------------------------------------------------- product_template ---
CREATE TABLE product_template (
  id               serial PRIMARY KEY,
  name             varchar NOT NULL,
  sequence         integer DEFAULT 1,
  description      text,
  description_purchase text,
  description_sale text,
  description_picking text,              -- stock
  description_pickingout text,           -- stock
  description_pickingin text,            -- stock
  type             varchar NOT NULL DEFAULT 'consu',
  tracking         varchar NOT NULL DEFAULT 'none',   -- stock
  rental           boolean,
  categ_id         integer NOT NULL REFERENCES product_category (id) ON DELETE RESTRICT,
  list_price       numeric(16, 4),
  volume           numeric(16, 4),
  weight           numeric(16, 4),
  sale_ok          boolean DEFAULT true,
  purchase_ok      boolean DEFAULT true,
  uom_id           integer NOT NULL REFERENCES uom_uom (id) ON DELETE RESTRICT,
  uom_po_id        integer NOT NULL REFERENCES uom_uom (id) ON DELETE RESTRICT,
  company_id       integer REFERENCES res_company (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  active           boolean DEFAULT true,
  color            integer,
  default_code     varchar,              -- stored, kept in step with the single variant
  responsible_id   integer REFERENCES res_users (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  sale_delay       numeric(8, 2) DEFAULT 0,

  -- Yamama custom fields
  arabic_name      varchar,
  internal_short_code varchar,
  no_discount      boolean DEFAULT false,          -- att_customer_pricelist
  is_teltonika_product boolean DEFAULT false,      -- sale_custom
  is_vehicle_subscription boolean DEFAULT false,   -- subscription_management
  purchase_request boolean DEFAULT false,          -- purchase_request
  product_type_id  integer,              -- att.product.type (stock_customization): out of scope

  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT product_template_type_check CHECK (type IN ('consu', 'service', 'product')),
  CONSTRAINT product_template_tracking_check CHECK (tracking IN ('none', 'lot', 'serial'))
);
CREATE INDEX product_template_categ_id_index ON product_template (categ_id);
CREATE INDEX product_template_uom_id_index ON product_template (uom_id);
CREATE INDEX product_template_company_id_index ON product_template (company_id);
CREATE INDEX product_template_active_index ON product_template (active);
CREATE INDEX product_template_default_code_index ON product_template (default_code);
CREATE INDEX product_template_name_trgm ON product_template USING gin (erp_unaccent(name) gin_trgm_ops);
CREATE INDEX product_template_default_code_trgm ON product_template USING gin (default_code gin_trgm_ops);

-- ------------------------------------------------------------- product_product ---
-- One variant per template (the live data has no attributes).
CREATE TABLE product_product (
  id             serial PRIMARY KEY,
  product_tmpl_id integer NOT NULL REFERENCES product_template (id) ON DELETE CASCADE,
  default_code   varchar,
  barcode        varchar,
  active         boolean DEFAULT true,
  volume         numeric(16, 4),
  weight         numeric(16, 4),
  no_discount    boolean DEFAULT false,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  -- "A barcode can only be assigned to one product !"
  CONSTRAINT product_product_barcode_uniq UNIQUE (barcode)
);
CREATE INDEX product_product_product_tmpl_id_index ON product_product (product_tmpl_id);
CREATE INDEX product_product_default_code_index ON product_product (default_code);

-- ---------------------------------------------- stock_location / warehouse / type ---
CREATE TABLE stock_location (
  id             serial PRIMARY KEY,
  name           varchar NOT NULL,
  complete_name  varchar,                -- stored computed: "Parent/Child"
  active         boolean DEFAULT true,
  usage          varchar NOT NULL DEFAULT 'internal',
  location_id    integer REFERENCES stock_location (id) ON DELETE CASCADE,
  parent_path    varchar,
  partner_id     integer REFERENCES res_partner (id) ON DELETE SET NULL,
  comment        text,
  posx           integer DEFAULT 0,
  posy           integer DEFAULT 0,
  posz           integer DEFAULT 0,
  company_id     integer REFERENCES res_company (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  scrap_location boolean DEFAULT false,
  return_location boolean DEFAULT false,
  barcode        varchar,
  -- removal/putaway strategy and valuation accounts: out of scope (columns omitted)
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  CONSTRAINT stock_location_barcode_company_uniq UNIQUE (barcode, company_id),
  CONSTRAINT stock_location_usage_check
    CHECK (usage IN ('supplier', 'view', 'internal', 'customer', 'inventory', 'procurement', 'production', 'transit'))
);
CREATE INDEX stock_location_location_id_index ON stock_location (location_id);
CREATE INDEX stock_location_parent_path_index ON stock_location (parent_path varchar_pattern_ops);
CREATE INDEX stock_location_complete_name_index ON stock_location (complete_name);
CREATE INDEX stock_location_company_id_index ON stock_location (company_id);
CREATE INDEX stock_location_usage_index ON stock_location (usage);

CREATE TABLE stock_warehouse (
  id               serial PRIMARY KEY,
  name             varchar NOT NULL,
  active           boolean DEFAULT true,
  company_id       integer NOT NULL REFERENCES res_company (id) ON DELETE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
  partner_id       integer REFERENCES res_partner (id) ON DELETE SET NULL,
  view_location_id integer NOT NULL REFERENCES stock_location (id) DEFERRABLE INITIALLY IMMEDIATE,
  lot_stock_id     integer NOT NULL REFERENCES stock_location (id) DEFERRABLE INITIALLY IMMEDIATE,
  code             varchar(5) NOT NULL,
  reception_steps  varchar NOT NULL DEFAULT 'one_step',
  delivery_steps   varchar NOT NULL DEFAULT 'ship_only',
  wh_input_stock_loc_id integer REFERENCES stock_location (id) DEFERRABLE INITIALLY IMMEDIATE,
  wh_qc_stock_loc_id    integer REFERENCES stock_location (id) DEFERRABLE INITIALLY IMMEDIATE,
  wh_output_stock_loc_id integer REFERENCES stock_location (id) DEFERRABLE INITIALLY IMMEDIATE,
  wh_pack_stock_loc_id  integer REFERENCES stock_location (id) DEFERRABLE INITIALLY IMMEDIATE,
  in_type_id       integer,              -- FKs to stock_picking_type added below
  out_type_id      integer,
  int_type_id      integer,
  pick_type_id     integer,
  pack_type_id     integer,
  buy_to_resupply  boolean DEFAULT true,
  manufacture_to_resupply boolean DEFAULT true,
  -- routes and pull rules (mto_pull_id, *_route_id, ...) are out of scope (columns omitted)
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  -- "The name of the warehouse must be unique per company!"
  CONSTRAINT stock_warehouse_warehouse_name_uniq UNIQUE (name, company_id),
  -- "The code of the warehouse must be unique per company!"
  CONSTRAINT stock_warehouse_warehouse_code_uniq UNIQUE (code, company_id),
  CONSTRAINT stock_warehouse_reception_steps_check CHECK (reception_steps IN ('one_step', 'two_steps', 'three_steps')),
  CONSTRAINT stock_warehouse_delivery_steps_check CHECK (delivery_steps IN ('ship_only', 'pick_ship', 'pick_pack_ship'))
);
CREATE INDEX stock_warehouse_company_id_index ON stock_warehouse (company_id);

CREATE TABLE stock_picking_type (
  id                       serial PRIMARY KEY,
  name                     varchar NOT NULL,
  color                    integer,
  sequence                 integer,
  sequence_id              integer,      -- ir_sequence: out of scope, plain integer (NOT NULL in Odoo)
  default_location_src_id  integer REFERENCES stock_location (id) ON DELETE SET NULL,
  default_location_dest_id integer REFERENCES stock_location (id) ON DELETE SET NULL,
  code                     varchar NOT NULL,
  return_picking_type_id   integer REFERENCES stock_picking_type (id) ON DELETE SET NULL,
  show_entire_packs        boolean,
  warehouse_id             integer REFERENCES stock_warehouse (id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE,
  active                   boolean DEFAULT true,
  use_create_lots          boolean DEFAULT true,
  use_existing_lots        boolean DEFAULT true,
  show_operations          boolean DEFAULT false,
  show_reserved            boolean DEFAULT true,
  barcode                  varchar,
  create_uid integer, create_date timestamp DEFAULT now(),
  write_uid  integer, write_date  timestamp DEFAULT now(),
  -- 'mrp_operation' is added by the mrp addon and is present in the live data
  CONSTRAINT stock_picking_type_code_check
    CHECK (code IN ('incoming', 'outgoing', 'internal', 'mrp_operation'))
);
CREATE INDEX stock_picking_type_warehouse_id_index ON stock_picking_type (warehouse_id);

ALTER TABLE stock_warehouse
  ADD CONSTRAINT stock_warehouse_in_type_id_fkey   FOREIGN KEY (in_type_id)   REFERENCES stock_picking_type (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT stock_warehouse_out_type_id_fkey  FOREIGN KEY (out_type_id)  REFERENCES stock_picking_type (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT stock_warehouse_int_type_id_fkey  FOREIGN KEY (int_type_id)  REFERENCES stock_picking_type (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT stock_warehouse_pick_type_id_fkey FOREIGN KEY (pick_type_id) REFERENCES stock_picking_type (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE,
  ADD CONSTRAINT stock_warehouse_pack_type_id_fkey FOREIGN KEY (pack_type_id) REFERENCES stock_picking_type (id) ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

-- A warehouse and its view location are created together, so these FKs may be
-- checked at COMMIT when a transaction asks for it (the importer does).
