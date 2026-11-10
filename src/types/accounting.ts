export type CompanyId = 'co_1' | 'co_2' | 'co_3' | 'co_4' | 'co_5'

export interface Company {
  id: CompanyId
  name: string
  legalName: string
  crNumber: string
  vatNumber: string
  baseCurrency: string
  city: string
  code: string
}

export type UserRole = 
  | 'Finance Director'
  | 'Accounts Manager'
  | 'Senior Accountant'
  | 'Accountant'
  | 'Auditor'

export type TabId = 
  | 'dashboard'
  | 'invoices'
  | 'bills'
  | 'payments'
  | 'reconcile'
  | 'journals'
  | 'coa'
  | 'banking'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'inventory'

export type DrawerType = 
  | 'invoice' 
  | 'bill' 
  | 'payment' 
  | 'journal' 
  | 'reconcile'
  | 'cheque' 
  | 'bank_tx'
  | 'lock_wizard'
  | null

// Invoice States: draft, open, in_payment, paid, cancel
export type InvoiceState = 'draft' | 'open' | 'in_payment' | 'paid' | 'cancel'

export type InvoiceCategory = 'cash' | 'credit' | 'proforma' | 'progressive'

export interface InvoiceLine {
  id: string
  // Proforma line fields
  subscriptionType?: string
  subscriptions?: number
  frequency?: string
  startDate?: string
  endDate?: string
  vehiclesText?: string
  mainTask?: string
  category?: string
  showSeparately?: boolean
  showLine?: boolean
  showMainQuantity?: boolean
  partnerNumberType?: string
  productSubType?: string
  product: string
  description: string
  accountId?: string
  accountCode?: string
  accountName?: string
  analyticAccountId?: string
  analyticAccountName?: string
  mainQuantity?: number
  quantity: number
  unitOfMeasure?: string // EA, PCS, etc.
  unitPrice: number
  taxRate: number // e.g. 0.15 for 15% VAT
  taxesApplied?: string // e.g. 'VAT 15%'
  discount?: number
  subtotal: number
  taxAmount: number
  total: number
}

export interface ZatcaSubmission {
  status: 'cleared' | 'rejected'
  uuid: string
  invoiceHash: string
  chainIndex: number
  submittedAt: string
  submittedBy: string
  message?: string
}

export interface CreditNoteOptions {
  reason: string
  date: string
  method: 'draft' | 'cancel' | 'modify' // draft only / create and reconcile / create, reconcile and re-draft the invoice
}

export interface Invoice {
  id: string
  number: string // Sequence e.g. INV/2026/0042, CRH2026-10551
  companyId: CompanyId
  partner: string // Customer
  customerAddress?: string
  customerVat?: string
  isSubscriptionInvoice?: boolean
  noOfSubscriptionItems?: number
  subscriptionFrequency?: string
  subscriptionType?: string
  subscriptionStartDate?: string
  subscriptionEndDate?: string
  subscriptionAlertDate?: string
  vehicles?: {
    id: string
    plateNumber: string
    chassisNumber?: string
    model?: string
    gpsDeviceId?: string
    simNumber?: string
  }[]
  project?: string
  contactPerson?: string
  paymentTerms: string
  showDiscount?: boolean
  vendorProjectName?: string
  prNumber?: string
  poNumber?: string
  invoiceDateWithTime?: string
  dateInvoice: string // YYYY-MM-DD
  dateDue: string // YYYY-MM-DD
  salesperson?: string
  equipmentGroupTask?: string
  sourceDocument?: string
  companySeal?: boolean
  showOutFromStock?: boolean
  isProgressive?: boolean
  salesTeam?: string
  journalId: string
  currency: string
  currencyRate: number // e.g. 1.0 for SAR, 3.75 for USD
  reference?: string // Customer PO / ref
  lines: InvoiceLine[]
  amountWithoutDiscount?: number
  discountTotal?: number
  amountUntaxed: number
  amountTax: number
  amountTotal: number
  residual: number // Amount due
  state: InvoiceState
  category?: InvoiceCategory
  // Progressive / Milestone billing attributes
  contractAmount?: number
  previouslyBilled?: number
  progressPercentage?: number
  retainageAmount?: number
  approvalStatus?: 'not_required' | 'pending_manager' | 'pending_director' | 'approved' | 'rejected'
  approvalRejectReason?: string
  validatedBy?: string
  validatedAt?: string
  type: 'out_invoice' | 'out_refund' // Invoice vs Customer Credit Note
  originInvoiceNumber?: string // If credit note
  // Progressive PO fields (PO total uses contractAmount)
  poName?: string
  poDescription?: string
  progressiveStatus?: 'draft' | 'approved'
  sourceProformaId?: string // invoice created from a proforma
  // Proforma header fields
  billingEmail?: string
  advPercentage?: number
  linkedInvoice?: string
  creditNoteReason?: string
  zatca?: ZatcaSubmission
  interCompanyBillRef?: string // Traceability to Co B bill
  attachmentsCount: number
}

