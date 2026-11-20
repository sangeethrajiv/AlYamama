import { Injectable, inject } from '@angular/core';
import type {
  Account, AnalyticAccount, AnalyticItem, AuditLogEntry, AuditRecordType, Bill, ChequeRecord, CompanyId, CreditNoteOptions,
  FiscalPeriodConfig, Invoice, JournalEntry, Payment, PaymentAllocation,
} from '@erp/shared/contracts';
import { add, dec, gt, gte, lte, max, min, nowMinute, nowStamp, stamp4, sub, sum, todayIso, type Decimal } from '@erp/shared/utils';
import { AccountingApi, type CreditNoteResult, type PaymentAllocationRequest } from '../api/accounting.api';
import { ApiError } from '../api/api-error';
import { RequestContext } from '../api/api-context';
import { MockDb, copy } from './mock-db';
import { ensurePartner } from './mock-partner';

const FIELDS_INVOICE: Record<string, string> = {
  partner: 'Customer', customerVat: 'Customer VAT', category: 'Invoice type', dateInvoice: 'Invoice date', dateDue: 'Due date',
  paymentTerms: 'Payment terms', currency: 'Currency', project: 'Project', contactPerson: 'Contact person', salesperson: 'Salesperson',
  sourceDocument: 'Source document', reference: 'Reference', prNumber: 'PR number', poNumber: 'PO number', vendorProjectName: 'Vendor project',
  isSubscriptionInvoice: 'Subscription invoice', subscriptionFrequency: 'Frequency', subscriptionType: 'Subscription type',
  subscriptionStartDate: 'Start date', subscriptionEndDate: 'End date', amountTotal: 'Total', billingEmail: 'Billing email',
  advPercentage: 'Adv. percentage', poName: 'PO name', poDescription: 'PO description', contractAmount: 'PO total amount', progressiveStatus: 'PO status',
};
const FIELDS_BILL: Record<string, string> = {
  vendor: 'Vendor', supplierInvoiceNumber: 'Vendor reference', dateBill: 'Bill date', dateDue: 'Due date', paymentTerms: 'Payment terms',
  currency: 'Currency', amountTotal: 'Total',
};

const fmtVal = (v: unknown): string => (v === undefined || v === null || v === '' ? 'empty' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));
const isOpen = (s: string) => s === 'open' || s === 'in_payment';

@Injectable()
export class MockAccountingApi extends AccountingApi {
  private readonly db = inject(MockDb);
  private readonly ctx = inject(RequestContext);

  private get a() { return this.db.accounting; }
  private done() { this.db.touch(); }

  // ------------------------------------------------------------------ queries
  override async accounts(): Promise<Account[]> { return copy(this.a.accounts); }
  override async analyticAccounts(): Promise<AnalyticAccount[]> { return copy(this.a.analyticAccounts); }
  override async analyticItems(): Promise<AnalyticItem[]> { return copy(this.a.analyticItems); }
  override async invoices(): Promise<Invoice[]> { return copy(this.a.invoices); }
  override async bills(): Promise<Bill[]> { return copy(this.a.bills); }
  override async payments(): Promise<Payment[]> { return copy(this.a.payments); }
  override async journalEntries(): Promise<JournalEntry[]> { return copy(this.a.journalEntries); }
  override async cheques(): Promise<ChequeRecord[]> { return copy(this.a.cheques); }
  override async auditLogs(): Promise<AuditLogEntry[]> { return copy(this.a.auditLogs); }
  override async fiscalConfig(companyId: CompanyId): Promise<FiscalPeriodConfig> {
    return copy(this.a.fiscalConfig[companyId] ?? this.a.fiscalConfig['co_1']);
  }

