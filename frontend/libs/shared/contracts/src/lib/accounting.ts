import type { CompanyId, Decimal, IsoDate } from './common';

export type InvoiceState = 'draft' | 'open' | 'in_payment' | 'paid' | 'cancel';
export type InvoiceCategory = 'cash' | 'credit' | 'proforma' | 'progressive';
export type ApprovalStatus = 'not_required' | 'pending_manager' | 'pending_director' | 'approved' | 'rejected';

export interface InvoiceLine {
  id: string;
  subscriptionType?: string;
  subscriptions?: number;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  vehiclesText?: string;
  mainTask?: string;
  category?: string;
  showSeparately?: boolean;
  showLine?: boolean;
  showMainQuantity?: boolean;
  partnerNumberType?: string;
  productSubType?: string;
  product: string;
  description: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  analyticAccountId?: string;
  analyticAccountName?: string;
  mainQuantity?: Decimal;
  quantity: Decimal;
  unitOfMeasure?: string;
  unitPrice: Decimal;
  /** Fraction, e.g. "0.15" for 15% VAT. */
  taxRate: Decimal;
  taxesApplied?: string;
  discount?: Decimal;
  subtotal: Decimal;
  taxAmount: Decimal;
  total: Decimal;
}

export interface ZatcaSubmission {
  status: 'cleared' | 'rejected';
  uuid: string;
  invoiceHash: string;
  chainIndex: number;
  submittedAt: string;
  submittedBy: string;
  message?: string;
}

export interface CreditNoteOptions {
  reason: string;
  date: IsoDate;
  /** draft only / create and reconcile / create, reconcile and re-draft the invoice */
  method: 'draft' | 'cancel' | 'modify';
}

export interface InvoiceVehicle {
  id: string;
  plateNumber: string;
  chassisNumber?: string;
  model?: string;
  gpsDeviceId?: string;
  simNumber?: string;
}

export interface Invoice {
  id: string;
  number: string;
  companyId: CompanyId;
  partner: string;
  customerAddress?: string;
  customerVat?: string;
  isSubscriptionInvoice?: boolean;
  noOfSubscriptionItems?: number;
  subscriptionFrequency?: string;
  subscriptionType?: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  subscriptionAlertDate?: string;
  vehicles?: InvoiceVehicle[];
  project?: string;
  contactPerson?: string;
  paymentTerms: string;
  showDiscount?: boolean;
  vendorProjectName?: string;
  prNumber?: string;
  poNumber?: string;
  invoiceDateWithTime?: string;
  dateInvoice: IsoDate;
  dateDue: IsoDate;
  salesperson?: string;
  equipmentGroupTask?: string;
  sourceDocument?: string;
  companySeal?: boolean;
  showOutFromStock?: boolean;
  isProgressive?: boolean;
  salesTeam?: string;
  journalId: string;
  currency: string;
  currencyRate: Decimal;
  reference?: string;
  lines: InvoiceLine[];
  amountWithoutDiscount?: Decimal;
  discountTotal?: Decimal;
  amountUntaxed: Decimal;
  amountTax: Decimal;
  amountTotal: Decimal;
  /** Amount still due. */
  residual: Decimal;
  state: InvoiceState;
  category?: InvoiceCategory;
  contractAmount?: Decimal;
  previouslyBilled?: Decimal;
  progressPercentage?: Decimal;
  retainageAmount?: Decimal;
  approvalStatus?: ApprovalStatus;
  approvalRejectReason?: string;
  validatedBy?: string;
  validatedAt?: string;
  type: 'out_invoice' | 'out_refund';
  originInvoiceNumber?: string;
  poName?: string;
  poDescription?: string;
  progressiveStatus?: 'draft' | 'approved';
  sourceProformaId?: string;
  billingEmail?: string;
  advPercentage?: Decimal;
  linkedInvoice?: string;
  creditNoteReason?: string;
  zatca?: ZatcaSubmission;
  interCompanyBillRef?: string;
  attachmentsCount: number;
}

export interface Bill {
  id: string;
  number: string;
  supplierInvoiceNumber: string;
  companyId: CompanyId;
  vendor: string;
  vendorVat?: string;
  dateBill: IsoDate;
  dateDue: IsoDate;
  paymentTerms: string;
  journalId: string;
  currency: string;
  currencyRate: Decimal;
  lines: InvoiceLine[];
  amountUntaxed: Decimal;
  amountTax: Decimal;
  amountTotal: Decimal;
  residual: Decimal;
  state: InvoiceState;
  approvalStatus: ApprovalStatus;
  approvalRejectReason?: string;
  type: 'in_invoice' | 'in_refund';
  interCompanyOrigin?: string;
  attachmentsCount: number;
}

