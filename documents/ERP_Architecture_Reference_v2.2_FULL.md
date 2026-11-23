# ERP Architecture Reference — Revised Baseline

**Version:** 2.2  
**Date:** 18 November 2026  
**Source:** `ERP_Architecture_Reference_v2.2 2(1).pdf`  
**PDF length:** 28 pages

> Full text extraction from the supplied PDF. Original page order and fixed-width layout are preserved so tables, diagrams, code samples, and alignment-based content remain readable. Each PDF page is explicitly marked.

## PDF page 1

```text
                                              ERP ARCHITECTURE REFERENCE | REVISED BASELINE




       ERP ARCHITECTURE
           REFERENCE
NestJS Modular Monolith + Angular Single Application

        Revised architecture baseline • Version 2.2 • 18 November 2026




                                       Purpose
   A practical engineering reference for rebuilding the existing customized Odoo ERP
        as a configurable, multi-client platform using one shared codebase and
                        independently deployed client instances.




               Architecture baseline • Internal engineering reference | 1
```

## PDF page 2

```text
                                                                  ERP ARCHITECTURE REFERENCE | REVISED BASELINE

1. Executive summary
This document defines the recommended target architecture for the ERP rebuild. It retains the strongest decisions in
the supplied architecture reference and incorporates the review amendments: stronger company isolation, explicit
accounting scope, safer transaction boundaries, resilient outbox processing, configurable legal numbering, and
clearer add-on distribution controls. Accounting is the first business module: it is built, tested and signed off by an
accountant, and only then are data migration and go-live carried out. After go-live the new ERP issues invoices and
bills while Odoo keeps sales, purchase and inventory until those modules are added. Version 2.2 targets India and
Saudi Arabia, with country rules delivered as per-company localization add-ons.
    Decision area                                                Baseline decision
    Backend                                                      NestJS modular monolith, split into API and worker processes
                                                                 One Angular application with a shell and lazy-loaded domain
    Frontend
                                                                 feature libraries; no micro-frontends initially
    Workspace                                                    Nx monorepo with enforced dependency boundaries
                                                                 PostgreSQL as the system of record; one database per client
    Database
                                                                 instance initially
                                                                 MikroORM proposed, subject to a focused proof of concept
    ORM
                                                                 against Prisma and Drizzle
                                                                 pg-boss initially; Redis/BullMQ only if measured needs justify
    Background jobs
                                                                 another infrastructure dependency
                                                                 Settings, custom fields/layouts, workflow configuration, then
    Customization
                                                                 compiled add-ons
                                                                 Common versioned images deployed to isolated client
    Deployment
                                                                 instances using Docker Compose initially
                                                                 Accounting first: build, accountant acceptance testing, then
    Migration                                                    data migration and go-live per client; Odoo keeps sales,
                                                                 purchase and inventory until those modules are added
                                                                 Option A: the new ERP issues customer invoices, credit notes,
    Invoicing during coexistence
                                                                 vendor bills and debit notes from Odoo "ready to invoice" data
                                                                 Foundation, accounting (ledger, receivables/payables with the
                                                                 pilot country's localization, bank and close), accountant
    Build order
                                                                 testing, migration and go-live; then purchase, sales and
                                                                 inventory one at a time
                                                                 India and Saudi Arabia: gst-india (GST, e-invoicing) and zatca-
    Countries
                                                                 ksa (VAT, ZATCA Phase 2) add-ons, selected per company


Architecture principle: begin with a well-modularized monolith and a single Angular application. Extract services or
introduce frontend federation only when independently scaling, deploying or governing a domain becomes a
demonstrated requirement.


Scope and assumptions
      The existing Odoo installation contains standard ERP capabilities and client-specific customizations. The exact
       Odoo version, installed modules and custom modules must be inventoried before detailed migration design.
      Clients share a product codebase but have separate production instances and databases in the initial operating
       model.
      Each client may have different enabled modules, fields, workflows, statutory requirements, templates and
       integrations.
      Accounting is the first module built. An accountant tests and signs it off on staging before any production data
       migration or go-live. Other modules are added only after accounting is live.
      During coexistence the new ERP issues all customer invoices, credit notes, vendor bills and debit notes (Option
       A). Odoo sends "ready to invoice" data from sales orders, deliveries, purchase orders and receipts, and receives
       invoice and payment status back.
      Target countries are India and Saudi Arabia. Statutory behavior is delivered as per-company localization add-
       ons: gst-india (GST and e-invoicing) and zatca-ksa (VAT and ZATCA Phase 2 e-invoicing). A client may own
       companies in both countries.
      Saudi clients' instances, backups and logs are hosted in Saudi Arabia, and their invoices and invoice PDFs are in
       Arabic (bilingual Arabic/English allowed).

                                   Architecture baseline • Internal engineering reference | 2
```

## PDF page 3

```text
                                                                  ERP ARCHITECTURE REFERENCE | REVISED BASELINE
      The development team is four developers. Scope, sequencing and infrastructure are sized for one small team,
       not several independent teams.


2. Architecture principles
    Principle                                                    Required practice
                                                                 Client differences are configuration, data and approved add-
    One codebase, one release                                    ons. Do not fork core or add client-name conditionals to core
                                                                 logic.
                                                                 Angular validation is for usability. Authorization, validation,
    Backend owns business rules                                  workflow transitions and company scope are enforced by the
                                                                 API.
                                                                 Caches, browser state, queues and external systems are not
    PostgreSQL is authoritative
                                                                 the source of truth for ERP transactions.
                                                                 A domain accesses another domain through its public
    Modules expose public contracts                              facade/application contract or published event, never its tables
                                                                 or internal classes.
                                                                 Correct posted records through controlled reversal/adjustment
    Financial records are immutable after posting
                                                                 flows, not silent edits or deletes.
                                                                 Every database change is a reviewed migration in Git; no
    Schema changes are versioned
                                                                 manual production schema edits.
                                                                 Company scope, least privilege, auditability, secrets
    Secure by default
                                                                 management and safe operational defaults are mandatory.
                                                                 Add Redis, microservices, Kubernetes or other components
    Keep infrastructure proportional                             only when a documented requirement justifies the operational
                                                                 cost.
                                                                 Country rules come from the company's localization add-on
    Localization by company                                      (tax engine, e-invoicing, statutory reports). Core never
                                                                 branches on country.




3. Target system topology
                            Browser
                                |
                         HTTPS / Nginx
                                |
                 Angular SPA (one application)
            Shell + lazy-loaded domain feature areas
                                |
                          /api/v1
                                |
                        NestJS API process
                                |
              Modular application/domain boundaries
            |         |           |          |
         Identity Purchase Accounting Inventory ...
                                |
                         PostgreSQL
                 (transactional system of record)
                                |
                        Transactional outbox
                                |
                        NestJS worker process
                    pg-boss / scheduled jobs
                 /           |          |          \
              Email        PDFs      Odoo sync    Exports
                                |
                     Object storage (S3/GCS/
                          MinIO where needed)




                                   Architecture baseline • Internal engineering reference | 3
```

## PDF page 4

```text
                                                                   ERP ARCHITECTURE REFERENCE | REVISED BASELINE
The API and worker may use the same server image with separate start commands, as proposed in the source
architecture. They should be independently scalable processes even if initially deployed together.


Deployment boundary
        Each client has an isolated runtime configuration and PostgreSQL database. A separate database per client is the
         default isolation model.
        Use the same immutable server and web image tags across clients unless a client-specific add-on must not be
         distributed to other clients.
        Keep secrets outside Git and image layers. Use GitLab protected variables or a secret manager.
        Use Docker Compose on VMs initially. Move to Kubernetes only when fleet size, availability requirements or
         deployment complexity justify it.
        Host each Saudi client instance in Saudi Arabia (an in-Kingdom cloud region or on-premise), including its
         backups, logs and object storage (7.4).


4. Technology stack
    Layer                                   Recommended technology                   Decision notes
                                                                                     Pin exact runtime in .nvmrc, package
    Runtime                                 Node.js Active LTS + TypeScript strict   manager and Docker base image;
                                                                                     upgrade on a planned cadence.
                                                                                     Modular monolith, dependency injection,
    Backend framework                       NestJS
                                                                                     guards, pipes, interceptors.
                                                                                     Use a currently supported major release;
    Database                                PostgreSQL
                                                                                     managed service where practical.
                                                                                     Run a 2-day proof of concept for
                                                                                     transaction propagation, row locks,
    ORM                                     MikroORM (proposed)
                                                                                     company filters, JSONB and reporting
                                                                                     SQL. Compare Prisma and Drizzle.
                                                                                     Carry authenticated user, active
                                                                                     company, authorized companies and
    Request context                         nestjs-cls / AsyncLocalStorage
                                                                                     correlation ID; never treat context alone
                                                                                     as authorization.
                                                                                     Global ValidationPipe with whitelist and
    Validation                              class-validator + class-transformer
                                                                                     rejection of unknown fields.
                                                                                     Generate Angular API client; do not
    API contract                            NestJS Swagger / OpenAPI
                                                                                     hand-edit generated client code.
                                                                                     PostgreSQL-backed queue initially;
    Jobs                                    pg-boss                                  assess throughput and operational
                                                                                     contention under realistic workloads.
                                                                                     Store metadata in PostgreSQL and bytes
    Storage                                 S3-compatible / GCS; MinIO for on-prem
                                                                                     in object storage.
                                                                                     Render in worker. Templates must
                                                                                     support Arabic and right-to-left layout;
    PDF                                     Handlebars + headless Chromium           Saudi B2B PDFs need the cleared XML
                                                                                     embedded (PDF/A-3), which needs a
                                                                                     post-processing step.
                                                                                     Send through worker jobs with retry and
    Email                                   Nodemailer / SMTP
                                                                                     delivery status.
                                                                                     ZATCA signing, QR and hash chain; India
                                            Provider or SDK behind an internal
    E-invoicing                                                                      IRP access through an authorized API
                                            EInvoiceProvider interface
                                                                                     provider. Build vs buy in section 21.
                                                                                     Structured logs, trace IDs and client
    Logging/tracing                         Pino + OpenTelemetry
                                                                                     instance identifiers.
                                            Angular standalone components +          One SPA with lazy-loaded feature
    Frontend
                                            signals                                  libraries.
                                                                                     Wrap vendor components in internal UI
                                            Angular Material + CDK; evaluate AG
    UI                                                                               abstractions; verify licensing and feature
                                            Grid
                                                                                     fit.
                                                                                     Use for simple/configurable forms, not
    Metadata forms                          ngx-formly or internal renderer          as a universal replacement for bespoke
                                                                                     ERP screens.
    i18n                                    Transloco                                All visible text uses translation keys;
                                  Architecture baseline • Internal engineering reference | 4
```

