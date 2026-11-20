import { Injectable, effect, inject, signal } from '@angular/core';
import { AccountingApi, DataChanges } from '@erp/web/api-client';
import type { Account, AnalyticAccount, AnalyticItem, AuditLogEntry, Bill, ChequeRecord, Invoice, JournalEntry, Payment } from '@erp/shared/contracts';

/** Feature-local state for accounting: signals filled from AccountingApi and refreshed whenever data changes. */
@Injectable({ providedIn: 'root' })
export class AccountingStore {
  readonly api = inject(AccountingApi);
  private readonly changes = inject(DataChanges);

  readonly accounts = signal<Account[]>([]);
  readonly analyticAccounts = signal<AnalyticAccount[]>([]);
  readonly analyticItems = signal<AnalyticItem[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly bills = signal<Bill[]>([]);
  readonly payments = signal<Payment[]>([]);
  readonly journalEntries = signal<JournalEntry[]>([]);
  readonly cheques = signal<ChequeRecord[]>([]);
  readonly auditLogs = signal<AuditLogEntry[]>([]);
  readonly loaded = signal(false);

  constructor() {
    effect(() => {
      this.changes.revision();
      void this.reload();
    });
  }

  async reload(): Promise<void> {
    const [accounts, analyticAccounts, analyticItems, invoices, bills, payments, journalEntries, cheques, auditLogs] = await Promise.all([
      this.api.accounts(), this.api.analyticAccounts(), this.api.analyticItems(), this.api.invoices(), this.api.bills(), this.api.payments(),
      this.api.journalEntries(), this.api.cheques(), this.api.auditLogs(),
    ]);
    this.accounts.set(accounts);
    this.analyticAccounts.set(analyticAccounts);
    this.analyticItems.set(analyticItems);
    this.invoices.set(invoices);
    this.bills.set(bills);
    this.payments.set(payments);
    this.journalEntries.set(journalEntries);
    this.cheques.set(cheques);
    this.auditLogs.set(auditLogs);
    this.loaded.set(true);
  }

  invoiceById(id: string): Invoice | undefined { return this.invoices().find(i => i.id === id); }
  billById(id: string): Bill | undefined { return this.bills().find(b => b.id === id); }
}
