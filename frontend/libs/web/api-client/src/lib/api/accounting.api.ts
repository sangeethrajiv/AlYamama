import type {
  Account, AnalyticAccount, AnalyticItem, AuditLogEntry, AuditRecordType, Bill, ChequeRecord, CompanyId, CreditNoteOptions,
  FiscalPeriodConfig, Invoice, JournalEntry, Payment, PaymentAllocation,
} from '@erp/shared/contracts';
import type { Decimal } from '@erp/shared/utils';

export interface CreditNoteResult {
  creditNote: Invoice;
  /** Present when the method was "modify": a fresh draft copy to correct and re-issue. */
  redraft?: Invoice;
}

export interface PaymentAllocationRequest {
  invoiceId?: string;
  billId?: string;
}

/**
 * Accounting (sections 8 and 9). State changes are explicit action methods, never silent edits (PATCH must not
 * transition state). Posting/payment/allocation are the calls a real API protects with an Idempotency-Key and
 * company scope; the mock adapter only simulates the effects and is not a transactional store.
 */
export abstract class AccountingApi {
  // ---- queries
  abstract accounts(): Promise<Account[]>;
  abstract analyticAccounts(): Promise<AnalyticAccount[]>;
  abstract analyticItems(): Promise<AnalyticItem[]>;
  abstract invoices(): Promise<Invoice[]>;
  abstract bills(): Promise<Bill[]>;
  abstract payments(): Promise<Payment[]>;
  abstract journalEntries(): Promise<JournalEntry[]>;
  abstract cheques(): Promise<ChequeRecord[]>;
  abstract auditLogs(): Promise<AuditLogEntry[]>;
  abstract fiscalConfig(companyId: CompanyId): Promise<FiscalPeriodConfig>;

  // ---- customer invoices
  /** Create draft or update a draft (the record's id decides). `post` also posts it. */
  abstract saveInvoice(invoice: Invoice, options?: { post?: boolean }): Promise<Invoice>;
  abstract postInvoice(id: string): Promise<Invoice>;
  abstract cancelInvoice(id: string): Promise<Invoice>;
  abstract convertToTaxInvoice(id: string): Promise<Invoice>;
  abstract createCreditNote(invoiceId: string, options?: CreditNoteOptions): Promise<CreditNoteResult>;
  abstract renewProforma(id: string): Promise<Invoice>;
  abstract submitZatca(id: string): Promise<Invoice>;
  abstract unreconcile(invoiceId: string, paymentId: string): Promise<void>;

  // ---- vendor bills
  abstract saveBill(bill: Bill, options?: { post?: boolean }): Promise<Bill>;
  abstract approveBill(id: string): Promise<Bill>;
  abstract rejectBill(id: string, reason: string): Promise<Bill>;

  // ---- payments and reconciliation
  abstract savePayment(payment: Payment, allocation?: PaymentAllocationRequest): Promise<Payment>;
  abstract reconcile(invoiceId: string, paymentId: string, writeOff?: Decimal): Promise<void>;
  abstract bulkReconcile(paymentId: string, allocations: PaymentAllocation[]): Promise<void>;

  // ---- general ledger
  abstract saveJournalEntry(entry: JournalEntry): Promise<JournalEntry>;
  abstract reverseJournalEntry(id: string): Promise<JournalEntry>;
  abstract saveAnalyticItem(item: AnalyticItem): Promise<AnalyticItem>;

  // ---- banking
  abstract clearCheque(id: string): Promise<void>;
  abstract bounceCheque(id: string, reason: string): Promise<void>;
  abstract recordDirectBankTransaction(journalId: string, amount: Decimal, isCharge: boolean, memo: string): Promise<JournalEntry>;

  // ---- fiscal control
  abstract advanceLockDate(companyId: CompanyId, hardLock: string, softLock: string): Promise<FiscalPeriodConfig>;

  // ---- audit trail
  abstract postNote(recordType: AuditRecordType, recordId: string, recordName: string, text: string): Promise<void>;
}
