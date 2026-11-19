# 06 — Node.js + Express Backend Feasibility

> Analysis only. No API, model, controller or service was created.
> **[V]** verified fact about the current system · **[I]** engineering judgement.

---

## 1. Summary
Node.js + Express can implement everything in scope. The risk is **not the framework**; it is re-implementing Odoo's ORM-driven behaviour (computed stored fields, record rules, `ir.property`, sequence/locking semantics, posting and reconciliation engines) explicitly and safely. Express is minimal, so the team must **supply the structure** (modules, validation, transactions, authorization, error model) that Odoo provided implicitly.

---

## 2. What Odoo gives for free that Express will not

| Odoo 12 facility | Where it shows up in this system | Node/Express replacement |
|---|---|---|
| ORM with relational fields, `create/write/unlink` hooks | 615 models, 3,327 FKs | Data-access layer (query builder or ORM) + domain services |
| Computed stored fields (`@api.depends`) | invoice totals, `amount_residual`, `reconciled`, `number`, quant quantities | Explicit calculators inside the same transaction as the write; DB triggers only for invariants |
| `@api.onchange` | account 47, stock 30, product 4 (standard) + custom | Explicit "preview/defaults" endpoints; not auto-recomputed server-side |
| `@api.constrains` + `_sql_constraints` | account 22/9, stock 11/5, product 7/2; `ir_model_constraint`: 815 constraint rows on in-scope models, of which 37 are unique constraints (the rest are FKs) | Domain validators + DB constraints |
| ACL (`ir.model.access`) + record rules (`ir.rule`) | 1,025 + 229 rows | Authorization middleware + policy-scoped repositories (doc 02) |
| Sequences (`no_gap`) | 64 journal sequences, 490 date ranges | Counter table with row locks |
| `ir.property` (company-dependent fields) | `standard_price`, accounts, cost method, valuation | Explicit per-company tables |
| Chatter / tracking | 1.1 M messages, 1.8 M tracking values | Audit/event log service |
| Reports (QWeb → PDF/XLSX) | 80 report definitions + XLSX modules | Template engine + headless PDF; XLSX library |
| Scheduled actions | 38 active crons; in scope: reverse entries, stock notification, asset entries, EDI, auto-invoicing | Job scheduler (e.g., BullMQ/pg-boss) with idempotency |
| Server actions | `ir_act_server` 216 (40 `object_write`, 176 `code`) — **not itemised** [U] | Inventory required |
| Import/export | `base_import` | Bulk-import service |

---

## 3. Compare architectures

### A. Modular monolith — one Express app, independent modules
### B. Microservices — User, Accounting, Products, Inventory as separate services

| Dimension | A. Modular monolith | B. Microservices |
|---|---|---|
| **Development complexity** | Low–medium. One codebase, shared types, one debugger | High. Service templates, contracts, versioning, local orchestration |
| **Database management** | One PostgreSQL, **schema-per-module** (`iam`, `masterdata`, `inventory`, `accounting`) with module-owned tables | Separate DB per service (or shared DB anti-pattern) |
| **API communication** | In-process calls through module public interfaces; events in-process | HTTP/gRPC/message bus between services |
| **Authentication** | One auth middleware | Gateway + token propagation; service-to-service auth |
| **Authorization** | One policy engine reading the same permission tables | Policy duplicated per service or an authorization service on the hot path |
| **Transactions** | **ACID across modules** — invoice + journal entry + stock + valuation in one DB transaction | Distributed transactions / sagas / eventual consistency — dangerous for ledger |
| **Data consistency** | Strong | Eventual unless carefully designed |
| **Deployment** | One artifact, one pipeline | N pipelines, N runtime configs |
| **Scalability** | Vertical + horizontal replicas of the whole app; enough for ~100 users and ~350 k ledger rows | Independent scaling (not needed at this size) |
| **Debugging** | Single process trace | Distributed tracing required |
| **Maintenance** | Needs discipline to keep boundaries (lint rules, no cross-module table access) | Boundaries enforced by network but with heavy operational cost |

### Why the data in this system favours A **[V]**
* **27 %** of journal entries (32,176/118,858) are created by stock moves → stock + accounting must commit atomically.
* Product category properties (`ir.property`) link inventory configuration to accounting accounts.
* Reconciliation, residuals and invoice states are tightly coupled stored values.
* Scale is modest: 97 users, 36 k invoices, 346 k journal items, 35 k move lines. Nothing demands independent scaling.

### Recommendation: **Modular monolith (A)** now, designed so that a module could be extracted later
* Frontend micro-frontends **do not require** backend microservices (doc 05).
* If an extraction ever becomes valuable, the best candidate is the **ZATCA/e-invoicing adapter** (external integration, async, different failure mode), then **reporting** (read-heavy). Do **not** split the ledger/posting engine.

---

## 4. Proposed module boundaries (logical, no code)

