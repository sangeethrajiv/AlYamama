# 05 — Angular Microfrontend Feasibility

> This is an **architecture evaluation**. No Angular code, pages or components were created.
> Facts about the current system come from the Odoo analysis (docs 01–04). Recommendations are **[I]** (engineering judgement) unless stated.

---

## 1. Facts from the current system that shape the frontend

| Fact | Source | Frontend implication |
|---|---|---|
| ≈ 97 users (84 active), 94 internal | doc 02 | Small user base: bundle size and deployment independence matter less than correctness and maintainability |
| 14 user categories + role groups drive menus (301 of 568 menus group-restricted), views (41 view-group links) and buttons (`groups=` in XML) | doc 02 | Need a **shared permission service + route guards + UI directives**; server still enforces |
| Companies switch in the UI (`user.company_id`); 11 users have >1 company | doc 02 | A **global company-context** must be shared by every micro-frontend and sent on every API call |
| Approval flows (invoice, voucher, PO, PR) with 82 level rules | doc 02/03 | Reusable **approval widget** (history, level, approve/reject) |
| Bilingual (English UI, Arabic names, Arabic amount-in-words, RTL PDFs) | doc 03 | **i18n + RTL** is a cross-cutting requirement; only `en_US` is activated in Odoo today |
| 2,059 views, 658 window actions, 80 reports across the whole DB (in-scope subset not itemised) | doc 01 | Screen inventory must be scoped before sizing |
| Heavy list/report screens (346 k journal items, 36 k invoices, 20 k products, 35 k move lines) | doc 03/04 | Server-side pagination, virtual scroll, export (Excel/PDF) |
| Mobile app already consumes `/api/*` | doc 02 | API versioning discipline: web and mobile must not break each other |

---

## 2. Options evaluated

| Option | Description | Pros | Cons | Fit |
|---|---|---|---|---|
| **A. Nx monorepo + Module/Native Federation** (host shell + 3 remotes) | One repo, independent apps, runtime composition | Shared libs with enforced boundaries; independent builds; one CI; consistent Angular version | Federation config and version-skew risk; learning curve | **Best fit** |
| B. Separate repos per Angular app | Fully independent teams/pipelines | Max team autonomy | Duplicated shared code; version drift; harder to keep UX consistent | Poor for a small team |
| C. Single Angular app with lazy-loaded feature modules (no federation) | "Modular monolith" frontend | Simplest; one deploy; best DX | Not truly independent deployments | Valid **starting point**, can be split later |
| D. iframes / Web Components bridging | Technology-agnostic composition | Isolation | Poor UX (auth, routing, styling), duplicated chrome | Not recommended |
| E. Nx monorepo with *build-time* composition (libs, one deployable) | Independent libs, single bundle | Boundaries without runtime risk | No independent deployment | Good fallback |

**Recommendation:** **Option A, staged.** Start as an Nx workspace with the shell and three feature remotes configured for federation, but **deploy initially as one release train** (same version tags). Move to independent deployments for individual remotes only after the shared contracts (auth, permissions, API client, design system) are stable.

---

## 3. Can the three areas be independent micro-frontends?

| Area | Independent? | Reason |
|---|---|---|
| **User Management** (users, groups/roles, companies, user categories, approval-level config) | **Yes** | Self-contained; consumed by others through the shared auth/permission library only |
| **Accounting** (CoA, journals, taxes, invoices, bills, payments, reconciliation, reports, vouchers, ZATCA status) | **Yes, but with deep links to Contacts & Products** | Needs partner and product selectors (shared components) and links to stock documents |
| **Products & Inventory** | **Yes, but coupled to Accounting** | 27 % of journal entries originate from stock moves; product category holds accounting accounts; inventory valuation screens show journal-entry links |

**Contacts (`res.partner`)** is used by all three. Treat it as a **shared domain**: either a fourth remote (*Master Data / Contacts*) or part of the shell's shared feature library. Given the milestone plan (Contacts before Products), a dedicated **Master Data remote** (contacts, UoM, currencies, product categories) is the cleaner option.

---

## 4. Architecture elements

### 4.1 Host / shell
Responsibilities: login screen, token handling, **company switcher**, global navigation built from the permission set, breadcrumbs, notifications, error boundary, theming/RTL, remote loading. The shell owns **routing roots** (`/users/**`, `/accounting/**`, `/inventory/**`, `/master-data/**`).

### 4.2 Common login and authentication
* Single login in the shell. Access token kept **in memory** (not `localStorage`); refresh via `HttpOnly` cookie; silent refresh on 401.
* Remotes never see credentials. They call the shell-provided **`AuthService`** (shared singleton exposed through federation).
* Mobile-compatible API contract (doc 06) — the same token model.

### 4.3 Shared navigation and layout
Shell renders the sidebar from `GET /me/menu` (server-computed from permissions). Remotes provide **route configs** only. Avoids duplicating Odoo's 568 menu records: only in-scope menus are migrated.