## PDF page 5

```text
                                                              ERP ARCHITECTURE REFERENCE | REVISED BASELINE
                                                                             Arabic with right-to-left layout from the
                                                                             first release.
                                                                             Enforce tags and dependency
 Workspace                             Nx
                                                                             constraints; use affected builds/tests.
                                       Jest, Supertest, Testcontainers,      Use Vitest for Angular unit tests; confirm
 Testing
                                       Vitest/Jest, Playwright               with the chosen UI kit and Nx setup.
                                                                             Immutable artifacts, migration gates,
 Delivery                              Docker, Nginx, GitLab CI/CD
                                                                             staged rollout and rollback.




5. Repository and workspace layout
One Nx monorepo contains API, worker, Angular application, shared contracts, add-ons, deployment definitions and
tooling. Applications should contain bootstrap and wiring; domain implementation belongs in libraries.
  erp/
  ├── apps/
  │    ├── api/                  # NestJS HTTP bootstrap
  │    ├── worker/               # NestJS worker bootstrap
  │    ├── web/                  # Angular SPA bootstrap
  │    └── web-e2e/              # Playwright tests
  ├── libs/
  │    ├── api/
  │    │   ├── common/           # guards, context, errors, decorators
  │    │   ├── infrastructure/ # DB, jobs, storage, mail, PDF, logging
  │    │   ├── identity/
  │    │   ├── organization/
  │    │   ├── master-data/
  │    │   ├── accounting/
  │    │   ├── purchase/
  │    │   ├── sales/
  │    │   ├── inventory/
  │    │   ├── workflow/
  │    │   ├── documents/
  │    │   ├── notifications/
  │    │   ├── reporting/
  │    │   ├── audit/
  │    │   ├── customization/
  │    │   └── integrations/
  │    ├── web/
  │    │   ├── core/             # auth, company context, shell, manifest
  │    │   ├── ui/               # shared design system
  │    │   ├── metadata-forms/
  │    │   ├── api-client/       # generated OpenAPI client
  │    │   └── features/
  │    │        ├── accounting/ purchase/ sales/ inventory/
  │    │        └── reports/ administration/
  │    └── shared/
  │        ├── contracts/
  │        └── utils/
  ├── addons/
  │    ├── gst-india/
  │    └── client-acme/
  ├── deploy/
  │    ├── docker/
  │    ├── compose/
  │    └── clients/
  ├── tools/                     # new-client, migrate, upgrade, codegen
  ├── nx.json
  ├── package.json
  └── tsconfig.base.json




                            Architecture baseline • Internal engineering reference | 5
```

## PDF page 6

```text
                                                              ERP ARCHITECTURE REFERENCE | REVISED BASELINE

Dependency boundaries
 Tag                                   Applies to                                  Allowed imports
 scope:api                             API libs, API/worker apps, add-on API       scope:api and scope:shared
 scope:web                             Web libs, Angular app, add-on web           scope:web and scope:shared
                                       Shared pure TypeScript
 scope:shared                                                                      scope:shared only
                                       contracts/utilities
                                                                                   web core, UI, metadata forms and
 type:feature                          Angular feature libraries                   generated API client; never another
                                                                                   feature
                                                                                   Other domain public entry points only;
 type:domain                           Backend domain libraries
                                                                                   never their internals
                                                                                   Core public extension APIs; core must
 type:addon                            Add-on code
                                                                                   never import add-ons


Nx lint rules must enforce these boundaries in CI. A dependency-boundary exception requires an architecture review
and an explicit comment explaining why it is safe.


6. Backend architecture
6.1 Modular monolith
The backend is one NestJS modular monolith. The API process serves synchronous requests. The worker process
runs scheduled and asynchronous work. Both import the same domain libraries and share the same code version.
  apps/api/src/
    main.ts
    app.module.ts
    config/

  apps/worker/src/
    main.ts
    worker.module.ts

  libs/api/common/
    context/ decorators/ guards/ filters/ errors/ money/

  libs/api/infrastructure/
    database/ jobs/ storage/ mail/ pdf/ health/

  libs/api/<domain>/
    index.ts                    # public module/facade/events
    <domain>.module.ts
    <domain>.facade.ts
    controllers/
    application/                # use cases / orchestration
    domain/                     # entities, rules, state transitions
    repositories/
    dto/
    events/
    jobs/
    tests/


6.2 Module responsibilities
 Module                                                      Owns
                                                             Users, credentials, sessions, roles, permissions, MFA and
 Identity & access
                                                             access assignments.
                                                             Clients/companies, branches, business settings, fiscal
 Organization
                                                             calendars and organizational structure.
 Master data                                                 Partners, products, units, currencies, tax definitions and


                            Architecture baseline • Internal engineering reference | 6
```

## PDF page 7

```text
                                                                ERP ARCHITECTURE REFERENCE | REVISED BASELINE
                                                               shared reference data.
                                                               Chart of accounts, journals, entries, invoices/bills, payments,
    Accounting                                                 allocations, tax accounting, reconciliation and financial
                                                               statements.
                                                               Requests, quotations, purchase orders, receipts coordination
    Purchase
                                                               and supplier procurement workflow.
                                                               Quotations, sales orders, delivery coordination and customer
    Sales
                                                               commercial workflow.
                                                               Warehouses, locations, stock moves, reservations, valuation
    Inventory
                                                               and inventory counts.
                                                               Approval definitions, workflow instances, conditions,
    Workflow
                                                               escalation and approval history.
                                                               Attachment metadata, access checks, templates and
    Documents
                                                               generated documents.
                                                               Operational and financial reporting, exports and report
    Reporting
                                                               scheduling.
    Audit                                                      Security and business audit trail.
    Customization                                              Settings, custom fields, view metadata and extension registry.
                                                               Odoo and other external-system adapters, inbound/outbound
    Integrations
                                                               synchronization.




6.3 Module interaction and transaction boundary
A module must not read or write another module's tables directly. Cross-domain synchronous operations use a
public facade/application contract. Asynchronous side effects use domain events persisted through the transactional
outbox.
Important refinement: do not expose a raw ORM EntityManager as a long-term public module API. Define a
transaction context/port owned by the application layer, with the ORM implementation hidden in infrastructure. A
single database transaction may span multiple modules inside this monolith, but the boundary must be explicit and
tested.
Pattern. Use an ambient transaction propagated through AsyncLocalStorage. An application service runs the use
case through the TransactionRunner contract (Appendix A.2); facades, repositories, hooks and the outbox join the
open transaction automatically, so no public contract takes an ORM EntityManager parameter. The ORM proof of
concept must demonstrate this across a facade call, a hook and an outbox write.
      Purchase may request a vendor bill through the Accounting public application contract.
      Accounting remains the sole writer of journal-entry and accounting-ledger tables.
      Inventory may request valuation/accounting effects through a defined Accounting contract.
      Emails, Odoo calls, notifications and large exports are never executed inside the user-facing transaction.
      Do not use distributed transactions. If a workflow crosses an external system, use an outbox/inbox, idempotency
       and compensating actions where needed.
      The Odoo integration adapter calls Accounting contracts like any other module: Odoo "ready to invoice" data
       becomes draft invoices and bills through the same contracts, never through direct table writes.


6.4 Layer responsibilities
    Layer                                 Responsibilities                           Must not
                                          DTO validation,
                                                                                     Contain business rules or direct DB
    Controller                            authentication/permission metadata, call
                                                                                     access
                                          one use case, map response DTO
                                          Transaction boundary, orchestration,
    Application service                   domain rules, persistence coordination,    Depend on HTTP response details
                                          outbox writes
                                          Pure business rules, invariants,           Import NestJS, ORM or another module's
    Domain
                                          calculations, allowed state transitions    internals
                                          Persistence queries and measured
    Repository                                                                       Make business decisions
                                          complex SQL
                                          Stable public entry point for other        Expose mutable ORM entities or internal
    Facade/contract
                                          modules/add-ons                            implementation

                               Architecture baseline • Internal engineering reference | 7
```

## PDF page 8

```text
                                                            ERP ARCHITECTURE REFERENCE | REVISED BASELINE




7. Data architecture and company isolation
Terminology. A tenant is a client. Tenants are isolated by separate databases and runtimes. A company is a legal
entity or branch inside one client database and is isolated by company_id scoping. The row-level controls in this
section concern company scope; isolation between tenants comes from the separate databases.


7.1 Database model
   Use one PostgreSQL database per client instance initially. This simplifies client isolation, backup/restore,
    maintenance windows and data residency.
   Within a client database, use company_id on every company-owned business record. A client instance may
    contain multiple legal companies or branches.
   Use explicit foreign keys and indexes. Index common access patterns such as (company_id, state,
    document_date) based on measured query plans.
   Use JSONB only for flexible metadata/custom fields. Core accounting facts, quantities, states, references and
    searchable business attributes belong in typed columns and relational tables.
   Use exact NUMERIC/DECIMAL values for money and quantities where required; never JavaScript floating-point
    arithmetic for financial calculations.
   Fields printed on statutory documents (partner and product names, addresses, units) support Arabic translations.


7.2 Company scope security
The active company header is a selector, not proof of authorization. The server must verify the selected company
against the authenticated user's allowed-company assignments on every request.
   Build a validated RequestContext containing user ID, active company ID, authorized company IDs and correlation
    ID.
   Apply company scoping in repository/query abstractions by default. Do not rely solely on a global ORM filter.
   Evaluate PostgreSQL Row-Level Security as defense in depth for company scope. If enabled, set transaction-
    local session variables safely and ensure pooled connections cannot leak context between requests.
   Audit raw SQL, reporting queries, exports, background jobs, scheduled tasks and file downloads for company
    scope.
   Workers must receive explicit company context in job payloads and validate it before processing; log the client
    instance code with every job.
   Cross-company access must use a dedicated, reviewed service path with explicit authorization and audit
    logging.
   Return 404 for records outside the caller's scope where revealing existence would be unsafe.


7.3 Concurrency and consistency
   Use optimistic version columns for normal draft edits and return 409 on stale updates.
   Use row-level pessimistic locks for posting, allocation, stock reservation and other contention-sensitive
    operations.
   Keep transactions short; never call external APIs while holding a database transaction open.
   Use database constraints for critical invariants where practical, in addition to application validation.
   Use expand-and-contract migrations for rolling upgrades and maintain backward compatibility between adjacent
    application versions during deployment.


7.4 Data residency and retention
   Saudi Arabia's Personal Data Protection Law restricts transfers of personal data outside the Kingdom. Host Saudi
    instances in Saudi Arabia, and keep their backups, logs, metrics containing personal data and object storage
    there too.


                             Architecture baseline • Internal engineering reference | 8
```

