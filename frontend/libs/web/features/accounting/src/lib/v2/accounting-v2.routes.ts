import type { Route } from '@angular/router';
import { permissionGuard } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { DOC_KINDS } from './kinds';

/**
 * Routes of the id-based accounting screens that talk to the Express backend (`/v2/accounting`).
 * One route set per menu entry: documents (invoices, bills, credit notes), generic resource screens (config, vouchers,
 * payments, journal entries, assets), and a few dedicated pages (reconciliation, bank statements, reports, settings).
 */
const listPage = () => import('./document-list.page').then(m => m.DocumentListPage);
const formPage = () => import('./document-form.page').then(m => m.DocumentFormPage);
const resList = () => import('./resource-list.page').then(m => m.ResourceListPage);
const resForm = () => import('./resource-form.page').then(m => m.ResourceFormPage);

const guard = (p: string) => [permissionGuard(p as never)];

/** [resource key, path, permission] for every screen built from a ResourceSpec. */
const RESOURCES: [string, string, string][] = [
  ['accounts', 'chart-of-accounts', PERM.account.read], ['account-types', 'account-types', PERM.account.read], ['account-groups', 'account-groups', PERM.account.read],
  ['taxes', 'taxes', PERM.account.read], ['tax-groups', 'tax-groups', PERM.account.read], ['payment-terms', 'payment-terms', PERM.account.read],
  ['fiscal-positions', 'fiscal-positions', PERM.account.read], ['journals', 'journals', PERM.account.read], ['currencies', 'currencies', PERM.account.read],
  ['currency-rates', 'currency-rates', PERM.account.read], ['incoterms', 'incoterms', PERM.account.read], ['reconcile-models', 'reconcile-models', PERM.account.read],
  ['fiscal-years', 'fiscal-years', PERM.account.read], ['analytic-accounts', 'analytic-accounts', PERM.account.read], ['analytic-groups', 'analytic-groups', PERM.account.read],
  ['analytic-items', 'analytic-items', PERM.account.read], ['asset-types', 'asset-types', PERM.account.read], ['assets', 'assets', PERM.account.read],
  ['internal-vouchers', 'internal-vouchers', PERM.payment.read], ['payable-vouchers', 'payable-vouchers', PERM.payment.read],
  ['customer-payments', 'customer-payments', PERM.payment.read], ['vendor-payments', 'vendor-payments', PERM.payment.read],
  ['journal-entries', 'journal-entries', PERM.journalEntry.read],
];

const docRoutes = (): Route[] => DOC_KINDS.flatMap(k => {
  const read = k.moveType.startsWith('in_') ? PERM.bill.read : PERM.invoice.read;
  const write = k.moveType.startsWith('in_') ? PERM.bill.write : PERM.invoice.write;
  const data = { kind: k.key };
  return [
    { path: k.path, title: k.title, data, canActivate: guard(read), loadComponent: listPage },
    ...(k.noNew ? [] : [{ path: `${k.path}/new`, title: `New ${k.singular}`, data, canActivate: guard(write), loadComponent: formPage }]),
    { path: `${k.path}/:id`, title: k.singular, data, canActivate: guard(read), loadComponent: formPage },
  ];
});

const resourceRoutes = (): Route[] => RESOURCES.flatMap(([resource, path, perm]) => {
  const data = { resource };
  return [
    { path, data, canActivate: guard(perm), loadComponent: resList },
    { path: `${path}/new`, data, canActivate: guard(perm), loadComponent: resForm },
    { path: `${path}/:id`, data, canActivate: guard(perm), loadComponent: resForm },
  ];
});

export const V2_ROUTES: Route[] = [
  { path: 'overview', title: 'Accounting Overview', canActivate: guard(PERM.invoice.read), loadComponent: () => import('./dashboard.page').then(m => m.AccountingDashboardPage) },
  ...docRoutes(),
  ...resourceRoutes(),
  { path: 'journal-items', title: 'Journal Items', data: { mode: 'items' }, canActivate: guard(PERM.journalEntry.read), loadComponent: () => import('./journal-items.page').then(m => m.JournalItemsPage) },
  { path: 'reconciliation', title: 'Reconciliation', data: { mode: 'reconcile' }, canActivate: guard(PERM.reconciliation.read), loadComponent: () => import('./journal-items.page').then(m => m.JournalItemsPage) },
  { path: 'bank-statements', title: 'Bank Statements', canActivate: guard(PERM.bank.read), loadComponent: () => import('./bank-statements.page').then(m => m.BankStatementsPage) },
  { path: 'bank-statements/:id', title: 'Bank Statement', canActivate: guard(PERM.bank.read), loadComponent: () => import('./bank-statements.page').then(m => m.BankStatementsPage) },
  { path: 'report/:report', title: 'Reports', canActivate: guard(PERM.report.read), loadComponent: () => import('./reports.page').then(m => m.AccountingReportsPage) },
  { path: 'settings', title: 'Accounting Settings', canActivate: guard(PERM.settings.read), loadComponent: () => import('./small-pages').then(m => m.AccountingSettingsPage) },
  { path: 'tax-adjustments', title: 'Tax Adjustments', canActivate: guard(PERM.journalEntry.post), loadComponent: () => import('./small-pages').then(m => m.TaxAdjustmentPage) },
  { path: 'generate-asset-entries', title: 'Generate Assets Entries', canActivate: guard(PERM.journalEntry.post), loadComponent: () => import('./small-pages').then(m => m.GenerateAssetsPage) },
  { path: 'asset-rental', title: 'Asset Rental', data: { title: 'Asset Rental', app: 'Asset Rental' }, canActivate: guard(PERM.account.read), loadComponent: () => import('./small-pages').then(m => m.ExternalAppPage) },
  { path: 'payment-acquirers', title: 'Payment Acquirers', data: { title: 'Payment Acquirers', app: 'Payment Providers' }, canActivate: guard(PERM.account.read), loadComponent: () => import('./small-pages').then(m => m.ExternalAppPage) },
];
