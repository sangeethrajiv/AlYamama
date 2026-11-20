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

Auth is a stub: send `X-User-Id`, `X-Company-Id`, `X-Allowed-Company-Ids`. Real JWT comes later.