### 4.4 Routing between micro-frontends
* Hash/path routing owned by the shell; each remote exposes a `Routes` array.
* Cross-links (e.g., invoice → partner, product → stock moves → journal entry) use **stable deep-link URLs** (`/master-data/partners/123`) rather than imports, so no remote depends on another's code.
* A `LinkResolver` service in the shared library maps `(model, id)` → URL (replaces Odoo's action/`res_model` navigation).

### 4.5 Shared UI components (put in `libs/ui-kit`)
Data table with server-side paging/sort/filter and saved filters (replaces `ir.filters`, 77 rows), form controls (many2one-style async selector, date, money with currency), status badges/ribbons, **chatter/audit timeline**, attachment panel, **approval history widget**, confirmation dialogs, **print/export** menu, address/partner card, company switcher, Arabic/English text pair control, permission directive.

### 4.6 API communication
* One generated **TypeScript API client** from an OpenAPI contract (shared lib), with interceptors for auth, `X-Company-Id`, error mapping, correlation id.
* Module-specific API facades per remote. No remote calls another module's backend directly except through the shared client.

### 4.7 Cross-module communication
* Prefer **URL parameters and server APIs** over in-memory messaging.
* For live UX events (company changed, user logged out, document updated) use a small typed **event bus** in the shell (RxJS `Subject` exposed as a shared service) — events only, no shared mutable state.
* Do **not** share NgRx stores between remotes.

### 4.8 State management
* Per-remote state (NgRx SignalStore / component stores).
* Shell-level: `session`, `companyContext`, `permissions`, `featureFlags`.
* Server state caching with a query library or HTTP interceptors; explicit cache invalidation keyed by `(companyId, resource)`.

### 4.9 Shared permission handling
Shell fetches `/me/permissions` → `{ role[], permissions[] ("account.invoice:create"), companyIds[], activeCompanyId }`. Shared lib provides `canActivate` guards, `*hasPermission` directive, and `PermissionService.can(resource, action)`. **UI hiding is cosmetic**; the API enforces every call (see doc 02).

### 4.10 Independent builds & deployments, version compatibility
* Nx `affected` builds; each remote emits `remoteEntry.json`; shell loads a **manifest** (`module-federation.manifest.json`) that maps remote → URL → version.
* Rules: **same major Angular version across shell and remotes**; shared singletons (`@angular/*`, `rxjs`, shared libs) pinned with `strictVersion`; semantic versioning for `libs/*` and for the API contract; contract tests (Pact or OpenAPI diff) in CI.
* Rollback = repoint manifest to previous remote version.

### 4.11 Error handling
Per-remote error boundary (shell shows "module unavailable" fallback if `remoteEntry` fails), global HTTP error interceptor (401 → refresh/logout, 403 → friendly page, 409 → optimistic-lock/state conflicts such as "invoice already posted"), correlation id displayed for support, offline/slow-network indicators.

---

## 5. What to share vs. keep module-specific

| Shared (`libs/`) | Module-specific |
|---|---|
| `auth`, `permissions`, `company-context`, `api-client` (generated), `ui-kit`, `i18n` (incl. RTL), `money` (decimal formatting, currency), `date`, `error-handling`, `link-resolver`, `audit-timeline`, `approval-widget`, `export` utilities, design tokens/theme | Invoice form & posting UI, reconciliation UI, journal-entry viewer, financial-report screens, ZATCA status screens, voucher screens, stock-picking screens, quant/lot views, valuation views, product form, user/role editor, approval-level configuration |
| Domain **types** generated from the API contract | Domain-specific validators and calculators that exist on the server (UI only mirrors for UX, **never authoritative**) |

**Do not** duplicate tax/rounding/posting logic in the UI beyond display previews; the server is authoritative (see doc 08 — accounting accuracy).

---

## 6. Trade-offs and risks (frontend)

| # | Risk / trade-off | Mitigation |
|---|---|---|
| 1 | Federation adds build/runtime complexity for a 97-user system | Stage it: one release train first; extract independence only when needed |
| 2 | Shared-library version drift | Nx monorepo, `strictVersion`, CI contract checks |
| 3 | Permission drift between UI and API | Generate permission constants from one server-side catalogue |
| 4 | Accounting UI complexity (reconciliation, multi-currency, many-line invoices) | Design the screens from the real Odoo 12 workflows (docs 03), prototype with real data volumes |
| 5 | Arabic/RTL and bilingual PDFs | Decide up front: PDFs generated **server-side** (doc 06), UI only previews |
| 6 | Reports with 346 k journal items | Server-side aggregation + async export jobs; no client-side aggregation |
| 7 | Backend modularity ≠ frontend modularity | Frontend micro-frontends do **not** require backend microservices (doc 06) |
| 8 | Hidden Odoo UX behaviours (onchange, defaults, domain filters on many2one) | Catalogue them per screen — defaults/onchange logic must be an explicit API (`/defaults`, `/preview`) |

---

## 7. Recommendation
**Nx monorepo, Angular shell + remotes `users`, `master-data`, `accounting`, `inventory`, shared libs as above; Module/Native Federation configured from day one but released together initially.** If the team lacks federation experience, begin with Option C/E (single app, lazy-loaded feature libs with enforced Nx boundaries) — the lib boundaries are the same, so promoting them to remotes later is mechanical.

**Questions for the Angular team** are consolidated in doc 11.