## PDF page 9

```text
                                                                       ERP ARCHITECTURE REFERENCE | REVISED BASELINE
      Get legal advice on whether support or development access from India to Saudi production data counts as a
       cross-border transfer, and record the outcome per client.
      Saudi VAT records, including e-invoices, are kept for at least 6 years from the end of the relevant tax period;
       confirm longer periods for capital assets and real estate. Confirm Indian GST retention with each client's tax
       advisor.
      Store the original signed e-invoice (XML or JSON) and the authority's response unchanged for the whole
       retention period, in the same country as the instance.


8. Accounting architecture — foundational domain
Accounting is the first business module delivered and requires a separate detailed design and acceptance process.
Each submodule below is marked MVP (needed for the first client cutover) or Later (delivered after the first cutover,
according to client need).
    Submodule                        Release             Core responsibilities
                                                         Account hierarchy, account types, control accounts, company-specific
    Chart of Accounts                MVP
                                                         configuration and activation rules.
                                                         Sales, purchase, bank, cash, general and other journals; sequence
    Journals                         MVP
                                                         configuration and posting permissions.
                                                         Draft, validate, post, reverse; balanced debit/credit lines; dimensions and
    Journal Entries                  MVP
                                                         references.
                                                         Receive "ready to invoice" lines from Odoo sales orders, deliveries,
    Billing intake from Odoo         MVP                 purchase orders and receipts; create draft invoices and bills; return invoice
                                                         and payment status to Odoo.
                                                         Customer invoices, credit notes, receivable aging, payment terms and
    Accounts Receivable              MVP
                                                         outstanding balances.
    Accounts Payable                 MVP                 Vendor bills, debit notes, payable aging, due dates and supplier balances.
                                                         Receipts, disbursements, payment methods, allocations, partial payments
    Payments                         MVP
                                                         and unapplied amounts.
                                                         Tax codes, rates, inclusive/exclusive calculation, recoverable/output tax.
                                                         India (gst-india): CGST, SGST or IGST by place of supply, HSN/SAC,
    Tax                              MVP
                                                         reverse charge, TDS/TCS. Saudi Arabia (zatca-ksa): VAT at standard, zero
                                                         and exempt rates with reason codes, reverse charge, withholding tax.
                                     MVP for the pilot   India: IRN and signed QR from the IRP. Saudi Arabia: ZATCA Phase 2
    Statutory e-invoicing
                                     country             clearance (B2B) and reporting (B2C). Lifecycle in 8.4.
                                     MVP for the pilot   Data for GST returns (India) and VAT returns (Saudi Arabia), produced by
    Statutory returns and reports
                                     country             the localization add-on.
    Bank Reconciliation              MVP                 Bank statements, matching, reconciliation adjustments and audit trail.
    General Ledger                   MVP                 Account activity, opening/closing balances, drill-down and period filters.
                                     MVP (cash flow:     Trial balance, P&L and balance sheet for the first cutover; cash-flow
    Financial statements
                                     Later)              statement later.
                                                         Fiscal years per company (April-March for India; usually January-December
    Fiscal control                   MVP                 for Saudi Arabia), periods, lock dates, period close, year-end closing and
                                                         retained earnings.
                                                         Asset register, depreciation schedules and disposal. Until delivered,
    Fixed assets                     Later
                                                         depreciation is posted as manual journal entries.




8.1 Posting invariants
      Every posted journal entry balances: total debit equals total credit in company currency, within the defined
       currency precision.
      Use exact decimal arithmetic and explicit rounding policies. Persist transaction currency amount, company
       currency amount and exchange rate used.
      Posted entries and their lines are immutable. Corrections use a reversal linked to the original and, where
       appropriate, a replacement entry.
      Enforce fiscal lock dates and period status in the posting transaction.
      Draft documents do not receive a legal posting number unless jurisdictional rules require otherwise.
      Posting, payment and allocation endpoints require idempotency keys and protect against duplicate effects.
      Concurrent posting of the same source document must be serialized or rejected deterministically.

                                    Architecture baseline • Internal engineering reference | 9
```

## PDF page 10

```text
                                                                   ERP ARCHITECTURE REFERENCE | REVISED BASELINE
      Subledger documents create accounting effects only through Accounting application contracts.


8.2 Legal numbering
Use a configurable numbering policy per company, journal/document type and fiscal year. A locked counter table
can provide serialized allocation when gapless numbering is legally required. Do not impose gapless numbering on
every document by default.
      Document the legal requirement for each number series and distinguish draft references from legally issued
       numbers.
      Define behavior for cancelled, voided and reversed documents; never silently recycle a number if local law or
       audit policy prohibits it.
      Allocate the number inside the same transaction as the final posting/issuance operation.
      Test concurrency, fiscal-year rollover, journal separation and transaction rollback behavior.
      Use PostgreSQL sequences for non-legal technical IDs where gaps are acceptable.
      GST. Indian GST tax invoices (Rule 46(b), CGST Rules 2017) need a consecutive serial number of at most 16
       characters (letters, digits, "-" and "/"), in one or more series, unique within the April-March financial year. Use
       the locked-counter path, keep cancelled numbers on record, and validate the formatted length when a series
       pattern is configured. Confirm each client's series with their tax advisor.
      Saudi Arabia. Each ZATCA invoicing unit (EGS) keeps its own invoice counter (ICV) and hash chain (PIH). These
       are separate from the printed invoice number and must be assigned strictly in order, one document at a time
       (8.4).
      Cutover. At accounting cutover, either continue Odoo's current series from its last issued number or start a new
       series prefix. Disable invoice creation in Odoo at the same moment, so the two systems never issue numbers in
       the same series.


8.3 Accounting acceptance tests
      Balanced and unbalanced entry posting.
      Reversal and adjustment of posted entries.
      Lock-date and closed-period rejection.
      Two concurrent attempts to post the same source document.
      Repeated idempotency key returns the same result without duplicate ledger effects.
      Partial payment, multiple allocations, overpayment and unapplied cash.
      Foreign currency valuation and rounding behavior.
      Trial balance agrees with the sum of ledger balances; subledger totals reconcile to control accounts.
      Company isolation and user permission checks for every accounting endpoint.
      Invoices and bills created from Odoo "ready to invoice" data match the expected quantities, amounts and taxes,
       and the same source line is never invoiced twice.
      Accountant acceptance: the country scenario pack passes on staging and the accountant signs off (17.3).
      E-invoicing in the authority sandboxes: clearance, reporting, rejection and correction, deadline alerts, and (Saudi
       Arabia) chain continuity after a rejected document.
      Bilingual Arabic/English invoice PDFs and QR codes checked by the accountant for Saudi companies.


8.4 Statutory e-invoicing lifecycle
Under Option A the new ERP issues every invoice, so e-invoicing for the pilot country is part of the first release.
Saudi B2B tax invoices must be cleared by ZATCA before they are shared with the buyer, and B2C simplified
invoices reported within 24 hours. In India, e-invoicing applies above ₹5 crore aggregate turnover, and taxpayers at
₹10 crore or more must register invoices on the IRP within 30 days of the invoice date. Confirm current thresholds
per client during discovery.
    State                          Meaning                                            Ledger and documents
    Draft                          Editable; no legal number                          Nothing posted; no PDF
                                   Legal number assigned; statutory payload built
    Issued                                                                            Saudi B2B: not yet posted. Others: posted
                                   and signed
    Submitted                      Sent to the IRP or ZATCA; waiting for a response   PDF and email held back

                                Architecture baseline • Internal engineering reference | 10
```

## PDF page 11

