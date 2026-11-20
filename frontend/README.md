# Al-Yamama ERP – Angular

Nx monorepo (Angular 22, zoneless, signals) rebuilt from the React ERP prototype following `ERP_Architecture_Reference_v2.2_FULL.md`.
Parity with the React reference is tracked in [docs/PARITY_CHECKLIST.md](docs/PARITY_CHECKLIST.md).

## Layout

```
apps/web                      composition root: shell + one lazy route per feature
apps/web-e2e                  Playwright specs
libs/shared/contracts         API types, permissions (no framework code)
libs/shared/utils             exact decimal maths, dates, ids
libs/web/core                 auth, permissions, company, i18n, shell, layout
libs/web/ui                   presentational components, pipes, dialogs, styles
libs/web/metadata-forms       metadata-driven form / view / CRUD page
libs/web/api-client           abstract API classes + in-memory mock adapters
libs/web/features/*           accounting, contacts, product, reports, administration, dashboard
```

Module boundaries are enforced by `@nx/enforce-module-boundaries` (see `eslint.config.mjs`); features cannot import each other.

## Commands

```sh
npm install            # .npmrc sets legacy-peer-deps
npm start              # dev server on http://localhost:4200
npx nx build web       # production build
npx nx run-many -t lint test
npx nx e2e web-e2e     # Playwright (starts the dev server)
npm run i18n           # regenerate en.json / ar.json from each feature's i18n.src.txt
```

Demo sign-in: any account in `libs/web/api-client/src/lib/seed/auth-users.seed.ts` (e.g. `director@alyamama.example`) with the demo password defined next to it.

## Data

There is no backend. `provideMockApiClient()` wires in-memory adapters; a reload restores the seed and nothing is persisted. The abstract `*Api` classes are the contract a future NestJS `/api/v1` adapter implements. Money is always a decimal string.
