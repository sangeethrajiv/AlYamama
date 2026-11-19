# 04 — Products & Inventory Analysis

> Legend: **[V]** verified (source/DB) · **[I]** inferred · **[U]** unverified.
> Source references: `TY-employee-odoo/odoo_server/addons/{product,stock,stock_account}`.

---

## 1. Installed stack **[V]**
Standard: `product`, `uom`, `stock`, `stock_account`, `stock_landed_costs`, `purchase`, `purchase_stock`, `sale_stock`, `mrp`, `sale_mrp`, `purchase_mrp`.
Custom: `stock_customization`, `stock_force_date`, `landedcost_custom`, `delivery_order_custom`, `att_product_tracking`, `att_customer_pricelist`, `product_ageing_report`, `att_inventory_consumption_report`, `purchase_request`, `purchase_custom`, `sale_custom`, `asset_management_extended`, `att_asset_project_delivery_custom`.
Not installed: `point_of_sale`, `product_expiry`, `stock_picking_batch`, `delivery`, `stock_dropshipping`.

---

## 2. Live data profile **[V]**

| Item | Value |
|---|---|
| `product_template` / `product_product` | 20,327 / 20,327 — **exactly 1:1** |
| Attributes / attribute values / template-attribute values | **0 / 0 / 0** — product variants are **not used** |
| Product `type` | `product` (storable) 18,646 · `consu` 1,245 · `service` 436 |
| `tracking` | `lot` on all 18,646 storable products; `none` on the rest. **No serial tracking** |
| Product ownership by company | company 5: 19,763 · 7: 483 · 9: 69 · 1: 8 · 12: 3 · NULL: 1 |
| Categories `product_category` | 121 (29 roots) |
| UoM | 48 `uom_uom` in 11 `uom_category` (Length 19, Unit 9, Volume 5, Weight 5, Working Time 4, Area 2, plus custom `pcs`, `No.s`, Service, imported units) |
| Pricelists | 1 (`Public Pricelist`, 1 item) — price logic is in custom customer-price fields |
| Vendor info `product_supplierinfo` | 2,412 |
| Warehouses | 6 (one per company; `reception_steps=one_step`, `delivery_steps=ship_only`) |
| Locations `stock_location` | 64: internal 42, view 9, transit 7, inventory 2, production 1, procurement 1, supplier 1, customer 1 |
| Picking types | 49: internal 31, incoming 6, outgoing 6, mrp_operation 6 |
| Pickings `stock_picking` | 9,049: done 8,518 · assigned 317 · draft 126 · cancel 61 · confirmed 27 |
| Moves `stock_move` | 34,534: done 32,267 · assigned 1,175 · cancel 1,021 · confirmed 39 · draft 30 · partially_available 2 |
| Move lines `stock_move_line` | 35,253 |
| Quants `stock_quant` | 19,021 — internal 6,797 (Σ ≈ 578,680 units); customer 5,041; supplier 6,701 (Σ ≈ −1.07 M); inventory 478 (Σ ≈ −35.6 k); transit 4. **19 internal quants are negative (Σ −166)** |
| Lots `stock_production_lot` | 10,900 |
| Inventory adjustments `stock_inventory` / lines | 498 / 1,057 |
| Landed costs | 77 |
| Reordering rules | 2 |
| Procurement rules / routes | 48 / 27 |
| Stock-linked journal entries | 32,176 of 118,858 `account_move` have `stock_move_id` |
| `stock_quantity_history` | 0 rows (transient wizard model; historical stock is computed from moves, not stored) |

Negative quants in supplier/inventory/customer locations are normal double-entry stock (virtual locations); the **19 negative internal quants** indicate permitted negative stock **[I]**.

---

## 3. Product master data vs. transactional data

