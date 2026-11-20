import type { Routes } from '@angular/router';
import { permissionGuard, unsavedChangesGuard } from '@erp/web/core';
import { PERM } from '@erp/shared/contracts';
import { provideTranslocoScope } from '@jsverse/transloco';

/** Lazy dictionary for this feature. The files are keyed `accounting.*`; a scope nests under its own name, so unwrap one level. */
const scope = provideTranslocoScope({
  scope: 'accounting',
  loader: { en: () => import('./i18n/en.json').then(m => m.default.accounting), ar: () => import('./i18n/ar.json').then(m => m.default.accounting) },
});

export const ACCOUNTING_ROUTES: Routes = [
  {
    path: '',
    providers: [scope],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'invoices' },
      { path: 'invoices', canActivate: [permissionGuard(PERM.invoice.read)], title: 'Invoices', loadComponent: () => import('./pages/invoice-list.page').then(m => m.InvoiceListPage) },
      { path: 'invoices/new', canActivate: [permissionGuard(PERM.invoice.write)], canDeactivate: [unsavedChangesGuard], title: 'New invoice', loadComponent: () => import('./pages/invoice-form.page').then(m => m.InvoiceFormPage) },
      { path: 'invoices/:id', canActivate: [permissionGuard(PERM.invoice.read)], canDeactivate: [unsavedChangesGuard], title: 'Invoice', loadComponent: () => import('./pages/invoice-form.page').then(m => m.InvoiceFormPage) },
      { path: 'bills', canActivate: [permissionGuard(PERM.bill.read)], title: 'Vendor bills', loadComponent: () => import('./pages/bill-list.page').then(m => m.BillListPage) },
      { path: 'bills/new', canActivate: [permissionGuard(PERM.bill.write)], canDeactivate: [unsavedChangesGuard], title: 'New vendor bill', loadComponent: () => import('./pages/bill-form.page').then(m => m.BillFormPage) },
      { path: 'bills/:id', canActivate: [permissionGuard(PERM.bill.read)], canDeactivate: [unsavedChangesGuard], title: 'Vendor bill', loadComponent: () => import('./pages/bill-form.page').then(m => m.BillFormPage) },
      { path: 'payments', canActivate: [permissionGuard(PERM.payment.read)], title: 'Payments & receipts', loadComponent: () => import('./pages/payments.page').then(m => m.PaymentsPage) },
      { path: 'reconciliation', canActivate: [permissionGuard(PERM.reconciliation.read)], title: 'Reconciliation', loadComponent: () => import('./pages/reconciliation.page').then(m => m.ReconciliationPage) },
      { path: 'banking', canActivate: [permissionGuard(PERM.bank.read)], title: 'Banking & cheques', loadComponent: () => import('./pages/banking.page').then(m => m.BankingPage) },
      { path: 'journal-entries', canActivate: [permissionGuard(PERM.journalEntry.read)], title: 'Journal entries', loadComponent: () => import('./pages/journal-entries.page').then(m => m.JournalEntriesPage) },
      { path: 'chart-of-accounts', canActivate: [permissionGuard(PERM.account.read)], title: 'Chart of accounts', loadComponent: () => import('./pages/chart-of-accounts.page').then(m => m.ChartOfAccountsPage) },
    ],
  },
];
