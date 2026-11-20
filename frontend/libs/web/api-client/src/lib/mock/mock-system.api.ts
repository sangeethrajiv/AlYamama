import { Injectable, inject } from '@angular/core';
import { PERM, type CompanyId, type CurrencyRate, type ManifestItem, type NavBadges, type SystemManifest } from '@erp/shared/contracts';
import { SystemApi } from '../api/system.api';
import { MockDb } from './mock-db';

const item = (id: string, labelKey: string, extra: Partial<ManifestItem> = {}): ManifestItem => ({ id, labelKey, ...extra });

/** Navigation as served by GET /api/v1/system/manifest. Add-ons would append their own menus here. */
const MENU: ManifestItem[] = [
  item('dashboard', 'nav.dashboard', { icon: 'layout-dashboard', path: '/dashboard', permission: PERM.dashboard.read }),
  item('accounting', 'nav.accounting', {
    icon: 'book-open',
    children: [
      item('invoices', 'nav.invoices', {
        icon: 'file-text', path: '/accounting/invoices', badge: 'openInvoices', permission: PERM.invoice.read, sectionKey: 'nav.section.bookkeeping',
        children: [
          item('invoices-cash', 'nav.invoicesCash', { path: '/accounting/invoices', queryParams: { category: 'cash' }, badge: 'invoice.cash' }),
          item('invoices-credit', 'nav.invoicesCredit', { path: '/accounting/invoices', queryParams: { category: 'credit' }, badge: 'invoice.credit' }),
          item('invoices-proforma', 'nav.invoicesProforma', { path: '/accounting/invoices', queryParams: { category: 'proforma' }, badge: 'invoice.proforma' }),
          item('invoices-progressive', 'nav.invoicesProgressive', { path: '/accounting/invoices', queryParams: { category: 'progressive' }, badge: 'invoice.progressive' }),
        ],
      }),
      item('bills', 'nav.bills', { icon: 'receipt', path: '/accounting/bills', badge: 'openBills', permission: PERM.bill.read }),
      item('payments', 'nav.payments', { icon: 'credit-card', path: '/accounting/payments', permission: PERM.payment.read }),
      item('reconciliation', 'nav.reconciliation', { icon: 'file-check-2', path: '/accounting/reconciliation', badge: 'unreconciled', permission: PERM.reconciliation.read }),
      item('journal-entries', 'nav.journalEntries', { icon: 'scale', path: '/accounting/journal-entries', permission: PERM.journalEntry.read, sectionKey: 'nav.section.ledger' }),
      item('chart-of-accounts', 'nav.chartOfAccounts', { icon: 'book-open', path: '/accounting/chart-of-accounts', permission: PERM.account.read }),
      item('banking', 'nav.banking', { icon: 'landmark', path: '/accounting/banking', permission: PERM.bank.read }),
      item('reports', 'nav.reports', { icon: 'bar-chart-3', path: '/reports', permission: PERM.report.read, sectionKey: 'nav.section.governance' }),
      item('audit', 'nav.audit', { icon: 'history', path: '/administration/audit', permission: PERM.audit.read }),
      item('settings', 'nav.settings', { icon: 'settings', path: '/administration/settings', permission: PERM.settings.read }),
    ],
  }),
  item('users', 'nav.users', {
    icon: 'users',
    children: [
      item('users-all', 'nav.usersAll', { icon: 'users', path: '/contacts/users', permission: PERM.user.read }),
      item('users-customers', 'nav.usersCustomers', { icon: 'user-check', path: '/contacts/directory/customers', permission: PERM.contact.read, sectionKey: 'nav.section.partners' }),
      item('users-vendors', 'nav.usersVendors', { icon: 'truck', path: '/contacts/directory/vendors', permission: PERM.contact.read }),
      item('users-employees', 'nav.usersEmployees', { icon: 'id-card', path: '/contacts/directory/employees', permission: PERM.contact.read, sectionKey: 'nav.section.people' }),
      item('users-logins', 'nav.usersLogins', { icon: 'key-round', path: '/contacts/directory/logins', permission: PERM.contact.read }),
      item('users-other', 'nav.usersOther', { icon: 'landmark', path: '/contacts/directory/other', permission: PERM.contact.read, sectionKey: 'nav.section.other' }),
      item('users-archived', 'nav.usersArchived', { icon: 'archive', path: '/contacts/directory/archived', permission: PERM.contact.read }),
    ],
  }),
  item('contact', 'nav.contact', { icon: 'contact', path: '/contacts/master', permission: PERM.contact.read }),
  item('product', 'nav.product', {
    icon: 'package',
    children: [
      item('prod-overview', 'nav.productOverview', { icon: 'gauge', path: '/product/overview', permission: PERM.inventory.read }),
      item('prod-products', 'nav.productProducts', { icon: 'package', path: '/product/products', permission: PERM.inventory.read, sectionKey: 'nav.section.masterData' }),
      item('prod-categories', 'nav.productCategories', { icon: 'tags', path: '/product/categories', permission: PERM.inventory.read }),
      item('prod-uom', 'nav.productUom', { icon: 'layers', path: '/product/uom', permission: PERM.inventory.read }),
      item('prod-uom-categories', 'nav.productUomCategories', { icon: 'tags', path: '/product/uom-categories', permission: PERM.inventory.read }),
    ],
  }),
];

@Injectable()
export class MockSystemApi extends SystemApi {
  private readonly db = inject(MockDb);

  override async manifest(): Promise<SystemManifest> {
    return { version: '1.0.0', enabledAddons: [], menu: structuredClone(MENU) };
  }

  override async currencies(): Promise<CurrencyRate[]> {
    return structuredClone(this.db.accounting.currencies);
  }

  override async badges(companyId: CompanyId): Promise<NavBadges> {
    void companyId; // The prototype does not filter documents by company (see baseline summary 5).
    const { invoices, bills, payments } = this.db.accounting;
    const open = (s: string) => s === 'open' || s === 'in_payment';
    const cat = (c: string) => invoices.filter(i => (i.category || 'credit') === c).length;
    return {
      openInvoices: invoices.filter(i => open(i.state)).length,
      openBills: bills.filter(b => open(b.state)).length,
      unreconciled: payments.filter(p => p.state === 'posted' && p.partnerType === 'customer').length,
      'invoice.cash': cat('cash'),
      'invoice.credit': cat('credit'),
      'invoice.proforma': cat('proforma'),
      'invoice.progressive': cat('progressive'),
    };
  }
}