| Category | Models / fields | Notes |
|---|---|---|
| **Master data (migrate once, versioned)** | `product.template` (name, `default_code`, `type`, `categ_id`, `uom_id`, `uom_po_id`, `list_price`, `sale_ok`, `purchase_ok`, `tracking`, `invoice_policy`, `purchase_method`, `description_*`, `weight`, `volume`, `active`, `company_id`), `product.product` (`barcode`, `default_code`), `product.category`, `uom.uom`/`uom.category`, `product.supplierinfo`, `product.pricelist(.item)`, taxes (`product_taxes_rel`, `product_supplier_taxes_rel`) | |
| **Company-dependent properties (`ir.property`, not columns)** | `standard_price` (17,385 rows), `property_account_income_id` (14), `property_account_expense_id` (130), `property_cost_method` (87), `property_valuation` (85), `property_stock_valuation_account_id` (87), `property_stock_account_input/output_categ_id` (88/88), `property_stock_account_input/output` (4/4), `property_stock_journal` (6) | **Must be flattened into explicit per-company tables** in the target — this is a major redesign item |
| **Derived/transactional (do not hand-migrate as master)** | `stock.quant` quantities, `stock.move(.line)`, `stock.picking`, `stock.inventory`, `stock.production.lot` (identity) + `stock_quant` linkage, valuation fields on moves (`value`, `remaining_qty`, `remaining_value`, `price_unit`) | Quants are **derived from done moves** and must be reconciled, not independently trusted |
| **Custom master data** | `product.main.head` (6 rows), `att.product.type`, `att.product.subtype`, `product.customerinfo` (`sale_custom`), `product.lot.track` (`delivery_order_custom`) | |

### 3.1 Custom fields on product models **[V]**
`product.template`: `no_discount` (`att_customer_pricelist`), `internal_type`, `margin_perc` (`crm_customization`), `asset_category_id`, `deferred_revenue_category_id` (`om_account_asset`), `is_purchased_product`, `purchase_order_lines` (`purchase_custom`), `purchase_request` (`purchase_request`), `arabic_name`, `customer_ids`, `internal_short_code`, `is_teltonika_product` (`sale_custom`), `product_type_id` (`stock_customization`), `is_vehicle_subscription` (`subscription_management`).
`product.category`: `lot_sequence_id` (`att_product_tracking`), `arabic_name`, `sequence_code`, `sequence_id` (`sale_custom`).
`uom.uom`: `view_name` (`purchase_custom`).
`stock.picking`: `force_date`, `direct_delivery_id`, `asset_project_delivery_id`, `landed_cost_ids`/`count`/`exists`.
`stock.move`: `created_purchase_request_line_id`, `purchase_request_allocation_ids`, `purchase_request_ids`.
`stock.production.lot`: fields from `purchase_custom`, `stock_customization`.
`stock.landed.cost` (+`.lines`, `stock.valuation.adjustment.lines`): 6 + 1 + 1 fields from `landedcost_custom`.

---

## 4. Valuation and product ↔ accounting **[V]**

* Costing: **FIFO** (`property_cost_method = fifo` on 87 category-property rows). Valuation: **real_time (perpetual)** (85 rows). No `average`/`standard` category property rows exist.
* Mechanism (`stock_account/models/stock.py`): `StockMove._run_fifo` (line 225), `_run_valuation` (296), `_action_done` (357), `_get_accounting_data_for_valuation` (495), `_account_entry_move` (644), `_create_account_move_line` (617), `_run_fifo_vacuum` (481). On done: stock move → `account.move` in the category's **stock journal** (`STJ` in every company) debiting/crediting *stock valuation / stock input / stock output / expense* accounts, setting `account_move.stock_move_id`.
* Product-to-accounting: product → category properties → accounts. `product.category` is the primary configuration point (88 categories carry input/output account properties; 87 carry the valuation account).
* **Custom interference with valuation dates:** `stock_force_date` back-dates `date_done`, move dates, **journal entry dates** (`account.move.create` override) and quant `in_date` from `stock.picking.force_date`. This breaks the "entry date = processing date" assumption and interacts with FIFO ordering and (future) lock dates.
* **Landed costs** (`stock_landed_costs` + `landedcost_custom`): vendor invoice → `stock.landed.cost` → `stock.valuation.adjustment.lines` → extra valuation entries and `landed_cost_value` on `stock.move` (see `stock_move.landed_cost_value`). 77 records exist.
* Purchase side: `purchase_stock` (receipt creates moves), `purchase_request` creates moves linked to request lines; sales side: `sale_stock` + `delivery_order_custom` (`delivery.order` 506, `direct.delivery.order` 7,363) generate pickings and invoices (`delivery.custom.invoice`, `account.invoice.picking_id`/`delivery_note_ids`).

---

## 5. Inventory transaction mechanics **[V]** (Odoo 12)

