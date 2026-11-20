# Al-Yamama Accounting React Module

A Vite + React + TypeScript frontend prototype based on the supplied accounting UI source.

## Repository layout and branches
This repository holds two versions of the ERP frontend on separate branches:

| Branch | Content | Location |
| --- | --- | --- |
| `main` | React + Vite prototype (this document) | repository root |
| `frontend` | Angular Nx workspace (rebuild of the React ERP) | [`frontend/`](frontend/) |

The `frontend` branch is branched from `main`, so it also contains the React files at the root; the Angular workspace is self-contained in `frontend/` (its Nx workspace root is `frontend/`). Run all Angular commands from inside that folder — see [`frontend/README.md`](frontend/README.md).

## Included
- Dashboard with KPI cards and financial snapshot
- Invoices list with status filters and text search
- Vendor bills list
- Payments activity list
- Create invoice, vendor bill, and receive-payment side panels
- Progressive / milestone invoice toggle
- Responsive layout for desktop and mobile
- Arabic language toggle direction (RTL shell)
- Local in-memory record creation for prototype testing

## Requirements
- Node.js 18.0 or later
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite.

## Production build
```bash
npm run build
npm run preview
```

## Important notes
- This is a frontend prototype. It uses sample data and React state only.
- Records created in the UI are not persisted after refresh.
- No API, authentication, database, accounting ledger, ZATCA integration, or real payment processing is connected.
- Currency values are displayed as SAR (SR); sample values are illustrative.
- To connect this to a backend, replace the sample data and save handlers in `src/App.tsx` with API service calls.
