# Al-Yamama ERP – Frontend

Modern enterprise ERP frontend application built with **Angular 22**, **Nx Monorepo**, **Zoneless change detection**, and **Angular Signals**.

---

## 🏗️ Architecture & Monorepo Layout

The codebase is organized as an Nx monorepo inside [`frontend/`](frontend/):

```
frontend/
├── apps/
│   ├── web                      # Composition root: shell, router, app providers
│   └── web-e2e                  # Playwright end-to-end test suite
├── libs/
│   ├── shared/
│   │   ├── contracts            # API contracts, permissions, models (framework-agnostic)
│   │   └── utils                # Exact decimal maths, date utilities, ID helpers
│   └── web/
│       ├── core                 # Auth, RBAC, company context, i18n, shell layout
│       ├── ui                   # Presentational components, pipes, dialogs, design system
│       ├── metadata-forms       # Dynamic metadata-driven CRUD pages, forms, and dialogs
│       ├── api-client           # Abstract API service classes + in-memory mock adapters
│       └── features/
│           ├── dashboard        # Financial snapshot, KPI cards, activity feed
│           ├── accounting       # Invoices, vendor bills, payments, bank reconciliation
│           ├── contacts         # Contact directory, users, role management
│           ├── product          # Product catalog, categories, price lists
│           ├── reports          # Financial statements, P&L, balance sheets
│           └── administration   # System settings, lock dates, audit logs
```

> **Module Boundaries:** Enforced strictly via `@nx/enforce-module-boundaries` (see `frontend/eslint.config.mjs`). Features cannot directly import other features.

---

## 🚀 Quick Start

You can run all commands directly from the **repository root**:

### 1. Install Dependencies
```bash
npm --prefix frontend install
```

### 2. Start Development Server
```bash
npm start
```
Opens the application at [http://localhost:4200](http://localhost:4200).

### 3. Build for Production
```bash
npm run build
```
Generates production bundles into `frontend/dist/apps/web/browser`.

### 4. Run Lint & Tests
```bash
npm run lint    # Runs ESLint across all 14 libraries and apps
npm test        # Runs Vitest unit test suites
```

---

## ⚡ Instant Git Push to Live

To stage all changes, generate a commit message, and push directly to GitHub/Vercel:

```bash
npm run push
```
*(or run `./push "optional commit message"`)*

---

## 🔐 Demo Sign-in Credentials

The app includes an in-memory mock backend (`provideMockApiClient()`) with pre-seeded accounts:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Finance Director** | `director@alyamama.example` | `Yamama@2026` |
| **Accounts Manager** | `manager@alyamama.example` | `Yamama@2026` |
| **Senior Accountant** | `senior.acc@alyamama.example` | `Yamama@2026` |
| **Auditor** | `auditor@alyamama.example` | `Yamama@2026` |

---

## 🌐 Localization & Features

- **Bilingual Support:** Full English and Arabic (`ar`) translations with automatic RTL shell layout switching.
- **Zoneless Angular:** Powered by signal-based reactive state and computed properties.
- **Enterprise Accounting:** Invoicing, progressive/milestone billings, multi-currency support (SAR / USD), journal entries, and bank reconciliation.
- **Live Deployment:** Pre-configured for seamless Vercel production hosting via [`vercel.json`](vercel.json).