| Step | Method | Notes |
|---|---|---|
| Confirm | `stock.move._action_confirm` (`stock_move.py:735`) | procurement rules, merging of moves |
| Reserve | `_action_assign` (886) → `stock.quant._update_reserved_quantity` (`stock_quant.py:240`) | FIFO/FEFO strategy per location removal strategy; lot selection |
| Done | `_action_done` (1084) → `stock.move.line._action_done` | creates quant changes via `_update_available_quantity` (`stock_quant.py:184`), and **valuation entries** (`stock_account`) |
| Quant update | `_update_available_quantity` | **Row-level concurrency control** with `SELECT … FOR UPDATE`/`SAVEPOINT` retries; merges quants; cleans zero quants |
| Inventory adjustment | `stock.inventory` → generates moves from the inventory location | 498 adjustments / 1,057 lines |
| Lots | `stock.production.lot` (10,900) per product; `att_product_tracking` auto-assigns lot numbers on receipts using `product.category.lot_sequence_id` | Lot sequences per category |

**Concurrency:** quant mutations are the hottest write path. Node must replicate the **atomic update-or-insert with locking** per `(product, location, lot, package, owner)`.

---

## 6. Node.js + Express feasibility — products & inventory

### 6.1 API requirements
| Capability | Endpoint family | Complexity |
|---|---|---|
| Product CRUD (template ≡ product here) | `/products`, `/product-categories`, `/uoms`, `/pricelists`, `/vendor-prices` | Low–Medium |
| Company-specific costs & accounts | `/products/:id/company-settings` | Medium (replaces `ir.property`) |
| Stock moves & pickings | `/pickings`, `/stock-moves`, actions: confirm / assign / validate / cancel / return | **High** |
| On-hand & availability | `/stock/quants`, `/stock/availability` | Medium (read) / High (write) |
| Adjustments | `/inventory-adjustments` | Medium |
| Lots | `/lots` | Medium |
| Warehouses/locations | `/warehouses`, `/locations`, `/picking-types` | Low–Medium |
| Landed cost | `/landed-costs` | Medium–High |
| Valuation posting | internal domain service (not public) | **High** (calls the accounting posting engine) |

### 6.2 Product variants
Zero attributes and 1:1 template/variant means **a single-table product model is sufficient for the existing data**. Recommend a `product` table with an optional future `product_variant` extension rather than implementing the full template/variant engine now. **[Decision needed from the business]** whether variants are required for the future.

### 6.3 Stock quantity management
* Do **not** store only an editable "on hand" number. Keep **moves as the source of truth** and maintain `stock_quant` with transactional updates, plus a nightly reconciliation (Σ done moves ≡ quants).
* Replicate: location hierarchy (materialised path via `parent_path`; internal locations 42), quantity `reserved_quantity`, lots, negative-stock policy (19 negative internal quants prove it is currently allowed).
* Multi-company: one warehouse per company; internal transfers across companies are done via transit locations/`ICT` journal **[I]** — review the 7 transit locations.

### 6.4 Complex areas
1. FIFO valuation with partial consumption (`remaining_qty`, `remaining_value`) and **FIFO vacuum** for negative stock — replicating cost layers exactly is hard; the migration must carry layer state.
2. Real-time valuation entries (27 % of all journal entries) — need the posting engine first.
3. Procurement/reordering rules (48 rules, 27 routes) and MRP (6 `mrp_operation` types): decide whether MRP/procurement are in scope (**[U]**).
4. `stock_force_date` semantic.
5. Landed cost allocation (`split_method`: equal/by_quantity/by_current_cost_price/by_weight/by_volume).
6. Quantity ↔ UoM conversions (category-based factors, `uom_po_id`).
7. Barcode/lot printing and Arabic names for documents.
8. Reports: stock ledger / ageing / consumption (`product_ageing_report`, `att_inventory_consumption_report`) are bespoke SQL.

### 6.5 Risks
* **Quant divergence:** quants (19,021) must equal the aggregation of done move lines per `(product, location, lot)`; verify before cutover.
* **Company-dependent properties** flattened incorrectly → wrong accounts on invoices/valuation.
* **1 stock move dated 2002** and 19 negative internal quants indicate data-quality exceptions to triage before import.
* **Inline 9.3 GB attachments** (product images, delivery proofs) need a separate migration path (object storage).