| Module | Owns (tables) | Public interface | Depends on |
|---|---|---|---|
| `iam` | users, roles/permissions, role templates (14 user categories), sessions/refresh tokens, companies (security view), audit log | `authenticate`, `authorize(user, action, resource)`, `scopeFor(user, resource)`, `companyContext` | – |
| `masterdata` | partners (+addresses/contacts), currencies & rates, UoM, product categories, countries, payment terms | read-heavy lookups, CRUD | `iam` |
| `catalog` (products) | products, supplier prices, pricelists, per-company product settings (replaces `ir.property`) | product queries, cost/account resolution | `masterdata`, `accounting` (account ids) |
| `inventory` | warehouses, locations, picking types, pickings, moves, move lines, quants, lots, adjustments, landed costs, valuation layers | stock commands (confirm/assign/validate/cancel/return/adjust) | `catalog`, `masterdata`, **`accounting` via posting port** |
| `accounting` | accounts, journals, taxes, sequences, invoices(+lines/taxes), journal entries(+lines), payments, reconciliations, assets, vouchers | posting engine, reconciliation, tax engine, report queries | `masterdata`, `catalog`, `iam` |
| `approvals` | approval levels, requests, histories | `requestApproval`, `decide`, `nextApprover` | `iam` |
| `einvoicing` | ZATCA documents, keys/CSIDs references, chain state | `submit(invoice)`, status | `accounting` |
| `reporting` | read models/views | report endpoints/exports | all (read-only) |
| `platform` | config, jobs/scheduler, files/attachments, i18n, PDF rendering, notifications | – | – |

Rules: modules talk only through their public interfaces; no cross-module SQL joins on *write* paths; shared kernel only for `Money`, `Company`, `Clock`, `Result` types.

### Layering inside each module
`routes/controllers → application services (use-cases, transactions) → domain (entities, calculators, state machines) → repositories`. Express is only the delivery mechanism.

---

## 5. Cross-cutting design requirements

| Concern | Requirement |
|---|---|
| **Transactions** | Every posting/stock/reconcile command is a *single* DB transaction with explicit isolation. Use `SELECT … FOR UPDATE` for sequences, quants and reconciliation targets. Idempotency keys on mutation endpoints |
| **Money** | `NUMERIC(…)` in DB + decimal library in Node; never JS floats. Currency rounding per currency (`SAR 0.01`, `JPY 1`) |
| **Validation** | Schema validation at the edge (request DTOs) + domain invariants (debit = credit; state transitions; lock dates) |
| **Error model** | Stable error codes (e.g., `ACC_ENTRY_UNBALANCED`, `STK_INSUFFICIENT_STOCK`), 409 on state conflicts, problem+json |
| **State machines** | Invoice, payment, picking, move, approval states modelled explicitly with allowed transitions (mirrors Odoo `state` fields) |
| **Concurrency** | Optimistic version column (`write_date`/`version`) on editable aggregates |
| **Audit** | `created_by/at`, `updated_by/at` + immutable event log for posted documents |
| **Jobs** | Scheduler with idempotent handlers: auto-reverse entries, asset depreciation, ZATCA submission/retry, stock notifications, auto-invoicing |
| **Documents** | Server-side PDF (Arabic/RTL fonts) and XLSX generation |
| **Files** | Move 125 k binary attachments (9.3 GB) to object storage; keep metadata table |
| **Observability** | Structured logs with correlation id, metrics, audit of authorization decisions |
| **Config & secrets** | Secret manager for DB, SMTP, ZATCA private key/CSIDs; never in repo or in `.config` files |
| **API style** | REST + OpenAPI as the contract for Angular codegen; versioned `/v1`. Mobile compatibility layer for `/api/*` legacy endpoints (52 + others) if the mobile app stays |
| **Testing** | Golden-master tests against Odoo outputs (see doc 08/10) |

---

## 6. Feasibility by capability

| Capability | Feasibility | Comment |
|---|---|---|
| Auth / RBAC / multi-company scoping | **High** | Standard patterns; the policy engine for 229 rules is the real work |
| Master data CRUD | **High** | |
| Product & per-company settings | **High** | After flattening `ir.property` |
| Stock moves, quants, lots, adjustments | **Medium–High** | Concurrency and FIFO layers |
| Valuation posting | **Medium** | Needs accounting engine; FIFO + landed cost + `force_date` quirks |
| Invoicing + tax + totals | **Medium–High** | Must match custom discount/rounding |
| Reconciliation, FX difference | **Medium** (hardest standard feature) | Dedicated service + exhaustive tests |
| Approvals | **High** | |
| ZATCA Phase 2 | **Medium, compliance-heavy** | Consider keeping Odoo as e-invoice signer during transition |
| Financial reports | **Medium–High** | Rebuild + reconcile against Odoo |
| Fixed assets | **Medium** | Scope decision |

---

## 7. Open items for the Node.js team (summarised in doc 11)
ORM/query builder choice (Prisma vs Drizzle vs Knex vs TypeORM — raw SQL strongly advisable for posting/reconciliation), TypeScript strictness, testing framework, migration tool for the new schema, job scheduler, PDF engine, logging stack, hosting/secrets, decimal library.
