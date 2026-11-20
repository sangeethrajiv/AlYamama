import { Injectable, inject } from '@angular/core';
import { PERM, type CompanyId, type CurrencyRate, type ManifestItem, type NavBadges, type SystemManifest } from '@erp/shared/contracts';
import { SystemApi } from '../api/system.api';
import { MockDb } from './mock-db';

const item = (id: string, labelKey: string, extra: Partial<ManifestItem> = {}): ManifestItem => ({ id, labelKey, ...extra });

/** Navigation as served by GET /api/v1/system/manifest. Add-ons would append their own menus here. */
const MENU: ManifestItem[] = [
  item('dashboard', 'nav.dashboard', { icon: 'layout-dashboard', path: '/dashboard', permission: PERM.dashboard.read }),
  item('customers', 'nav.m.customers', {
    icon: 'users',
    children: [
      item('c-invoices', 'nav.m.c-invoices', { icon: 'file-text', path: '/accounting/customer-invoices', permission: PERM.invoice.read }),
      item('c-cash', 'nav.m.c-cash', { icon: 'banknote', path: '/accounting/cash-invoices', permission: PERM.invoice.read }),
      item('c-credit', 'nav.m.c-credit', { icon: 'file-text', path: '/accounting/credit-invoices', permission: PERM.invoice.read }),
      item('c-proforma', 'nav.m.c-proforma', { icon: 'file-text', path: '/accounting/proforma-invoices', permission: PERM.invoice.read }),
      item('c-progressive', 'nav.m.c-progressive', { icon: 'file-text', path: '/accounting/progressive-invoices', permission: PERM.invoice.read }),
      item('c-notes', 'nav.m.c-notes', { icon: 'file-text', path: '/accounting/credit-notes', permission: PERM.invoice.read }),
      item('c-internal', 'nav.m.c-internal', { icon: 'arrow-left-right', path: '/accounting/internal-vouchers', permission: PERM.payment.read }),
      item('c-payments', 'nav.m.c-payments', { icon: 'credit-card', path: '/accounting/customer-payments', permission: PERM.payment.read }),
      item('c-products', 'nav.m.c-products', { icon: 'package', path: '/product/products', permission: PERM.inventory.read }),
      item('c-customers', 'nav.m.c-customers', { icon: 'user-check', path: '/contacts/directory/customers', permission: PERM.contact.read }),
    ],
  }),
  item('vendors', 'nav.m.vendors', {
    icon: 'truck',
    children: [
      item('v-bills', 'nav.m.v-bills', { icon: 'receipt', path: '/accounting/vendor-bills', permission: PERM.bill.read }),
      item('v-toapprove', 'nav.m.v-toapprove', { icon: 'file-check-2', path: '/accounting/bills-to-approve', permission: PERM.bill.read }),
      item('v-approved', 'nav.m.v-approved', { icon: 'check-check', path: '/accounting/bills-approved', permission: PERM.bill.read }),
      item('v-refund', 'nav.m.v-refund', { icon: 'file-text', path: '/accounting/vendor-refunds', permission: PERM.bill.read }),
      item('v-voucher', 'nav.m.v-voucher', { icon: 'receipt', path: '/accounting/payable-vouchers', permission: PERM.payment.read }),
      item('v-payments', 'nav.m.v-payments', { icon: 'credit-card', path: '/accounting/vendor-payments', permission: PERM.payment.read }),
      item('v-products', 'nav.m.v-products', { icon: 'package', path: '/product/products', permission: PERM.inventory.read }),
      item('v-vendors', 'nav.m.v-vendors', { icon: 'truck', path: '/contacts/directory/vendors', permission: PERM.contact.read }),
    ],
  }),
  item('accounting', 'nav.m.accounting', {
    icon: 'book-open',
    children: [
      item('a-overview', 'nav.m.a-overview', { icon: 'layout-dashboard', path: '/accounting/overview', permission: PERM.invoice.read }),
      item('a-entries', 'nav.m.a-entries', { icon: 'scale', path: '/accounting/journal-entries', permission: PERM.journalEntry.read, sectionKey: 'nav.s.accounting-entries' }),
      item('a-items', 'nav.m.a-items', { icon: 'list', path: '/accounting/journal-items', permission: PERM.journalEntry.read }),
      item('a-analytic', 'nav.m.a-analytic', { icon: 'layers', path: '/accounting/analytic-items', permission: PERM.account.read }),
      item('a-assets', 'nav.m.a-assets', { icon: 'building', path: '/accounting/assets', permission: PERM.account.read, sectionKey: 'nav.s.management' }),
      item('a-rental', 'nav.m.a-rental', { icon: 'building', path: '/accounting/asset-rental', permission: PERM.account.read }),
      item('a-recon', 'nav.m.a-recon', { icon: 'file-check-2', path: '/accounting/reconciliation', permission: PERM.reconciliation.read, sectionKey: 'nav.s.actions' }),
      item('a-bank', 'nav.m.a-bank', { icon: 'landmark', path: '/accounting/bank-statements', permission: PERM.bank.read }),
      item('a-taxadj', 'nav.m.a-taxadj', { icon: 'scale', path: '/accounting/tax-adjustments', permission: PERM.journalEntry.post }),
      item('a-genassets', 'nav.m.a-genassets', { icon: 'building', path: '/accounting/generate-asset-entries', permission: PERM.journalEntry.post, sectionKey: 'nav.s.generate-entries' }),
    ],
  }),
  item('reporting', 'nav.m.reporting', {
    icon: 'bar-chart-3',
    children: [
      item('r-tb', 'nav.m.r-tb', { icon: 'bar-chart-3', path: '/accounting/report/trial-balance', permission: PERM.report.read, sectionKey: 'nav.s.ledgers' }),
      item('r-gl', 'nav.m.r-gl', { icon: 'book-open', path: '/accounting/report/general-ledger', permission: PERM.report.read }),
      item('r-pl', 'nav.m.r-pl', { icon: 'users', path: '/accounting/report/partner-ledger', permission: PERM.report.read }),
      item('r-ar', 'nav.m.r-ar', { icon: 'bar-chart-3', path: '/accounting/report/aged-receivable', permission: PERM.report.read, sectionKey: 'nav.s.partners' }),
      item('r-ap', 'nav.m.r-ap', { icon: 'bar-chart-3', path: '/accounting/report/aged-payable', permission: PERM.report.read }),
      item('r-pnl', 'nav.m.r-pnl', { icon: 'bar-chart-3', path: '/accounting/report/profit-loss', permission: PERM.report.read, sectionKey: 'nav.s.statements' }),
      item('r-bs', 'nav.m.r-bs', { icon: 'bar-chart-3', path: '/accounting/report/balance-sheet', permission: PERM.report.read }),
      item('r-tax', 'nav.m.r-tax', { icon: 'bar-chart-3', path: '/accounting/report/tax-report', permission: PERM.report.read }),
      item('r-js', 'nav.m.r-js', { icon: 'list', path: '/accounting/report/journal-summary', permission: PERM.report.read, sectionKey: 'nav.s.audit' }),
    ],
  }),
  item('configuration', 'nav.m.configuration', {
    icon: 'settings',
    children: [
      item('k-settings', 'nav.m.k-settings', { icon: 'settings', path: '/accounting/settings', permission: PERM.settings.read }),
      item('k-currencies', 'nav.m.k-currencies', { icon: 'banknote', path: '/accounting/currencies', permission: PERM.account.read, sectionKey: 'nav.s.accounting' }),
      item('k-rates', 'nav.m.k-rates', { icon: 'banknote', path: '/accounting/currency-rates', permission: PERM.account.read }),
      item('k-coa', 'nav.m.k-coa', { icon: 'book-open', path: '/accounting/chart-of-accounts', permission: PERM.account.read }),
      item('k-types', 'nav.m.k-types', { icon: 'tags', path: '/accounting/account-types', permission: PERM.account.read }),
      item('k-groups', 'nav.m.k-groups', { icon: 'layers', path: '/accounting/account-groups', permission: PERM.account.read }),
      item('k-taxes', 'nav.m.k-taxes', { icon: 'tags', path: '/accounting/taxes', permission: PERM.account.read }),
      item('k-taxgroups', 'nav.m.k-taxgroups', { icon: 'layers', path: '/accounting/tax-groups', permission: PERM.account.read }),
      item('k-fiscalpos', 'nav.m.k-fiscalpos', { icon: 'scale', path: '/accounting/fiscal-positions', permission: PERM.account.read }),
      item('k-fiscalyear', 'nav.m.k-fiscalyear', { icon: 'clock', path: '/accounting/fiscal-years', permission: PERM.account.read }),
      item('k-journals', 'nav.m.k-journals', { icon: 'book-open', path: '/accounting/journals', permission: PERM.account.read }),
      item('k-incoterms', 'nav.m.k-incoterms', { icon: 'truck', path: '/accounting/incoterms', permission: PERM.account.read }),
      item('k-recmodels', 'nav.m.k-recmodels', { icon: 'file-check-2', path: '/accounting/reconcile-models', permission: PERM.account.read }),
      item('k-terms', 'nav.m.k-terms', { icon: 'clock', path: '/accounting/payment-terms', permission: PERM.account.read, sectionKey: 'nav.s.management' }),
      item('k-assettypes', 'nav.m.k-assettypes', { icon: 'building', path: '/accounting/asset-types', permission: PERM.account.read }),
      item('k-analytic', 'nav.m.k-analytic', { icon: 'layers', path: '/accounting/analytic-accounts', permission: PERM.account.read, sectionKey: 'nav.s.analytic-accounting' }),
      item('k-analyticgroups', 'nav.m.k-analyticgroups', { icon: 'layers', path: '/accounting/analytic-groups', permission: PERM.account.read }),
      item('k-acquirers', 'nav.m.k-acquirers', { icon: 'credit-card', path: '/accounting/payment-acquirers', permission: PERM.account.read, sectionKey: 'nav.s.payments' }),
      item('k-reports', 'nav.m.k-reports', { icon: 'bar-chart-3', path: '/accounting/report/trial-balance', permission: PERM.report.read, sectionKey: 'nav.s.financial-reports' }),
      item('k-audit', 'nav.audit', { icon: 'history', path: '/administration/audit', permission: PERM.audit.read, sectionKey: 'nav.s.administration' }),
      item('k-company-settings', 'nav.settings', { icon: 'settings', path: '/administration/settings', permission: PERM.settings.read }),
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