```text
                                                                  ERP ARCHITECTURE REFERENCE | REVISED BASELINE
    Cleared / Reported /          Authority accepted it (Saudi clearance or          Saudi B2B posts now; PDF with QR
    Registered                    reporting; India IRN)                              released
                                  Authority refused it; document kept, never         Not posted, or reversed; corrected by a
    Rejected
                                  deleted                                            new document


      Saudi B2B documents post to the ledger only after clearance. B2C documents and Indian invoices post when
       issued and are reported or registered afterwards.
      Saudi documents are signed and submitted strictly one at a time per invoicing unit, using a locked counter row
       per unit. A rejected document keeps its counter value and hash, and the next document chains from it.
      Each Saudi invoicing unit has its own certificate and private key, held in the secret manager. Administrators
       register units and renew certificates from an admin screen.
      A worker monitors deadlines (24 hours for Saudi B2C reporting, 30 days for large Indian taxpayers) and alerts
       finance before they are missed.
      The localization add-on owns the payload format (UBL 2.1 XML for Saudi Arabia, the IRP JSON schema for India);
       core only sees the EInvoiceProvider interface (Appendix A.13).


9. API standards
      REST endpoints use /api/v1 and plural kebab-case resource names.
      State changes use explicit action endpoints such as POST /purchase-orders/{id}/confirm; PATCH must not
       silently transition document state.
      All request bodies use DTO validation. Reject or strip unknown properties consistently; responses are explicit
       response DTOs, never raw ORM entities.
      Use ISO 8601 for dates/timestamps. Represent money and high-precision quantities as decimal strings in JSON.
      List endpoints support bounded pagination, sorting and structured filters. Large exports run asynchronously.
       Query and response format: Appendix A.6.
      Use RFC 9457 Problem Details-compatible errors with stable application error codes and correlation IDs.
      Use Idempotency-Key for posting, payment, allocation and other non-repeatable financial operations; store
       request hash and result for a documented retention period. A repeat with the same key and the same body
       returns the stored result, not an error; the same key with a different body returns 422; a repeat while the first
       request is still running returns 409.
      Generate the Angular client from OpenAPI in CI and fail when generated output is stale.
    HTTP status                                                  Meaning
    400                                                          Malformed request or DTO validation failure
    401                                                          Missing or expired authentication
    403                                                          Authenticated but not permitted
    404                                                          Resource not found or not visible in caller scope
                                                                 Version conflict, or a request with the same Idempotency-Key
    409
                                                                 still in progress
                                                                 Valid request refused by a business rule, or an Idempotency-
    422
                                                                 Key reused with a different body
                                                                 Unexpected server error; expose correlation ID, not stack
    500
                                                                 trace


     GET       /api/v1/customer-invoices
     GET       /api/v1/customer-invoices/{id}
     POST      /api/v1/customer-invoices                           # create draft
     PATCH     /api/v1/customer-invoices/{id}                      # draft edit + version
     POST      /api/v1/customer-invoices/{id}/post                 # Idempotency-Key required
     POST      /api/v1/customer-invoices/{id}/credit-note          # reversal document
     POST      /api/v1/payments/{id}/allocate                      # Idempotency-Key required




                                Architecture baseline • Internal engineering reference | 11
```

## PDF page 12

```text
                                                                     ERP ARCHITECTURE REFERENCE | REVISED BASELINE

10. Authentication, authorization and audit
10.1 Sessions
      Use server-side sessions stored in PostgreSQL or a dedicated session store. Issue Secure, HttpOnly, SameSite
       cookies.
      Serve Angular and API on the same origin through Nginx where possible; this reduces CORS complexity.
      Protect state-changing requests against CSRF. Configure Angular XSRF handling and verify the token server-
       side.
      Hash passwords with Argon2id; add configurable rate limiting, lockout controls, MFA and session revocation.
      Do not store long-lived access tokens in localStorage.


10.2 Authorization
      Use permission strings such as accounting.journal_entry.post and purchase.order.confirm.
      Roles are editable permission bundles; assignments include user, role and company scope.
      Record rules are enforced by backend query/application layers, not just Angular route guards.
      Angular permission directives and guards are convenience controls only.
      Audit login events, failed login, role/permission changes, approvals, exports, posting, reversals and privileged
       scope overrides.


11. Client customization and add-on architecture
Use the lowest-cost customization mechanism that safely satisfies the requirement. Core behavior must remain
client-neutral. The extension framework (settings, custom fields, hooks and the add-on loader) is built in the
foundation phase, because accounting is the first module and must expose its extension points from its first release.
    Layer                                     Use for                                   Requires code release?
                                              Values, switches, defaults, thresholds,
    1. Settings                                                                         No
                                              default warehouse
                                              Additional fields, hidden/reordered
    2. Custom fields and layouts              columns, labels and simple form           No
                                              changes
                                              Approval stages, limits, routing and
    3. Workflow configuration                 conditions within supported workflow      No
                                              capabilities
                                              New domain logic, screens, reports,
    4. Add-on module                                                                    Yes
                                              integrations or statutory behavior




11.1 Add-on rules
      Add-ons declare name, version, dependencies, supported core version and required permissions (manifest
       format: Appendix A.7).
      Core exposes named, typed extension points. Add-ons may register handlers; core must never import a client
       add-on.
      Before-hooks may validate/block an operation inside the transaction. After-hooks must enqueue side effects
       rather than perform slow external work.
      An add-on requiring a missing extension point triggers a normal core change request; do not add hidden
       monkey-patching.
      Use add-on-owned tables with clear prefixes/namespaces and reviewed migrations.
      All add-ons are tested both in isolation and with the supported core version.




                                   Architecture baseline • Internal engineering reference | 12
```

## PDF page 13

```text
                                                               ERP ARCHITECTURE REFERENCE | REVISED BASELINE

11.2 Add-on distribution and confidentiality
A single image containing all compiled add-ons is operationally simple but distributes all included code to every client
instance. If client-specific source code or intellectual property must not be shipped to other clients, build a client-
specific image or package. Disabled configuration is not a confidentiality boundary.


11.3 Custom fields
    Store definitions separately from values, with type, label, options, required rules, visibility and company
     applicability.
    Use JSONB for genuinely flexible custom values; validate every write against server-side definitions.
    Do not use arbitrary custom JSON for core financial facts, high-volume joins or fields needed for critical
     constraints.
    Promote frequently queried or business-critical custom fields to typed columns or add-on-owned relational
     tables.
    Version metadata definitions and validate compatibility during deployment.


11.4 Localization add-ons
    Each company has a country setting that selects its localization add-on; this is never an instance-wide switch.
    gst-india: GST tax engine, IRP e-invoicing, GST return data and Indian invoice layouts.
    zatca-ksa: Saudi VAT tax engine, ZATCA Phase 2 clearance and reporting, VAT return data, bilingual invoice
     layouts with QR codes.
    Add-ons implement core interfaces (TaxEngine, EInvoiceProvider, StatutoryReports) and register through the
     normal add-on loader.
    Build the pilot country's add-on first. Build and accountant-test the second country's add-on before that
     country's first client goes live.


12. Angular frontend architecture
12.1 Single application with lazy-loaded domain features
Use one Angular SPA with a shell and lazy-loaded feature libraries. This is the preferred initial design for this ERP. It
avoids the runtime, deployment and dependency-version complexity of micro-frontends while preserving domain-
level code ownership.
    apps/web/src/
      main.ts
      app/
        app.config.ts
        app.routes.ts

    libs/web/core/
      auth/ permissions/ company/ http/ layout/ manifest/ i18n/

    libs/web/ui/                     # shared design system
    libs/web/metadata-forms/         # configurable forms/lists
    libs/web/api-client/             # generated from OpenAPI
    libs/web/features/
      accounting/
      purchase/
      sales/
      inventory/
      reports/
      administration/




                              Architecture baseline • Internal engineering reference | 13
```

## PDF page 14

```text
                                                                      ERP ARCHITECTURE REFERENCE | REVISED BASELINE

12.2 Frontend boundaries
      Shell owns login/session state, active company, navigation, global notifications, layout and route registration.
      Each feature owns its pages, components, API wrappers and feature-local state.
      Features must not import one another. Shared pickers and reusable controls belong in the UI library.
      Use standalone components, OnPush change detection, signals and typed reactive forms.
      Use generated API services through thin feature wrappers; do not inject HttpClient directly into every page.
      Keep filters, sort and pagination in URL query parameters where practical.
      Every visible string is a translation key.
      The design system supports Arabic and right-to-left layout from the first release (Angular CDK directionality,
       logical CSS properties); every shared component is checked in both directions.


12.3 When to reconsider micro-frontends
Revisit Module Federation or Native Federation only if multiple independent teams need independently deployed
frontend releases, there is a real need for separately versioned runtime remotes, or build/release bottlenecks
become measurable. If adopted, begin with a shell plus two representative remotes and prove authentication,
routing, shared dependency versions, deployment/rollback and remote failure handling.


12.4 Metadata-driven vs custom UI
    Screen category                                                  Recommended implementation
    Simple master data and settings                                  Metadata-driven forms/lists
    Basic searchable lists                                           Metadata-driven list where interaction is conventional
                                                                     Hybrid: custom workflow and line editor, metadata for
    Purchase/sales documents
                                                                     supported custom fields
                                                                     Hybrid: purpose-built line editor with tax computation;
    Invoices, bills and credit notes
                                                                     metadata for supported custom fields
    Journal entries and payment allocation                           Purpose-built Angular components
    Stock movement/reservation                                       Purpose-built components
                                                                     Purpose-built components with controlled filters and drill-
    Financial reports and reconciliation
                                                                     down
    Complex approvals                                                Purpose-built workflow UI


Metadata is presentation configuration, never a source of business authorization or validation. The API remains
authoritative.


13. Background jobs, outbox and integrations
13.1 Job processing
      Use pg-boss initially to reduce infrastructure count. Load-test queue volume, job latency, database contention
       and worker concurrency.
      Every job handler must be idempotent and safe to retry. Use exponential backoff, bounded attempts and a dead-
       letter/review workflow.
      Record job status, attempts, last error, correlation ID and client/company context.
      Expose operational visibility for stuck, failed and repeatedly retried jobs.
      Large reports, PDF generation, emails, Odoo sync and bulk imports run in workers.
      Saudi e-invoice submission runs one document at a time per invoicing unit (8.4); never process a unit's
       documents in parallel.


13.2 Transactional outbox
Write an outbox event in the same PostgreSQL transaction as the business change. A dispatcher claims pending
events safely, publishes/enqueues them, and records delivery. Design for at-least-once delivery: a crash can occur
after enqueueing but before marking the outbox row delivered.

                                       Architecture baseline • Internal engineering reference | 14
```

## PDF page 15

