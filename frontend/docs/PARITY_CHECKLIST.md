# React → Angular parity checklist

Reference: React ERP at Git `3223dd9` (read-only, never modified). Architecture: `ERP_Architecture_Reference_v2.2_FULL.md`.
Status legend: **Done** = implemented and exercised in a real browser; **Changed** = deliberate, architecture-driven difference; **Blocked** = intentionally not functional, with the reason.

Verification evidence: `nx run-many -t lint` (incl. `@nx/enforce-module-boundaries`), `nx run-many -t test` (unit), `nx build web` (production), `nx e2e web-e2e` (18 Playwright specs, Chromium), plus manual Playwright walk-throughs of every screen below (English, Arabic/RTL for the shell).

## 1. Application shell

| React | Angular | Status |
|---|---|---|
| `App.tsx` (view switching) | `apps/web` routes + `ShellComponent` (lazy feature routes) | Done / Changed (router instead of state switch) |
| `LoginPage.tsx`, `auth/session.ts`, `auth/users.ts` | `LoginPage`, `AuthService`, `session-store`, `MockIdentityApi` (demo accounts, lock-out counter, remember me, forgot password) | Done |
| `Sidebar.tsx` | `SidebarComponent`, menu from the manifest (`ManifestService`) filtered by permission | Done |
| `Header.tsx` (company switch, role switch, language, currencies, search) | `HeaderComponent`, `CurrenciesDialog`, `SearchService` | Done |
| English/Arabic + RTL | Transloco (lazy scoped dictionaries) + CDK `Directionality`; `dir`/`lang` on `<html>` | Done (Arabic labels seeded for every key; some auto-seeded fallbacks, see §9) |
| Role-based UI (Auditor read-only etc.) | `PERM` strings, `permissionGuard`, `*erpHasPermission`, API-side role map | Done |
| 404 / 403 | `NotFoundPage`, `ForbiddenPage` | Done |

## 2. Dashboard

| React | Angular | Status |
|---|---|---|
| `DashboardView.tsx` owner/accountant toggle, receivables/payables/cash/working capital, recent invoices, bank balances, `StatCard` | `DashboardPage` (feature `dashboard`), `erp-stat-card` | Done |

## 3. Accounting

| React | Angular | Status |
|---|---|---|
| `ChartOfAccountsView.tsx` – group filter, search, CSV export, ledger drill-down | `ChartOfAccountsPage` | Done |
| CoA "Import CSV" / "New Account" (React: `alert()` stubs) | disabled buttons with explanation | **Blocked** – no accounts write contract exists |
| `JournalEntryView.tsx`, `EntryModal.tsx` – entries / items / analytic tabs, create, balance check, post, draft, reverse | `JournalEntriesPage`, `JournalEntryDialog`, inspect dialogs | Done |
| `InvoiceList.tsx` + `MoneyBar` – type tabs, filters, tiles, bulk actions | `InvoiceListPage`, `erp-money-bar` | Done |
| `InvoiceModal.tsx` (+ `ProformaFormCards`, `ProgressiveFormCard`) – cash/credit/proforma/progressive forms, lines, taxes, discounts, vehicles, notes, chatter | `InvoiceFormPage` + `InvoiceLinesEditor` (purpose-built), metadata-driven header cards | Done |
| `DocumentActionBar`, `InvoiceNextSteps` – validate, register payment, credit note (cancel/modify), convert proforma, renew, ZATCA | `erp-document-action-bar`, `InvoiceNextSteps`, `CreditNoteDialog`, `ZatcaDialog` | Done |
| ZATCA submission | acknowledgement gate + mandatory-data checks; result is **simulated** and labelled so | **Changed** – no ZATCA service exists; never presented as a real clearance |
| `InvoicePdfModal.tsx` – preview, print | `InvoicePdfDialog`; print stylesheet prints only the invoice sheet | Done |
| `BillList.tsx`, `BillModal.tsx` – vendor bills, two-level approval by threshold, reject with reason | `BillListPage`, `BillFormPage` | Done |
| `PaymentList.tsx`, `PaymentModal.tsx` – customer/vendor payments, cheques | `PaymentsPage`, `PaymentDialog` | Done |
| `ReconciliationView.tsx`, `BulkMatchPanel.tsx` – match, write-off, un-reconcile, bulk allocate | `ReconciliationPage` (bulk panel inside) | Done |
| `BankingView.tsx` – bank journals, cheques clear/bounce, direct bank transactions | `BankingPage` | Done |
| `Chatter.tsx` – messages, audit trail, notes | `erp-chatter` (ui) over `AccountingApi.auditLogs/postNote` | Done |
| Inter-company bill auto-creation, analytic items | `MockAccountingApi` | Done |

