import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiError } from '@erp/web/api-client';
import { CompanyContext } from '@erp/web/core';
import { DECIMAL_RE } from '@erp/web/metadata-forms';
import { AmountPipe, DialogFrameComponent, ErrorBannerComponent, ToastService, I18n } from '@erp/web/ui';
import type { Bill, Invoice, Payment, PaymentMethod } from '@erp/shared/contracts';
import { dec, gt, todayIso } from '@erp/shared/utils';
import { startWith } from 'rxjs';
import { AccountingStore } from '../data/accounting.store';

export interface PaymentDialogData { type?: 'customer' | 'supplier'; invoice?: Invoice; bill?: Bill }

/** Register a customer receipt or vendor payment. Opened from a document it asks only for the essentials. */
@Component({
  selector: 'erp-payment-dialog',
  imports: [ReactiveFormsModule, TranslocoPipe, DialogFrameComponent, ErrorBannerComponent, AmountPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <erp-dialog-frame [title]="(customer ? 'accounting.payment.registerReceipt' : 'accounting.payment.registerPayment') | transloco" [subtitle]="'accounting.payment.voucher' | transloco">
      <form [formGroup]="form" class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-xs" (ngSubmit)="save()">
        <erp-error-banner [text]="error()" />
        @if (compact) {
          <p class="text-slate-500">{{ (customer ? 'accounting.payment.settling' : 'accounting.payment.paying') | transloco }} <b class="font-mono text-slate-800">{{ doc?.number }}</b> · {{ 'accounting.payment.balanceDue' | transloco }} <b class="font-mono">{{ docResidual() | erpAmount: doc?.currency }}</b></p>
        }
        @if (!compact) {
          <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ (customer ? 'accounting.payment.customer' : 'accounting.payment.vendor') | transloco }} *</span>
            <input formControlName="partner" class="erp-input" [attr.list]="customer ? 'dl-pay-customers' : 'dl-pay-vendors'" /></label>
          <datalist id="dl-pay-customers">@for (n of customerNames(); track n) { <option [value]="n"></option> }</datalist>
          <datalist id="dl-pay-vendors">@for (n of vendorNames(); track n) { <option [value]="n"></option> }</datalist>
        }
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.amount' | transloco }} *</span><input formControlName="amount" inputmode="decimal" class="erp-input text-end font-mono text-sm font-bold" (blur)="norm()" /></label>
          <label class="block"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.date' | transloco }} *</span><input type="date" formControlName="paymentDate" class="erp-input" /></label>
          <label class="block sm:col-span-2"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.journal' | transloco }} *</span>
            <select formControlName="journalId" class="erp-input">@for (j of journals(); track j.id) { <option [value]="j.id">{{ j.name }} ({{ j.code }})</option> }</select></label>
          @if (!compact) {
            <label class="block sm:col-span-2"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.method' | transloco }} *</span>
              <select formControlName="paymentMethod" class="erp-input"><option value="Bank Transfer">{{ 'accounting.payment.methods.bank' | transloco }}</option><option value="Mada Debit">{{ 'accounting.payment.methods.mada' | transloco }}</option><option value="Corporate Cheque">{{ 'accounting.payment.methods.cheque' | transloco }}</option><option value="Cash">{{ 'accounting.payment.methods.cash' | transloco }}</option></select></label>
            @if (isCheque()) {
              <div class="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2 sm:grid-cols-2">
                <label class="block"><span class="mb-1 block font-bold text-amber-900">{{ 'accounting.payment.chequeNumber' | transloco }} *</span><input formControlName="chequeNumber" class="erp-input font-mono" /></label>
                <label class="block"><span class="mb-1 block font-bold text-amber-900">{{ 'accounting.payment.draweeBank' | transloco }}</span><input formControlName="chequeBank" class="erp-input" /></label>
              </div>
            }
          }
          <label class="block sm:col-span-2"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.memo' | transloco }}</span><input formControlName="memo" class="erp-input" /></label>
          @if (!compact && customer) {
            <label class="block sm:col-span-2"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.allocateInvoice' | transloco }}</span>
              <select formControlName="invoiceId" class="erp-input"><option value="">{{ 'accounting.payment.unallocatedCredit' | transloco }}</option>@for (i of openInvoices(); track i.id) { <option [value]="i.id">{{ i.number }} — {{ i.partner }} ({{ i.residual | erpAmount: i.currency }})</option> }</select></label>
          }
          @if (!compact && !customer) {
            <label class="block sm:col-span-2"><span class="mb-1 block font-bold text-slate-600">{{ 'accounting.payment.allocateBill' | transloco }}</span>
              <select formControlName="billId" class="erp-input"><option value="">{{ 'accounting.payment.unallocatedDebit' | transloco }}</option>@for (b of openBills(); track b.id) { <option [value]="b.id">{{ b.number }} — {{ b.vendor }} ({{ b.residual | erpAmount: b.currency }})</option> }</select></label>
          }
        </div>
      </form>
      <div footer class="contents">
        <button type="button" class="erp-btn-ghost" (click)="ref.close()">{{ 'common.cancel' | transloco }}</button>
        <button type="button" class="erp-btn-primary" [disabled]="busy()" (click)="save()">{{ 'accounting.payment.confirm' | transloco }}</button>
      </div>
    </erp-dialog-frame>`,
})
export class PaymentDialogComponent {
  protected readonly data = inject<PaymentDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Payment>>(DialogRef);
  private readonly store = inject(AccountingStore);
  private readonly company = inject(CompanyContext);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18n);
  private readonly toast = inject(ToastService);

  protected readonly customer = this.data.invoice ? true : this.data.bill ? false : (this.data.type ?? 'customer') === 'customer';
  protected readonly compact = !!(this.data.invoice || this.data.bill);
  protected readonly doc = this.data.invoice ?? this.data.bill;
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly journals = computed(() => this.store.accounts().filter(a => a.type === 'Bank and Cash'));
  protected readonly openInvoices = computed(() => this.store.invoices().filter(i => i.state === 'open' || i.state === 'in_payment'));
  protected readonly openBills = computed(() => this.store.bills().filter(b => b.state === 'open' || b.state === 'in_payment'));
  protected readonly customerNames = computed(() => [...new Set(this.store.invoices().map(i => i.partner))]);
  protected readonly vendorNames = computed(() => [...new Set(this.store.bills().map(b => b.vendor))]);
  protected readonly docResidual = () => this.doc?.residual ?? '0.00';

  protected readonly form = this.fb.nonNullable.group({
    partner: [this.data.invoice?.partner ?? this.data.bill?.vendor ?? '', Validators.required],
    paymentDate: todayIso(),
    amount: [this.data.invoice?.residual ?? this.data.bill?.residual ?? '0.00', [Validators.required, Validators.pattern(DECIMAL_RE)]],
    journalId: this.store.accounts().find(a => a.type === 'Bank and Cash')?.id ?? 'acc_101',
    paymentMethod: 'Bank Transfer' as PaymentMethod,
    memo: this.data.invoice ? `Settlement for ${this.data.invoice.number}` : this.data.bill ? `Payment for ${this.data.bill.number} (${this.data.bill.supplierInvoiceNumber})` : this.i18n.tr('accounting.payment.defaultMemo'),
    chequeNumber: '', chequeBank: 'Riyad Bank', invoiceId: this.data.invoice?.id ?? '', billId: this.data.bill?.id ?? '',
  });
  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(null)), { initialValue: null });
  protected readonly isCheque = computed(() => { this.value(); return this.form.controls.paymentMethod.value === 'Corporate Cheque'; });
  protected norm(): void { const c = this.form.controls.amount; if (DECIMAL_RE.test(c.value)) c.setValue(dec(c.value), { emitEvent: false }); }

  protected async save(): Promise<void> {
    this.error.set('');
    const v = this.form.getRawValue();
    // PAY-007: a payment of zero is not allowed
    if (!DECIMAL_RE.test(v.amount) || !gt(v.amount, '0')) return this.error.set(this.i18n.tr('accounting.payment.err.amount'));
    if (!v.partner.trim()) return this.error.set(this.i18n.tr('accounting.payment.err.partner'));
    if (!this.compact && v.paymentMethod === 'Corporate Cheque' && !v.chequeNumber.trim()) return this.error.set(this.i18n.tr('accounting.payment.err.cheque'));
    const journal = this.journals().find(j => j.id === v.journalId) ?? this.journals()[0];
    const stamp = 1000 + Math.floor(Math.random() * 9000);
    const cheque = !this.compact && v.paymentMethod === 'Corporate Cheque';
    const payment: Payment = {
      id: `pay_${Date.now()}`, paymentNumber: `PAY/2026/${stamp}`, companyId: this.company.activeId(), partner: v.partner.trim(), partnerType: this.customer ? 'customer' : 'supplier',
      paymentDate: v.paymentDate, journalId: journal.id, journalName: journal.name, amount: dec(v.amount), currency: 'SAR', currencyRate: '1.000000', amountBaseCurrency: dec(v.amount),
      memo: cheque && v.chequeNumber ? `${v.memo} (Cheque #${v.chequeNumber} - ${v.chequeBank})` : v.memo,
      paymentMethod: this.compact ? (/cash/i.test(journal.name) ? 'Cash' : 'Bank Transfer') : v.paymentMethod, state: 'posted', matchedInvoiceIds: v.invoiceId ? [v.invoiceId] : [],
      chequeNumber: cheque ? v.chequeNumber : undefined,
    };
    this.busy.set(true);
    try {
      const saved = await this.store.api.savePayment(payment, { invoiceId: v.invoiceId || undefined, billId: v.billId || undefined });
      this.toast.success(this.i18n.tr('accounting.payment.recorded', { n: saved.paymentNumber }));
      this.ref.close(saved);
    } catch (e) { this.error.set(e instanceof ApiError ? (e.problem.detail ?? e.problem.title) : this.i18n.tr('common.errorGeneric')); }
    finally { this.busy.set(false); }
  }
}