```text
                                                                ERP ARCHITECTURE REFERENCE | REVISED BASELINE
      Give each event a globally unique event ID and stable event type/version.
      Claim rows using safe locking (for example, SKIP LOCKED) or another proven lease mechanism.
      Use idempotent consumers and unique constraints to prevent duplicate business effects.
      Track attempts, next-attempt time, delivered time, last error and dead-letter status.
      Do not assume exactly-once delivery across PostgreSQL and a job queue.
      Test in the ORM proof of concept: pg-boss stores its queue in the same PostgreSQL database, so an internal job
       may be enqueued inside the business transaction, removing the dispatcher step. Keep the outbox if the ORM
       transaction connection cannot be shared with pg-boss cleanly.


13.3 Integration patterns
      External calls are made by workers, not within API request transactions.
      Use dedicated integration credentials per client and least-privilege scopes.
      Use inbox/outbox patterns, external ID mapping, payload hashes and reconciliation reports.
      Define ownership for every synchronized entity and field to avoid bidirectional overwrite loops.
      Apply rate limits, retry/backoff, timeout, circuit-breaker behavior where appropriate, and manual replay controls.
      Odoo adapter (accounting first). Inbound: "ready to invoice" lines, partners, products and stock valuation
       entries. Outbound: invoice numbers, posting status and payment status, so Odoo sales and purchase users can
       see invoicing state. Each source line is identified by Odoo model and line ID, so a repeated sync never invoices it
       twice (contract: Appendix A.12).
      Odoo bridge module. Odoo computes sales and purchase invoicing status from its own invoice records. Plan a
       small Odoo bridge module per supported Odoo version that records quantities invoiced in the new ERP and
       shows invoice and payment status; verify against each client's Odoo version during discovery.


14. Files, PDFs, email and notifications
    Concern                                                    Standard
                                                               PostgreSQL row with company_id, entity, entity_id, file name,
    Attachment metadata
                                                               MIME type, size, checksum, storage key and creator.
                                                               S3/GCS/MinIO object storage; opaque UUID keys, not user-
    File bytes
                                                               controlled paths.
                                                               API validates authorization, size, content type and file
    Upload
                                                               signature; malware scanning where risk warrants.
                                                               Authorize every access and issue short-lived signed URLs or
    Download
                                                               stream through API.
                                                               Worker renders versioned templates (bilingual Arabic/English
                                                               with right-to-left layout for Saudi companies); Saudi B2B PDFs
    PDF generation
                                                               embed the cleared XML (PDF/A-3); store output as an
                                                               attachment with source/version metadata.
                                                               Signed payload and authority response stored unchanged, in-
    E-invoice archive
                                                               country, for the statutory retention period (7.4).
                                                               Worker job with template, retry status and provider response
    Email
                                                               tracking.
                                                               Persist notification records; clients may poll or use a real-time
    In-app notifications
                                                               channel if justified.
                                                               Back up database and object storage with coordinated
    Backup
                                                               retention and restore testing.




15. Reporting and performance
      Start with indexed PostgreSQL queries and measured query plans. Avoid premature data warehouses or read
       replicas.
      Keep report SQL in the owning domain or reporting module with explicit permission and company-scope
       enforcement.
      Use asynchronous jobs for large exports and long-running reports.
      Define report freshness expectations: real-time transactional query, cached summary or scheduled snapshot.

                                Architecture baseline • Internal engineering reference | 15
```

## PDF page 16

```text
                                                                 ERP ARCHITECTURE REFERENCE | REVISED BASELINE
      Use keyset pagination for very large datasets where offset pagination becomes expensive.
      Introduce read replicas, materialized views or a reporting database only when measured workload justifies them.
      Never bypass company filters in reporting or exports; test exports as rigorously as normal API endpoints.


16. Deployment, configuration and upgrades
16.1 Per-client runtime
    Container                                                   Role
    web                                                         Nginx serves Angular build and proxies API requests
    api                                                         NestJS HTTP process
    worker                                                      NestJS worker process using same server image
    db                                                          PostgreSQL container or managed PostgreSQL service
                                                                Optional MinIO for on-premise deployments; otherwise
    storage
                                                                external object storage




16.2 Upgrade procedure
      CI builds immutable erp-server and erp-web images tagged with a semantic version and records the source
       commit.
      Deploy the exact release to staging with the target client's add-on set and run migrations/tests.
      Take a verified database backup and confirm WAL/PITR coverage before production changes.
      Run versioned migration tooling as one separate step before new API and worker containers start, holding a
       PostgreSQL advisory lock so only one runner can migrate at a time. Use expand-and-contract changes so old
       and new application versions can coexist during rollout; stop or drain workers if a migration is not backward
       compatible.
      Deploy API and worker processes, run readiness checks, smoke tests and a client-specific critical workflow.
      On application failure, redeploy the previous image only if schema compatibility permits. Restore database
       backups only for data corruption or failed migration recovery, not as the default code rollback.
      Roll out per client or in controlled waves; capture deployed version, migration state and health centrally.


16.3 Operational controls
      Separate liveness and readiness checks.
      Centralize structured logs and metrics with client instance labels; do not put secrets or sensitive personal data in
       logs. For Saudi instances, keep logs and metrics that contain personal data inside Saudi Arabia.
      Monitor database health, disk growth, backup success, queue age, dead-letter jobs, API latency, error rate and
       worker utilization.
      Define RPO/RTO per client tier and test restore procedures regularly.
      Use TLS, firewall allow-lists, least-privilege service accounts and secrets rotation.
      Monitor e-invoicing: documents waiting for submission, rejections, and time left before statutory deadlines.


17. Odoo coexistence and migration
17.1 Discovery before migration
      Record Odoo version/edition, installed standard modules, custom Python modules, custom fields,
       automated/server actions, scheduled jobs, reports, email templates and integrations.
      Map each customization to target settings, metadata, workflow configuration, add-on code or a deliberate
       retirement decision.
      Inventory users, roles, companies, branches, fiscal setup, currencies, taxes, journals, sequences and master
       data.
      Identify data ownership and system-of-record for each entity during coexistence.

                                Architecture baseline • Internal engineering reference | 16
```

## PDF page 17

```text
                                                                        ERP ARCHITECTURE REFERENCE | REVISED BASELINE
      Accounting inventory per client: chart of accounts, journals, tax and GST configuration, invoice number series,
       payment terms, bank accounts, reconciliation practice, period-close process, custom accounting modules and
       reports actually used, whether e-invoicing is mandatory, current e-invoicing setup in Odoo (ZATCA invoicing
       units for Saudi companies, IRP access for Indian companies) and hosting requirements.


17.2 Coexistence rules
Accounting is built first, tested and signed off by an accountant, and only then migrated and taken live for each
client. After go-live the new ERP is the accounting system of record while Odoo continues to run sales, purchase and
inventory until those modules are added. During coexistence the new ERP issues all customer invoices, credit notes,
vendor bills and debit notes (Option A); Odoo sends "ready to invoice" data and receives invoice and payment status
back. Avoid dual writes for the same entity.
                                                 After accounting cutover (Odoo
    Data/workflow                                                                            After the module is rebuilt
                                                 coexistence)
    Chart of accounts, journals, taxes, fiscal
                                                 New ERP (migrated once from Odoo)           New ERP
    years
    Journal entries, general ledger, close,
                                                 New ERP                                     New ERP
    financial reports
                                                 New ERP issues them from Odoo sales
    Customer invoices and credit notes           order and delivery data; status sent back   New ERP, from its own sales module
                                                 to Odoo
                                                 New ERP issues them from Odoo
    Vendor bills and debit notes                 purchase order and receipt data; status     New ERP, from its own purchase module
                                                 sent back to Odoo
    Payments, bank statements,
                                                 New ERP                                     New ERP
    reconciliation
                                                 Odoo is master; read-only copies
    Partners, products                                                                       New ERP owns them
                                                 synced to the new ERP
                                                 Odoo creates them; synced to the new
    Stock valuation entries                                                                  New ERP inventory module
                                                 ERP as journal entries
    Sales orders, purchase orders, stock         Odoo                                        New ERP, one module at a time




17.3 Accountant acceptance testing
No production data is migrated and nothing goes live until an accountant has tested the accounting module and
signed it off. The accountant may be the pilot client's accountant or the team's own finance expert, named before
Phase 5 starts.
      Testing runs on staging against an agreed scenario pack per country: invoices and credit notes from Odoo
       "ready to invoice" data, vendor bills, payments and partial allocations, bank reconciliation, period and year-end
       close, and multi-currency.
      India scenarios: CGST/SGST versus IGST by place of supply, reverse charge, TDS/TCS, credit notes, and IRN
       generation in the IRP sandbox.
      Saudi scenarios: standard, zero-rated and exempt VAT, B2B clearance and B2C reporting in the ZATCA
       sandbox, a rejected document and its correction, and bilingual invoice PDFs.
      The accountant checks reports against expected results: trial balance, P&L, balance sheet, receivable and
       payable aging, and tax return figures.
      Defects are logged, fixed and retested. Acceptance is a written sign-off per country, listing any accepted open
       items.
      After sign-off, run at least two migration rehearsals on staging; the accountant reconciles each one (trial
       balance, open receivables and payables, tax balances) against Odoo before the production migration.
      Optional extra check: replay one closed Odoo period into staging and compare results, if the accountant wants
       more assurance before go-live.


17.4 Migration pipeline
      Extract through supported Odoo APIs where feasible; use controlled read-only database extraction only where
       necessary and approved.
                                    Architecture baseline • Internal engineering reference | 17
```

## PDF page 18

