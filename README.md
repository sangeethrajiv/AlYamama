# Al-Yamama ERP

| Folder | What |
|---|---|
| `backend/` | Node 20 + Express 5 + TypeScript + sequelize-typescript on PostgreSQL. Contacts and Products. |
| `frontend/` | Angular Nx workspace (see `frontend/README.md`). Talks to the backend at `/v2`. |
| `docs/` | Analysis, field maps, architecture handover and `SYSTEM_REFERENCE.md` (setup, databases, rules). |

## Run the backend
```bash
cd backend
cp .env.example .env        # fill PGUSER / PGPASSWORD / ODOO_PGDATABASE (see docs/SYSTEM_REFERENCE.md)
npm install
npm run db:create           # accounting_26_test + accounting_26_test_unit
npm run migrate             # schema, from migrations/*.sql
npm run import:odoo         # copy contacts from the Odoo 12 copy (read-only source)
npm run import:inventory    # UoMs, categories, locations, warehouses, operation types + 50 varied products
npm run import:accounting   # accounting CONFIG only: chart of accounts, journals, taxes, terms, analytic, asset types, defaults (no transactions)
npm run dev                 # http://localhost:3000/v2   (health: /health)
npm test                    # recreates the unit DB, runs every *.test.ts
```

## Run the frontend (Angular)
```bash
cd frontend
npm install
npm start                   # nx serve web -> http://localhost:4200
```
All Angular commands run inside `frontend/` (the Nx workspace root).

## Contacts API (`/v2`)
`GET /contacts` (q, field, filters, active, order, page, limit, counts=1, group_by) · `GET /contacts/search-view` · `GET /contacts/read-group` · `GET /contacts/name-search` · `GET|PUT /contacts/:id` · `POST /contacts` · `POST /contacts/:id/archive|unarchive` · `DELETE /contacts/:id` · `/partner-banks` · lookups: `/partner-titles`, `/partner-industries`, `/partner-categories`, `/banks`, `/countries`, `/countries/:id/states`, `/companies`, `/users`.

### Product API (`/v2`)
`/products` (search view, read-group, name-search, archive) · `/product-categories` · `/uom-categories` · `/uoms`. Also available, no UI for now: `/warehouses` · `/locations` · `/operation-types`.

### Accounting (`/v2/accounting`)
Schema: `migrations/005` core ledger, `006` payments, bank and analytic, `007` invoicing flows and assets. `npm run import:accounting` loads the configuration from Odoo (read-only); no invoices, entries or payments are copied.

- **Customers menu:** `/moves` with `move_type` and `invoice_category` (cash, credit, proforma, progressive); credit notes; `/internal-vouchers`; `/payments`.
- **Vendors menu:** `/moves` bills, refunds and the approval flow (`submit-approval`, `approve`, `reject`); `/payable-vouchers`; `/payments`.
- **Accounting menu:** journal entries and items, `/analytic-lines`, `/assets` (+ `generate-entries`), `/bank-statements`, `/move-lines/reconcile`, `moves/tax-adjustment`.
- **Reporting:** `/reports/<trial-balance | general-ledger | partner-ledger | aged-receivable | aged-payable | profit-loss | balance-sheet | tax-report | journal-summary>`.
- **Configuration:** `/accounts` `/account-types` `/account-groups` `/journals` `/taxes` `/tax-groups` `/payment-terms` `/fiscal-positions` `/fiscal-years` `/currency-list` `/currency-rates` `/incoterms` `/reconcile-models` `/analytic-accounts` `/analytic-groups` `/analytic-tags` `/asset-types` `/settings`.
- **External apps (columns kept, no behaviour):** subscriptions, vehicles/GPS, purchase, stock, landed cost, ZATCA e-invoicing, approval routing, asset rental, payment providers.
- Not built: budgets, foreign-currency exchange differences, cash-basis tax, bank statement file import.

The Angular screens live in `frontend/libs/web/features/accounting/src/lib/v2/`. Dropdowns for many2one / many2many fields are `erp-select` and `erp-multi-select` (`libs/web/ui`).

Auth is a stub: send `X-User-Id`, `X-Company-Id`, `X-Allowed-Company-Ids`. Real JWT comes later.