export interface Bill {
  id: string
  number: string // Sequence e.g. BILL/2026/0018
  supplierInvoiceNumber: string // Vendor's own reference
  companyId: CompanyId
  vendor: string
  vendorVat?: string
  dateBill: string
  dateDue: string
  paymentTerms: string
  journalId: string
  currency: string
  currencyRate: number
  lines: InvoiceLine[]
  amountUntaxed: number
  amountTax: number
  amountTotal: number
  residual: number
  state: InvoiceState
  approvalStatus: 'not_required' | 'pending_manager' | 'pending_director' | 'approved' | 'rejected'
  approvalRejectReason?: string
  type: 'in_invoice' | 'in_refund' // Bill vs Vendor Credit Note
  interCompanyOrigin?: string // If created by auto-intercompany
  attachmentsCount: number
}

export type PaymentMethod = 'Bank Transfer' | 'Mada Debit' | 'Corporate Cheque' | 'Cash'

export interface Payment {
  id: string
  paymentNumber: string // e.g. PAY/2026/0088
  companyId: CompanyId
  partner: string
  partnerType: 'customer' | 'supplier'
  paymentDate: string
  journalId: string
  journalName: string
  amount: number
  currency: string
  currencyRate: number
  amountBaseCurrency: number
  memo: string
  paymentMethod: PaymentMethod
  state: 'draft' | 'posted' | 'reconciled' | 'cancelled'
  matchedInvoiceIds?: string[]
  allocations?: { invoiceId: string; amount: number }[]
  chequeNumber?: string
}

export interface JournalLine {
  id: string
  accountId: string
  accountCode: string
  accountName: string
  partner?: string
  label: string
  analyticAccountId?: string
  analyticAccountName?: string
  amountCurrency?: number
  currency?: string
  debit: number
  credit: number
  taxesApplied?: string
  matchingNumber?: string
  dueDate?: string
  quantity?: number
}

export interface JournalEntry {
  id: string
  entryNumber: string // e.g. MISC/2026/0014, STJ/2026/0018, T26-1677
  companyId: CompanyId
  entryDate: string
  journalId: string
  journalName: string
  reference?: string
  lines: JournalLine[]
  state: 'draft' | 'posted'
  narration?: string
  internalNote?: string
  reconciledEntriesCount?: number
  sourceDocument?: string
  isReversed?: boolean
  reversedByEntryId?: string
}

export interface AnalyticItem {
  id: string
  date: string
  reference: string
  description: string
  analyticAccountId: string
  analyticAccountName: string
  companyName: string
  quantity: number
  amount: number
  financialAccount?: string
  journalItem?: string
  partner?: string
}

export type AccountType = 
  | 'Receivable' 
  | 'Payable' 
  | 'Bank and Cash' 
  | 'Current Assets' 
  | 'Fixed Assets' 
  | 'Current Liabilities' 
  | 'Non-current Liabilities' 
  | 'Equity' 
  | 'Income' 
  | 'Expense' 
  | 'Prepayments'

export interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  internalGroup: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  reconcile: boolean
  active: boolean
  companyId: CompanyId
  balance: number
  currency?: string
}

export interface AnalyticAccount {
  id: string
  code: string
  name: string
  companyId: CompanyId
  parentName?: string
  active: boolean
  totalDebits: number
  totalCredits: number
  balance: number
}

export interface ChequeRecord {
  id: string
  chequeNumber: string
  chequeDate: string
  payeeName: string
  bankName: string
  amount: number
  currency: string
  status: 'issued' | 'presented' | 'cleared' | 'bounced'
  clearanceDate?: string
  bounceReason?: string
  relatedPaymentId?: string
  relatedInvoiceId?: string
  companyId: CompanyId
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  user: string
  recordType: 'Invoice' | 'Vendor Bill' | 'Payment' | 'Journal Entry' | 'Chart of Accounts' | 'Lock Date' | 'Inventory Adjustment'
  recordId: string
  recordName: string
  fieldName: string
  oldValue: string
  newValue: string
  notes?: string
}

export interface CurrencyRate {
  currency: string
  symbol: string
  name: string
  rateToBase: number // e.g. 1 USD = 3.75 SAR -> rate is 3.75 or 0.2667 depending on standard
  lastUpdated: string
  active: boolean
}

export interface FiscalPeriodConfig {
  companyId: CompanyId
  fiscalYearStartMonth: number // 1 (January)
  periodLockDate: string // Hard lock: 2026-09-30
  fiscalYearLockDate: string // Soft lock: 2026-10-31
  retentionYears: number // 7 years default
  thresholdLevel1: number // e.g. 50,000 SAR
  thresholdLevel2: number // e.g. 250,000 SAR
}


// --- Inventory adjustments ---
export interface StockQuant {
  id: string
  companyId: CompanyId
  productCode: string
  productName: string
  category: string
  location: string
  lot?: string // Lot / serial number
  pack?: string // Package
  owner?: string
  uom: string
  onHand: number
  unitCost: number
}

export type AdjustmentReason = 'Physical count' | 'Damaged / scrapped' | 'Lost / theft' | 'Found / surplus' | 'Opening balance' | 'Other'

export interface InventoryAdjustmentLine {
  quantId: string
  productCode: string
  productName: string
  location: string
  lot?: string
  uom: string
  previousQty: number
  countedQty: number
  difference: number
  unitCost: number
}

export interface InventoryAdjustment {
  id: string
  reference: string
  companyId: CompanyId
  accountingDate: string
  appliedAt: string
  responsible: string
  reason: AdjustmentReason
  notes?: string
  lines: InventoryAdjustmentLine[]
  netValue: number
  journalEntryNumber: string
}