## 4. Reports

| React | Angular | Status |
|---|---|---|
| `ReportsView.tsx` – P&L, balance sheet, trial balance, aged receivables, general ledger with drill-down | `ReportsPage` | Done |
| Trial-balance opening balance / period split | derived from posted entries; shown as **indicative** | **Changed** – the React figures were not period-aware either; no period contract exists |

## 5. Administration

| React | Angular | Status |
|---|---|---|
| `SettingsAndLockView.tsx` – company/fiscal settings, currencies, lock-date wizard with checklist | `SettingsPage`, `ClosePeriodDialog` | Done (hard lock only moves forward, enforced by the API) |
| Currency "Fetch Daily Rates" (React: `alert()` stub) | disabled with explanation | **Blocked** – no exchange-rate provider |
| `AuditLogView.tsx` – filter, search, export | `AuditPage` | Done |

## 6. Contacts

| React | Angular | Status |
|---|---|---|
| `modules/shared/directory.tsx`, `ContactsModule`, `ContactDrawer` – customers/suppliers directory, contact drawer with tabs (details, invoices, bills, payments, KPIs) | `DirectoryPage`, `ContactDialog`, `ContactAddDialog` | Done |
| `contactMaster/*` – list with filters/chips, detail, form, child contacts, archive/unarchive | `MasterListPage`, `MasterDetailPage`, `MasterFormPage`, `ChildContacts`; metadata-driven form | Done |
| Permanent contact delete | not offered | **Blocked** – archive only; no delete contract |
| `AllUsersPage`, `UserDetailPage`, `UserAccessRights` – users list, detail, access-rights matrix | `UsersListPage`, `UserDetailPage`, `UserAccessRights` | Done |

## 7. Product

The Inventory module was reduced to Product master data. Overview, transfers, receipts, deliveries, adjustments, stock reports, warehouses, locations and operation types are intentionally **out of scope** and removed.

| React | Angular | Status |
|---|---|---|
| `ProductsPage` – list, form with tabs (quantity on hand is now a stored field on the product) | `ProductsPage`, `ProductFormPage` | Done |
| `ConfigPages` – product categories, UoM, UoM categories | three metadata-driven CRUD pages (`erp-crud-page`) | Done |
| Overview, transfers, adjustments, stock reports, warehouses, locations, operation types | removed | **Out of scope** |

## 8. Cross-cutting requirements (architecture doc)

| Requirement | Status |
|---|---|
| Nx boundaries (`scope:*`, `type:*`) enforced by lint; features never import each other | Done – lint passes |
| Standalone, signals, OnPush, typed forms, zoneless | Done |
| API interfaces + feature-specific mock adapters; ready for a NestJS `/api/v1` adapter | Done (`provideMockApiClient` is the only wiring point) |
| Money as decimal strings; exact arithmetic (`@erp/shared/utils`) | Done (unit-tested) |
| RFC 9457 Problem Details errors (`ApiError`) with 400/401/403/404/422 | Done |
| Metadata-driven forms for simple master data, purpose-built for complex workflows | Done |
| Unsaved-changes guard on forms | Done |
| Mock operations not presented as real transactions | Done – in-memory, reload restores the seed; ZATCA simulated and labelled |
| Angular Material + CDK; Tailwind visual identity preserved | Done |

## 9. Known gaps / follow-ups

* **No backend exists.** Everything runs on the in-memory mock; there is no persistence, no real authentication, and no server-side permission enforcement. The role map in `MockIdentityApi` is a stand-in.
* **Arabic coverage.** All user-facing strings go through Transloco. A subset of Arabic strings were seeded from humanised keys and should get a native-speaker review before release.
* **Test depth.** Unit tests cover the API adapters, decimal maths, invoice maths, product helpers, filters, permissions and route tables; e2e covers auth, RBAC, journal entries, the invoice lifecycle and every module rendering. Component-level tests for the large purpose-built pages (invoice form, reconciliation) are not written; they are covered only by e2e/manual runs.
* **Browsers.** E2E runs on Chromium only.
* **Mobile.** Layouts are responsive (Tailwind) but dense tables were verified mainly at desktop width.
