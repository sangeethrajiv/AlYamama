# System reference (local dev)

Living note of how this machine and project are set up. Update it when something changes. **Do not put real/production secrets here.**

## Repo layout (`/home/amaldev/ARJUN/odoo/accounting_26/AlYamama`)
| Path | What |
|---|---|
| `frontend/` | Angular 22 Nx workspace (merged from branch `frontend`). `npm start` in `frontend/` -> http://localhost:4200. Follows `ERP_Architecture_Reference_v2.2.pdf` (libs/web/core, ui, api-client, features/*). |
| `backend/` | Node 20 + Express 5 + TypeScript + sequelize-typescript + PostgreSQL. Contacts module first. |
| `docs/` | Shared docs (copies): `CLAUDE_main.md`, `field-map-phase1.md`, `api-service-architecture-handover.md`, `migration_analysis/`, `baseline/` |
| git branch | `feature/merge/angular_ui` (backend from `feature/contacts` + Angular UI from `frontend`). Remote: `origin` |

## Stack decisions
Express, PostgreSQL, fields as model classes (sequelize-typescript), Odoo 12 table/column names kept (incl. `arabic_*`), images as `bytea`, no server-side VAT format check, UI-only fields not stored, Angular final frontend.

## PostgreSQL (local)
| Item | Value |
|---|---|
| Clusters | v14 on port 5432, **v17 on port 5433 (used here)** |
| Host | localhost |
| Odoo 12 source DB (READ-ONLY) | `yamama_LIVE_sep_26` (the local Odoo 12 dev instance; config in `/home/amaldev/ARJUN/odoo/yamama/yamama.conf`) |
| Odoo DB user | `yamamafay` (superuser; password only in `yamama.conf`, never copied here) |
| New ERP DB | `accounting_26_test` |
| Throwaway test DB | `accounting_26_test_unit` (dropped/recreated by `npm test`) |
| ERP DB user | `erp_dev` / password `erp_dev` (LOGIN, CREATEDB, not superuser; dev only) |
| Config file | `backend/.env` (gitignored, chmod 600); template `backend/.env.example` |

Other databases on that server (do not touch): `yamama_live_290126_dump`, `yamamasynclive27026_db`, `yamamalivsync_040526_db`, `arj_yamama_live_2_sep_26`, `faywll_arj_oct`, `gcc_test_db`, `gg`, `yamamafay`.

## Rules
- The Odoo DB is only ever read, inside `BEGIN READ ONLY`. Only `backend/scripts/import-odoo.ts` connects to it.
- Schema changes go through `backend/migrations/`, never `sequelize.sync()` or ALTER at boot.
- Money/percent are `numeric`, never JS floats.
- Auth is a header stub (`X-User-Id`, `X-Company-Id`, `X-Allowed-Company-Ids`) until JWT is built.

## Commands (run in `backend/`)
`npm run db:create` · `npm run migrate` · `npm run import:odoo` · `npm run dev` (port 3000) · `npm test` · `npm run typecheck`

## Known facts about the Odoo data (from migration_analysis)
Odoo 12 CE; 6 companies; ~6,364 partners (6,291 active); `type` also has `manager` (259) and `child_company`; stored computed columns `display_name`, `commercial_partner_id`, `commercial_company_name`, `partner_share`; images live in `ir_attachment`.

## Status (Contacts, 2026-11-19)
- Backend done: migrations 001-002, model classes, Odoo rules in `partner.service.ts`, search view, partner banks, lookups, importer, 34 passing tests.
- Odoo import (`yamama_LIVE_sep_26`): 6,053 partners (5,986 active), 6 companies, 101 users, 251 countries, 712 states, 35 partner banks. All counts match the source; re-running creates no duplicates.
- Images: only 83 of ~6,034 partner image files exist in the local filestore (7.8 MB), so most contacts have no photo after import.
- Frontend: `contactMaster` store reads/writes the API when `frontend/.env.local` sets `VITE_API_URL`; otherwise it uses sample data. Verified in Chrome: list loads 6,053 contacts, create persists.
- UI-only (not stored): girfalcoId, latitude/longitude, locationNotes, taxRegime, invoiceDelivery, billingEmail, currency, paymentTerms, signatory, otherKind, isLogin.
- Tags: the Odoo copy has 0 tags and 0 tag links, so the tag feature is tested only on test data.

