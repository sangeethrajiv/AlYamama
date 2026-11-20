import type {
  Account, AnalyticAccount, AnalyticItem, AuditLogEntry, Bill, ChequeRecord, Company, Contact, ContactLookups, CurrencyRate,
  FiscalPeriodConfig, Invoice, JournalEntry, Payment, ResPartner, ResUser, ProductState,
} from '@erp/shared/contracts';
import { ACCOUNTING_SPEC, CONTACTS_SPEC, PARTNERS_SPEC, PRODUCT_SPEC, decimalize } from './decimalize';
import * as raw from './raw-accounting.seed';
import { seedContacts as rawSeedContacts } from './raw-contacts.seed';
import { SEED_PARTNERS } from './raw-partners.seed';
import { seedProducts as rawSeedProducts } from './raw-product.seed';
import { RES_USERS } from './users.seed';
import * as lk from './lookups.seed';

export { AUTH_USERS, DEMO_PASSWORD } from './auth-users.seed';

const clone = <T>(v: T): T => structuredClone(v);

export interface AccountingSeed {
  companies: Company[];
  currencies: CurrencyRate[];
  analyticAccounts: AnalyticAccount[];
  accounts: Account[];
  invoices: Invoice[];
  bills: Bill[];
  payments: Payment[];
  journalEntries: JournalEntry[];
  analyticItems: AnalyticItem[];
  cheques: ChequeRecord[];
  auditLogs: AuditLogEntry[];
  fiscalConfig: Record<string, FiscalPeriodConfig>;
}

export function seedAccounting(): AccountingSeed {
  const d = <T>(v: unknown) => decimalize<T>(clone(v), ACCOUNTING_SPEC);
  return {
    companies: clone(raw.mockCompanies) as Company[],
    currencies: d<CurrencyRate[]>(raw.mockCurrencies),
    analyticAccounts: d<AnalyticAccount[]>(raw.mockAnalyticAccounts),
    accounts: d<Account[]>(raw.mockChartOfAccounts),
    invoices: d<Invoice[]>(raw.mockInvoices),
    bills: d<Bill[]>(raw.mockBills),
    payments: d<Payment[]>(raw.mockPayments),
    journalEntries: d<JournalEntry[]>(raw.mockJournalEntries),
    analyticItems: d<AnalyticItem[]>(raw.mockAnalyticItems),
    cheques: d<ChequeRecord[]>(raw.mockCheques),
    auditLogs: clone(raw.mockAuditLogs) as AuditLogEntry[],
    fiscalConfig: d<Record<string, FiscalPeriodConfig>>(raw.mockFiscalConfig),
  };
}

/** The address book is derived from the partners used on the seeded documents, as in the prototype. */
export function seedContactDirectory(): Contact[] {
  return decimalize<Contact[]>(rawSeedContacts(clone(raw.mockInvoices), clone(raw.mockBills)), CONTACTS_SPEC);
}

export const seedPartners = (): ResPartner[] => decimalize<ResPartner[]>(clone(SEED_PARTNERS), PARTNERS_SPEC);
export const seedUsers = (): ResUser[] => clone(RES_USERS);

export function seedProducts(): ProductState {
  return decimalize<ProductState>(rawSeedProducts(), PRODUCT_SPEC);
}

const INDUSTRIES = [
  'Agriculture', 'Oil & Gas', 'Manufacturing', 'Construction', 'Power & Utilities', 'Transportation & Logistics',
  'Wholesale & Retail', 'Engineering Services', 'Petrochemicals', 'Marine & Shipping', 'Financial Services', 'Government',
].map((name, i) => ({ id: i + 1, name }));
const TAGS = ['VIP', 'Key Account', 'Industrial', 'Government', 'Overseas Supplier', 'Distributor', 'Contractor'].map((name, i) => ({ id: i + 1, name }));

export function seedLookups(): ContactLookups {
  return {
    countries: lk.COUNTRIES, states: lk.STATES, titles: lk.TITLES, salesTeams: lk.SALES_TEAMS, jobs: lk.JOBS,
    departments: lk.DEPARTMENTS, employees: lk.EMPLOYEES, companies: lk.COMPANIES, languages: lk.LANGUAGES,
    groups: lk.GROUPS, timezones: lk.TIMEZONES, industries: INDUSTRIES, tags: TAGS,
  };
}