```text
                                                                   ERP ARCHITECTURE REFERENCE | REVISED BASELINE
      Load raw records into a staging schema while retaining source model and source ID.
      Transform states, units, taxes, accounts, currencies and references using versioned mapping rules.
      Maintain an integration/migration mapping table with source system, source model, source ID, target entity,
       target ID, status, content hash and timestamps.
      Load in dependency order: companies and users, chart of accounts, journals and taxes, partners, opening
       balances, open receivable and payable items, then history and attachments according to agreed scope.
      Reconcile record counts, trial balance, open receivables/payables by partner, bank balances, inventory
       quantities and valuation.
      Rehearse at least twice against a production copy after accountant sign-off; the accountant reconciles each
       rehearsal; measure duration and delta volume.
      Go live only after accountant sign-off and a reconciled rehearsal: freeze Odoo invoicing and accounting entries,
       apply the final migration, have the accountant reconcile it, switch users, and keep Odoo's accounting read-only
       for reference.
      Saudi companies: register the new system's invoicing unit(s) with ZATCA and decommission Odoo's at go-live.
       Confirm with ZATCA during onboarding whether the new unit starts a new hash chain or carries over Odoo's last
       hash.
      Indian companies: move IRN generation from Odoo to the new system's IRP access at go-live, so no invoice is
       registered twice.


17.5 Cutover gates
    Gate                                                           Evidence required
                                                                   Mapping completeness, duplicate handling, exception report
    Data readiness
                                                                   and record counts
                                                                   Trial balance and subledger reconciliation signed off by
    Financial readiness
                                                                   finance
                                                                   Written sign-off of the country scenario pack and reports;
    Accountant acceptance
                                                                   open defects closed or explicitly accepted
                                                                   Two rehearsals reconciled by the accountant: trial balance,
    Migration rehearsal
                                                                   open AR/AP and tax balances match Odoo
                                                                   Series continuation agreed with finance; Odoo invoice creation
    Invoice series readiness
                                                                   disabled at cutover
                                                                   Production ZATCA units or IRP access ready; sandbox
    E-invoicing readiness
                                                                   scenarios passed; Odoo e-invoicing switched off at go-live
                                                                   Saudi instance, backups and logs hosted in Saudi Arabia;
    Data residency readiness
                                                                   support-access legal review recorded
                                                                   Critical purchase-to-pay, order-to-cash and inventory flows
    Operational readiness
                                                                   pass UAT
    Security readiness                                             Roles, company scope, audit events and access tests pass
                                                                   Verified backup, restore rehearsal and rollback decision
    Recovery readiness
                                                                   criteria
                                                                   Named client stakeholders approve cutover and acceptance
    Business approval
                                                                   criteria




18. Testing strategy and definition of done
    Test level                             Tools                                        Required coverage
                                                                                        Calculations, invariants, permissions-
    Domain unit                            Jest                                         independent domain rules, state
                                                                                        transitions.
                                                                                        Real PostgreSQL transactions,
    API integration                        Jest + Testcontainers                        constraints, locks, company filters and
                                                                                        migrations.
                                                                                        Authentication, permissions, company
    API contract/security                  Supertest                                    isolation, error shape, idempotency and
                                                                                        rate limits.
                                                                                        Tax computation per country, e-invoice
    Localization                           Jest + authority sandboxes                   payloads, Saudi signing and chain order,
                                                                                        Arabic PDF output.

                               Architecture baseline • Internal engineering reference | 18
```

## PDF page 19

```text
                                                                     ERP ARCHITECTURE REFERENCE | REVISED BASELINE
                                                                                            Components, stores, form validation
    Frontend unit                             Vitest + Angular Testing Library
                                                                                            display and route behavior.
                                                                                            Login; Odoo data to invoice, posting,
                                                                                            payment, allocation and bank
    End-to-end                                Playwright                                    reconciliation; period close; later
                                                                                            purchase-to-pay, order-to-cash and
                                                                                            stock flows; client add-on scenarios.
                                                                                            Business sign-off of accounting, tax, e-
    Accountant acceptance                     Country scenario packs on staging             invoicing and reports before any
                                                                                            production migration.
                                                                                            Repeatability, mapping completeness,
    Migration rehearsal                       Automated scripts + SQL checks                accountant reconciliation of each
                                                                                            rehearsal and cutover duration.
                                                                                            Backup restore, health checks, queue
    Operational                               CI/staging checks                             retries, worker restart and deployment
                                                                                            rollback.




Definition of done
      Tests added at appropriate levels, including company isolation for new endpoints.
      Database migration included and reviewed; expand-and-contract compatibility considered.
      OpenAPI contract updated and generated Angular client refreshed.
      Permissions declared and default roles reviewed.
      Audit events added for sensitive operations.
      Translation keys added for all new UI text.
      Metrics/logging added for important background work and failure paths.
      Client customization is configuration or an approved add-on, not a core client-specific branch.
      Documentation and runbooks updated where operational behavior changed.


19. Git workflow and engineering standards
      main remains releasable. Use short-lived feature/fix branches and merge requests.
      Require at least one reviewer and green CI: lint, typecheck, affected unit/integration tests, affected builds,
       OpenAPI client generation check and migration validation.
      Use Conventional Commits and semantic version tags.
      Hotfixes branch from a release tag and are merged back into main.
      Protect release and production deployment environments; require approval for production migrations.
      Use code owners for accounting, security, database migrations and shared architecture libraries. With a team of
       four, one person may own several areas, but accounting changes always get a second reviewer.


20. Implementation roadmap
    Phase                      Focus                                                         Exit criteria
                               Odoo accounting audit per client and country: chart of
                                                                                             Signed accounting scope (MVP vs
                               accounts, journals, tax setup, number series, e-invoicing
                                                                                             Later), pilot client and country chosen,
    0. Accounting discovery    setup (ZATCA units, IRP access), custom accounting
                                                                                             accountant named, Odoo "ready to
                               modules, reports in use, hosting needs; choose the pilot
                                                                                             invoice" data mapped
                               client and pilot country; name the accountant
                               Nx repo, CI/CD, API and worker, Angular shell with
                               Arabic/right-to-left support, auth and permissions, audit,
                               companies, fiscal years, currencies, legal numbering,         Deployable skeleton, company-
    1. Foundation              transaction interface, extension and localization             isolation tests, pilot client's Odoo
                               framework, attachments and PDF, Odoo extraction               accounting data in staging
                               adapter into staging; in-Kingdom hosting if the pilot is
                               Saudi
                               Chart of accounts, journals, journal entries, posting,
                                                                                             Accountant walkthrough of posting,
    2. Ledger core             reversal, lock dates, general ledger, trial balance,
                                                                                             reversal and lock-date scenarios
                               opening balance import
    3. Receivables, payables   Billing intake from Odoo, invoices, credit notes, bills,      Pilot country scenarios pass in the

                                 Architecture baseline • Internal engineering reference | 19
```

## PDF page 20

```text
                                                                    ERP ARCHITECTURE REFERENCE | REVISED BASELINE
                                debit notes, payments, allocation, aging, invoice PDFs,
 and pilot localization         Odoo bridge module, pilot country add-on (gst-india or      sandbox
                                zatca-ksa) with e-invoicing in the authority sandbox
                                Bank statements, reconciliation, period and year-end        One period closed end to end in
 4. Bank and close
                                close, P&L, balance sheet, tax return data                  staging
 5. Accountant                  Country scenario pack executed by the accountant on
                                                                                            Written sign-off for the pilot country
 acceptance testing             staging; defects fixed and retested (17.3)
                                At least two rehearsals from a production copy, each
                                                                                            Rehearsal reconciliation signed; all
 6. Migration rehearsals        reconciled by the accountant; production e-invoicing
                                                                                            cutover gates in 17.5 ready
                                credentials prepared
                                Production migration, accountant reconciliation, switch-
 7. Go-live (pilot client)                                                                  Pilot client live on the new accounting
                                over; Odoo keeps sales, purchase and inventory
                                Remaining clients in waves; second country add-on built
 8. Accounting rollout and
                                and accountant-tested before its first client goes live;    Per-client gates passed
 second country
                                Later items such as fixed assets and cash-flow statement
                                Purchase, sales and inventory added one at a time after
                                                                                            Per-module acceptance; Odoo retired
 9. Operational modules         accounting is live, each replacing its Odoo counterpart
                                                                                            per client
                                and its "ready to invoice" feed


A calendar estimate should be produced only after discovery confirms module scope, customization volume, team
capacity, accounting complexity, data quality and client rollout strategy. Do not treat a generic duration as a
commitment.


21. Architecture decisions to confirm
 Decision                                     Proposed baseline                            How to settle
                                                                                           2-day proof of concept against Prisma
                                                                                           and Drizzle: transaction propagation
 ORM                                          MikroORM                                     across facades and hooks, row locks,
                                                                                           company scoping, JSONB, migrations
                                                                                           and report SQL.
                                                                                           Build representative list, form, editable-
 Frontend UI kit                              Angular Material/CDK + AG Grid               line and report screens; review
                                                                                           licensing/accessibility/performance.
                                                                                           Reconsider only with independent team
 Angular federation                           Not initially                                release needs; prove with shell + two
                                                                                           remotes before adoption.
                                                                                           Load-test throughput, queue age, lock
 Job queue                                    pg-boss                                      contention and database resource
                                                                                           impact.
                                                                                           Prototype pooled-connection safety,
                                              Repository scope + evaluate PostgreSQL
 Company-scope defense in depth                                                            transaction-local context and
                                              RLS
                                                                                           admin/worker access.
                                                                                           Review operations burden as client
 Deployment                                   Docker Compose per client                    count grows; evaluate orchestration only
                                                                                           when justified.
                                                                                           Use client-specific image/package if
                                              Common image if code may be
 Add-on packaging                                                                          code confidentiality or licensing requires
                                              distributed
                                                                                           it.
                                                                                           Confirm each client hosting/data-
 Object storage                               S3/GCS; MinIO on-prem
                                                                                           residency requirement.
                                                                                           Inventory client Odoo versions and
 Odoo API                                     Version-specific adapter                     confirm supported API/authentication
                                                                                           per version.
                                                                                           Confirm per client which GST, e-
                                                                                           invoicing, e-way bill and Saudi VAT
                                              gst-india and zatca-ksa add-ons, per
 Localization                                                                              obligations apply, and whether e-way
                                              company
                                                                                           bills stay in Odoo while stock remains
                                                                                           there.
                                                                                           Confirm the invoicing workflow with the
                                              Option A (decided): the new ERP issues
 Invoicing during coexistence                                                              pilot client; map Odoo "ready to invoice"
                                              invoices and bills
                                                                                           data per client.
                                                                                           Prove in the ORM proof of concept
                                              Ambient transaction via
 Transaction propagation                                                                   across a facade call, a hook and an
                                              AsyncLocalStorage (TransactionRunner)
                                                                                           outbox write.

                                 Architecture baseline • Internal engineering reference | 20
```

## PDF page 21