export type PaymentMethod = 'Bank Transfer' | 'Mada Debit' | 'Corporate Cheque' | 'Cash';

export interface PaymentAllocation {
  invoiceId: string;
  amount: Decimal;
}

export interface Payment {
  id: string;
  paymentNumber: string;
  companyId: CompanyId;
  partner: string;
  partnerType: 'customer' | 'supplier';
  paymentDate: IsoDate;
  journalId: string;
  journalName: string;
  amount: Decimal;
  currency: string;
  currencyRate: Decimal;
  amountBaseCurrency: Decimal;
  memo: string;
  paymentMethod: PaymentMethod;
  state: 'draft' | 'posted' | 'reconciled' | 'cancelled';
  matchedInvoiceIds?: string[];
  allocations?: PaymentAllocation[];
  chequeNumber?: string;
}

export interface JournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  partner?: string;
  label: string;
  analyticAccountId?: string;
  analyticAccountName?: string;
  amountCurrency?: Decimal;
  currency?: string;
  debit: Decimal;
  credit: Decimal;
  taxesApplied?: string;
  matchingNumber?: string;
  dueDate?: IsoDate;
  quantity?: Decimal;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  companyId: CompanyId;
  entryDate: IsoDate;
  journalId: string;
  journalName: string;
  reference?: string;
  lines: JournalLine[];
  state: 'draft' | 'posted';
  narration?: string;
  internalNote?: string;
  reconciledEntriesCount?: number;
  sourceDocument?: string;
  isReversed?: boolean;
  reversedByEntryId?: string;
}

export interface AnalyticItem {
  id: string;
  date: IsoDate;
  reference: string;
  description: string;
  analyticAccountId: string;
  analyticAccountName: string;
  companyName: string;
  quantity: Decimal;
  amount: Decimal;
  financialAccount?: string;
  journalItem?: string;
  partner?: string;
}

export type AccountType =
  | 'Receivable' | 'Payable' | 'Bank and Cash' | 'Current Assets' | 'Fixed Assets'
  | 'Current Liabilities' | 'Non-current Liabilities' | 'Equity' | 'Income' | 'Expense' | 'Prepayments';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  internalGroup: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  reconcile: boolean;
  active: boolean;
  companyId: CompanyId;
  balance: Decimal;
  currency?: string;
}

export interface AnalyticAccount {
  id: string;
  code: string;
  name: string;
  companyId: CompanyId;
  parentName?: string;
  active: boolean;
  totalDebits: Decimal;
  totalCredits: Decimal;
  balance: Decimal;
}

export interface ChequeRecord {
  id: string;
  chequeNumber: string;
  chequeDate: IsoDate;
  payeeName: string;
  bankName: string;
  amount: Decimal;
  currency: string;
  status: 'issued' | 'presented' | 'cleared' | 'bounced';
  clearanceDate?: IsoDate;
  bounceReason?: string;
  relatedPaymentId?: string;
  relatedInvoiceId?: string;
  companyId: CompanyId;
}

export type AuditRecordType =
  | 'Invoice' | 'Vendor Bill' | 'Payment' | 'Journal Entry' | 'Chart of Accounts' | 'Lock Date' | 'Inventory Adjustment';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  recordType: AuditRecordType;
  recordId: string;
  recordName: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  notes?: string;
}

export interface CurrencyRate {
  currency: string;
  symbol: string;
  name: string;
  rateToBase: Decimal;
  lastUpdated: IsoDate;
  active: boolean;
}

export interface FiscalPeriodConfig {
  companyId: CompanyId;
  fiscalYearStartMonth: number;
  /** Hard lock. */
  periodLockDate: IsoDate;
  /** Soft lock. */
  fiscalYearLockDate: IsoDate;
  retentionYears: number;
  thresholdLevel1: Decimal;
  thresholdLevel2: Decimal;
}

/** Partner/product slices that document forms need (read-only bridge, see directory). */
export interface DirectoryProduct {
  id: string;
  sku: string;
  name: string;
  salePrice: Decimal;
  taxRate: Decimal;
  canSell: boolean;
  uom: string;
  active: boolean;
}
