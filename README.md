# Al-Yamama Accounting React Module

A Vite + React + TypeScript frontend prototype based on the supplied accounting UI source.

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