  // ------------------------------------------------------------------ audit helpers
  private log(recordType: AuditRecordType, recordId: string, recordName: string, fieldName: string, oldValue: string, newValue: string, notes?: string): void {
    this.a.auditLogs = [{
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`, timestamp: nowStamp(), user: this.ctx.actorRole(),
      recordType, recordId, recordName, fieldName, oldValue, newValue, notes,
    }, ...this.a.auditLogs];
  }

  /** One audit row per changed field (old -> new); same-second rows group as one edit in the chatter. */
  private trackChanges<T extends object>(type: AuditRecordType, id: string, name: string, before: T, after: T, fields: Record<string, string>): void {
    const b = before as Record<string, unknown>;
    const x = after as Record<string, unknown>;
    const rows: [string, string, string][] = [];
    for (const [key, label] of Object.entries(fields)) if (fmtVal(b[key]) !== fmtVal(x[key])) rows.push([label, fmtVal(b[key]), fmtVal(x[key])]);
    const bl = (b['lines'] as unknown[] | undefined)?.length ?? 0;
    const al = (x['lines'] as unknown[] | undefined)?.length ?? 0;
    if (JSON.stringify(b['lines']) !== JSON.stringify(x['lines'])) rows.push(['Lines', `${bl} line(s), ${fmtVal(b['amountUntaxed'])} untaxed`, `${al} line(s), ${fmtVal(x['amountUntaxed'])} untaxed`]);
    rows.reverse().forEach(([label, from, to]) => this.log(type, id, name, `edit:${label}`, from, to));
  }

  private invoice(id: string): Invoice {
    const i = this.a.invoices.find(x => x.id === id);
    if (!i) throw ApiError.notFound('Invoice');
    return i;
  }
  private patchInvoice(id: string, p: Partial<Invoice>): Invoice {
    this.a.invoices = this.a.invoices.map(i => (i.id === id ? { ...i, ...p } : i));
    return this.invoice(id);
  }
  private bill(id: string): Bill {
    const b = this.a.bills.find(x => x.id === id);
    if (!b) throw ApiError.notFound('Vendor bill');
    return b;
  }
  private bump(accountCode: string, delta: Decimal): void {
    this.a.accounts = this.a.accounts.map(x => (x.code === accountCode ? { ...x, balance: add(x.balance, delta) } : x));
  }

  // ------------------------------------------------------------------ customer invoices
  override async saveInvoice(invoice: Invoice, options?: { post?: boolean }): Promise<Invoice> {
    const inv = copy(invoice);
    if (!inv.partner?.trim()) throw ApiError.validation([{ field: 'partner', message: 'Customer is required.' }]);
    ensurePartner(this.db, inv.partner, 'isCustomer', inv.customerVat, inv.customerAddress);
    const prev = this.a.invoices.find(i => i.id === inv.id);
    if (prev) {
      this.a.invoices = this.a.invoices.map(i => (i.id === inv.id ? inv : i));
      this.trackChanges('Invoice', inv.id, inv.number, prev, inv, FIELDS_INVOICE);
    } else {
      this.a.invoices = [inv, ...this.a.invoices];
      this.log('Invoice', inv.id, inv.number, 'create', '—', options?.post ? 'draft' : inv.state, 'Invoice created');
    }
    if (options?.post) this.postInternal(inv.id);
    this.done();
    return copy(this.invoice(inv.id));
  }

  override async postInvoice(id: string): Promise<Invoice> {
    this.postInternal(id);
    this.done();
    return copy(this.invoice(id));
  }

  /** Post validation: every invoice (cash included) goes to open; it becomes paid only when a payment is registered. */
  private postInternal(id: string): void {
    const target = this.invoice(id);
    const updated: Invoice = {
      ...target, state: 'open', residual: target.amountTotal, validatedBy: this.ctx.actorRole(), validatedAt: nowMinute(), approvalStatus: 'approved',
    };
    const t = Date.now();
    const je: JournalEntry = {
      id: `je_inv_${target.id}`, entryNumber: `${target.number}-JE`, companyId: target.companyId, entryDate: target.dateInvoice,
      journalId: 'jour_sale', journalName: 'Customer Invoices', reference: target.number, state: 'posted',
      narration: `Automated journal entry for customer invoice ${target.number} - ${target.partner}`, sourceDocument: target.number,
      lines: [
        { id: `jel_rec_${t}`, accountId: 'acc_105', accountCode: '110000', accountName: 'Trade Debtors / Accounts Receivable', partner: target.partner, label: `${target.number} Receivable`, debit: target.amountTotal, credit: '0.00' },
        { id: `jel_rev_${t}`, accountId: 'acc_401', accountCode: '400000', accountName: 'Hydraulic Cylinder Overhaul Revenue', label: 'Revenue recognition', debit: '0.00', credit: target.amountUntaxed, analyticAccountId: target.lines[0]?.analyticAccountId || 'ana_1' },
        { id: `jel_tax_${t}`, accountId: 'acc_203', accountCode: '220000', accountName: 'Output VAT 15%', label: '15% VAT on Sale', debit: '0.00', credit: target.amountTax },
      ],
    };
    // Inter-company rule: posting an invoice to an Al-Yamama entity auto-creates a vendor bill in the partner company
    if (target.partner.includes('Al-Yamama')) {
      const origin = this.a.companies.find(c => c.id === target.companyId);
      const icBill: Bill = {
        id: `bill_ic_${t}`, number: `BILL/2026/IC-${target.number.slice(-4)}`, supplierInvoiceNumber: target.number, companyId: 'co_2',
        vendor: origin?.name || 'Al-Yamama HQ', dateBill: target.dateInvoice, dateDue: target.dateDue, paymentTerms: target.paymentTerms,
        journalId: 'jour_purchase', currency: target.currency, currencyRate: target.currencyRate, lines: copy(target.lines),
        amountUntaxed: target.amountUntaxed, amountTax: target.amountTax, amountTotal: target.amountTotal, residual: target.amountTotal,
        state: 'open', approvalStatus: 'approved', type: 'in_invoice', interCompanyOrigin: `${target.number} (${origin?.code})`, attachmentsCount: 1,
      };
      this.a.bills = [icBill, ...this.a.bills];
      this.log('Vendor Bill', icBill.id, icBill.number, 'auto_intercompany', '—', 'open', `Auto-generated inter-company vendor bill in Company B from posted invoice ${target.number}`);
    }
    this.a.invoices = this.a.invoices.map(i => (i.id === target.id ? updated : i));
    this.a.journalEntries = [je, ...this.a.journalEntries];
    this.bump('110000', target.amountTotal);
    this.bump('220000', target.amountTax);
    this.log('Invoice', target.id, target.number, 'state', 'draft', updated.state, `Invoice confirmed and posted. Journal entry ${je.entryNumber} was created automatically.`);
  }

  override async cancelInvoice(id: string): Promise<Invoice> {
    const t = this.invoice(id);
    if (t.zatca) throw ApiError.businessRule('INVOICE_SUBMITTED_TO_ZATCA', 'Invoice cannot be cancelled', 'This invoice was submitted to ZATCA and cannot be cancelled. Create a credit note instead.');
    const out = this.patchInvoice(id, { state: 'cancel', residual: '0.00' });
    this.log('Invoice', t.id, t.number, 'state', t.state, 'cancel', 'Invoice cancelled and receivables cleared.');
    this.done();
    return copy(out);
  }

  override async convertToTaxInvoice(id: string): Promise<Invoice> {
    const t = this.invoice(id);
    const newSeq = `INV/2026/${stamp4()}`;
    const out = this.patchInvoice(id, { number: newSeq, category: 'credit', state: 'open', paymentTerms: '15 Days Net', dateDue: '2026-11-20' });
    this.log('Invoice', t.id, newSeq, 'convert_proforma', t.number, 'open', `Proforma invoice ${t.number} converted to official Tax Invoice ${newSeq}`);
    this.done();
    return copy(out);
  }

  override async createCreditNote(invoiceId: string, opts: CreditNoteOptions = { reason: 'Credit note', date: '2026-11-10', method: 'cancel' }): Promise<CreditNoteResult> {
    const orig = this.invoice(invoiceId);
    const stamp = stamp4();
    const reconcile = opts.method !== 'draft';
    const creditNote: Invoice = {
      ...copy(orig), id: `inv_cn_${Date.now()}`, number: `RND/2026/${stamp}`, type: 'out_refund', originInvoiceNumber: orig.number,
      creditNoteReason: opts.reason, reference: `Credit Note for ${orig.number}`, dateInvoice: opts.date, state: reconcile ? 'paid' : 'draft',
      residual: '0.00', approvalStatus: reconcile ? 'approved' : 'not_required', zatca: undefined,
    };
    this.a.invoices = [creditNote, ...this.a.invoices.map(i => {
      if (i.id !== orig.id || !reconcile) return i;
      const residual = max('0.00', sub(i.residual, orig.amountTotal));
      return { ...i, residual, state: (gt(residual, '0') ? 'in_payment' : 'paid') as Invoice['state'] };
    })];
    this.log('Invoice', creditNote.id, creditNote.number, 'create_credit_note', '—', creditNote.state, `Credit note for ${orig.number} (${opts.reason}). ${reconcile ? 'Posted and reconciled against the invoice.' : 'Saved as draft.'}`);
    this.log('Invoice', orig.id, orig.number, 'create_credit_note', '—', creditNote.state, `Credit note ${creditNote.number} issued: ${opts.reason}.`);
    if (reconcile) {
      const left = max('0.00', sub(orig.residual, orig.amountTotal));
      this.log('Invoice', orig.id, orig.number, 'state', orig.state, gt(left, '0') ? 'in_payment' : 'paid', `Credit note ${creditNote.number} reconciled against this invoice.`);
    }
    let redraft: Invoice | undefined;
    if (opts.method === 'modify') {
      redraft = {
        ...copy(orig), id: `inv_mod_${Date.now()}`, number: `DRAFT/${stamp}`, state: 'draft', residual: orig.amountTotal, dateInvoice: opts.date,
        validatedBy: undefined, validatedAt: undefined, approvalStatus: 'not_required', zatca: undefined, reference: `Re-issued from ${orig.number}`,
      };
      this.a.invoices = [redraft, ...this.a.invoices];
      this.log('Invoice', redraft.id, redraft.number, 'create', '—', 'draft', `Draft re-issued from ${orig.number} after credit note ${creditNote.number}.`);
    }
    this.done();
    return { creditNote: copy(creditNote), redraft: redraft && copy(redraft) };
  }

  /** Renew a proforma: turns it into a real customer invoice (draft) and marks the proforma as invoiced. */
  override async renewProforma(id: string): Promise<Invoice> {
    const orig = this.invoice(id);
    if (orig.linkedInvoice) throw ApiError.businessRule('PROFORMA_ALREADY_INVOICED', 'Already invoiced', `Proforma ${orig.number} already has invoice ${orig.linkedInvoice}.`);
    const copyInv: Invoice = {
      ...copy(orig), id: `inv_from_pro_${Date.now()}`, number: `INV/2026/${stamp4()}`, category: 'credit', state: 'draft', residual: orig.amountTotal,
      dateInvoice: '2026-11-10', dateDue: '2026-11-10', sourceDocument: orig.number, sourceProformaId: orig.id, reference: `From proforma ${orig.number}`,
      linkedInvoice: undefined, billingEmail: undefined, advPercentage: undefined, validatedBy: undefined, validatedAt: undefined,
      approvalStatus: 'not_required', zatca: undefined, lines: orig.lines.map((l, i) => ({ ...l, id: `ln_inv_${Date.now()}_${i}` })),
    };
    this.a.invoices = [copyInv, ...this.a.invoices.map(i => (i.id === orig.id ? { ...i, linkedInvoice: copyInv.number } : i))];
    this.log('Invoice', orig.id, orig.number, 'renew', 'pending payment', 'invoiced', `Invoice ${copyInv.number} created from this proforma.`);
    this.log('Invoice', copyInv.id, copyInv.number, 'create', '—', 'draft', `Created from proforma ${orig.number}.`);
    this.done();
    return copy(copyInv);
  }

  /** Simulated ZATCA submission: validates, signs a local hash, chains the document. Not a real e-invoicing call. */
  override async submitZatca(id: string): Promise<Invoice> {
    const inv = this.invoice(id);
    if (inv.zatca) return copy(inv);
    const bytes = new TextEncoder().encode(JSON.stringify({ n: inv.number, t: inv.amountTotal, d: inv.dateInvoice, p: inv.partner }));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const invoiceHash = btoa(String.fromCharCode(...new Uint8Array(digest)));
    const chainIndex = Math.max(0, ...this.a.invoices.map(i => i.zatca?.chainIndex ?? 0)) + 1;
    const zatca = { status: 'cleared' as const, uuid: crypto.randomUUID(), invoiceHash, chainIndex, submittedAt: nowStamp(), submittedBy: this.ctx.actorRole(), message: 'Invoice cleared (simulated)' };
    const out = this.patchInvoice(id, { zatca });
    this.log('Invoice', inv.id, inv.number, 'zatca_submit', 'not submitted', 'cleared', `Submitted to ZATCA. Chain index ${chainIndex}, UUID ${zatca.uuid}.`);
    this.done();
    return copy(out);
  }

  override async unreconcile(invoiceId: string, paymentId: string): Promise<void> {
    const inv = this.invoice(invoiceId);
    const pay = this.a.payments.find(p => p.id === paymentId);
    if (!pay) throw ApiError.notFound('Payment');
    const amt = pay.allocations?.find(a => a.invoiceId === invoiceId)?.amount ?? min(pay.amount, inv.amountTotal);
    const residual = min(inv.amountTotal, add(inv.residual, amt));
    this.a.invoices = this.a.invoices.map(i => (i.id === invoiceId ? { ...i, residual, state: gte(residual, i.amountTotal) ? 'open' : 'in_payment' } : i));
    this.a.payments = this.a.payments.map(p => {
      if (p.id !== paymentId) return p;
      const matched = (p.matchedInvoiceIds || []).filter(x => x !== invoiceId);
      return { ...p, matchedInvoiceIds: matched, allocations: (p.allocations || []).filter(a => a.invoiceId !== invoiceId), state: matched.length ? p.state : 'posted' };
    });
    this.log('Invoice', inv.id, inv.number, 'unreconcile', inv.state, gte(residual, inv.amountTotal) ? 'open' : 'in_payment', `Payment ${pay.paymentNumber} unreconciled; ${amt} returned to the open balance.`);
    this.done();
  }

  // ------------------------------------------------------------------ vendor bills
  override async saveBill(bill: Bill, options?: { post?: boolean }): Promise<Bill> {
    const b = copy(bill);
    if (!b.vendor?.trim()) throw ApiError.validation([{ field: 'vendor', message: 'Vendor is required.' }]);
    ensurePartner(this.db, b.vendor, 'isVendor', b.vendorVat);
    const prev = this.a.bills.find(x => x.id === b.id);
    if (prev) {
      this.a.bills = this.a.bills.map(x => (x.id === b.id ? b : x));
      this.trackChanges('Vendor Bill', b.id, b.number, prev, b, FIELDS_BILL);
    } else {
      this.a.bills = [b, ...this.a.bills];
      this.log('Vendor Bill', b.id, b.number, 'save_bill', '—', options?.post ? 'open' : b.state, `Vendor bill created with supplier ref ${b.supplierInvoiceNumber}`);
    }
    this.done();
    return copy(this.bill(b.id));
  }

  override async approveBill(id: string): Promise<Bill> {
    const t = this.bill(id);
    this.a.bills = this.a.bills.map(b => (b.id === id ? { ...b, approvalStatus: 'approved', state: 'open' } : b));
    this.log('Vendor Bill', t.id, t.number, 'approvalStatus', t.approvalStatus, 'approved', `Approved by ${this.ctx.actorRole()}`);
    this.done();
    return copy(this.bill(id));
  }

  override async rejectBill(id: string, reason: string): Promise<Bill> {
    const t = this.bill(id);
    this.a.bills = this.a.bills.map(b => (b.id === id ? { ...b, approvalStatus: 'rejected', state: 'draft', approvalRejectReason: reason } : b));
    this.log('Vendor Bill', t.id, t.number, 'approvalStatus', t.approvalStatus, 'rejected', `Rejected with reason: "${reason}" (Returned to Draft state per §19.1 APR-006)`);
    this.done();
    return copy(this.bill(id));
  }

  // ------------------------------------------------------------------ payments and reconciliation
  override async savePayment(input: Payment, alloc: PaymentAllocationRequest = {}): Promise<Payment> {
    const payment: Payment = { ...copy(input), id: input.id || `pay_${Date.now()}` };
    if (!gt(payment.amount, '0')) throw ApiError.validation([{ field: 'amount', message: 'Amount must be greater than zero.' }]);
    const allocInv = alloc.invoiceId ? this.a.invoices.find(i => i.id === alloc.invoiceId) : undefined;
    const allocBill = alloc.billId ? this.a.bills.find(b => b.id === alloc.billId) : undefined;
    const stored: Payment = allocInv && alloc.invoiceId ? { ...payment, allocations: [{ invoiceId: alloc.invoiceId, amount: min(payment.amount, allocInv.residual) }] } : payment;
    this.a.payments = [stored, ...this.a.payments];

    const t = Date.now();
    const customer = payment.partnerType === 'customer';
    const je: JournalEntry = {
      id: `je_pay_${payment.id}`, entryNumber: `${payment.paymentNumber}-JE`, companyId: payment.companyId, entryDate: payment.paymentDate,
      journalId: payment.journalId, journalName: payment.journalName, reference: payment.paymentNumber, state: 'posted', narration: payment.memo, sourceDocument: payment.paymentNumber,
      lines: customer
        ? [
            { id: `jel_${t}_1`, accountId: payment.journalId, accountCode: '101000', accountName: payment.journalName, label: 'Receipt in Bank', debit: payment.amountBaseCurrency, credit: '0.00' },
            { id: `jel_${t}_2`, accountId: 'acc_105', accountCode: '110000', accountName: 'Trade Debtors', partner: payment.partner, label: `Settlement for ${payment.memo}`, debit: '0.00', credit: payment.amountBaseCurrency },
          ]
        : [
            { id: `jel_${t}_3`, accountId: 'acc_201', accountCode: '210000', accountName: 'Trade Creditors / Accounts Payable', partner: payment.partner, label: `Disbursement for ${payment.memo}`, debit: payment.amountBaseCurrency, credit: '0.00' },
            { id: `jel_${t}_4`, accountId: payment.journalId, accountCode: '101000', accountName: payment.journalName, label: 'Bank disbursement', debit: '0.00', credit: payment.amountBaseCurrency },
          ],
    };
    this.a.journalEntries = [je, ...this.a.journalEntries];

    const paid = (doc: Invoice | Bill) => {
      const left = max('0.00', sub(doc.residual, payment.amount));
      return { left, state: (gt(left, '0') ? 'in_payment' : 'paid') as Invoice['state'] };
    };
    if (allocInv) {
      const { left, state } = paid(allocInv);
      this.log('Invoice', allocInv.id, allocInv.number, 'payment', allocInv.state, state, `Payment ${payment.paymentNumber} of ${payment.amount} ${allocInv.currency} registered via ${payment.journalName}. Balance due ${left}.`);
      this.a.invoices = this.a.invoices.map(i => (i.id === allocInv.id ? { ...i, residual: left, state } : i));
    }
    if (allocBill) {
      const { left, state } = paid(allocBill);
      this.log('Vendor Bill', allocBill.id, allocBill.number, 'payment', allocBill.state, state, `Payment ${payment.paymentNumber} of ${payment.amount} ${allocBill.currency} registered via ${payment.journalName}. Balance due ${left}.`);
      this.a.bills = this.a.bills.map(b => (b.id === allocBill.id ? { ...b, residual: left, state } : b));
    }
    if (payment.paymentMethod === 'Corporate Cheque') {
      const chq: ChequeRecord = {
        id: `chq_${Date.now()}`, chequeNumber: payment.chequeNumber || `CHQ-${100000 + Math.floor(Math.random() * 900000)}`, chequeDate: payment.paymentDate,
        payeeName: payment.partner, bankName: 'Riyad Bank', amount: payment.amount, currency: payment.currency, status: 'issued', relatedPaymentId: payment.id, companyId: payment.companyId,
      };
      this.a.cheques = [chq, ...this.a.cheques];
    }
    // Bank balance
    this.a.accounts = this.a.accounts.map(x => (x.id === payment.journalId ? { ...x, balance: customer ? add(x.balance, payment.amountBaseCurrency) : sub(x.balance, payment.amountBaseCurrency) } : x));
    this.log('Payment', payment.id, payment.paymentNumber, 'state', 'draft', 'posted', `Payment voucher confirmed for SAR ${payment.amount}. Linked JE ${je.entryNumber} posted.`);
    this.done();
    return copy(stored);
  }

  override async reconcile(invoiceId: string, paymentId: string, writeOff: Decimal = '0.00'): Promise<void> {
    const inv = this.invoice(invoiceId);
    const pay = this.a.payments.find(p => p.id === paymentId);
    if (!pay) throw ApiError.notFound('Payment');
    const residual = max('0.00', sub(sub(inv.residual, pay.amount), writeOff));
    const state: Invoice['state'] = gt(residual, '0') ? 'in_payment' : 'paid';
    this.a.invoices = this.a.invoices.map(i => (i.id === invoiceId ? { ...i, residual, state } : i));
    this.a.payments = this.a.payments.map(p => p.id === paymentId
      ? { ...p, state: 'reconciled', matchedInvoiceIds: [...(p.matchedInvoiceIds || []), invoiceId], allocations: [...(p.allocations || []), { invoiceId, amount: min(pay.amount, inv.residual) }] }
      : p);
    this.log('Invoice', inv.id, inv.number, 'reconciliation', inv.state, state, `Payment ${pay.paymentNumber} reconciled against this invoice. Balance due ${residual}.`);
    this.log('Payment', pay.id, pay.paymentNumber, 'reconciliation', 'posted', 'reconciled', `Matched and reconciled against invoice ${inv.number}. Write-off applied: SAR ${writeOff}. Residual updated to ${residual}.`);
    this.done();
  }

  override async bulkReconcile(paymentId: string, allocations: PaymentAllocation[]): Promise<void> {
    const pay = this.a.payments.find(p => p.id === paymentId);
    if (!pay) throw ApiError.notFound('Payment');
    if (allocations.length === 0) return;
    const byId = new Map(allocations.map(a => [a.invoiceId, a.amount]));
    const before = new Map(this.a.invoices.map(i => [i.id, i]));
    this.a.invoices = this.a.invoices.map(i => {
      const amt = byId.get(i.id);
      if (!amt) return i;
      const residual = max('0.00', sub(i.residual, amt));
      return { ...i, residual, state: gt(residual, '0') ? 'in_payment' : 'paid' };
    });
    const total = sum(allocations.map(a => a.amount));
    const fully = gte(total, sub(pay.amount, '0.005'));
    this.a.payments = this.a.payments.map(p => p.id === paymentId
      ? { ...p, state: fully ? 'reconciled' : 'posted', matchedInvoiceIds: [...(p.matchedInvoiceIds || []), ...allocations.map(a => a.invoiceId)], allocations: [...(p.allocations || []), ...copy(allocations)] }
      : p);
    allocations.forEach(a => {
      const inv = before.get(a.invoiceId);
      if (!inv) return;
      const left = max('0.00', sub(inv.residual, a.amount));
      this.log('Invoice', inv.id, inv.number, 'reconciliation', inv.state, gt(left, '0') ? 'in_payment' : 'paid', `Bulk payment ${pay.paymentNumber} applied ${a.amount}. Balance due ${left}.`);
    });
    this.log('Payment', pay.id, pay.paymentNumber, 'bulk_reconciliation', 'posted', fully ? 'reconciled' : 'posted',
      `Bulk payment matched against ${allocations.length} invoice(s): ${allocations.map(a => before.get(a.invoiceId)?.number).join(', ')}. Total allocated ${total}.`);
    this.done();
  }

  // ------------------------------------------------------------------ general ledger
  override async saveJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
    const debit = sum(entry.lines.map(l => l.debit));
    const credit = sum(entry.lines.map(l => l.credit));
    if (!(debit === credit) || !gt(debit, '0')) throw ApiError.businessRule('JOURNAL_UNBALANCED', 'Entry is not balanced', `Debits ${debit} and credits ${credit} must be equal and greater than zero.`);
    const prev = entry.id ? this.a.journalEntries.find(e => e.id === entry.id) : undefined;
    // Posted entries are immutable; corrections use a reversal (section 8.1)
    if (prev && prev.state === 'posted') throw ApiError.businessRule('JOURNAL_POSTED_IMMUTABLE', 'Posted entry cannot be edited', `${prev.entryNumber} is posted. Reverse it to correct it.`);
    const stored = { ...copy(entry), id: prev ? prev.id : entry.id || `je_${Date.now()}` };
    this.a.journalEntries = prev ? this.a.journalEntries.map(e => (e.id === stored.id ? stored : e)) : [stored, ...this.a.journalEntries];
    if (stored.state === 'posted') this.log('Journal Entry', stored.id, stored.entryNumber, 'state', 'draft', 'posted', `Manual double-entry JE posted. Lines: ${stored.lines.length}. Balanced debits/credits verified.`);
    else this.log('Journal Entry', stored.id, stored.entryNumber, 'create', '—', 'draft', `Draft journal entry saved. Lines: ${stored.lines.length}.`);
    this.done();
    return copy(stored);
  }

  override async reverseJournalEntry(id: string): Promise<JournalEntry> {
    const orig = this.a.journalEntries.find(e => e.id === id);
    if (!orig) throw ApiError.notFound('Journal entry');
    if (orig.isReversed) throw ApiError.businessRule('JOURNAL_ALREADY_REVERSED', 'Already reversed', `${orig.entryNumber} has already been reversed.`);
    const counter: JournalEntry = {
      id: `je_rev_${Date.now()}`, entryNumber: `REV/${orig.entryNumber.replace(/[^0-9]/g, '') || stamp4()}`, companyId: orig.companyId, entryDate: '2026-11-06',
      journalId: orig.journalId, journalName: orig.journalName, reference: `Reversal of ${orig.entryNumber}`, state: 'posted', narration: `Reversal entry counterbalancing ${orig.entryNumber}`,
      lines: orig.lines.map(l => ({ ...copy(l), id: `rev_jel_${Date.now()}_${Math.random()}`, debit: l.credit, credit: l.debit, label: `Reversal: ${l.label}` })),
    };
    this.a.journalEntries = [counter, ...this.a.journalEntries.map(e => (e.id === id ? { ...e, isReversed: true, reversedByEntryId: counter.id } : e))];
    this.log('Journal Entry', counter.id, counter.entryNumber, 'reverse_entry', orig.entryNumber, 'posted', `Reversal entry posted counterbalancing ${orig.entryNumber}`);
    this.done();
    return copy(counter);
  }

  override async saveAnalyticItem(item: AnalyticItem): Promise<AnalyticItem> {
    const stored = { ...copy(item), id: item.id || `ai_${Date.now()}` };
    this.a.analyticItems = this.a.analyticItems.some(x => x.id === stored.id) ? this.a.analyticItems.map(x => (x.id === stored.id ? stored : x)) : [stored, ...this.a.analyticItems];
    this.done();
    return copy(stored);
  }

  // ------------------------------------------------------------------ banking
  override async clearCheque(id: string): Promise<void> {
    this.a.cheques = this.a.cheques.map(c => (c.id === id ? { ...c, status: 'cleared', clearanceDate: todayIso() } : c));
    this.done();
  }

  override async bounceCheque(id: string, reason: string): Promise<void> {
    const target = this.a.cheques.find(c => c.id === id);
    if (!target) throw ApiError.notFound('Cheque');
    this.a.cheques = this.a.cheques.map(c => (c.id === id ? { ...c, status: 'bounced', bounceReason: reason } : c));
    if (target.relatedPaymentId) this.a.payments = this.a.payments.map(p => (p.id === target.relatedPaymentId ? { ...p, state: 'cancelled' } : p));
    this.log('Payment', id, target.chequeNumber, 'cheque_bounced', target.status, 'bounced', `Cheque marked bounced: "${reason}". Reversed payment voucher and recorded bank return charge.`);
    this.done();
  }

  override async recordDirectBankTransaction(journalId: string, amount: Decimal, isCharge: boolean, memo: string): Promise<JournalEntry> {
    if (!gt(amount, '0')) throw ApiError.validation([{ field: 'amount', message: 'Amount must be greater than zero.' }]);
    this.a.accounts = this.a.accounts.map(x => (x.id === journalId ? { ...x, balance: isCharge ? sub(x.balance, amount) : add(x.balance, amount) } : x));
    const t = Date.now();
    const je: JournalEntry = {
      id: `je_bank_${t}`, entryNumber: `BNK/2026/${stamp4()}`, companyId: this.ctx.companyId(), entryDate: '2026-11-06', journalId, journalName: 'Bank Journal',
      reference: memo, state: 'posted', narration: memo,
      lines: isCharge
        ? [
            { id: `jel_fee_${t}`, accountId: 'acc_505', accountCode: '504000', accountName: 'Bank Charges & Gateway Fees', label: memo, debit: amount, credit: '0.00', analyticAccountId: 'ana_1' },
            { id: `jel_bnk_${t}`, accountId: journalId, accountCode: '101000', accountName: 'Bank Account', label: memo, debit: '0.00', credit: amount },
          ]
        : [
            { id: `jel_bnk2_${t}`, accountId: journalId, accountCode: '101000', accountName: 'Bank Account', label: memo, debit: amount, credit: '0.00' },
            { id: `jel_inc_${t}`, accountId: 'acc_404', accountCode: '490000', accountName: 'Interest & Miscellaneous Income', label: memo, debit: '0.00', credit: amount, analyticAccountId: 'ana_1' },
          ],
    };
    this.a.journalEntries = [je, ...this.a.journalEntries];
    this.log('Journal Entry', je.id, je.entryNumber, 'direct_bank_tx', '—', 'posted', `Direct bank transaction: ${memo} (SAR ${amount}) recorded.`);
    this.done();
    return copy(je);
  }

  // ------------------------------------------------------------------ fiscal control
  override async advanceLockDate(companyId: CompanyId, hardLock: string, softLock: string): Promise<FiscalPeriodConfig> {
    const cur = this.a.fiscalConfig[companyId] ?? this.a.fiscalConfig['co_1'];
    if (lte(dec(hardLock.replace(/-/g, ''), 0), dec(cur.periodLockDate.replace(/-/g, ''), 0)) && hardLock !== cur.periodLockDate) {
      throw ApiError.businessRule('LOCK_DATE_BACKWARDS', 'Lock date cannot move backwards', `The hard lock date can only advance beyond ${cur.periodLockDate}.`);
    }
    this.a.fiscalConfig = { ...this.a.fiscalConfig, [companyId]: { ...cur, periodLockDate: hardLock, fiscalYearLockDate: softLock } };
    const name = this.a.companies.find(c => c.id === companyId)?.name;
    this.log('Lock Date', companyId, `${name} Lock Dates`, 'period_lock_date', cur.periodLockDate, hardLock, `Hard lock date advanced post closing checklist verification. Soft lock updated to ${softLock} (FY-006 / FY-011).`);
    this.done();
    return copy(this.a.fiscalConfig[companyId]);
  }

  override async postNote(recordType: AuditRecordType, recordId: string, recordName: string, text: string): Promise<void> {
    this.log(recordType, recordId, recordName, 'note', '', '', text);
    this.done();
  }
}
void isOpen;