## Status (Inventory basics, 2026-11-19)
- Built: UoM categories and units, product categories (tree), products (template + one variant), warehouses, locations (tree) and operation types. Migration `003-inventory-basics.sql`, importer `npm run import:inventory`.
- Imported from Odoo: 11 UoM categories, 48 UoMs, 120 product categories, 64 locations, 6 warehouses, 49 operation types, and **50 products chosen to differ** (30 storable / 12 consumable / 8 service; 32 categories, 16 units, 10 unit categories, 3 archived).
- Odoo rules ported (with tests): one reference unit per UoM category, factor/rounding checks, `factor_inv = 1/factor`, same-category sales/purchase units, unique barcode, `complete_name` + `parent_path` on categories and locations, recursion checks, unique warehouse name/code per company, unique location barcode per company. Unit conversion uses decimal.js.
- UI: with `VITE_API_URL` the Inventory master-data screens read/write the API. Receipts, Deliveries, Transfers, Adjustments, Overview and the stock reports show "Coming soon".
- Warehouses and operation types can be edited (name, code, active) but not created: Odoo generates locations, routes and sequences for a new warehouse, which are not built. The reception/delivery steps are read-only for the same reason.
- Not stored (screen labels only): product cost and responsible user, location owner, operation-type sequence prefix.
- Deferred: pickings, stock moves, quants, lots, routes/pull rules, pricelists, taxes, accounts, supplier info, packaging, variants, reordering rules. `ir_sequence`, `att_product_type` columns are plain integers.
- Arabic: `arabic_*` columns are kept but the Contacts and Inventory APIs no longer return or search them. The 20 contacts that have Arabic text in `name` are unchanged.

## Open items
- Sample size and selection are in `scripts/import-inventory.ts` (`--products N`).
- 20 contacts have Arabic text in the main `name`; they need English names from the business.
- Arabic `lang` code (Odoo has only `en_US` installed).
- `neighborhood -> street2` and `streetAr -> arabic_street2_name` mapping to confirm.
- `child_company_ids` is the inverse of `parent_id` (checked); live data has 0 `child_company` rows, 170 `manager`, 5,883 `contact`.
- Vercel root directory must be `frontend/` if the repo is deployed there.
- `yamama.conf` holds plaintext secrets, `list_db=True`: harden the legacy instance.

## Status (Angular merge, 2026-11-20)
- `frontend` branch merged; the React app is deleted. `backend/.env` from that branch was not taken (it held passwords); rotate the `yamamafay` password, it is in that branch's git history.
- Angular talks to the backend through `HttpContactsApi` and `HttpProductApi` (`frontend/libs/web/api-client/src/lib/http/`). Switch with `USE_BACKEND` in `frontend/apps/web/src/app/app.config.ts`. URL and stub-auth headers: `BACKEND_CONFIG`.
- Still mock: sign-in, system, accounting, catalog, and the Users directory, access rights and per-contact activity.
- Migration `004-product-extras.sql`: `standard_price`, `margin_perc`, `internal_type`, `product_genre` on products; `active` on both category tables. `taxes_id` is not stored (no account module); `qty_available` and `virtual_available` are 0 until stock moves exist.
- `GET /contacts?full=1` returns every column except images; `GET /states` lists all states. CORS allows http://localhost:4200.
- Warehouses, locations and operation types: API only, no Angular screens.
- Checked in Chrome: 6,054 contacts and the 50 products, categories and UoMs load from the database; creating a product and a contact persisted (test rows deleted).