```text
                                                                     ERP ARCHITECTURE REFERENCE | REVISED BASELINE
                                                                                         Build one master-data screen with
Metadata form renderer                      ngx-formly                                   custom fields in ngx-formly and in an
                                                                                         internal renderer.
                                                                                         Confirm with the chosen UI kit and Nx
Angular unit-test runner                    Vitest
                                                                                         setup.
                                                                                         Decide whether accounting-only
Partner master during coexistence           Odoo is master                               partners (for example expense vendors)
                                                                                         are created in Odoo or the new ERP.
                                            Continue Odoo's series or start a new        Agree per client with finance and the
Invoice series at cutover
                                            prefix                                       client's tax advisor.
                                            Small Odoo module per supported Odoo         Prototype on the pilot client's Odoo
Odoo bridge module
                                            version                                      version during discovery.
                                                                                         Decide in discovery; the second country
Pilot country                               Country of the first pilot client
                                                                                         follows in Phase 8.
                                            Buy signing and transport from a             Compare ZATCA-capable providers or
E-invoicing connectivity                    provider; build tax logic and invoice        SDKs and Indian API providers on cost,
                                            states in-house                              hosting location and API quality.
                                                                                         Confirm with each Saudi client's tax
Saudi invoicing units (EGS)                 One unit per client instance                 advisor whether branches need separate
                                                                                         units.
                                                                                         Confirm per client, including backups,
Saudi hosting                               In-Kingdom cloud region or on-premise
                                                                                         logs and support access.
                                            Pilot client's accountant or the team's      Name the person before Phase 5 and
Accountant for acceptance
                                            finance expert                               agree the scenario pack in Phase 3.




22. Risks and controls
Risk                                                                Control
                                                                    Defense-in-depth scope enforcement, RLS evaluation,
Cross-company data exposure
                                                                    negative tests, export/job review and audit.
                                                                    Multiple rehearsals, signed reconciliation, controlled cutover
Accounting mismatch at migration
                                                                    and read-only Odoo retention.
                                                                    Four-layer policy, extension contracts, add-on tests and
Customization sprawl
                                                                    architecture review.
                                                                    Transactional outbox, unique event IDs, idempotent handlers
Queue duplicate effects
                                                                    and replay controls.
                                                                    Expand-and-contract migrations, staged rollout and
Deployment schema incompatibility
                                                                    compatibility checks.
                                                                    Lazy loading, bundle budgets and domain ownership; consider
Single SPA grows too large
                                                                    federation only when justified.
                                                                    Automated provisioning/upgrades/backups/monitoring and
Per-client operations overhead
                                                                    central fleet inventory.
Sensitive add-on code distribution                                  Client-specific build artifacts and access controls.
                                                                    Build foundation patterns on the ledger-core slice first;
New stack learned on the hardest module                             architecture review of early accounting merge requests;
                                                                    accounting expert available for acceptance.
                                                                    Accountant named in discovery and involved from the ledger
Accountant sign-off delayed                                         core; scenario pack agreed in Phase 3; defects triaged and
                                                                    retested before migration starts.
                                                                    Pilot client first; training on invoicing screens; invoice and
Users switch systems for invoicing
                                                                    payment status visible in Odoo through the bridge module.
                                                                    Single owner per number series; Odoo invoice creation
Duplicate invoice numbers across systems
                                                                    disabled at cutover; series continuation agreed in advance.
                                                                    One-at-a-time submission per invoicing unit, rejected
Saudi e-invoice chain broken or deadline missed
                                                                    documents kept in the chain, deadline monitor and alerts.
                                                                    In-Kingdom hosting for instance, backups and logs; legal
Personal data leaving Saudi Arabia
                                                                    review of support access.
                                                                    Pilot one country first; second country add-on accountant-
Two countries' rules in the first release
                                                                    tested before its first go-live.




                                 Architecture baseline • Internal engineering reference | 21
```

## PDF page 22

```text
                                                              ERP ARCHITECTURE REFERENCE | REVISED BASELINE

23. Final architecture recommendation
Adopt this revised baseline as the default architecture for the ERP rebuild:
    NestJS modular monolith with separate API and worker processes.
    One Angular SPA with a shell and lazy-loaded domain feature libraries; no micro-frontends initially.
    Nx monorepo with strict dependency boundaries.
    PostgreSQL as the transactional system of record, one database per client instance initially.
    MikroORM as the leading ORM candidate, pending the documented proof of concept.
    pg-boss as the initial background job system, with an outbox and idempotent consumers.
    Strong company-level data isolation, an ambient transaction contract and comprehensive accounting invariants.
    Configuration-first customization with compiled add-ons only when necessary.
    Accounting first: built, tested and signed off by an accountant, then migrated and taken live per client; the new
     ERP issues invoices and bills while Odoo keeps sales, purchase and inventory until those modules are added.
    Per-company localization add-ons for India and Saudi Arabia, with Saudi instances hosted in the Kingdom.
    Automated client deployments, tested backups/restores, observability and controlled upgrades.
This is a baseline, not a substitute for detailed domain specifications. Accounting, inventory valuation, tax
localization, workflow configuration and each client's Odoo migration mapping require dedicated design and
acceptance documents.


Reference implementation order
    First prove the foundation: login/session, company switch, company isolation, migration pipeline and CI/CD.
    Then prove one accounting flow end to end: Odoo "ready to invoice" data, draft customer invoice, tax
     computation for the pilot country, e-invoice in the authority sandbox, posting with a legal number, payment,
     allocation, general ledger and trial balance.
    Use that vertical slice to validate ORM, transaction contracts, outbox, permissions, audit, UI patterns and
     deployment.
    Only after the vertical slice passes should the team scale implementation across the remaining modules.


Appendix A. Developer conventions
This appendix turns the architecture into day-to-day conventions. Examples use the accounting module because it is
built first; every other module follows the same shapes.


A.1 Backend module structure
    libs/api/accounting/src/
    ├── index.ts                          # public: module, facade, events, hook types
    ├── accounting.module.ts
    ├── accounting.facade.ts              # contract for other modules, add-ons, Odoo adapter
    ├── hooks.ts                          # extension points this module offers
    ├── controllers/
    │   ├── customer-invoices.controller.ts
    │   └── journal-entries.controller.ts
    ├── application/                      # one use case per file, one transaction each
    │   ├── post-invoice.use-case.ts
    │   └── create-invoice-from-odoo.use-case.ts
    ├── domain/                           # plain TypeScript, no NestJS or ORM imports
    │   ├── invoice.entity.ts
    │   ├── journal-entry.entity.ts
    │   ├── posting.rules.ts              # balance check, rounding, state rules
    │   └── invoice.states.ts
    ├── repositories/                     # company-scoped queries, report SQL
    ├── dto/                              # request and response DTOs
    ├── events/
    │   └── invoice-posted.event.ts
    ├── jobs/                             # pg-boss handlers owned by this module

                             Architecture baseline • Internal engineering reference | 22
```

## PDF page 23

```text
                                                            ERP ARCHITECTURE REFERENCE | REVISED BASELINE
   ├── views/                                 # form and list metadata
   ├── templates/                             # invoice and payment receipt PDF templates
   └── tests/


A.2 Transaction interface
Application code depends only on TransactionRunner. The ORM implementation lives in infrastructure. Verify the join
and savepoint behavior of nested calls in the ORM proof of concept.
   // libs/api/common/src/transaction/transaction-runner.ts (public contract)
   export abstract class TransactionRunner {
     /** Runs work in the current transaction, or starts one if none is open. */
     abstract run<T>(work: () => Promise<T>): Promise<T>;
   }

   // libs/api/infrastructure/src/database/mikro-orm-transaction-runner.ts           (hidden implementation)
   @Injectable()
   export class MikroOrmTransactionRunner extends TransactionRunner {
     constructor(private readonly em: EntityManager) {
       super();
     }

       run<T>(work: () => Promise<T>): Promise<T> {
         // MikroORM keeps the transactional context in AsyncLocalStorage, so repositories
         // and facades called inside work() use the same transaction.
         return this.em.transactional(() => work());
       }
   }


A.3 Controller and use case
Controllers validate, check the permission and call one use case. The use case owns the transaction, applies rules,
runs hooks and writes the outbox event.
   @Controller('v1/customer-invoices')
   @UseGuards(SessionGuard, PermissionGuard)
   export class CustomerInvoicesController {
     constructor(private readonly postInvoice: PostInvoiceUseCase) {}

       @Post(':id/post')
       @Permission('accounting.invoice.post')
       post(
         @Param('id', ParseIntPipe) id: number,
         @Headers('idempotency-key') idempotencyKey: string,
         @CurrentContext() ctx: RequestContext,
       ): Promise<InvoiceResponse> {
         return this.postInvoice.execute({ id, idempotencyKey }, ctx);
       }
   }

   @Injectable()
   export class PostInvoiceUseCase {
     constructor(
       private readonly tx: TransactionRunner,
       private readonly idempotency: IdempotencyService,
       private readonly invoices: InvoiceRepository,
       private readonly numbering: NumberingService,
       private readonly ledger: LedgerService,
       private readonly hooks: HookRegistry,
       private readonly outbox: OutboxService,
     ) {}

       execute(input: PostInvoiceInput, ctx: RequestContext): Promise<InvoiceResponse> {
         return this.idempotency.once(input.idempotencyKey, input, () =>

                            Architecture baseline • Internal engineering reference | 23
```

## PDF page 24

```text
                                                                   ERP ARCHITECTURE REFERENCE | REVISED BASELINE
                this.tx.run(async () => {
                  const invoice = await this.invoices.getForUpdate(input.id, ctx); // scoped + locked
                  assertCanPost(invoice);                                         // pure domain rules
                  await this.hooks.run('accounting.invoice.beforePost', { invoice, ctx });
                  invoice.number = await this.numbering.issue('customer-invoice', invoice, ctx);
                  await this.ledger.postFromInvoice(invoice, ctx); // balanced entry, lock-date check
                  invoice.state = 'posted';
                  await this.outbox.add(new InvoicePosted(invoice.id, ctx.companyId));
                  return toInvoiceResponse(invoice);
                }),
              );
          }
     }


A.4 Hooks
Each module lists its extension points in hooks.ts. Before-hooks run inside the transaction and may throw a
BusinessRuleError to block the action. After-hooks only enqueue work. Hooks receive no ORM objects; they join the
ambient transaction.
     // libs/api/accounting/src/hooks.ts
     export interface AccountingHooks {
       'accounting.invoice.beforePost': { invoice: Invoice; ctx: RequestContext };
       'accounting.invoice.afterPost': { invoice: Invoice; ctx: RequestContext };
     }

     // addons/gst-india/api/hooks/gst-invoice.hook.ts
     @Injectable()
     export class GstInvoiceHook implements OnModuleInit {
       constructor(private readonly hooks: HookRegistry, private readonly gst: GstService) {}

          onModuleInit() {
            this.hooks.on('accounting.invoice.beforePost', async ({ invoice, ctx }) => {
              await this.gst.validateInvoice(invoice, ctx); // GSTIN, place of supply, HSN/SAC
            });
            this.hooks.on('accounting.invoice.afterPost', async ({ invoice, ctx }) => {
              await this.gst.queueEInvoice(invoice, ctx);   // outbox event, handled by a worker job
            });
          }
     }


A.5 Database conventions
        Tables are snake_case and plural (customer_invoices, journal_entry_lines); foreign keys are <entity>_id; indexes
         ix_<table>_<columns>, unique constraints uq_<table>_<columns>, checks ck_<table>_<rule>.
        Add-on tables use the prefix x_<addon>_ with underscores (for example x_gst_india_einvoices).
        Money is numeric(18,2) or the currency precision; quantities numeric(18,4); exchange rates numeric(18,8). In
         TypeScript use a Decimal type (decimal.js), never number.
        Business dates (invoice date, accounting date) are date; moments are timestamptz in UTC.
        Master data is archived with active = false, not deleted. Only drafts may be hard-deleted.
        Translatable fields printed on statutory documents store translations as jsonb, for example name plus
         name_translations = {"ar": "..."}.
    Standard column                 Type                            Purpose
    id                              bigint identity                 Primary key
    company_id                      bigint, foreign key             Owning company; on every company-owned table
    created_at, updated_at          timestamptz (UTC)               Set automatically
    created_by, updated_by          bigint, foreign key to users    Set from RequestContext
    version                         integer                         Optimistic locking for draft edits; mismatch returns 409
    active                          boolean                         Archive instead of delete for master data
    custom                          jsonb                           Custom field values, validated against definitions (A.8)



                                 Architecture baseline • Internal engineering reference | 24
```

## PDF page 25

```text
                                                                ERP ARCHITECTURE REFERENCE | REVISED BASELINE

A.6 List queries, responses and errors
       Query parameters: page, pageSize (maximum 200), sort (comma-separated, "-" for descending), filter[field], and
        q for free-text search.
    GET /api/v1/customer-invoices?page=1&pageSize=50&sort=-invoiceDate
        &filter[state]=posted&filter[partnerId]=12

    {
         "data": [
            { "id": 981, "number": "INV/26-27/0412", "state": "posted",
              "invoiceDate": "2026-11-17", "amountTotal": "118000.00" }
         ],
         "meta": { "page": 1, "pageSize": 50, "total": 1342 }
    }

    {
         "type": "https://erp.example/errors/business-rule",
         "title": "Invoice cannot be posted",
         "status": 422,
         "code": "ACCOUNTING_PERIOD_LOCKED",
         "detail": "The accounting date 2026-03-31 is on or before the lock date.",
         "errors": [{ "field": "lines[2].taxCode", "message": "Tax code is required" }],
         "correlationId": "9f1c2e7a-..."
    }


A.7 Add-on manifest and loading
    addons/gst-india/
    ├── addon.json
    ├── api/
    │   ├── index.ts                       # exports GstIndiaModule
    │   ├── gst-india.module.ts
    │   ├── hooks/
    │   ├── controllers/                   # endpoints under /api/v1/x/gst-india/...
    │   ├── entities/                      # tables prefixed x_gst_india_
    │   ├── migrations/
    │   └── tests/
    └── web/
        ├── routes.ts                      # lazy routes under /x/gst-india
        ├── menu.ts                        # menu entries + required permissions
        └── extensions.ts                  # extra fields, actions or panels on core screens

    {
         "name": "gst-india",
         "version": "1.0.0",
         "depends": ["accounting"],
         "core": "^1.0.0",
         "permissions": ["x.gst_india.einvoice.retry"]
    }

       The API reads the instance's enabled list (ENABLED_ADDONS, from deploy/clients/<client>/addons.json),
        checks depends and core, and imports only those NestJS modules at startup.
       Angular reads the same list from GET /api/v1/system/manifest and registers only those routes and menus;
        disabled add-ons' lazy chunks are never downloaded.


A.8 Custom fields
       custom_field_definitions columns: entity, key, label, type (text, number, money, date, select, boolean,
        many2one), options, required, company_id (null means all companies), show_in (form, list, filter), sequence.
       Values are stored in the entity's custom column and returned by the API as custom: { key: value }.
        CustomFieldService validates every write; add a GIN index when a field is filtered often.


                                Architecture baseline • Internal engineering reference | 25
```

## PDF page 26

```text
                                                                   ERP ARCHITECTURE REFERENCE | REVISED BASELINE

A.9 Angular feature structure
     libs/web/features/accounting/src/
     ├── index.ts                          # exports ACCOUNTING_ROUTES only
     ├── accounting.routes.ts
     ├── pages/                            # routed components: load data, navigate
     │   ├── invoice-list/invoice-list.page.ts
     │   ├── invoice-form/invoice-form.page.ts
     │   └── journal-entry-form/journal-entry-form.page.ts
     ├── components/                       # invoice-lines-editor, tax-summary, allocation-panel
     ├── data/
     │   ├── invoice.api.ts                # thin wrapper over the generated client
     │   └── invoice.store.ts              # signal-based feature state
     └── models/                           # view models only

     export const ACCOUNTING_ROUTES: Routes = [
        { path: '', redirectTo: 'invoices', pathMatch: 'full' },
        {
           path: 'invoices',
           loadComponent: () =>
             import('./pages/invoice-list/invoice-list.page').then((m) => m.InvoiceListPage),
           canActivate: [permissionGuard('accounting.invoice.read')],
        },
        {
           path: 'invoices/:id',
           loadComponent: () =>
             import('./pages/invoice-form/invoice-form.page').then((m) => m.InvoiceFormPage),
           canActivate: [permissionGuard('accounting.invoice.read')],
           canDeactivate: [unsavedChangesGuard],
        },
     ];

        File names are kebab-case with a role suffix: *.page.ts, *.component.ts, *.store.ts, *.api.ts.
        A shared helper maps Problem Details errors[] onto form controls, so server errors appear on the right field.


A.10 Metadata view format
GET /api/v1/metadata/views/{entity}?type=form returns the module default merged with the client's overrides and
custom fields. Overrides may hide, reorder, relabel or make a field required, but never make optional a field the API
requires.
     {
          "entity": "partner",
          "type": "form",
          "sections": [
            {
              "title": "partner.section.general",
              "columns": 2,
              "fields": [
                { "key": "name", "type": "text", "required": true },
                { "key": "gstin", "type": "text" },
                { "key": "paymentTermId", "type": "many2one", "resource": "payment-terms" },
                { "key": "custom.region", "type": "select", "options": ["North", "South"] }
              ]
            }
          ]
     }

    Field type                           Renders as
    text, textarea                       Single-line or multi-line input
    number, money                        Numeric input; money uses currency precision and string values
    date                                 Date picker
    boolean                              Checkbox or toggle
    select                               Dropdown from options

                                 Architecture baseline • Internal engineering reference | 26
```

## PDF page 27

```text
                                                                ERP ARCHITECTURE REFERENCE | REVISED BASELINE
    many2one                           Search-as-you-type picker on resource
    one2many                           Inline editable lines table
    file                               Upload to the attachments API




A.11 Client deployment folder
     deploy/clients/acme/
     ├── addons.json               ["gst-india", "client-acme"]
     ├── .env.example              CLIENT_CODE, database host, storage bucket, SMTP host (no secrets)
     └── compose.override.yml      ports, resources, domain

Secrets live in GitLab protected variables or a secret manager. Business settings live in the client database and are
edited from the administration screens.


A.12 Odoo "ready to invoice" contract
The Odoo adapter sends one message per source document. The new ERP creates a draft invoice or bill through the
Accounting facade and records the source line IDs in integration_links, so the same line is never invoiced twice.
     {
          "source": { "system": "odoo", "model": "sale.order", "id": 4512, "name": "S04512" },
          "documentType": "customer-invoice",
          "companyId": 1,
          "partner": { "odooId": 88 },
          "currency": "INR",
          "lines": [
            {
              "odooLineId": 9921,
              "productOdooId": 301,
              "description": "Steel rod 12 mm",
              "quantity": "10.0000",
              "uom": "Units",
              "unitPrice": "1000.00",
              "taxCodes": ["GST18"]
            }
          ]
     }

        The new ERP sends back invoice number, posting state and payment state per source document, and the Odoo
         bridge module records invoiced quantities per line.
        Messages are idempotent by source model, source ID and line IDs. A changed source document after invoicing
         produces an exception for review, not an automatic re-invoice.


A.13 E-invoicing interface
Core accounting depends only on this interface. Each localization add-on implements it, wrapping the chosen
provider or SDK.
     // libs/api/accounting/src/einvoicing/einvoice-provider.ts
     export interface EInvoiceProvider {
       readonly country: 'IN' | 'SA';

          /** Builds, signs and submits one document. For Saudi Arabia the caller
           * guarantees one document at a time per invoicing unit. */
          submit(doc: StatutoryDocument, unit: InvoicingUnit): Promise<SubmissionResult>;

          /** Polls a pending submission. */
          status(submissionId: string, unit: InvoicingUnit): Promise<SubmissionResult>;
     }

     export interface SubmissionResult {
       state: 'pending' | 'cleared' | 'reported' | 'registered' | 'rejected';

                                Architecture baseline • Internal engineering reference | 27
```

## PDF page 28

```text
                                                               ERP ARCHITECTURE REFERENCE | REVISED BASELINE
         authorityReference?: string;   // India IRN, or the ZATCA response reference
         qrPayload?: string;            // printed on the invoice PDF
         signedPayload?: Buffer;        // archived unchanged (7.4)
         messages: { code: string; text: string }[];
    }

       InvoicingUnit holds the Saudi unit's counter, last hash and certificate reference, or the Indian GSTIN and API
        credentials reference. Secrets stay in the secret manager.
       Rejections become BusinessRuleError details shown to the user; the document stays in the Rejected state and is
        corrected with a new document.




                                Architecture baseline • Internal engineering reference | 28
```
